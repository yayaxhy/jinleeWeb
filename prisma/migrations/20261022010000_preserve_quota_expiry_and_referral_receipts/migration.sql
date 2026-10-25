-- Original consumed expiry and referral receipts cannot be inferred from current
-- balances. Historical NULL facts stay unknown; do not backfill guessed values.
ALTER TABLE "gift_audit"
  ADD COLUMN "spendQuotaUsage" JSONB,
  ADD COLUMN "flowQuotaUsage" JSONB,
  ADD COLUMN "referralLedgerFacts" JSONB;
ALTER TABLE "order_audit"
  ADD COLUMN "spendQuotaUsage" JSONB,
  ADD COLUMN "flowQuotaUsage" JSONB;

CREATE TABLE "manual_quota_restoration" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "remaining_extra" DECIMAL(19,4) NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "manual_quota_restoration_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "manual_quota_restoration_kind_check" CHECK ("kind" IN ('flow', 'spend')),
  CONSTRAINT "manual_quota_restoration_amount_check" CHECK ("remaining_extra" >= 0)
);
CREATE INDEX "manual_quota_restoration_user_id_kind_expires_at_id_idx"
  ON "manual_quota_restoration" ("user_id", "kind", "expires_at", "id");
