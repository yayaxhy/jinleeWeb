import { NextRequest, NextResponse } from 'next/server';
import { isAdminDiscordId } from '@/lib/admin';
import { postInternalBot } from '@/lib/internal-bot';
import { getServerSession } from '@/lib/session';

export async function POST(request: NextRequest) {
  const session = await getServerSession();
  if (!session?.discordId || !isAdminDiscordId(session.discordId)) {
    return NextResponse.json({ error: '无权访问' }, { status: 403 });
  }
  try {
    const body = await request.json();
    const data = await postInternalBot<Record<string, unknown>>('/internal/admin/delegated-gift', {
      requestId: String(body?.requestId ?? ''),
      dlmId: String(body?.dlmId ?? ''),
      peiwanId: String(body?.peiwanId ?? ''),
      giftName: String(body?.giftName ?? ''),
      quantity: Number(body?.quantity),
      operatorDiscordId: session.discordId,
    });
    return NextResponse.json(data);
  } catch (error: any) {
    const status = typeof error?.status === 'number' ? error.status : 500;
    return NextResponse.json({ error: error?.message ?? '代打赏失败' }, { status });
  }
}
