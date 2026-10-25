-- Keep legacy invitations unproven; never infer original identity or quote.
ALTER TABLE "AuditionInvite"
  ADD COLUMN "bossDlmId" TEXT,
  ADD COLUMN "workerDlmId" TEXT,
  ADD COLUMN "bossDiscordIdSnapshot" TEXT,
  ADD COLUMN "workerDiscordIdSnapshot" TEXT,
  ADD COLUMN "quotedGross" DECIMAL(19,4);

ALTER TABLE "AuditionInvite" ADD CONSTRAINT "AuditionInvite_quotedGross_nonnegative"
  CHECK ("quotedGross" IS NULL OR ("quotedGross" >= 0 AND "quotedGross" <> 'NaN'::numeric));
