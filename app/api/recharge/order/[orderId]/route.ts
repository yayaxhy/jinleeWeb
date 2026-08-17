import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentJinleeUser } from '@/lib/current-jinlee-user';
import { reconcileWechatNativePayment } from '@/lib/wechat-native-reconciliation';

type RouteParams = { orderId: string };

const belongsToCurrentUser = (
  order: { jinleeId: string | null; discordUserId: string | null },
  currentUser: { jinleeId: string; discordUserId: string | null },
) => {
  if (order.jinleeId) {
    return order.jinleeId === currentUser.jinleeId;
  }
  return order.discordUserId === currentUser.discordUserId;
};

export async function GET(request: Request, context: { params: Promise<RouteParams> }) {
  const currentUser = await getCurrentJinleeUser(request);
  if (!currentUser) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const params = await context.params;
  const zpayOrder = await prisma.zPayRechargeOrder.findUnique({
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

  if (zpayOrder) {
    if (!belongsToCurrentUser(zpayOrder, currentUser)) {
      return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
    }
    return NextResponse.json({
      ok: true,
      order: {
        id: zpayOrder.outTradeNo,
        amount: zpayOrder.amount.toString(),
        status: zpayOrder.status,
        channel: zpayOrder.channel,
        paidAt: zpayOrder.paidAt,
        createdAt: zpayOrder.createdAt,
      },
    });
  }

  let wechatNativePayment = await prisma.wechatNativePayment.findUnique({
    where: { outTradeNo: params.orderId },
    select: {
      outTradeNo: true,
      rechargeAmount: true,
      status: true,
      paidAt: true,
      createdAt: true,
      expiresAt: true,
      discordUserId: true,
      jinleeId: true,
    },
  });

  if (wechatNativePayment) {
    if (!belongsToCurrentUser(wechatNativePayment, currentUser)) {
      return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
    }

    if (wechatNativePayment.status === 'PENDING') {
      try {
        await reconcileWechatNativePayment(wechatNativePayment.outTradeNo);

        wechatNativePayment = await prisma.wechatNativePayment.findUnique({
          where: { outTradeNo: params.orderId },
          select: {
            outTradeNo: true,
            rechargeAmount: true,
            status: true,
            paidAt: true,
            createdAt: true,
            expiresAt: true,
            discordUserId: true,
            jinleeId: true,
          },
        });
      } catch (error) {
        console.error('[recharge.order.status] wechat query failed', {
          outTradeNo: params.orderId,
          error,
        });
      }
    }

    if (!wechatNativePayment) {
      return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      order: {
        id: wechatNativePayment.outTradeNo,
        amount: wechatNativePayment.rechargeAmount.toString(),
        status: wechatNativePayment.status,
        channel: 'wechat_native',
        paidAt: wechatNativePayment.paidAt,
        createdAt: wechatNativePayment.createdAt,
        expiresAt: wechatNativePayment.expiresAt,
      },
    });
  }

  const stripePayment = await prisma.stripePayment.findUnique({
    where: { outTradeNo: params.orderId },
    select: {
      outTradeNo: true,
      rechargeAmount: true,
      status: true,
      paidAt: true,
      createdAt: true,
      discordUserId: true,
      jinleeId: true,
    },
  });

  if (!stripePayment || !belongsToCurrentUser(stripePayment, currentUser)) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    order: {
      id: stripePayment.outTradeNo,
      amount: stripePayment.rechargeAmount.toString(),
      status: stripePayment.status,
      channel: 'stripe_checkout',
      paidAt: stripePayment.paidAt,
      createdAt: stripePayment.createdAt,
    },
  });
}
