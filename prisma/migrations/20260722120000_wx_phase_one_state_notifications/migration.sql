CREATE TYPE "MiniAvailabilityStatus" AS ENUM ('AVAILABLE', 'BUSY', 'RESTING');

ALTER TABLE "JinleeUser"
  ADD COLUMN "miniAvailability" "MiniAvailabilityStatus" NOT NULL DEFAULT 'AVAILABLE',
  ADD COLUMN "miniCriticalNotifications" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "miniMessageNotifications" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "miniDispatchNotifications" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "MiniConversation"
  ADD COLUMN "userALastReadAt" TIMESTAMP(3),
  ADD COLUMN "userBLastReadAt" TIMESTAMP(3);

ALTER TABLE "MiniMessageModerationEvent"
  ADD COLUMN "notifiedAt" TIMESTAMP(3),
  ADD COLUMN "notificationError" TEXT;
