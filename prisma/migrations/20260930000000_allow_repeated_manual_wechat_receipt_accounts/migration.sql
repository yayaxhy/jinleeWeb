-- "receiptReference" stores a manual recharge receiving account, not a
-- payment transaction number. One account may receive many recharges.
DROP INDEX IF EXISTS "DlmAdminOperation_receiptReference_key";

CREATE INDEX IF NOT EXISTS "DlmAdminOperation_receiptReference_createdAt_idx"
  ON "DlmAdminOperation"("receiptReference", "createdAt");
