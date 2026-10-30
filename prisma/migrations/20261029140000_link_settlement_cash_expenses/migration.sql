ALTER TABLE "MonthlyManualExpense"
  ADD COLUMN "cashFlowCorrection" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "voidedAt" TIMESTAMP(3);

ALTER TABLE "SettlementCashExpense"
  ADD COLUMN "actualPaidOn" DATE,
  ADD COLUMN "monthlyManualExpenseId" TEXT;

CREATE UNIQUE INDEX "SettlementCashExpense_monthlyManualExpenseId_key"
  ON "SettlementCashExpense"("monthlyManualExpenseId");

CREATE INDEX "SettlementCashExpense_actualPaidOn_idx"
  ON "SettlementCashExpense"("actualPaidOn");

ALTER TABLE "SettlementCashExpense"
  ADD CONSTRAINT "SettlementCashExpense_monthlyManualExpenseId_fkey"
  FOREIGN KEY ("monthlyManualExpenseId") REFERENCES "MonthlyManualExpense"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
