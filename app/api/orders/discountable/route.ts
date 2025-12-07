import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from '@/lib/session';

const MAX_FETCH = 50;
const MAX_RETURN = 20;
const DISCOUNT_PRIZE_NAME = '8折券';

export async function GET() {
  const session = await getServerSession();
  if (!session?.discordId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const orders = await prisma.order.findMany({
    where: { hostId: session.discordId, status: 'ENDED' },
    orderBy: { endedAt: 'desc' },
    take: MAX_FETCH,
    select: {
      id: true,
      displayNo: true,
      workerId: true,
      unitPrice: true,
      totalMinutes: true,
      endedAt: true,
    },
  });

  const orderIds = orders.map((o) => o.id);
  if (orderIds.length === 0) {
    return NextResponse.json({ orders: [] });
  }

  const [couponUsage, lotteryUsage] = await Promise.all([
    prisma.coupon.findMany({
      where: { orderId: { in: orderIds }, status: 'USED' },
      select: { orderId: true },
    }),
    prisma.lotteryDraw.findMany({
      where: {
        requestId: { in: orderIds },
        status: 'USED',
        prize: { name: DISCOUNT_PRIZE_NAME },
      },
      select: { requestId: true },
    }),
  ]);

  const usedIds = new Set<string>();
  couponUsage.forEach((item) => item.orderId && usedIds.add(item.orderId));
  lotteryUsage.forEach((item) => item.requestId && usedIds.add(item.requestId));

  const eligible = orders.filter((order) => !usedIds.has(order.id)).slice(0, MAX_RETURN);

  return NextResponse.json({
    orders: eligible.map((order) => ({
      id: order.id,
      displayNo: order.displayNo,
      workerId: order.workerId,
      unitPrice: order.unitPrice,
      totalMinutes: order.totalMinutes,
      endedAt: order.endedAt,
    })),
  });
}
