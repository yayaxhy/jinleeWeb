-- Additive rollout. This migration does not backfill, replay a business event,
-- update a wallet, or change a historical IndividualTransaction.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

CREATE TABLE "WalletLedgerEntry" (
  "id" TEXT NOT NULL,
  "sourceTransactionId" TEXT NOT NULL,
  "dlmId" TEXT,
  "discordId" TEXT,
  "counterpartyId" TEXT,
  "walletDelta" DECIMAL(19,4) NOT NULL,
  "businessAmount" DECIMAL(19,4) NOT NULL,
  "balanceBefore" DECIMAL(19,4) NOT NULL,
  "balanceAfter" DECIMAL(19,4) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'CNY',
  "direction" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "legacyType" TEXT NOT NULL,
  "incomeDelta" DECIMAL(19,4),
  "rechargeDelta" DECIMAL(19,4),
  "totalSpentDelta" DECIMAL(19,4),
  "loyaltyPointsDelta" DECIMAL(19,4),
  "correlationId" TEXT,
  "reversalOfLedgerId" TEXT,
  "reversalOfSourceTransactionId" TEXT,
  "idempotencyKey" TEXT,
  "source" TEXT NOT NULL,
  "integrityStatus" TEXT NOT NULL,
  "timeCreatedAt" TIMESTAMP(3) NOT NULL,
  "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "schemaVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "WalletLedgerEntry_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "WalletLedgerEntry_finite_money" CHECK (
    "walletDelta"::TEXT <> 'NaN' AND "businessAmount"::TEXT <> 'NaN' AND
    "balanceBefore"::TEXT <> 'NaN' AND "balanceAfter"::TEXT <> 'NaN' AND
    COALESCE("incomeDelta"::TEXT <> 'NaN', TRUE) AND
    COALESCE("rechargeDelta"::TEXT <> 'NaN', TRUE) AND
    COALESCE("totalSpentDelta"::TEXT <> 'NaN', TRUE) AND
    COALESCE("loyaltyPointsDelta"::TEXT <> 'NaN', TRUE)
  ),
  CONSTRAINT "WalletLedgerEntry_id_matches_source" CHECK ("id" = 'WLE:' || "sourceTransactionId"),
  CONSTRAINT "WalletLedgerEntry_balance_equation" CHECK ("walletDelta" = "balanceAfter" - "balanceBefore"),
  CONSTRAINT "WalletLedgerEntry_business_amount_nonnegative" CHECK ("businessAmount" >= 0),
  CONSTRAINT "WalletLedgerEntry_direction_matches_delta" CHECK (
    ("walletDelta" > 0 AND "direction" = 'CREDIT') OR
    ("walletDelta" < 0 AND "direction" = 'DEBIT') OR
    ("walletDelta" = 0 AND "direction" = 'NONE')
  ),
  CONSTRAINT "WalletLedgerEntry_known_component_equation" CHECK (
    "incomeDelta" IS NULL OR "rechargeDelta" IS NULL OR
    "walletDelta" = "incomeDelta" + "rechargeDelta"
  ),
  CONSTRAINT "WalletLedgerEntry_currency_supported" CHECK ("currency" = 'CNY'),
  CONSTRAINT "WalletLedgerEntry_source_supported" CHECK ("source" IN ('LIVE', 'COMPATIBILITY', 'LEGACY_BACKFILL')),
  CONSTRAINT "WalletLedgerEntry_integrity_supported" CHECK ("integrityStatus" IN ('VERIFIED', 'REQUIRES_REVIEW', 'UNVERIFIABLE')),
  CONSTRAINT "WalletLedgerEntry_verified_arithmetic" CHECK (
    "integrityStatus" <> 'VERIFIED' OR (
      ABS("walletDelta") = "businessAmount" AND
      (NULLIF("dlmId", '') IS NOT NULL OR NULLIF("discordId", '') IS NOT NULL)
    )
  ),
  CONSTRAINT "WalletLedgerEntry_version_supported" CHECK ("schemaVersion" = 1),
  CONSTRAINT "WalletLedgerEntry_no_self_reversal" CHECK ("reversalOfLedgerId" IS NULL OR "reversalOfLedgerId" <> "id")
);

CREATE UNIQUE INDEX "WalletLedgerEntry_sourceTransactionId_key" ON "WalletLedgerEntry"("sourceTransactionId");
CREATE UNIQUE INDEX "WalletLedgerEntry_idempotencyKey_key" ON "WalletLedgerEntry"("idempotencyKey");
CREATE INDEX "WalletLedgerEntry_dlmId_timeCreatedAt_idx" ON "WalletLedgerEntry"("dlmId", "timeCreatedAt");
CREATE INDEX "WalletLedgerEntry_discordId_timeCreatedAt_idx" ON "WalletLedgerEntry"("discordId", "timeCreatedAt");
CREATE INDEX "WalletLedgerEntry_eventType_timeCreatedAt_idx" ON "WalletLedgerEntry"("eventType", "timeCreatedAt");
CREATE INDEX "WalletLedgerEntry_correlationId_idx" ON "WalletLedgerEntry"("correlationId");
CREATE INDEX "WalletLedgerEntry_reversalOfLedgerId_idx" ON "WalletLedgerEntry"("reversalOfLedgerId");
CREATE INDEX "WalletLedgerEntry_reversalOfSourceTransactionId_idx" ON "WalletLedgerEntry"("reversalOfSourceTransactionId");
CREATE INDEX "WalletLedgerEntry_integrityStatus_timeCreatedAt_idx" ON "WalletLedgerEntry"("integrityStatus", "timeCreatedAt");

ALTER TABLE "WalletLedgerEntry"
  ADD CONSTRAINT "WalletLedgerEntry_sourceTransactionId_fkey"
  FOREIGN KEY ("sourceTransactionId") REFERENCES "IndividualTransaction"("transactionId")
  ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "WalletLedgerEntry"
  ADD CONSTRAINT "WalletLedgerEntry_reversalOfLedgerId_fkey"
  FOREIGN KEY ("reversalOfLedgerId") REFERENCES "WalletLedgerEntry"("id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

COMMENT ON COLUMN "WalletLedgerEntry"."dlmId" IS 'Immutable owner snapshot; current ownership is resolved through sourceTransactionId after account merges.';
COMMENT ON COLUMN "WalletLedgerEntry"."integrityStatus" IS 'VERIFIED checks receipt arithmetic and owner availability only, not bank settlement, wallet continuity or business eligibility.';
COMMENT ON COLUMN "WalletLedgerEntry"."incomeDelta" IS 'NULL means unknown. Never infer historical component changes as zero.';

-- Keep this classification identical to the TypeScript writer. Unknown labels
-- remain LEGACY_OTHER rather than acquiring guessed business semantics.
CREATE FUNCTION wallet_ledger_event_type(transaction_type TEXT, balance_delta NUMERIC)
RETURNS TEXT LANGUAGE SQL IMMUTABLE STRICT AS $$
  SELECT CASE
    WHEN transaction_type = '点单' THEN
      CASE WHEN balance_delta < 0 THEN 'ORDER_PAYMENT' WHEN balance_delta > 0 THEN 'ORDER_INCOME' ELSE 'ORDER_ZERO' END
    WHEN transaction_type = '订单撤销' THEN
      CASE WHEN balance_delta > 0 THEN 'ORDER_REFUND' WHEN balance_delta < 0 THEN 'ORDER_INCOME_REVERSAL' ELSE 'ORDER_REVERSAL_ZERO' END
    WHEN transaction_type IN ('打赏', '客服代打赏') THEN
      CASE WHEN balance_delta < 0 THEN 'GIFT_PAYMENT' WHEN balance_delta > 0 THEN 'GIFT_INCOME' ELSE 'GIFT_ZERO' END
    WHEN transaction_type = '打赏撤销' THEN
      CASE WHEN balance_delta > 0 THEN 'GIFT_REFUND' WHEN balance_delta < 0 THEN 'GIFT_INCOME_REVERSAL' ELSE 'GIFT_REVERSAL_ZERO' END
    WHEN transaction_type IN ('充值', '人工充值', '网站充值', '微信Native充值', '信用卡/银行卡充值') THEN 'RECHARGE'
    WHEN transaction_type = '提现' THEN 'WITHDRAWAL'
    WHEN transaction_type = '优惠返利' THEN 'COUPON_REBATE'
    WHEN transaction_type = '红包发出' THEN 'RED_ENVELOPE_SEND'
    WHEN transaction_type = '红包收入' THEN 'RED_ENVELOPE_RECEIVE'
    WHEN transaction_type = '红包退回' THEN 'RED_ENVELOPE_REFUND'
    ELSE 'LEGACY_OTHER'
  END
$$;

-- Validate the money and event facts, not identity snapshots. Account merge may
-- legitimately reassign the existing source receipt without rewriting history.
CREATE FUNCTION wallet_ledger_assert_source(ledger_id TEXT)
RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE
  ledger "WalletLedgerEntry"%ROWTYPE;
  receipt "IndividualTransaction"%ROWTYPE;
BEGIN
  SELECT * INTO STRICT ledger FROM "WalletLedgerEntry" WHERE "id" = ledger_id;
  SELECT * INTO STRICT receipt FROM "IndividualTransaction" WHERE "transactionId" = ledger."sourceTransactionId";
  IF ledger."balanceBefore" IS DISTINCT FROM receipt."balanceBefore" OR
     ledger."balanceAfter" IS DISTINCT FROM receipt."balanceAfter" OR
     ledger."walletDelta" IS DISTINCT FROM receipt."balanceAfter" - receipt."balanceBefore" OR
     ledger."businessAmount" IS DISTINCT FROM ABS(receipt."amountChange") OR
     ledger."legacyType" IS DISTINCT FROM receipt."typeOfTransaction" OR
     ledger."eventType" IS DISTINCT FROM wallet_ledger_event_type(receipt."typeOfTransaction", receipt."balanceAfter" - receipt."balanceBefore") OR
     ledger."timeCreatedAt" IS DISTINCT FROM receipt."timeCreatedAt" THEN
    RAISE EXCEPTION 'wallet_ledger_source_mismatch:%', ledger."sourceTransactionId" USING ERRCODE = '23514';
  END IF;
END;
$$;

-- Old binaries and direct SQL/createMany writers are covered at commit. New
-- writers may first insert the compatibility receipt and then a richer ledger
-- row in the same transaction; the deferred bridge validates instead of adding
-- a duplicate. Unknown component deltas intentionally remain NULL.
CREATE FUNCTION wallet_ledger_capture_receipt()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  receipt "IndividualTransaction"%ROWTYPE;
  delta NUMERIC;
  ledger_id TEXT;
BEGIN
  SELECT * INTO STRICT receipt FROM "IndividualTransaction" WHERE "transactionId" = NEW."transactionId";
  delta := receipt."balanceAfter" - receipt."balanceBefore";
  ledger_id := 'WLE:' || receipt."transactionId";
  INSERT INTO "WalletLedgerEntry" (
    "id", "sourceTransactionId", "dlmId", "discordId", "counterpartyId",
    "walletDelta", "businessAmount", "balanceBefore", "balanceAfter",
    "currency", "direction", "eventType", "legacyType", "source", "integrityStatus", "timeCreatedAt"
  ) VALUES (
    ledger_id, receipt."transactionId", receipt."dlmId", receipt."discordId", receipt."thirdPartydiscordId",
    delta, ABS(receipt."amountChange"), receipt."balanceBefore", receipt."balanceAfter",
    'CNY', CASE WHEN delta > 0 THEN 'CREDIT' WHEN delta < 0 THEN 'DEBIT' ELSE 'NONE' END,
    wallet_ledger_event_type(receipt."typeOfTransaction", delta), receipt."typeOfTransaction", 'COMPATIBILITY',
    CASE
      WHEN NULLIF(receipt."dlmId", '') IS NULL AND NULLIF(receipt."discordId", '') IS NULL THEN 'UNVERIFIABLE'
      WHEN ABS(delta) = ABS(receipt."amountChange") THEN 'VERIFIED'
      ELSE 'REQUIRES_REVIEW'
    END,
    receipt."timeCreatedAt"
  ) ON CONFLICT ("sourceTransactionId") DO NOTHING;
  PERFORM wallet_ledger_assert_source(ledger_id);
  RETURN NEW;
END;
$$;

CREATE CONSTRAINT TRIGGER "IndividualTransaction_capture_wallet_ledger"
  AFTER INSERT ON "IndividualTransaction"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION wallet_ledger_capture_receipt();

CREATE FUNCTION wallet_ledger_validate_insert()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  PERFORM wallet_ledger_assert_source(NEW."id");
  RETURN NEW;
END;
$$;

CREATE CONSTRAINT TRIGGER "WalletLedgerEntry_validate_source"
  AFTER INSERT ON "WalletLedgerEntry"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION wallet_ledger_validate_insert();

CREATE FUNCTION wallet_ledger_reject_mutation()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'wallet_ledger_is_append_only' USING ERRCODE = '23514';
END;
$$;

CREATE TRIGGER "WalletLedgerEntry_no_update_or_delete"
  BEFORE UPDATE OR DELETE ON "WalletLedgerEntry"
  FOR EACH ROW EXECUTE FUNCTION wallet_ledger_reject_mutation();
CREATE TRIGGER "WalletLedgerEntry_no_truncate"
  BEFORE TRUNCATE ON "WalletLedgerEntry"
  FOR EACH STATEMENT EXECUTE FUNCTION wallet_ledger_reject_mutation();

COMMIT;
