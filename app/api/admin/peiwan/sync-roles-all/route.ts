import { NextResponse } from 'next/server';
import { canManagePeiwan, isHowardReadOnlyDiscordId } from '@/lib/admin';
import { getServerSession } from '@/lib/session';

const INTERNAL_HOST = process.env.INTERNAL_API_HOST ?? '127.0.0.1';
const INTERNAL_PORT = process.env.INTERNAL_API_PORT;
const INTERNAL_TOKEN = process.env.INTERNAL_API_TOKEN;

export async function POST() {
  const session = await getServerSession();
  if (!session?.discordId || !canManagePeiwan(session.discordId)) {
    return NextResponse.json({ error: '无权访问' }, { status: 403 });
  }
  if (isHowardReadOnlyDiscordId(session.discordId)) {
    return NextResponse.json({ error: '当前账号为只读权限，无法同步陪玩 tag。' }, { status: 403 });
  }
  if (!INTERNAL_PORT || !INTERNAL_TOKEN) {
    return NextResponse.json({ error: '内部接口未配置（INTERNAL_API_PORT/INTERNAL_API_TOKEN）' }, { status: 500 });
  }

  try {
    const endpoint = `http://${INTERNAL_HOST}:${INTERNAL_PORT}/internal/peiwan/sync-roles-all`;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Token': INTERNAL_TOKEN,
      },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = typeof data?.error === 'string' ? data.error : `内部接口错误 (${response.status})`;
      return NextResponse.json({ error: message }, { status: response.status });
    }
    return NextResponse.json(data, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
