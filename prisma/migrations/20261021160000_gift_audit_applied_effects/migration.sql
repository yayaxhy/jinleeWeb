-- Legacy audits remain v1. Missing historical flow, wallet-split, and heart
-- effects must not be inferred or marked complete by this migration.
ALTER TABLE "gift_audit"
  ADD COLUMN "auditVersion" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "giverDlmId" TEXT,
  ADD COLUMN "giverDiscordId" TEXT,
  ADD COLUMN "receiverDlmId" TEXT,
  ADD COLUMN "receiverIncomeDelta" DECIMAL(19,4),
  ADD COLUMN "receiverRechargeDelta" DECIMAL(19,4),
  ADD COLUMN "receiverEarnDelta" DECIMAL(19,4),
  ADD COLUMN "heartApplied" INTEGER;
