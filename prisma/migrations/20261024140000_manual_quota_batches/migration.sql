-- Legacy flow_buff/spend_buff rows retain their exact amounts and expiries.
-- Only future voucher grants create new batches; no history is guessed/backfilled.
CREATE TABLE "manual_quota_batch" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "remaining_extra" DECIMAL(19,4) NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "manual_quota_batch_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "manual_quota_batch_kind_check" CHECK ("kind" IN ('flow', 'spend')),
  CONSTRAINT "manual_quota_batch_amount_check" CHECK ("remaining_extra" >= 0)
);
CREATE INDEX "manual_quota_batch_user_id_kind_expires_at_id_idx"
  ON "manual_quota_batch" ("user_id", "kind", "expires_at", "id");
