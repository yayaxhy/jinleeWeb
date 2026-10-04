-- Manual cash-recharge reconciliation. These tables are deliberately separate
-- from Member/Recharge wallet effects: operating the reconciliation backoffice
-- must never change a boss's platform balance.

CREATE TYPE "SettlementReconciliationStatus" AS ENUM (
  'PENDING_FINANCE',
  'FINANCE_CONFIRMED',
  'OWNER_CONFIRMED',
  'OWNER_DISPUTED',
  'INVALIDATED'
);

CREATE TYPE "SettlementTransferStatus" AS ENUM (
  'PENDING_RECEIVER_CONFIRMATION',
  'RECEIVER_CONFIRMED',
  'RECEIVER_DISPUTED',
  'CANCELED'
);

CREATE TYPE "SettlementPayoutStatus" AS ENUM ('PAID', 'VOIDED');

CREATE TABLE "SettlementAccount" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "ownerDiscordId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "currency" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "retiredAt" TIMESTAMP(3),
  CONSTRAINT "SettlementAccount_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SettlementAccount_name_key" ON "SettlementAccount"("name");
CREATE INDEX "SettlementAccount_ownerDiscordId_active_idx" ON "SettlementAccount"("ownerDiscordId", "active");

CREATE TABLE "SettlementRechargeReconciliation" (
  "id" TEXT NOT NULL,
  "rechargeId" TEXT NOT NULL,
  "accountId" TEXT,
  "ownerDiscordId" TEXT,
  "status" "SettlementReconciliationStatus" NOT NULL DEFAULT 'PENDING_FINANCE',
  "rmbAmount" DECIMAL(19,4),
  "originalReceivedAmount" DECIMAL(19,4),
  "originalReceivedCurrency" TEXT,
  "reversalRechargeId" TEXT,
  "exceptionReason" TEXT,
  "invalidReason" TEXT,
  "financeConfirmedBy" TEXT,
  "financeConfirmedAt" TIMESTAMP(3),
  "ownerConfirmedBy" TEXT,
  "ownerConfirmedAt" TIMESTAMP(3),
  "ownerDisputedBy" TEXT,
  "ownerDisputedAt" TIMESTAMP(3),
  "invalidatedBy" TEXT,
  "invalidatedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SettlementRechargeReconciliation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SettlementRechargeReconciliation_rechargeId_key"
ON "SettlementRechargeReconciliation"("rechargeId");
CREATE INDEX "SettlementRechargeReconciliation_status_createdAt_idx"
ON "SettlementRechargeReconciliation"("status", "createdAt");
CREATE INDEX "SettlementRechargeReconciliation_accountId_status_createdAt_idx"
ON "SettlementRechargeReconciliation"("accountId", "status", "createdAt");
CREATE INDEX "SettlementRechargeReconciliation_ownerDiscordId_status_createdAt_idx"
ON "SettlementRechargeReconciliation"("ownerDiscordId", "status", "createdAt");
CREATE INDEX "SettlementRechargeReconciliation_reversalRechargeId_idx"
ON "SettlementRechargeReconciliation"("reversalRechargeId");

CREATE TABLE "SettlementReceiptEvidence" (
  "id" TEXT NOT NULL,
  "reconciliationId" TEXT NOT NULL,
  "storageFileName" TEXT NOT NULL,
  "originalFileName" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "byteSize" INTEGER NOT NULL,
  "uploadedBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SettlementReceiptEvidence_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SettlementReceiptEvidence_reconciliationId_createdAt_idx"
ON "SettlementReceiptEvidence"("reconciliationId", "createdAt");

CREATE TABLE "SettlementReconciliationEvent" (
  "id" TEXT NOT NULL,
  "reconciliationId" TEXT NOT NULL,
  "fromStatus" "SettlementReconciliationStatus",
  "toStatus" "SettlementReconciliationStatus" NOT NULL,
  "actorDiscordId" TEXT NOT NULL,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SettlementReconciliationEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SettlementReconciliationEvent_reconciliationId_createdAt_idx"
ON "SettlementReconciliationEvent"("reconciliationId", "createdAt");

CREATE TABLE "SettlementAccountTransfer" (
  "id" TEXT NOT NULL,
  "fromAccountId" TEXT NOT NULL,
  "toAccountId" TEXT NOT NULL,
  "amount" DECIMAL(19,4) NOT NULL,
  "status" "SettlementTransferStatus" NOT NULL DEFAULT 'PENDING_RECEIVER_CONFIRMATION',
  "initiatedBy" TEXT NOT NULL,
  "receiverConfirmedBy" TEXT,
  "receiverConfirmedAt" TIMESTAMP(3),
  "receiverDisputedBy" TEXT,
  "receiverDisputedAt" TIMESTAMP(3),
  "disputeReason" TEXT,
  "canceledBy" TEXT,
  "canceledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SettlementAccountTransfer_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SettlementAccountTransfer_fromAccountId_status_createdAt_idx"
ON "SettlementAccountTransfer"("fromAccountId", "status", "createdAt");
CREATE INDEX "SettlementAccountTransfer_toAccountId_status_createdAt_idx"
ON "SettlementAccountTransfer"("toAccountId", "status", "createdAt");

CREATE TABLE "SettlementForexRecovery" (
  "id" TEXT NOT NULL,
  "fromAccountId" TEXT NOT NULL,
  "toAccountId" TEXT NOT NULL,
  "foreignAmount" DECIMAL(19,4) NOT NULL,
  "foreignCurrency" TEXT NOT NULL,
  "rmbAmount" DECIMAL(19,4) NOT NULL,
  "recoveredAt" TIMESTAMP(3) NOT NULL,
  "note" TEXT,
  "recordedBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SettlementForexRecovery_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SettlementForexRecovery_fromAccountId_recoveredAt_idx"
ON "SettlementForexRecovery"("fromAccountId", "recoveredAt");
CREATE INDEX "SettlementForexRecovery_toAccountId_recoveredAt_idx"
ON "SettlementForexRecovery"("toAccountId", "recoveredAt");

CREATE TABLE "SettlementWithdrawalPayout" (
  "id" TEXT NOT NULL,
  "withdrawalId" TEXT NOT NULL,
  "ownerDiscordId" TEXT NOT NULL,
  "amount" DECIMAL(19,4) NOT NULL,
  "status" "SettlementPayoutStatus" NOT NULL DEFAULT 'PAID',
  "paidBy" TEXT NOT NULL,
  "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "voidedBy" TEXT,
  "voidedAt" TIMESTAMP(3),
  "voidReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SettlementWithdrawalPayout_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SettlementWithdrawalPayout_withdrawalId_key"
ON "SettlementWithdrawalPayout"("withdrawalId");
CREATE INDEX "SettlementWithdrawalPayout_ownerDiscordId_status_paidAt_idx"
ON "SettlementWithdrawalPayout"("ownerDiscordId", "status", "paidAt");

ALTER TABLE "SettlementRechargeReconciliation"
ADD CONSTRAINT "SettlementRechargeReconciliation_rechargeId_fkey"
FOREIGN KEY ("rechargeId") REFERENCES "Recharge"("RechargeID") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SettlementRechargeReconciliation"
ADD CONSTRAINT "SettlementRechargeReconciliation_accountId_fkey"
FOREIGN KEY ("accountId") REFERENCES "SettlementAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SettlementReceiptEvidence"
ADD CONSTRAINT "SettlementReceiptEvidence_reconciliationId_fkey"
FOREIGN KEY ("reconciliationId") REFERENCES "SettlementRechargeReconciliation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SettlementReconciliationEvent"
ADD CONSTRAINT "SettlementReconciliationEvent_reconciliationId_fkey"
FOREIGN KEY ("reconciliationId") REFERENCES "SettlementRechargeReconciliation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SettlementAccountTransfer"
ADD CONSTRAINT "SettlementAccountTransfer_fromAccountId_fkey"
FOREIGN KEY ("fromAccountId") REFERENCES "SettlementAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SettlementAccountTransfer"
ADD CONSTRAINT "SettlementAccountTransfer_toAccountId_fkey"
FOREIGN KEY ("toAccountId") REFERENCES "SettlementAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SettlementForexRecovery"
ADD CONSTRAINT "SettlementForexRecovery_fromAccountId_fkey"
FOREIGN KEY ("fromAccountId") REFERENCES "SettlementAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SettlementForexRecovery"
ADD CONSTRAINT "SettlementForexRecovery_toAccountId_fkey"
FOREIGN KEY ("toAccountId") REFERENCES "SettlementAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SettlementWithdrawalPayout"
ADD CONSTRAINT "SettlementWithdrawalPayout_withdrawalId_fkey"
FOREIGN KEY ("withdrawalId") REFERENCES "Withdraw"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Initial account registry. New accounts can only be created in the finance UI.
INSERT INTO "SettlementAccount" ("id", "name", "ownerDiscordId", "kind", "currency") VALUES
  ('settlement-iria-alipay', 'iria支付宝', '1008032640445710447', 'ALIPAY', 'CNY'),
  ('settlement-xiaohuo-wechat', '小霍微信', '308164614846414851', 'WECHAT', 'CNY'),
  ('settlement-xiaohuo-alipay', '小霍支付宝', '308164614846414851', 'ALIPAY', 'CNY'),
  ('settlement-yaya-wechat', '鸭鸭微信', '525770714574225408', 'WECHAT', 'CNY'),
  ('settlement-yaya-alipay', '鸭鸭支付宝', '525770714574225408', 'ALIPAY', 'CNY'),
  ('settlement-iria-paypal', 'iria-Paypal', '1008032640445710447', 'PAYPAL', 'EUR'),
  ('settlement-gbp-bank', '英镑银行卡', '525770714574225408', 'BANK', 'GBP'),
  ('settlement-eur-bank', '欧元银行卡', '1008032640445710447', 'BANK', 'EUR')
ON CONFLICT ("name") DO NOTHING;
