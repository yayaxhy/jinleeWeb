CREATE TYPE "StripePaymentStatus" AS ENUM (
    'PENDING',
    'SUCCEEDED',
    'PARTIALLY_REFUNDED',
    'REFUNDED',
    'DISPUTED',
    'DISPUTE_CLOSED',
    'FAILED',
    'EXPIRED'
);

CREATE TABLE "StripePayment" (
    "id" TEXT NOT NULL,
    "outTradeNo" TEXT NOT NULL,
    "discordUserId" TEXT,
    "jinleeId" TEXT,
    "rechargeAmount" DECIMAL(19,4) NOT NULL,
    "priceId" TEXT,
    "selectedCurrency" TEXT,
    "status" "RechargeOrderStatus" NOT NULL DEFAULT 'PENDING',
    "paymentStatus" "StripePaymentStatus" NOT NULL DEFAULT 'PENDING',
    "checkoutSessionId" TEXT,
    "paymentIntentId" TEXT,
    "chargeId" TEXT,
    "chargedAmount" INTEGER,
    "chargedCurrency" TEXT,
    "refundedAmount" INTEGER NOT NULL DEFAULT 0,
    "balanceTransactionId" TEXT,
    "balanceAmount" INTEGER,
    "balanceFee" INTEGER,
    "balanceNet" INTEGER,
    "balanceCurrency" TEXT,
    "disputeId" TEXT,
    "disputeStatus" TEXT,
    "latestStripeEventId" TEXT,
    "failedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StripePayment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StripePayment_outTradeNo_key" ON "StripePayment"("outTradeNo");
CREATE UNIQUE INDEX "StripePayment_checkoutSessionId_key" ON "StripePayment"("checkoutSessionId");
CREATE UNIQUE INDEX "StripePayment_paymentIntentId_key" ON "StripePayment"("paymentIntentId");
CREATE UNIQUE INDEX "StripePayment_chargeId_key" ON "StripePayment"("chargeId");
CREATE UNIQUE INDEX "StripePayment_balanceTransactionId_key" ON "StripePayment"("balanceTransactionId");
CREATE UNIQUE INDEX "StripePayment_disputeId_key" ON "StripePayment"("disputeId");
CREATE INDEX "StripePayment_status_updatedAt_idx" ON "StripePayment"("status", "updatedAt");
CREATE INDEX "StripePayment_jinleeId_status_createdAt_idx" ON "StripePayment"("jinleeId", "status", "createdAt");
CREATE INDEX "StripePayment_chargedCurrency_createdAt_idx" ON "StripePayment"("chargedCurrency", "createdAt");

ALTER TABLE "StripePayment"
ADD CONSTRAINT "StripePayment_discordUserId_fkey"
FOREIGN KEY ("discordUserId") REFERENCES "Member"("discordUserId")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "StripePayment"
ADD CONSTRAINT "StripePayment_jinleeId_fkey"
FOREIGN KEY ("jinleeId") REFERENCES "JinleeUser"("jinleeId")
ON DELETE SET NULL ON UPDATE CASCADE;

-- Preserve existing Stripe orders while removing their raw event payloads from ZPayRechargeOrder.
INSERT INTO "StripePayment" (
    "id",
    "outTradeNo",
    "discordUserId",
    "jinleeId",
    "rechargeAmount",
    "priceId",
    "selectedCurrency",
    "status",
    "paymentStatus",
    "checkoutSessionId",
    "paymentIntentId",
    "chargedAmount",
    "chargedCurrency",
    "latestStripeEventId",
    "createdAt",
    "paidAt",
    "updatedAt"
)
SELECT
    CONCAT('sp_', REPLACE(gen_random_uuid()::text, '-', '')),
    o."outTradeNo",
    o."discordUserId",
    o."jinleeId",
    o."amount",
    NULLIF(o."notifyPayload"->>'priceId', ''),
    COALESCE(
        NULLIF(o."notifyPayload"->>'selectedCurrency', ''),
        NULLIF(o."notifyPayload"->'data'->'object'->'metadata'->>'selected_currency', ''),
        NULLIF(o."notifyPayload"->'data'->'object'->>'currency', '')
    ),
    o."status",
    CASE
        WHEN o."status" = 'PAID' THEN 'SUCCEEDED'::"StripePaymentStatus"
        WHEN o."status" = 'FAILED' THEN 'FAILED'::"StripePaymentStatus"
        ELSE 'PENDING'::"StripePaymentStatus"
    END,
    COALESCE(
        NULLIF(o."notifyPayload"->>'sessionId', ''),
        NULLIF(o."notifyPayload"->'data'->'object'->>'id', ''),
        CASE WHEN o."gatewayTradeNo" LIKE 'cs_%' THEN o."gatewayTradeNo" ELSE NULL END
    ),
    COALESCE(
        NULLIF(o."notifyPayload"->>'paymentIntentId', ''),
        NULLIF(o."notifyPayload"->'data'->'object'->>'payment_intent', ''),
        CASE WHEN o."gatewayTradeNo" LIKE 'pi_%' THEN o."gatewayTradeNo" ELSE NULL END
    ),
    CASE
        WHEN COALESCE(
            o."notifyPayload"->>'chargedAmountMinor',
            o."notifyPayload"->'data'->'object'->>'amount_total'
        ) ~ '^[0-9]+$'
        THEN COALESCE(
            o."notifyPayload"->>'chargedAmountMinor',
            o."notifyPayload"->'data'->'object'->>'amount_total'
        )::INTEGER
        ELSE NULL
    END,
    COALESCE(
        NULLIF(o."notifyPayload"->>'chargedCurrency', ''),
        NULLIF(o."notifyPayload"->'data'->'object'->>'currency', '')
    ),
    NULLIF(o."notifyPayload"->>'eventId', ''),
    o."createdAt",
    o."paidAt",
    o."createdAt"
FROM "ZPayRechargeOrder" o
WHERE o."channel" = 'stripe_checkout';

DELETE FROM "ZPayRechargeOrder"
WHERE "channel" = 'stripe_checkout';
