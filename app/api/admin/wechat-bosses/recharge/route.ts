import { getSiteCopy } from "@/lib/site-copy-server";
import { NextRequest, NextResponse } from 'next/server';
import { isAdminDiscordId } from '@/lib/admin';
import { postInternalBot } from '@/lib/internal-bot';
import { rechargeManualWechatBoss } from '@/lib/manual-wechat-boss';
import { ManualWechatReversalError } from '@/lib/manual-wechat-recharge-reversal';
import { GuildNotificationEvent } from '@prisma/client';
import { publishGuildNotification } from '@/lib/notification-center';
import { getServerSession } from '@/lib/session';

export async function POST(request: NextRequest) {
  const session = await getServerSession();
  if (!session?.discordId || !isAdminDiscordId(session.discordId)) {
    return NextResponse.json({ error: '无权访问' }, { status: 403 });
  }
  let debitRequested = false;
  try {
    const body = await request.json();
    debitRequested = String(body?.amount ?? '').trim().startsWith('-');
    const requestId = String(body?.requestId ?? '');
    const result = await rechargeManualWechatBoss({
      requestId,
      operatorDiscordId: session.discordId,
      dlmId: String(body?.dlmId ?? ''),
      amount: body?.amount,
      receiptAccount: typeof body?.receiptAccount === 'string' ? body.receiptAccount : null,
      note: typeof body?.note === 'string' ? body.note : null,
    }, { debitTransactionType: '充值回退' });
    // Use the persisted outcome: a debit must never enter the credit-only
    // notification paths, including on an idempotent retry.
    if (Number(result.result.amount) < 0) {
      return NextResponse.json({ ok: true, ...result, notificationWarning: null });
    }
    const copy = await getSiteCopy();
    let notificationWarning: string | null = null;
    try {
      await publishGuildNotification({
        dlmId: String(result.result.dlmId ?? body?.dlmId ?? ''),
        event: GuildNotificationEvent.BALANCE_ADJUSTED,
        title: copy("site.app.api.admin.wechat.bosses.recharge.route.333c89553678"),
        body: copy("site.app.api.admin.wechat.bosses.recharge.route.3f58c4e9a04d", {value1: String(String(result.result.amount ?? body?.amount ?? ''))}),
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
    if (error instanceof ManualWechatReversalError) {
      const message = error.code === 'INVALID_INPUT'
        ? '请填写有效金额和微信收款账号。'
        : error.code === 'BOSS_NOT_FOUND'
          ? '未找到该微信老板账户。'
          : error.code === 'INSUFFICIENT_BALANCE'
            ? '当前余额或充值余额不足，无法扣回该金额。'
            : '操作失败，请稍后重试。';
      return NextResponse.json({ error: message }, { status: 400 });
    }
    if (debitRequested) {
      console.error('[wechat-boss-recharge] debit failed', error);
      return NextResponse.json({ error: '操作失败，请稍后重试。' }, { status: 400 });
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : '入账失败' }, { status: 400 });
  }
}
