-- Capture new discounts only; historical rebate receipts cannot be inferred.
CREATE TABLE "order_discount_audit" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "auditVersion" INTEGER NOT NULL DEFAULT 1,
  "voucherKind" TEXT NOT NULL,
  "voucherId" TEXT NOT NULL,
  "rebateTransactionId" TEXT NOT NULL,
  "ownerDlmId" TEXT NOT NULL,
  "ownerDiscordId" TEXT,
  "workerDlmId" TEXT NOT NULL,
  "workerDiscordId" TEXT NOT NULL,
  "amount" DECIMAL(19,4) NOT NULL,
  "rechargeDelta" DECIMAL(19,4) NOT NULL,
  "voucherIssuedAt" TIMESTAMP(3) NOT NULL,
  "voucherExpiresAt" TIMESTAMP(3) NOT NULL,
  "consumedAt" TIMESTAMP(3) NOT NULL,
  "voucherType" TEXT NOT NULL,
  "voucherLabel" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "order_discount_audit_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "order_discount_audit_kind_check" CHECK ("voucherKind" IN ('coupon', 'pointshop', 'lottery')),
  CONSTRAINT "order_discount_audit_amount_check" CHECK ("amount" > 0 AND "rechargeDelta" = "amount")
);
CREATE UNIQUE INDEX "order_discount_audit_orderId_key" ON "order_discount_audit" ("orderId");
CREATE UNIQUE INDEX "order_discount_audit_rebateTransactionId_key" ON "order_discount_audit" ("rebateTransactionId");
CREATE INDEX "order_discount_audit_ownerDlmId_createdAt_idx" ON "order_discount_audit" ("ownerDlmId", "createdAt");
