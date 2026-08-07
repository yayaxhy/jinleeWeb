import crypto from 'crypto';
import { Prisma } from '@prisma/client';

const STRIPE_CHECKOUT_SESSIONS_URL = 'https://api.stripe.com/v1/checkout/sessions';
const STRIPE_THREE_D_SECURE_VALUES = new Set(['automatic', 'any', 'challenge']);
const DEFAULT_STRIPE_RECHARGE_PRICES = [
  { amount: '3', priceId: 'price_1U1mbHFvZwyimnyiXoFKWTft' },
  { amount: '500', priceId: 'price_1U1knZFvZwyimnyiJOGnUvhh' },
  { amount: '1000', priceId: 'price_1U1knZFvZwyimnyiuNLpYHJ6' },
  { amount: '2000', priceId: 'price_1U1knZFvZwyimnyiA2lAZJeE' },
  { amount: '5000', priceId: 'price_1U1knZFvZwyimnyiwKY9nm2G' },
] as const;
const STRIPE_TEST_RECHARGE_AMOUNT = new Prisma.Decimal('3').toDecimalPlaces(2);

export type StripeRechargePrice = {
  amount: Prisma.Decimal;
  amountText: string;
  priceId: string;
};

type StripeCheckoutSessionPayload = {
  id?: string;
  url?: string | null;
  error?: {
    code?: string;
    message?: string;
    param?: string;
    type?: string;
  };
};

export class StripeCheckoutSessionError extends Error {
  code?: string;
  param?: string;
  stripeType?: string;
  status: number;

  constructor(input: { message: string; code?: string; param?: string; stripeType?: string; status: number }) {
    super(input.message);
    this.name = 'StripeCheckoutSessionError';
    this.code = input.code;
    this.param = input.param;
    this.stripeType = input.stripeType;
    this.status = input.status;
  }
}

export type StripeWebhookEvent = {
  id: string;
  type: string;
  data: {
    object: Record<string, unknown>;
  };
};

export type StripeCheckoutSessionObject = {
  id?: string;
  client_reference_id?: string | null;
  customer_email?: string | null;
  customer_details?: {
    email?: string | null;
  } | null;
  payment_intent?: string | { id?: string } | null;
  payment_status?: string | null;
  status?: string | null;
  metadata?: Record<string, string> | null;
};

export const getStripeSecretKey = () => {
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
  if (!secretKey) {
    throw new Error('STRIPE_SECRET_KEY is not configured');
  }
  return secretKey;
};

export const getStripeWebhookSecret = () => {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!webhookSecret) {
    throw new Error('STRIPE_WEBHOOK_SECRET is not configured');
  }
  return webhookSecret;
};

export const getStripeRechargePrices = (): StripeRechargePrice[] =>
  DEFAULT_STRIPE_RECHARGE_PRICES.map((price) => {
    const envOverride = process.env[`STRIPE_RECHARGE_PRICE_${price.amount}`]?.trim();
    return {
      amount: new Prisma.Decimal(price.amount).toDecimalPlaces(2),
      amountText: new Prisma.Decimal(price.amount).toDecimalPlaces(2).toFixed(2),
      priceId: envOverride || price.priceId,
    };
  });

export const findStripeRechargePrice = (amount: Prisma.Decimal | number | string) => {
  const normalizedAmount = new Prisma.Decimal(amount).toDecimalPlaces(2);
  return getStripeRechargePrices().find((price) => price.amount.equals(normalizedAmount)) ?? null;
};

export const getStripeFirstRechargeAmount = () =>
  new Prisma.Decimal(process.env.STRIPE_FIRST_RECHARGE_AMOUNT ?? '500').toDecimalPlaces(2);

export const isStripeRechargeAmountAllowed = (input: {
  amount: Prisma.Decimal | number | string;
  hasPriorRecharge: boolean;
}) => {
  const normalizedAmount = new Prisma.Decimal(input.amount).toDecimalPlaces(2);
  return (
    normalizedAmount.equals(STRIPE_TEST_RECHARGE_AMOUNT) ||
    input.hasPriorRecharge ||
    normalizedAmount.equals(getStripeFirstRechargeAmount())
  );
};

export const buildStripeOutTradeNo = (jinleeId: string) => {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = crypto.randomBytes(4).toString('hex').toUpperCase();
  const suffix = jinleeId.slice(-4).toUpperCase();
  return `STRIPE${timestamp}${random}${suffix}`;
};

const getStripeThreeDSecureMode = () => {
  const configured = process.env.STRIPE_REQUEST_THREE_D_SECURE?.trim();
  return configured && STRIPE_THREE_D_SECURE_VALUES.has(configured) ? configured : 'challenge';
};

export const createStripeCheckoutSession = async (input: {
  secretKey: string;
  priceId: string;
  outTradeNo: string;
  jinleeId: string;
  discordUserId?: string | null;
  rechargeAmount: string;
  successUrl: string;
  cancelUrl: string;
}) => {
  const params = new URLSearchParams();
  params.set('mode', 'payment');
  params.set('payment_method_types[0]', 'card');
  params.set('payment_method_options[card][request_three_d_secure]', getStripeThreeDSecureMode());
  params.set('billing_address_collection', 'required');
  params.set('phone_number_collection[enabled]', 'true');
  params.set('success_url', input.successUrl);
  params.set('cancel_url', input.cancelUrl);
  params.set('client_reference_id', input.outTradeNo);
  params.set('line_items[0][price]', input.priceId);
  params.set('line_items[0][quantity]', '1');
  params.set('metadata[out_trade_no]', input.outTradeNo);
  params.set('metadata[jinlee_id]', input.jinleeId);
  params.set('metadata[recharge_amount]', input.rechargeAmount);
  params.set('payment_intent_data[metadata][out_trade_no]', input.outTradeNo);
  params.set('payment_intent_data[metadata][jinlee_id]', input.jinleeId);
  params.set('payment_intent_data[metadata][recharge_amount]', input.rechargeAmount);
  if (input.discordUserId) {
    params.set('metadata[discord_user_id]', input.discordUserId);
    params.set('payment_intent_data[metadata][discord_user_id]', input.discordUserId);
  }

  const response = await fetch(STRIPE_CHECKOUT_SESSIONS_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${input.secretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Idempotency-Key': input.outTradeNo,
    },
    body: params,
  });

  const payload = (await response.json()) as StripeCheckoutSessionPayload;
  if (!response.ok || !payload.url || !payload.id) {
    throw new StripeCheckoutSessionError({
      message: payload.error?.message || 'stripe_checkout_session_failed',
      code: payload.error?.code,
      param: payload.error?.param,
      stripeType: payload.error?.type,
      status: response.status,
    });
  }

  return {
    id: payload.id,
    url: payload.url,
  };
};

const parseStripeSignatureHeader = (header: string) => {
  const parsed: { timestamp?: string; signatures: string[] } = { signatures: [] };
  header.split(',').forEach((part) => {
    const [key, value] = part.split('=');
    if (key === 't') parsed.timestamp = value;
    if (key === 'v1' && value) parsed.signatures.push(value);
  });
  return parsed;
};

const timingSafeHexEqual = (left: string, right: string) => {
  const leftBuffer = Buffer.from(left, 'hex');
  const rightBuffer = Buffer.from(right, 'hex');
  if (leftBuffer.length !== rightBuffer.length) return false;
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
};

export const verifyStripeWebhookPayload = (input: {
  rawBody: string;
  signatureHeader: string | null;
  webhookSecret: string;
}) => {
  if (!input.signatureHeader) {
    throw new Error('stripe_signature_missing');
  }

  const parsed = parseStripeSignatureHeader(input.signatureHeader);
  if (!parsed.timestamp || parsed.signatures.length === 0) {
    throw new Error('stripe_signature_invalid');
  }

  const toleranceSeconds = Number(process.env.STRIPE_WEBHOOK_TOLERANCE_SECONDS ?? 300);
  const timestampSeconds = Number(parsed.timestamp);
  if (!Number.isFinite(timestampSeconds)) {
    throw new Error('stripe_signature_timestamp_invalid');
  }

  const ageSeconds = Math.abs(Date.now() / 1000 - timestampSeconds);
  if (ageSeconds > toleranceSeconds) {
    throw new Error('stripe_signature_timestamp_out_of_range');
  }

  const expected = crypto
    .createHmac('sha256', input.webhookSecret)
    .update(`${parsed.timestamp}.${input.rawBody}`, 'utf8')
    .digest('hex');

  const valid = parsed.signatures.some((signature) => timingSafeHexEqual(expected, signature));
  if (!valid) {
    throw new Error('stripe_signature_mismatch');
  }

  return JSON.parse(input.rawBody) as StripeWebhookEvent;
};

export const getStripePaymentIntentId = (session: StripeCheckoutSessionObject) => {
  if (typeof session.payment_intent === 'string') return session.payment_intent;
  return session.payment_intent?.id ?? null;
};
