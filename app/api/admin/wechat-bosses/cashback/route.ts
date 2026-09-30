import { NextRequest, NextResponse } from 'next/server';
import { isAdminDiscordId } from '@/lib/admin';
import { cashbackManualWechatBossRecharge } from '@/lib/manual-wechat-boss';
import { getServerSession } from '@/lib/session';

export async function POST(request: NextRequest) {
  const session = await getServerSession();
  if (!session?.discordId || !isAdminDiscordId(session.discordId)) {
    return NextResponse.json({ error: '无权访问' }, { status: 403 });
  }
  try {
    const body = await request.json();
    const result = await cashbackManualWechatBossRecharge({
      requestId: String(body?.requestId ?? ''),
      operatorDiscordId: session.discordId,
      dlmId: String(body?.dlmId ?? ''),
      amount: body?.amount,
      sourceReceiptReference: typeof body?.sourceReceiptReference === 'string' ? body.sourceReceiptReference : null,
      note: typeof body?.note === 'string' ? body.note : null,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : '充值返现失败' }, { status: 400 });
  }
}
