CREATE TABLE "AuthLoginEvent" (
    "id" TEXT NOT NULL,
    "jinleeId" TEXT,
    "discordUserId" TEXT,
    "provider" "AccountProvider" NOT NULL,
    "ipAddressEncrypted" TEXT,
    "ipHash" TEXT,
    "userAgent" TEXT,
    "referrer" TEXT,
    "visitorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthLoginEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AuthLoginEvent_jinleeId_createdAt_idx" ON "AuthLoginEvent"("jinleeId", "createdAt");
CREATE INDEX "AuthLoginEvent_discordUserId_createdAt_idx" ON "AuthLoginEvent"("discordUserId", "createdAt");
CREATE INDEX "AuthLoginEvent_ipHash_createdAt_idx" ON "AuthLoginEvent"("ipHash", "createdAt");
CREATE INDEX "AuthLoginEvent_createdAt_idx" ON "AuthLoginEvent"("createdAt");

ALTER TABLE "AuthLoginEvent"
ADD CONSTRAINT "AuthLoginEvent_jinleeId_fkey"
FOREIGN KEY ("jinleeId") REFERENCES "JinleeUser"("jinleeId")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AuthLoginEvent"
ADD CONSTRAINT "AuthLoginEvent_discordUserId_fkey"
FOREIGN KEY ("discordUserId") REFERENCES "Member"("discordUserId")
ON DELETE SET NULL ON UPDATE CASCADE;
