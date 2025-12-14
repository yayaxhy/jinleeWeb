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

  const eligible = orders
    .filter((order) => {
      if (usedIds.has(order.id)) return false;
      const minutes = Number(order.totalMinutes ?? 0);
      if (!Number.isFinite(minutes) || minutes <= 5) return false;
      const unitPrice = Number(order.unitPrice ?? 0);
      if (!Number.isFinite(unitPrice) || unitPrice <= 0) return false;
      return true;
    })
    .slice(0, MAX_RETURN);

  return NextResponse.json({
    orders: eligible.map((order) => ({
      id: order.id,
      displayNo: order.displayNo,
      workerId: order.workerId,
      totalMinutes: order.totalMinutes,
      totalAmount: (() => {
        const minutes = Number(order.totalMinutes ?? 0);
        const unitPrice = Number(order.unitPrice ?? 0); // 按小时计价
        if (!Number.isFinite(minutes) || !Number.isFinite(unitPrice)) return undefined;
        const billableMinutes = Math.max(0, minutes - 5); // 前 5 分钟免费
        const amount = (unitPrice * billableMinutes) / 60;
        return amount.toFixed(2);
      })(),
      endedAt: order.endedAt,
    })),
  });
}
