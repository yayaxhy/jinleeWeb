-- Staff-created offline WeChat bosses. The DLM-ID portal is deliberately
-- read-only; wallet changes are performed by an authenticated admin only.
CREATE TYPE "DlmAdminOperationType" AS ENUM (
  'MANUAL_WECHAT_BOSS_CREATE',
  'MANUAL_WECHAT_RECHARGE',
  'DELEGATED_GIFT',
  'DELEGATED_ORDER'
);

CREATE TYPE "DlmAdminOperationStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED');

CREATE TABLE "ManualWechatBoss" (
  "dlmId" TEXT NOT NULL,
  "wechatContact" TEXT NOT NULL,
  "displayName" TEXT,
  "createdByDiscordId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ManualWechatBoss_pkey" PRIMARY KEY ("dlmId")
);

CREATE TABLE "DlmAdminOperation" (
  "id" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "receiptReference" TEXT,
  "dlmId" TEXT NOT NULL,
  "operatorDiscordId" TEXT NOT NULL,
  "type" "DlmAdminOperationType" NOT NULL,
  "status" "DlmAdminOperationStatus" NOT NULL DEFAULT 'PENDING',
  "details" JSONB,
  "result" JSONB,
  "failureReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DlmAdminOperation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ManualWechatBoss_wechatContact_key" ON "ManualWechatBoss"("wechatContact");
CREATE UNIQUE INDEX "DlmAdminOperation_requestId_key" ON "DlmAdminOperation"("requestId");
CREATE UNIQUE INDEX "DlmAdminOperation_receiptReference_key" ON "DlmAdminOperation"("receiptReference");
CREATE INDEX "ManualWechatBoss_createdByDiscordId_createdAt_idx" ON "ManualWechatBoss"("createdByDiscordId", "createdAt");
CREATE INDEX "DlmAdminOperation_dlmId_createdAt_idx" ON "DlmAdminOperation"("dlmId", "createdAt");
CREATE INDEX "DlmAdminOperation_operatorDiscordId_createdAt_idx" ON "DlmAdminOperation"("operatorDiscordId", "createdAt");
CREATE INDEX "DlmAdminOperation_type_status_createdAt_idx" ON "DlmAdminOperation"("type", "status", "createdAt");

ALTER TABLE "ManualWechatBoss"
  ADD CONSTRAINT "ManualWechatBoss_dlmId_fkey"
  FOREIGN KEY ("dlmId") REFERENCES "DlmUser"("dlmId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DlmAdminOperation"
  ADD CONSTRAINT "DlmAdminOperation_dlmId_fkey"
  FOREIGN KEY ("dlmId") REFERENCES "DlmUser"("dlmId") ON DELETE CASCADE ON UPDATE CASCADE;
