-- No historical request IDs or outcomes can be inferred from existing gifts.
CREATE TABLE "GiftExecutionRequest" (
  "requestId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "intent" JSONB NOT NULL,
  "intentHash" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "giftAuditId" TEXT,
  "result" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GiftExecutionRequest_pkey" PRIMARY KEY ("requestId"),
  CONSTRAINT "GiftExecutionRequest_kind_check" CHECK ("kind" IN ('VOUCHER_GIFT', 'DELEGATED_GIFT', 'DISCORD_GIFT')),
  CONSTRAINT "GiftExecutionRequest_result_check" CHECK (
    ("status" IN ('PENDING', 'ABANDONED') AND "giftAuditId" IS NULL AND "result" IS NULL) OR
    ("status" = 'COMPLETED' AND "giftAuditId" IS NOT NULL AND "result" IS NOT NULL)
  )
);
CREATE UNIQUE INDEX "GiftExecutionRequest_giftAuditId_key" ON "GiftExecutionRequest"("giftAuditId");
CREATE INDEX "GiftExecutionRequest_status_createdAt_idx" ON "GiftExecutionRequest"("status", "createdAt");
ALTER TABLE "GiftExecutionRequest" ADD CONSTRAINT "GiftExecutionRequest_giftAuditId_fkey"
 FOREIGN KEY ("giftAuditId") REFERENCES "gift_audit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
