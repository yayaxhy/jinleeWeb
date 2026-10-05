-- This migration is intentionally identical to the shared Bot migration.
-- Deploy it once against the shared database from either repository.
CREATE TYPE "GuildNotificationEvent" AS ENUM (
  'ORDER_CREATED',
  'ORDER_ACCEPTED',
  'ORDER_CANCELED',
  'BALANCE_ADJUSTED'
);

CREATE TYPE "GuildNotificationChannel" AS ENUM (
  'DISCORD',
  'WEB_PUSH',
  'EMAIL'
);

CREATE TYPE "GuildNotificationDeliveryStatus" AS ENUM (
  'PENDING',
  'SENT',
  'SKIPPED',
  'FAILED'
);

ALTER TYPE "MiniConversationType" ADD VALUE IF NOT EXISTS 'SUPPORT';

ALTER TABLE "DlmUser"
  ADD COLUMN "notificationEmail" TEXT,
  ADD COLUMN "notificationEmailEnabled" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "WebPushSubscription" (
  "id" TEXT NOT NULL,
  "dlmId" TEXT NOT NULL,
  "endpoint" TEXT NOT NULL,
  "p256dh" TEXT NOT NULL,
  "auth" TEXT NOT NULL,
  "expirationTime" TIMESTAMP(3),
  "userAgent" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WebPushSubscription_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GuildNotification" (
  "id" TEXT NOT NULL,
  "dlmId" TEXT NOT NULL,
  "event" "GuildNotificationEvent" NOT NULL,
  "title" VARCHAR(160) NOT NULL,
  "body" VARCHAR(1000) NOT NULL,
  "href" VARCHAR(512),
  "details" JSONB,
  "dedupeKey" TEXT,
  "readAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GuildNotification_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GuildNotificationDelivery" (
  "id" TEXT NOT NULL,
  "notificationId" TEXT NOT NULL,
  "channel" "GuildNotificationChannel" NOT NULL,
  "status" "GuildNotificationDeliveryStatus" NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "error" VARCHAR(1000),
  "sentAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GuildNotificationDelivery_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WebPushSubscription_endpoint_key" ON "WebPushSubscription"("endpoint");
CREATE INDEX "WebPushSubscription_dlmId_updatedAt_idx" ON "WebPushSubscription"("dlmId", "updatedAt");
CREATE UNIQUE INDEX "GuildNotification_dedupeKey_key" ON "GuildNotification"("dedupeKey");
CREATE INDEX "GuildNotification_dlmId_createdAt_idx" ON "GuildNotification"("dlmId", "createdAt");
CREATE INDEX "GuildNotification_dlmId_readAt_createdAt_idx" ON "GuildNotification"("dlmId", "readAt", "createdAt");
CREATE INDEX "GuildNotification_event_createdAt_idx" ON "GuildNotification"("event", "createdAt");
CREATE UNIQUE INDEX "GuildNotificationDelivery_notificationId_channel_key" ON "GuildNotificationDelivery"("notificationId", "channel");
CREATE INDEX "GuildNotificationDelivery_status_updatedAt_idx" ON "GuildNotificationDelivery"("status", "updatedAt");

ALTER TABLE "WebPushSubscription"
  ADD CONSTRAINT "WebPushSubscription_dlmId_fkey"
  FOREIGN KEY ("dlmId") REFERENCES "DlmUser"("dlmId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GuildNotification"
  ADD CONSTRAINT "GuildNotification_dlmId_fkey"
  FOREIGN KEY ("dlmId") REFERENCES "DlmUser"("dlmId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GuildNotificationDelivery"
  ADD CONSTRAINT "GuildNotificationDelivery_notificationId_fkey"
  FOREIGN KEY ("notificationId") REFERENCES "GuildNotification"("id") ON DELETE CASCADE ON UPDATE CASCADE;
