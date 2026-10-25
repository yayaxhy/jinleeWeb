-- Optional Web recovery ownership. Existing Bot/legacy rows remain unclaimed.
ALTER TABLE "GiftExecutionRequest"
  ADD COLUMN "recoveryOwnerDlmId" TEXT,
  ADD COLUMN "recoveryOwnerDiscordId" TEXT,
  ADD COLUMN "recoverySnapshot" JSONB;

CREATE INDEX "GiftExecutionRequest_recovery_owner_idx"
  ON "GiftExecutionRequest"("recoveryOwnerDlmId", "kind", "createdAt", "requestId");
