import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from '@/lib/session';

type RouteParams = { orderId: string };

export async function GET(request: Request, context: { params: Promise<RouteParams> }) {
  const session = await getServerSession();
  if (!session?.discordId) {
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
    },
  });

  if (!order || order.discordUserId !== session.discordId) {
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
