-- Do not backfill legacy orders from present-day balances. v1/null facts
-- require manual review; new v2 audits contain actual committed effects.
ALTER TABLE "order_audit"
  ADD COLUMN "auditVersion" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "workerIncomeDelta" DECIMAL(19,4),
  ADD COLUMN "workerRechargeDelta" DECIMAL(19,4),
  ADD COLUMN "workerEarnDelta" DECIMAL(19,4),
  ADD COLUMN "heartApplied" INTEGER,
  ADD COLUMN "referralLedgerFacts" JSONB;
