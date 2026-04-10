import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentJinleeUser } from '@/lib/current-jinlee-user';

type RouteParams = { orderId: string };

export async function GET(request: Request, context: { params: Promise<RouteParams> }) {
  const currentUser = await getCurrentJinleeUser(request);
  if (!currentUser) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const params = await context.params;
  const order = await prisma.zPayRechargeOrder.findUnique({
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
