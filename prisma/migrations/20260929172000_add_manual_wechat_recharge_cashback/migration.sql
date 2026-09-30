-- Cashback follows the /gift accounting pattern while retaining the source
-- recharge operation, so a given original receipt cannot receive cashback twice.
ALTER TYPE "DlmAdminOperationType"
  ADD VALUE IF NOT EXISTS 'RECHARGE_CASHBACK';

ALTER TABLE "DlmAdminOperation"
  ADD COLUMN IF NOT EXISTS "sourceOperationId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "DlmAdminOperation_sourceOperationId_key"
  ON "DlmAdminOperation"("sourceOperationId");
