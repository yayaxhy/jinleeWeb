import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/session';
import { isAdminDiscordId } from '@/lib/admin';
import { decryptAuthAuditIp } from '@/lib/auth-login-audit';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const EVIDENCE_LOGIN_LOOKBACK_MS = 90 * 24 * 60 * 60 * 1000;
const MAX_ACTIVITY_ROWS = 500;

type RouteParams = { outTradeNo: string };

export async function GET(_request: NextRequest, context: { params: Promise<RouteParams> }) {
  const session = await getServerSession();
  if (!session?.discordId || !isAdminDiscordId(session.discordId)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { outTradeNo } = await context.params;
  const payment = await prisma.stripePayment.findUnique({
    where: { outTradeNo },
  });
  if (!payment?.jinleeId) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const activityStart = payment.paidAt ?? payment.createdAt;
  const loginStart = new Date(activityStart.getTime() - EVIDENCE_LOGIN_LOOKBACK_MS);
  const [accountBindings, loginEvents, rechargeRecords, transactions, orders, orderAudits, giftAudits, lotteryDraws, pageViews] =
    await Promise.all([
      prisma.accountBinding.findMany({
        where: { jinleeId: payment.jinleeId },
        select: { provider: true, providerUserId: true, lastLoginAt: true, createdAt: true, updatedAt: true },
      }),
      prisma.authLoginEvent.findMany({
        where: { jinleeId: payment.jinleeId, createdAt: { gte: loginStart } },
        orderBy: { createdAt: 'asc' },
        take: MAX_ACTIVITY_ROWS,
      }),
      prisma.recharge.findMany({
        where: { jinleeId: payment.jinleeId, createdAt: { gte: activityStart } },
        orderBy: { createdAt: 'asc' },
        take: MAX_ACTIVITY_ROWS,
      }),
      prisma.individualTransaction.findMany({
        where: { jinleeId: payment.jinleeId, timeCreatedAt: { gte: activityStart } },
        orderBy: { timeCreatedAt: 'asc' },
        take: MAX_ACTIVITY_ROWS,
      }),
      prisma.order.findMany({
        where: { hostJinleeId: payment.jinleeId, createdAt: { gte: activityStart } },
        orderBy: { createdAt: 'asc' },
        take: MAX_ACTIVITY_ROWS,
      }),
      prisma.orderAudit.findMany({
        where: { hostJinleeId: payment.jinleeId, createdAt: { gte: activityStart } },
        orderBy: { createdAt: 'asc' },
        take: MAX_ACTIVITY_ROWS,
      }),
      payment.discordUserId
        ? prisma.giftAudit.findMany({
            where: { giverId: payment.discordUserId, createdAt: { gte: activityStart } },
            orderBy: { createdAt: 'asc' },
            take: MAX_ACTIVITY_ROWS,
          })
        : Promise.resolve([]),
      prisma.lotteryDraw.findMany({
        where: { jinleeId: payment.jinleeId, createdAt: { gte: activityStart } },
        orderBy: { createdAt: 'asc' },
        take: MAX_ACTIVITY_ROWS,
      }),
      payment.discordUserId
        ? prisma.pageViewEvent.findMany({
            where: { discordUserId: payment.discordUserId, createdAt: { gte: activityStart } },
            orderBy: { createdAt: 'asc' },
            take: MAX_ACTIVITY_ROWS,
          })
        : Promise.resolve([]),
    ]);

  const evidence = {
    generatedAt: new Date().toISOString(),
    generatedByAdminDiscordId: session.discordId,
    payment,
    accountBindings,
    loginEvents: loginEvents.map((event) => ({
      id: event.id,
      jinleeId: event.jinleeId,
      discordUserId: event.discordUserId,
      provider: event.provider,
      userAgent: event.userAgent,
      referrer: event.referrer,
      visitorId: event.visitorId,
      createdAt: event.createdAt,
      ipAddress: decryptAuthAuditIp(event.ipAddressEncrypted),
    })),
    rechargeRecords,
    transactions,
    orders,
    orderAudits,
    giftAudits,
    lotteryDraws,
    pageViews,
  };

  const body = JSON.stringify(evidence, null, 2);
  return new NextResponse(body, {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="stripe-dispute-evidence-${payment.outTradeNo}.json"`,
      'Cache-Control': 'no-store',
    },
  });
}
