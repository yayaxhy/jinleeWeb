-- No historical tasks, identity snapshots or coupon receipts are inferred.
CREATE TABLE "GiftPostCommitTask" (
 "id" TEXT NOT NULL, "requestId" TEXT NOT NULL, "taskKey" TEXT NOT NULL,
 "kind" TEXT NOT NULL, "payload" JSONB NOT NULL, "status" TEXT NOT NULL DEFAULT 'PENDING',
 "attempts" INTEGER NOT NULL DEFAULT 0, "claimToken" TEXT, "claimedAt" TIMESTAMP(3),
 "completedAt" TIMESTAMP(3), "result" JSONB, "errorCode" TEXT,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "GiftPostCommitTask_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "GiftPostCommitTask_kind_check" CHECK ("kind" IN ('GIFT_WALL', 'DISCORD_MESSAGE')),
 CONSTRAINT "GiftPostCommitTask_status_check" CHECK ("status" IN ('PENDING','RUNNING','SUCCEEDED','FAILED','UNKNOWN','REQUIRES_REVIEW','SKIPPED')),
 CONSTRAINT "GiftPostCommitTask_attempts_check" CHECK ("attempts" >= 0)
);
CREATE UNIQUE INDEX "GiftPostCommitTask_requestId_taskKey_key" ON "GiftPostCommitTask"("requestId", "taskKey");
CREATE INDEX "GiftPostCommitTask_status_createdAt_idx" ON "GiftPostCommitTask"("status", "createdAt");
ALTER TABLE "GiftPostCommitTask" ADD CONSTRAINT "GiftPostCommitTask_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "GiftExecutionRequest"("requestId") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE TABLE "GiftPostCommitRetry" (
 "id" TEXT NOT NULL, "taskId" TEXT NOT NULL, "actorDiscordId" TEXT NOT NULL,
 "previousAttempts" INTEGER NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "GiftPostCommitRetry_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "GiftPostCommitRetry_taskId_createdAt_idx" ON "GiftPostCommitRetry"("taskId", "createdAt");
ALTER TABLE "GiftPostCommitRetry" ADD CONSTRAINT "GiftPostCommitRetry_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "GiftPostCommitTask"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PeiwanGiftUnlock" ADD COLUMN "ownerDlmIdSnapshot" TEXT, ADD COLUMN "peiwanIdSnapshot" INTEGER, ADD COLUMN "giftAuditIdSnapshot" TEXT;
ALTER TABLE "PeiwanGiftRewardClaim" ADD COLUMN "ownerDlmIdSnapshot" TEXT, ADD COLUMN "peiwanIdSnapshot" INTEGER, ADD COLUMN "giftAuditIdSnapshot" TEXT, ADD COLUMN "couponIds" JSONB, ADD COLUMN "rewardSnapshot" JSONB;
