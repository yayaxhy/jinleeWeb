-- Original-table rollout. No wallet balances, legacy amounts, or historical
-- receipts are rewritten here. Deploy this before clients generated with the
-- new column; Prisma default record selection includes nullable columns too.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

-- The withdrawn, separate-ledger proposal was confirmed unapplied on the
-- configured target. Never silently alter an environment that applied it.
DO $$
BEGIN
  IF to_regclass('"WalletLedgerEntry"') IS NOT NULL THEN
    RAISE EXCEPTION 'transaction_delta_prior_ledger_requires_review';
  END IF;
END;
$$;

ALTER TABLE "IndividualTransaction" ADD COLUMN "deltaAmount" DECIMAL(19,4);

ALTER TABLE "IndividualTransaction"
  ADD CONSTRAINT "IndividualTransaction_deltaAmount_consistent" CHECK (
    "deltaAmount" IS NULL OR (
      "deltaAmount"::TEXT <> 'NaN' AND
      "balanceBefore"::TEXT <> 'NaN' AND
      "balanceAfter"::TEXT <> 'NaN' AND
      "deltaAmount" = "balanceAfter" - "balanceBefore"
    )
  ) NOT VALID;

COMMENT ON COLUMN "IndividualTransaction"."deltaAmount" IS
  'Signed wallet change = balanceAfter - balanceBefore. NULL means historical value not yet backfilled. amountChange retains its existing meaning.';

CREATE FUNCTION individual_transaction_set_delta_amount()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  actual_delta NUMERIC;
  source_balances_changed BOOLEAN := FALSE;
BEGIN
  IF NEW."balanceBefore"::TEXT = 'NaN' OR NEW."balanceAfter"::TEXT = 'NaN' THEN
    RAISE EXCEPTION 'transaction_delta_non_finite_balance' USING ERRCODE = '23514';
  END IF;
  actual_delta := NEW."balanceAfter" - NEW."balanceBefore";
  IF TG_OP = 'UPDATE' THEN
    source_balances_changed := NEW."balanceBefore" IS DISTINCT FROM OLD."balanceBefore" OR
                               NEW."balanceAfter" IS DISTINCT FROM OLD."balanceAfter";
    -- An old writer can correct balance facts without knowing the new column.
    -- Recompute its unchanged prior delta instead of rejecting that correction.
    IF source_balances_changed AND NEW."deltaAmount" IS NOT DISTINCT FROM OLD."deltaAmount" THEN
      NEW."deltaAmount" := actual_delta;
    END IF;
  END IF;
  IF NEW."deltaAmount" IS NULL THEN
    NEW."deltaAmount" := actual_delta;
  ELSIF NEW."deltaAmount"::TEXT = 'NaN' OR NEW."deltaAmount" <> actual_delta THEN
    RAISE EXCEPTION 'transaction_delta_amount_mismatch' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

-- Identity merges and other non-monetary edits do not implicitly backfill an
-- old row. Direct SQL, createMany and old application binaries are covered.
CREATE TRIGGER "IndividualTransaction_set_deltaAmount"
  BEFORE INSERT OR UPDATE OF "balanceBefore", "balanceAfter", "deltaAmount"
  ON "IndividualTransaction"
  FOR EACH ROW EXECUTE FUNCTION individual_transaction_set_delta_amount();

COMMIT;
