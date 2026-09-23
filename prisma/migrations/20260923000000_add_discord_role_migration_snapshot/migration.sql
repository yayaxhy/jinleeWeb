CREATE TABLE "DiscordRoleMigrationSnapshot" (
    "id" TEXT NOT NULL,
    "sourceGuildId" TEXT NOT NULL,
    "targetGuildId" TEXT NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiscordRoleMigrationSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DiscordRoleMigrationSnapshotMember" (
    "id" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "discordUserId" TEXT NOT NULL,
    "roleIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiscordRoleMigrationSnapshotMember_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DiscordRoleMigrationSnapshot_sourceGuildId_targetGuildId_capturedAt_idx"
ON "DiscordRoleMigrationSnapshot"("sourceGuildId", "targetGuildId", "capturedAt");

CREATE UNIQUE INDEX "DiscordRoleMigrationSnapshotMember_snapshotId_discordUserId_key"
ON "DiscordRoleMigrationSnapshotMember"("snapshotId", "discordUserId");

CREATE INDEX "DiscordRoleMigrationSnapshotMember_discordUserId_idx"
ON "DiscordRoleMigrationSnapshotMember"("discordUserId");

ALTER TABLE "DiscordRoleMigrationSnapshotMember"
ADD CONSTRAINT "DiscordRoleMigrationSnapshotMember_snapshotId_fkey"
FOREIGN KEY ("snapshotId") REFERENCES "DiscordRoleMigrationSnapshot"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
