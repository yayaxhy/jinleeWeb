import { prisma } from '@/lib/prisma';

const normalizeCurrency = (value: string | null | undefined) => value?.trim().toLowerCase() || null;

export const recordWechatNativePaymentSuccess = async (input: {
  outTradeNo: string;
  transactionId?: string | null;
  tradeState: string;
  amountFen: number;
  currency?: string | null;
  wechatEventId?: string | null;
}) => {
  const existing = await prisma.wechatNativePayment.findUnique({
    where: { outTradeNo: input.outTradeNo },
    select: { id: true },
  });
  if (!existing) return null;

  return prisma.wechatNativePayment.update({
    where: { outTradeNo: input.outTradeNo },
    data: {
      transactionId: input.transactionId ?? undefined,
      tradeState: input.tradeState,
      amountFen: input.amountFen,
      currency: normalizeCurrency(input.currency),
      paymentStatus: 'SUCCEEDED',
      latestWechatEventId: input.wechatEventId ?? undefined,
    },
  });
};

export const recordWechatNativePaymentFailure = async (input: {
  outTradeNo: string;
  tradeState?: string | null;
  reason?: string | null;
  closed?: boolean;
  wechatEventId?: string | null;
}) =>
  prisma.wechatNativePayment.updateMany({
    where: { outTradeNo: input.outTradeNo, status: 'PENDING' },
    data: {
      status: 'FAILED',
      paymentStatus: input.closed ? 'CLOSED' : 'FAILED',
      tradeState: input.tradeState ?? undefined,
      failedReason: input.reason ?? undefined,
      latestWechatEventId: input.wechatEventId ?? undefined,
    },
  });
