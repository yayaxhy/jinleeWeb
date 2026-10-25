-- Prepared only. Apply once to the shared database through its chosen migration owner.
CREATE TABLE "BotRuntimeConfig" (
  "guildId" TEXT NOT NULL,
  "revision" INTEGER NOT NULL DEFAULT 0,
  "activeVersion" INTEGER NOT NULL DEFAULT 0,
  "draft" JSONB,
  "draftUpdatedBy" TEXT,
  "draftUpdatedAt" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BotRuntimeConfig_pkey" PRIMARY KEY ("guildId"),
  CONSTRAINT "BotRuntimeConfig_nonnegative" CHECK ("revision" >= 0 AND "activeVersion" >= 0)
);
CREATE TABLE "BotRuntimeConfigVersion" (
  "guildId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "settings" JSONB NOT NULL,
  "createdBy" TEXT NOT NULL,
  "reason" VARCHAR(300) NOT NULL,
  "rollbackOf" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BotRuntimeConfigVersion_pkey" PRIMARY KEY ("guildId", "version"),
  CONSTRAINT "BotRuntimeConfigVersion_positive" CHECK ("version" > 0),
  CONSTRAINT "BotRuntimeConfigVersion_config_fkey" FOREIGN KEY ("guildId") REFERENCES "BotRuntimeConfig"("guildId") ON DELETE RESTRICT ON UPDATE CASCADE
);
