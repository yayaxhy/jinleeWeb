import { NextRequest, NextResponse } from 'next/server';
import { isAdminDiscordId } from '@/lib/admin';
import { createManualWechatBoss } from '@/lib/manual-wechat-boss';
import { getServerSession } from '@/lib/session';

export async function POST(request: NextRequest) {
  const session = await getServerSession();
  if (!session?.discordId || !isAdminDiscordId(session.discordId)) {
    return NextResponse.json({ error: '无权访问' }, { status: 403 });
  }
  try {
    const body = await request.json();
    const result = await createManualWechatBoss({
      requestId: String(body?.requestId ?? ''),
      operatorDiscordId: session.discordId,
      wechatContact: String(body?.wechatContact ?? ''),
      displayName: typeof body?.displayName === 'string' ? body.displayName : null,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : '创建失败' }, { status: 400 });
  }
}
