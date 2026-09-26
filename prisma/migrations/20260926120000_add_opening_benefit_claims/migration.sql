ALTER TYPE "CouponSource" ADD VALUE IF NOT EXISTS 'OPENING_CAMPAIGN';

CREATE TABLE IF NOT EXISTS "OpeningBenefitClaim" (
  "id" TEXT NOT NULL,
  "jinleeId" TEXT NOT NULL,
  "benefit" TEXT NOT NULL,
  "periodKey" TEXT NOT NULL,
  "couponId" TEXT,
  "claimedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OpeningBenefitClaim_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'OpeningBenefitClaim_jinleeId_fkey'
  ) THEN
    ALTER TABLE "OpeningBenefitClaim"
      ADD CONSTRAINT "OpeningBenefitClaim_jinleeId_fkey"
      FOREIGN KEY ("jinleeId") REFERENCES "JinleeUser"("jinleeId")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "OpeningBenefitClaim_jinleeId_benefit_periodKey_key"
  ON "OpeningBenefitClaim"("jinleeId", "benefit", "periodKey");
CREATE INDEX IF NOT EXISTS "OpeningBenefitClaim_benefit_periodKey_idx"
  ON "OpeningBenefitClaim"("benefit", "periodKey");
CREATE INDEX IF NOT EXISTS "OpeningBenefitClaim_jinleeId_claimedAt_idx"
  ON "OpeningBenefitClaim"("jinleeId", "claimedAt");
