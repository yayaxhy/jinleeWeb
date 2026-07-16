-- Cross-channel dispatch, candidate, and mini-program message foundation.
-- Safe to apply after both Bot and jinleeWeb Prisma clients are regenerated from the matching schema.

CREATE TYPE "DispatchRequestStatus" AS ENUM ('OPEN', 'CLOSED', 'EXPIRED', 'CANCELED');
CREATE TYPE "DispatchSource" AS ENUM ('DISCORD', 'WECHAT_MINIPROGRAM');
CREATE TYPE "DispatchCandidateStatus" AS ENUM ('ACTIVE', 'SELECTED', 'CANCELED');
CREATE TYPE "MiniConversationType" AS ENUM ('DIRECT', 'SYSTEM');
CREATE TYPE "MiniMessageSenderType" AS ENUM ('USER', 'SYSTEM', 'BOT', 'ADMIN');
CREATE TYPE "MiniMessageStatus" AS ENUM ('NORMAL', 'BLOCKED', 'NOTICE');
CREATE TYPE "MiniModerationAction" AS ENUM ('ALLOW', 'ALERT', 'BLOCK');

ALTER TABLE "Order"
  ADD COLUMN "dispatchRequestId" TEXT,
  ADD COLUMN "dispatchCandidateId" TEXT;

CREATE TABLE "DispatchRequest" (
  "id" TEXT NOT NULL,
  "ownerJinleeId" TEXT,
  "ownerDiscordUserId" TEXT,
  "ownerWechatOpenId" TEXT,
  "ownerDisplayName" TEXT,
  "anonymous" BOOLEAN NOT NULL DEFAULT true,
  "requirement" VARCHAR(500) NOT NULL,
  "sexRequirement" JSONB NOT NULL,
  "game" TEXT,
  "tags" JSONB,
  "status" "DispatchRequestStatus" NOT NULL DEFAULT 'OPEN',
  "source" "DispatchSource" NOT NULL,
  "discordOrderRequestLogId" TEXT,
  "discordGuildId" TEXT,
  "discordChannelId" TEXT,
  "discordMessageId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "closedAt" TIMESTAMP(3),

  CONSTRAINT "DispatchRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DispatchCandidate" (
  "id" TEXT NOT NULL,
  "dispatchRequestId" TEXT NOT NULL,
  "workerJinleeId" TEXT,
  "workerDiscordUserId" TEXT,
  "workerDisplayName" TEXT,
  "peiwanId" INTEGER NOT NULL,
  "status" "DispatchCandidateStatus" NOT NULL DEFAULT 'ACTIVE',
  "grabbedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "selectedAt" TIMESTAMP(3),
  "selectedOrderId" TEXT,

  CONSTRAINT "DispatchCandidate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MiniConversation" (
  "id" TEXT NOT NULL,
  "type" "MiniConversationType" NOT NULL DEFAULT 'DIRECT',
  "peerKey" TEXT,
  "userAId" TEXT,
  "userBId" TEXT,
  "linkedOrderId" TEXT,
  "adminWatched" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "MiniConversation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MiniMessage" (
  "id" TEXT NOT NULL,
  "conversationId" TEXT NOT NULL,
  "senderJinleeId" TEXT,
  "senderType" "MiniMessageSenderType" NOT NULL DEFAULT 'USER',
  "body" VARCHAR(1000) NOT NULL,
  "rawBody" VARCHAR(1000),
  "status" "MiniMessageStatus" NOT NULL DEFAULT 'NORMAL',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "MiniMessage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MiniMessageModerationEvent" (
  "id" TEXT NOT NULL,
  "messageId" TEXT,
  "conversationId" TEXT,
  "action" "MiniModerationAction" NOT NULL,
  "riskLabels" JSONB,
  "rawText" VARCHAR(1000) NOT NULL,
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedAt" TIMESTAMP(3),

  CONSTRAINT "MiniMessageModerationEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DispatchRequest_discordOrderRequestLogId_key" ON "DispatchRequest"("discordOrderRequestLogId");
CREATE INDEX "DispatchRequest_status_expiresAt_idx" ON "DispatchRequest"("status", "expiresAt");
CREATE INDEX "DispatchRequest_ownerJinleeId_createdAt_idx" ON "DispatchRequest"("ownerJinleeId", "createdAt");
CREATE INDEX "DispatchRequest_ownerDiscordUserId_createdAt_idx" ON "DispatchRequest"("ownerDiscordUserId", "createdAt");
CREATE INDEX "DispatchRequest_source_createdAt_idx" ON "DispatchRequest"("source", "createdAt");

CREATE UNIQUE INDEX "DispatchCandidate_selectedOrderId_key" ON "DispatchCandidate"("selectedOrderId");
CREATE UNIQUE INDEX "DispatchCandidate_dispatchRequestId_peiwanId_key" ON "DispatchCandidate"("dispatchRequestId", "peiwanId");
CREATE INDEX "DispatchCandidate_dispatchRequestId_grabbedAt_idx" ON "DispatchCandidate"("dispatchRequestId", "grabbedAt");
CREATE INDEX "DispatchCandidate_workerJinleeId_grabbedAt_idx" ON "DispatchCandidate"("workerJinleeId", "grabbedAt");
CREATE INDEX "DispatchCandidate_workerDiscordUserId_grabbedAt_idx" ON "DispatchCandidate"("workerDiscordUserId", "grabbedAt");
CREATE INDEX "DispatchCandidate_status_grabbedAt_idx" ON "DispatchCandidate"("status", "grabbedAt");

CREATE UNIQUE INDEX "MiniConversation_type_peerKey_key" ON "MiniConversation"("type", "peerKey");
CREATE INDEX "MiniConversation_userAId_updatedAt_idx" ON "MiniConversation"("userAId", "updatedAt");
CREATE INDEX "MiniConversation_userBId_updatedAt_idx" ON "MiniConversation"("userBId", "updatedAt");
CREATE INDEX "MiniConversation_linkedOrderId_idx" ON "MiniConversation"("linkedOrderId");

CREATE INDEX "MiniMessage_conversationId_createdAt_idx" ON "MiniMessage"("conversationId", "createdAt");
CREATE INDEX "MiniMessage_senderJinleeId_createdAt_idx" ON "MiniMessage"("senderJinleeId", "createdAt");
CREATE INDEX "MiniMessage_status_createdAt_idx" ON "MiniMessage"("status", "createdAt");

CREATE INDEX "MiniMessageModerationEvent_messageId_idx" ON "MiniMessageModerationEvent"("messageId");
CREATE INDEX "MiniMessageModerationEvent_conversationId_createdAt_idx" ON "MiniMessageModerationEvent"("conversationId", "createdAt");
CREATE INDEX "MiniMessageModerationEvent_action_createdAt_idx" ON "MiniMessageModerationEvent"("action", "createdAt");

CREATE INDEX "Order_dispatchRequestId_idx" ON "Order"("dispatchRequestId");
CREATE INDEX "Order_dispatchCandidateId_idx" ON "Order"("dispatchCandidateId");

ALTER TABLE "DispatchRequest"
  ADD CONSTRAINT "DispatchRequest_ownerJinleeId_fkey" FOREIGN KEY ("ownerJinleeId") REFERENCES "JinleeUser"("jinleeId") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "DispatchRequest_ownerDiscordUserId_fkey" FOREIGN KEY ("ownerDiscordUserId") REFERENCES "Member"("discordUserId") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "DispatchCandidate"
  ADD CONSTRAINT "DispatchCandidate_dispatchRequestId_fkey" FOREIGN KEY ("dispatchRequestId") REFERENCES "DispatchRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "DispatchCandidate_workerJinleeId_fkey" FOREIGN KEY ("workerJinleeId") REFERENCES "JinleeUser"("jinleeId") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "DispatchCandidate_workerDiscordUserId_fkey" FOREIGN KEY ("workerDiscordUserId") REFERENCES "Member"("discordUserId") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "DispatchCandidate_peiwanId_fkey" FOREIGN KEY ("peiwanId") REFERENCES "PEIWAN"("PEIWANID") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Order"
  ADD CONSTRAINT "Order_dispatchRequestId_fkey" FOREIGN KEY ("dispatchRequestId") REFERENCES "DispatchRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "Order_dispatchCandidateId_fkey" FOREIGN KEY ("dispatchCandidateId") REFERENCES "DispatchCandidate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MiniConversation"
  ADD CONSTRAINT "MiniConversation_userAId_fkey" FOREIGN KEY ("userAId") REFERENCES "JinleeUser"("jinleeId") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "MiniConversation_userBId_fkey" FOREIGN KEY ("userBId") REFERENCES "JinleeUser"("jinleeId") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "MiniConversation_linkedOrderId_fkey" FOREIGN KEY ("linkedOrderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MiniMessage"
  ADD CONSTRAINT "MiniMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "MiniConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "MiniMessage_senderJinleeId_fkey" FOREIGN KEY ("senderJinleeId") REFERENCES "JinleeUser"("jinleeId") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MiniMessageModerationEvent"
  ADD CONSTRAINT "MiniMessageModerationEvent_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "MiniMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
