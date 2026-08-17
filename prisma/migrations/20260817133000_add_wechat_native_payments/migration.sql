CREATE TYPE "WechatNativePaymentStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED', 'CLOSED');

CREATE TABLE "WechatNativePayment" (
    "id" TEXT NOT NULL,
    "outTradeNo" TEXT NOT NULL,
    "discordUserId" TEXT,
    "jinleeId" TEXT,
    "rechargeAmount" DECIMAL(19,4) NOT NULL,
    "status" "RechargeOrderStatus" NOT NULL DEFAULT 'PENDING',
    "paymentStatus" "WechatNativePaymentStatus" NOT NULL DEFAULT 'PENDING',
    "transactionId" TEXT,
    "tradeState" TEXT,
    "amountFen" INTEGER,
    "currency" TEXT,
    "latestWechatEventId" TEXT,
    "failedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WechatNativePayment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WechatNativePayment_outTradeNo_key" ON "WechatNativePayment"("outTradeNo");
CREATE UNIQUE INDEX "WechatNativePayment_transactionId_key" ON "WechatNativePayment"("transactionId");
CREATE INDEX "WechatNativePayment_status_updatedAt_idx" ON "WechatNativePayment"("status", "updatedAt");
CREATE INDEX "WechatNativePayment_status_expiresAt_idx" ON "WechatNativePayment"("status", "expiresAt");
CREATE INDEX "WechatNativePayment_jinleeId_status_createdAt_idx" ON "WechatNativePayment"("jinleeId", "status", "createdAt");
CREATE INDEX "WechatNativePayment_tradeState_createdAt_idx" ON "WechatNativePayment"("tradeState", "createdAt");

ALTER TABLE "WechatNativePayment"
ADD CONSTRAINT "WechatNativePayment_discordUserId_fkey"
FOREIGN KEY ("discordUserId") REFERENCES "Member"("discordUserId")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "WechatNativePayment"
ADD CONSTRAINT "WechatNativePayment_jinleeId_fkey"
FOREIGN KEY ("jinleeId") REFERENCES "JinleeUser"("jinleeId")
ON DELETE SET NULL ON UPDATE CASCADE;

-- Preserve historic WeChat Native orders without retaining callback payloads or payer OpenIDs in the new table.
INSERT INTO "WechatNativePayment" (
    "id",
    "outTradeNo",
    "discordUserId",
    "jinleeId",
    "rechargeAmount",
    "status",
    "paymentStatus",
    "transactionId",
    "tradeState",
    "amountFen",
    "currency",
    "latestWechatEventId",
    "createdAt",
    "expiresAt",
    "paidAt",
    "updatedAt"
)
SELECT
    CONCAT('wnp_', REPLACE(gen_random_uuid()::text, '-', '')),
    o."outTradeNo",
    o."discordUserId",
    o."jinleeId",
    o."amount",
    o."status",
    CASE
        WHEN o."status" = 'PAID' THEN 'SUCCEEDED'::"WechatNativePaymentStatus"
        WHEN o."status" = 'FAILED' THEN 'FAILED'::"WechatNativePaymentStatus"
        ELSE 'PENDING'::"WechatNativePaymentStatus"
    END,
    o."gatewayTradeNo",
    NULLIF(o."notifyPayload"->'transaction'->>'trade_state', ''),
    ROUND(o."amount" * 100)::INTEGER,
    LOWER(COALESCE(
        NULLIF(o."notifyPayload"->'transaction'->'amount'->>'currency', ''),
        NULLIF(o."notifyPayload"->'transaction'->'amount'->>'payer_currency', ''),
        'cny'
    )),
    NULLIF(o."notifyPayload"->'notification'->>'id', ''),
    o."createdAt",
    CASE WHEN o."status" = 'PENDING' THEN o."createdAt" + INTERVAL '1 hour' ELSE NULL END,
    o."paidAt",
    o."createdAt"
FROM "ZPayRechargeOrder" o
WHERE o."channel" = 'wechat_native';

DELETE FROM "ZPayRechargeOrder"
WHERE "channel" = 'wechat_native';
