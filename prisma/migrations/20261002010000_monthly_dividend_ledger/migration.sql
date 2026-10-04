CREATE TABLE "MonthlyDividendDecision" (
    "id" TEXT NOT NULL,
    "monthKey" TEXT NOT NULL,
    "sourceMonthKey" TEXT,
    "amount" DECIMAL(19,4) NOT NULL,
    "note" TEXT NOT NULL,
    "operatorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MonthlyDividendDecision_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MonthlyDividendDecision_monthKey_createdAt_idx"
ON "MonthlyDividendDecision"("monthKey", "createdAt");

CREATE TABLE "MonthlyDividendPayment" (
    "id" TEXT NOT NULL,
    "amount" DECIMAL(19,4) NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL,
    "note" TEXT NOT NULL,
    "operatorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MonthlyDividendPayment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MonthlyDividendPayment_paidAt_idx"
ON "MonthlyDividendPayment"("paidAt");
