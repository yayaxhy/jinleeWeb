import { NextRequest, NextResponse } from 'next/server';
import { isAdminDiscordId } from '@/lib/admin';
import { postInternalBot } from '@/lib/internal-bot';
import { rechargeManualWechatBoss } from '@/lib/manual-wechat-boss';
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
    const requestId = String(body?.requestId ?? '');
    const result = await rechargeManualWechatBoss({
      requestId,
      operatorDiscordId: session.discordId,
      dlmId: String(body?.dlmId ?? ''),
      amount: body?.amount,
      receiptAccount: typeof body?.receiptAccount === 'string' ? body.receiptAccount : null,
      note: typeof body?.note === 'string' ? body.note : null,
    });
    let notificationWarning: string | null = null;
    try {
      await publishGuildNotification({
        dlmId: String(result.result.dlmId ?? body?.dlmId ?? ''),
        event: GuildNotificationEvent.BALANCE_ADJUSTED,
        title: '余额已人工充值',
        body: `客服已为你的账户入账 ${String(result.result.amount ?? body?.amount ?? '')} 币。`,
        href: '/console?tab=wallet',
        dedupeKey: `manual-recharge:${result.result.rechargeRequestId ?? requestId}`,
        details: { requestId, source: 'manual_wechat_recharge' },
      });
    } catch (deliveryError) {
      console.error('[wechat-boss-recharge] notification center failed', deliveryError);
      notificationWarning = '充值已入账，但通知中心写入失败。';
    }
    try {
      await postInternalBot('/internal/admin/wechat-boss-recharge-notify', {
        rechargeRequestId: result.result.rechargeRequestId ?? requestId,
      });
    } catch (notificationError) {
      console.error('[wechat-boss-recharge] channel notification failed', notificationError);
      notificationWarning = notificationWarning
        ? `${notificationWarning} Discord 频道通知也发送失败。`
        : '充值已入账，但频道通知发送失败；请确认 Bot 已更新并完成数据库迁移后，重新提交本次操作以补发通知。';
    }
    return NextResponse.json({ ok: true, ...result, notificationWarning });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : '入账失败' }, { status: 400 });
  }
}
