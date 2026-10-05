import { NextRequest, NextResponse } from 'next/server';
import { isAdminDiscordId } from '@/lib/admin';
import { giftManualWechatBoss } from '@/lib/manual-wechat-boss';
import { GuildNotificationEvent } from '@prisma/client';
import { publishGuildNotification } from '@/lib/notification-center';
import { getServerSession } from '@/lib/session';

export async function POST(request: NextRequest) {
  const session = await getServerSession();
  if (!session?.discordId || !isAdminDiscordId(session.discordId)) {
    return NextResponse.json({ error: '无权访问' }, { status: 403 });
  }
  try {
    const body = await request.json();
    const result = await giftManualWechatBoss({
      requestId: String(body?.requestId ?? ''),
      operatorDiscordId: session.discordId,
      dlmId: String(body?.dlmId ?? ''),
      amount: body?.amount,
      reason: body?.reason,
    });
    try {
      await publishGuildNotification({
        dlmId: String(result.result.dlmId ?? body?.dlmId ?? ''),
        event: GuildNotificationEvent.BALANCE_ADJUSTED,
        title: '余额已调整',
        body: `客服已向你的账户发放 ${String(result.result.amount ?? body?.amount ?? '')} 币${body?.reason ? `（${String(body.reason).slice(0, 40)}）` : ''}。`,
        href: '/console?tab=wallet',
        dedupeKey: `manual-gift:${String(body?.requestId ?? '')}`,
        details: { requestId: String(body?.requestId ?? ''), source: 'manual_wechat_gift' },
      });
    } catch (notificationError) {
      // The balance mutation is already durable; notification failure must not
      // turn a successful manual adjustment into an API error.
      console.error('[wechat-boss-cashback] notification center failed', notificationError);
    }
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : '余额赠送失败' }, { status: 400 });
  }
}
