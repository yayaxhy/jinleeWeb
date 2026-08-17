import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { settleRechargeOrderPayment } from '@/lib/recharge-order';
import { queryNativeRechargeOrder } from '@/lib/wechat-pay';
import { recordWechatNativePaymentFailure, recordWechatNativePaymentSuccess } from '@/lib/wechat-native-payment';

const TERMINAL_TRADE_STATES = new Set(['CLOSED', 'REVOKED', 'PAYERROR']);

export type WechatNativeReconciliationResult =
  | { kind: 'not_found' | 'not_pending' | 'pending' }
  | { kind: 'paid' | 'already_paid' }
  | { kind: 'failed'; tradeState: string }
  | { kind: 'invalid_order'; reason: string };

export const reconcileWechatNativePayment = async (
  outTradeNo: string,
): Promise<WechatNativeReconciliationResult> => {
  const payment = await prisma.wechatNativePayment.findUnique({
    where: { outTradeNo },
    select: { status: true },
  });
  if (!payment) return { kind: 'not_found' };
  if (payment.status !== 'PENDING') return { kind: 'not_pending' };

  const remoteOrder = await queryNativeRechargeOrder(outTradeNo);
  if (remoteOrder.trade_state === 'SUCCESS') {
    const recorded = await recordWechatNativePaymentSuccess({
      outTradeNo: remoteOrder.out_trade_no,
      transactionId: remoteOrder.transaction_id,
      tradeState: remoteOrder.trade_state,
      amountFen: remoteOrder.amount.total,
      currency: remoteOrder.amount.currency,
    });
    if (!recorded) return { kind: 'not_found' };

    const settlement = await settleRechargeOrderPayment({
      outTradeNo: remoteOrder.out_trade_no,
      amount: new Prisma.Decimal(remoteOrder.amount.total).div(100).toDecimalPlaces(2),
      orderProvider: 'wechat_native',
      gatewayTradeNo: remoteOrder.transaction_id ?? null,
      payerReference: remoteOrder.transaction_id ?? remoteOrder.out_trade_no,
      transactionType: '微信Native充值',
    });

    if (settlement.kind === 'paid' || settlement.kind === 'already_paid') {
      return { kind: settlement.kind };
    }
    if (settlement.kind === 'invalid_order') return settlement;
    return { kind: 'invalid_order', reason: settlement.kind };
  }

  if (TERMINAL_TRADE_STATES.has(remoteOrder.trade_state)) {
    await recordWechatNativePaymentFailure({
      outTradeNo: remoteOrder.out_trade_no,
      tradeState: remoteOrder.trade_state,
      reason: `wechat_trade_state:${remoteOrder.trade_state}`,
      closed: remoteOrder.trade_state === 'CLOSED',
    });
    return { kind: 'failed', tradeState: remoteOrder.trade_state };
  }

  return { kind: 'pending' };
};

export const reconcileExpiredWechatNativePayments = async (limit = 100) => {
  const payments = await prisma.wechatNativePayment.findMany({
    where: {
      status: 'PENDING',
      expiresAt: { lte: new Date() },
    },
    select: { outTradeNo: true },
    orderBy: { expiresAt: 'asc' },
    take: Math.min(Math.max(limit, 1), 100),
  });

  const summary = { checked: payments.length, paid: 0, closed: 0, pending: 0, failed: 0 };
  for (const payment of payments) {
    try {
      const result = await reconcileWechatNativePayment(payment.outTradeNo);
      if (result.kind === 'paid' || result.kind === 'already_paid') summary.paid += 1;
      else if (result.kind === 'failed') summary.closed += 1;
      else if (result.kind === 'pending') summary.pending += 1;
      else summary.failed += 1;
    } catch (error) {
      summary.failed += 1;
      console.error('[wechat.native.reconcile] failed', { outTradeNo: payment.outTradeNo, error });
    }
  }

  return summary;
};
