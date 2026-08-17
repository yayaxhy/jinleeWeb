import { prisma } from '@/lib/prisma';
import type { StripePaymentAccounting } from '@/lib/stripe-recharge';

type StripePaymentLifecycle =
  | 'PENDING'
  | 'SUCCEEDED'
  | 'PARTIALLY_REFUNDED'
  | 'REFUNDED'
  | 'DISPUTED'
  | 'DISPUTE_CLOSED'
  | 'FAILED'
  | 'EXPIRED';

const requireInteger = (value: number | null, field: string) => {
  if (value === null || !Number.isInteger(value)) {
    throw new Error(`stripe_payment_${field}_missing`);
  }
  return value;
};

const requireCurrency = (value: string | null, field: string) => {
  const currency = value?.trim().toLowerCase();
  if (!currency) throw new Error(`stripe_payment_${field}_missing`);
  return currency;
};

const accountingData = (accounting: StripePaymentAccounting) => ({
  chargeId: accounting.chargeId ?? null,
  chargedAmount: requireInteger(accounting.chargedAmount, 'charged_amount'),
  chargedCurrency: requireCurrency(accounting.chargedCurrency, 'charged_currency'),
  refundedAmount: accounting.refundedAmount ?? 0,
  balanceTransactionId: accounting.balanceTransactionId ?? null,
  balanceAmount: accounting.balanceAmount ?? null,
  balanceFee: accounting.balanceFee ?? null,
  balanceNet: accounting.balanceNet ?? null,
  balanceCurrency: accounting.balanceCurrency?.trim().toLowerCase() ?? null,
});

const lifecycleFromAccounting = (data: ReturnType<typeof accountingData>): StripePaymentLifecycle => {
  if (data.refundedAmount >= data.chargedAmount) return 'REFUNDED';
  if (data.refundedAmount > 0) return 'PARTIALLY_REFUNDED';
  return 'SUCCEEDED';
};

export const recordStripePaymentSuccess = async (input: {
  outTradeNo: string;
  checkoutSessionId: string;
  accounting: StripePaymentAccounting;
  stripeEventId: string;
}) => {
  const existing = await prisma.stripePayment.findUnique({
    where: { outTradeNo: input.outTradeNo },
    select: { paymentStatus: true },
  });
  if (!existing) return null;

  const data = accountingData(input.accounting);
  const paymentStatus =
    existing.paymentStatus === 'DISPUTED' || existing.paymentStatus === 'DISPUTE_CLOSED'
      ? existing.paymentStatus
      : lifecycleFromAccounting(data);

  return prisma.stripePayment.update({
    where: { outTradeNo: input.outTradeNo },
    data: {
      checkoutSessionId: input.checkoutSessionId,
      paymentIntentId: input.accounting.paymentIntentId,
      ...data,
      paymentStatus,
      latestStripeEventId: input.stripeEventId,
    },
  });
};

export const recordStripeRefund = async (input: {
  paymentIntentId: string;
  accounting: StripePaymentAccounting;
  stripeEventId: string;
}) => {
  const existing = await prisma.stripePayment.findUnique({
    where: { paymentIntentId: input.paymentIntentId },
    select: { paymentStatus: true },
  });
  if (!existing) return null;

  const data = accountingData(input.accounting);
  const paymentStatus =
    existing.paymentStatus === 'DISPUTED' || existing.paymentStatus === 'DISPUTE_CLOSED'
      ? existing.paymentStatus
      : lifecycleFromAccounting(data);

  return prisma.stripePayment.update({
    where: { paymentIntentId: input.paymentIntentId },
    data: {
      ...data,
      paymentStatus,
      latestStripeEventId: input.stripeEventId,
    },
  });
};

export const recordStripeDispute = async (input: {
  paymentIntentId?: string | null;
  chargeId?: string | null;
  disputeId: string;
  disputeStatus?: string | null;
  closed: boolean;
  stripeEventId: string;
}) => {
  const where = input.paymentIntentId
    ? { paymentIntentId: input.paymentIntentId }
    : input.chargeId
      ? { chargeId: input.chargeId }
      : null;
  if (!where) return null;

  const result = await prisma.stripePayment.updateMany({
    where,
    data: {
      disputeId: input.disputeId,
      disputeStatus: input.disputeStatus ?? undefined,
      paymentStatus: input.closed ? 'DISPUTE_CLOSED' : 'DISPUTED',
      latestStripeEventId: input.stripeEventId,
    },
  });
  return result.count > 0;
};

export const recordStripeCheckoutFailure = async (input: {
  outTradeNo: string;
  checkoutSessionId?: string | null;
  paymentIntentId?: string | null;
  expired: boolean;
  reason?: string | null;
  stripeEventId?: string | null;
}) =>
  prisma.stripePayment.updateMany({
    where: { outTradeNo: input.outTradeNo, status: 'PENDING' },
    data: {
      checkoutSessionId: input.checkoutSessionId ?? undefined,
      paymentIntentId: input.paymentIntentId ?? undefined,
      status: 'FAILED',
      paymentStatus: input.expired ? 'EXPIRED' : 'FAILED',
      failedReason: input.reason ?? undefined,
      latestStripeEventId: input.stripeEventId ?? undefined,
    },
  });
