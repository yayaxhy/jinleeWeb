-- Cash expenses are tracked separately from platform withdrawals. They reduce
-- a responsible owner's settlement total immediately until finance voids them.

CREATE TYPE "SettlementCashExpenseStatus" AS ENUM (
  'PENDING_OWNER_CONFIRMATION',
  'OWNER_CONFIRMED',
  'OWNER_DISPUTED',
  'VOIDED'
);

CREATE TABLE "SettlementCashExpense" (
  "id" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "ownerDiscordId" TEXT NOT NULL,
  "amount" DECIMAL(19,4) NOT NULL,
  "note" TEXT NOT NULL,
  "status" "SettlementCashExpenseStatus" NOT NULL DEFAULT 'PENDING_OWNER_CONFIRMATION',
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ownerConfirmedBy" TEXT,
  "ownerConfirmedAt" TIMESTAMP(3),
  "ownerDisputedBy" TEXT,
  "ownerDisputedAt" TIMESTAMP(3),
  "disputeReason" TEXT,
  "voidedBy" TEXT,
  "voidedAt" TIMESTAMP(3),
  "voidReason" TEXT,
  CONSTRAINT "SettlementCashExpense_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SettlementCashExpense_accountId_status_createdAt_idx"
ON "SettlementCashExpense"("accountId", "status", "createdAt");
CREATE INDEX "SettlementCashExpense_ownerDiscordId_status_createdAt_idx"
ON "SettlementCashExpense"("ownerDiscordId", "status", "createdAt");

ALTER TABLE "SettlementCashExpense"
ADD CONSTRAINT "SettlementCashExpense_accountId_fkey"
FOREIGN KEY ("accountId") REFERENCES "SettlementAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
