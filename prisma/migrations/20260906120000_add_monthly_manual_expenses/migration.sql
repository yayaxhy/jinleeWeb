CREATE TABLE "MonthlyManualExpense" (
    "id" TEXT NOT NULL,
    "monthKey" TEXT NOT NULL,
    "amount" DECIMAL(19,4) NOT NULL,
    "note" TEXT NOT NULL,
    "imageFileName" TEXT,
    "operatorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MonthlyManualExpense_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MonthlyManualExpense_monthKey_updatedAt_idx" ON "MonthlyManualExpense"("monthKey", "updatedAt");
CREATE INDEX "MonthlyManualExpense_operatorId_idx" ON "MonthlyManualExpense"("operatorId");

ALTER TABLE "MonthlyManualExpense"
ADD CONSTRAINT "MonthlyManualExpense_operatorId_fkey"
FOREIGN KEY ("operatorId") REFERENCES "Member"("discordUserId")
ON DELETE RESTRICT ON UPDATE CASCADE;
