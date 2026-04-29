import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentJinleeUser } from '@/lib/current-jinlee-user';
import { queryNativeRechargeOrder } from '@/lib/wechat-pay';
import { settleRechargeOrderPayment } from '@/lib/recharge-order';

type RouteParams = { orderId: string };

export async function GET(request: Request, context: { params: Promise<RouteParams> }) {
  const currentUser = await getCurrentJinleeUser(request);
  if (!currentUser) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const params = await context.params;
  let order = await prisma.zPayRechargeOrder.findUnique({
    where: { outTradeNo: params.orderId },
    select: {
      outTradeNo: true,
      amount: true,
      status: true,
      channel: true,
      paidAt: true,
      createdAt: true,
      discordUserId: true,
      jinleeId: true,
    },
  });

  if (
    !order ||
    (order.jinleeId && order.jinleeId !== currentUser.jinleeId) ||
    (!order.jinleeId && order.discordUserId !== currentUser.discordUserId)
  ) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
  }

  if (order.status !== 'PAID' && order.channel === 'wechat_native') {
    try {
      const remoteOrder = await queryNativeRechargeOrder(order.outTradeNo);
      if (remoteOrder.trade_state === 'SUCCESS') {
        await settleRechargeOrderPayment({
          outTradeNo: remoteOrder.out_trade_no,
          amount: (remoteOrder.amount.total / 100).toFixed(2),
          gatewayTradeNo: remoteOrder.transaction_id ?? null,
          notifyPayload: { transaction: remoteOrder, source: 'manual_query' },
          payerReference: remoteOrder.payer?.openid ?? remoteOrder.transaction_id ?? remoteOrder.out_trade_no,
          transactionType: '微信Native充值',
        });

        order = await prisma.zPayRechargeOrder.findUnique({
          where: { outTradeNo: params.orderId },
          select: {
            outTradeNo: true,
            amount: true,
            status: true,
            channel: true,
            paidAt: true,
            createdAt: true,
            discordUserId: true,
            jinleeId: true,
          },
        });
      }
    } catch (error) {
      console.error('[recharge.order.status] wechat query failed', {
        outTradeNo: params.orderId,
        error,
      });
    }
  }

  if (!order) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    order: {
      id: order.outTradeNo,
      amount: order.amount.toString(),
      status: order.status,
      channel: order.channel,
      paidAt: order.paidAt,
      createdAt: order.createdAt,
    },
  });
}
