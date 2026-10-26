import { NextRequest, NextResponse } from 'next/server';

import { isAdminDiscordId } from '@/lib/admin';
import { correctManualWechatBossRecharge } from '@/lib/manual-wechat-recharge-correction';
import { getServerSession } from '@/lib/session';

export async function POST(request: NextRequest) {
  const session = await getServerSession();
  if (!session?.discordId || !isAdminDiscordId(session.discordId)) {
    return NextResponse.json({ error: '无权访问' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const result = await correctManualWechatBossRecharge({
      requestId: String(body?.requestId ?? ''),
      operatorDiscordId: session.discordId,
      sourceOperationId: String(body?.sourceOperationId ?? ''),
      targetDlmId: String(body?.targetDlmId ?? ''),
      reason: String(body?.reason ?? ''),
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : '充值更正失败' }, { status: 400 });
  }
}
