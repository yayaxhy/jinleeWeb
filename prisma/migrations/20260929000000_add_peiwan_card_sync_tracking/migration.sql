-- Tracks incremental DLM namecard imports and their source-message audit trail.
CREATE TABLE "PeiwanCardSyncCheckpoint" (
    "sourceChannelId" TEXT NOT NULL,
    "lastProcessedMessageId" TEXT,
    "lastProcessedAt" TIMESTAMP(3),
    "lastRunAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PeiwanCardSyncCheckpoint_pkey" PRIMARY KEY ("sourceChannelId")
);

CREATE TABLE "PeiwanCardSyncLog" (
    "id" TEXT NOT NULL,
    "sourceChannelId" TEXT NOT NULL,
    "sourceMessageId" TEXT NOT NULL,
    "sourceTimestamp" TIMESTAMP(3) NOT NULL,
    "peiwanId" INTEGER,
    "action" TEXT NOT NULL,
    "detail" TEXT,
    "imageUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PeiwanCardSyncLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PeiwanCardSyncLog_sourceChannelId_sourceMessageId_key"
ON "PeiwanCardSyncLog"("sourceChannelId", "sourceMessageId");

CREATE INDEX "PeiwanCardSyncLog_peiwanId_sourceTimestamp_idx"
ON "PeiwanCardSyncLog"("peiwanId", "sourceTimestamp");

CREATE INDEX "PeiwanCardSyncLog_sourceChannelId_sourceTimestamp_idx"
ON "PeiwanCardSyncLog"("sourceChannelId", "sourceTimestamp");
