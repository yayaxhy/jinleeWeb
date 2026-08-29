ALTER TABLE "JinleeUser"
  ADD COLUMN "miniAvailabilitySetAt" TIMESTAMP(3),
  ALTER COLUMN "miniAvailability" SET DEFAULT 'RESTING';
