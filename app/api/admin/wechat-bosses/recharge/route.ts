import { NextRequest, NextResponse } from 'next/server';
import { isAdminDiscordId } from '@/lib/admin';
import { postInternalBot } from '@/lib/internal-bot';
import { rechargeManualWechatBoss } from '@/lib/manual-wechat-boss';
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
      receiptReference: typeof body?.receiptReference === 'string' ? body.receiptReference : null,
      note: typeof body?.note === 'string' ? body.note : null,
    });
    let notificationWarning: string | null = null;
    try {
      await postInternalBot('/internal/admin/wechat-boss-recharge-notify', {
        // A duplicate receipt is intentionally replayed rather than credited
        // again.  Its notification must still point to the original recharge.
        rechargeRequestId: result.result.rechargeRequestId ?? requestId,
      });
    } catch (notificationError) {
      console.error('[wechat-boss-recharge] channel notification failed', notificationError);
      notificationWarning = '充值已入账，但频道通知发送失败；请确认 Bot 已更新并完成数据库迁移后，用相同微信收款号重新提交以补发通知。';
    }
    return NextResponse.json({ ok: true, ...result, notificationWarning });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : '入账失败' }, { status: 400 });
  }
}
