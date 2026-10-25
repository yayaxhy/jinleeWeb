CREATE TABLE "AccountMigration" (
  "id" TEXT NOT NULL, "mode" TEXT NOT NULL,
  "sourceDlmId" TEXT NOT NULL, "targetDlmId" TEXT NOT NULL,
  "sourceDiscordId" TEXT, "targetDiscordId" TEXT,
  "sourcePeiwanId" INTEGER, "targetPeiwanId" INTEGER,
  "actorDlmId" TEXT, "actorDiscordId" TEXT,
  "previewHash" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'COMPLETED',
  "snapshot" JSONB NOT NULL, "result" JSONB NOT NULL, "rolePlan" JSONB NOT NULL,
  "inheritedAutoCommissionUntil" TIMESTAMP(3), "autoCommissionProgressDiscordId" TEXT,
  "rolesStatus" TEXT NOT NULL DEFAULT 'PENDING', "rolesClaimToken" TEXT,
  "rolesClaimedAt" TIMESTAMP(3), "rolesError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AccountMigration_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AccountMigration_sourceDlmId_createdAt_idx" ON "AccountMigration"("sourceDlmId", "createdAt");
CREATE INDEX "AccountMigration_targetDlmId_createdAt_idx" ON "AccountMigration"("targetDlmId", "createdAt");
CREATE INDEX "AccountMigration_rolesStatus_createdAt_idx" ON "AccountMigration"("rolesStatus", "createdAt");
CREATE TABLE "AccountOwnership" (
  "id" TEXT NOT NULL, "identityKind" TEXT NOT NULL, "identityKey" TEXT NOT NULL,
  "originalDlmId" TEXT NOT NULL, "currentDlmId" TEXT NOT NULL,
  "currentDiscordId" TEXT, "currentPeiwanId" INTEGER,
  "migrationId" TEXT NOT NULL, "retiredAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AccountOwnership_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AccountOwnership_identityKind_identityKey_originalDlmId_key" ON "AccountOwnership"("identityKind", "identityKey", "originalDlmId");
CREATE INDEX "AccountOwnership_currentDlmId_idx" ON "AccountOwnership"("currentDlmId");
CREATE INDEX "AccountOwnership_identityKind_identityKey_retiredAt_idx" ON "AccountOwnership"("identityKind", "identityKey", "retiredAt");
CREATE TABLE "AccountMigrationArchive" (
  "id" TEXT NOT NULL, "migrationId" TEXT NOT NULL, "model" TEXT NOT NULL,
  "recordKey" TEXT NOT NULL, "disposition" TEXT NOT NULL, "payload" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AccountMigrationArchive_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AccountMigrationArchive_migrationId_model_idx" ON "AccountMigrationArchive"("migrationId", "model");
CREATE INDEX "AccountMigrationArchive_model_recordKey_idx" ON "AccountMigrationArchive"("model", "recordKey");
