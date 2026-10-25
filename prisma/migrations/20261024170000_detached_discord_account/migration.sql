CREATE TABLE "DetachedDiscordAccount" (
  "ownerDlmId" TEXT NOT NULL,
  "memberKey" TEXT NOT NULL,
  "originalDiscordId" TEXT NOT NULL,
  "detachedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DetachedDiscordAccount_pkey" PRIMARY KEY ("ownerDlmId")
);
CREATE UNIQUE INDEX "DetachedDiscordAccount_memberKey_key" ON "DetachedDiscordAccount"("memberKey");
