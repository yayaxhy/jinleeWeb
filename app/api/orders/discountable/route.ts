import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentJinleeUser } from '@/lib/current-jinlee-user';

const MAX_FETCH = 50;
const MAX_RETURN = 20;
const DISCOUNT_PRIZE_NAMES = ['8折券', '7折券', '特殊9折券', '特殊九折券'];

export async function GET(request: Request) {
  const currentUser = await getCurrentJinleeUser(request);
  if (!currentUser) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const orders = await prisma.order.findMany({
    where: { hostJinleeId: currentUser.jinleeId, status: 'ENDED' },
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

  const [couponUsage, pointShopUsage, lotteryUsage] = await Promise.all([
    prisma.coupon.findMany({
      where: { orderId: { in: orderIds }, status: 'USED' },
      select: { orderId: true },
    }),
    prisma.pointShopGrant.findMany({
      where: {
        consumeOrderId: { in: orderIds },
        deliveryType: 'COUPON',
        couponStatus: 'USED',
      },
      select: { consumeOrderId: true },
    }),
    prisma.lotteryDraw.findMany({
      where: {
        consumeOrderId: { in: orderIds },
        status: 'USED',
        prize: { name: { in: DISCOUNT_PRIZE_NAMES } },
      },
      select: { consumeOrderId: true },
    }),
  ]);

  const usedIds = new Set<string>();
  couponUsage.forEach((item) => item.orderId && usedIds.add(item.orderId));
  pointShopUsage.forEach((item) => item.consumeOrderId && usedIds.add(item.consumeOrderId));
  lotteryUsage.forEach((item) => item.consumeOrderId && usedIds.add(item.consumeOrderId));

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
