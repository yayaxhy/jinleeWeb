import { NextRequest, NextResponse } from 'next/server';
import { canManagePeiwan, isHowardReadOnlyDiscordId } from '@/lib/admin';
import { getServerSession } from '@/lib/session';

const INTERNAL_HOST = process.env.INTERNAL_API_HOST ?? '127.0.0.1';
const INTERNAL_PORT = process.env.INTERNAL_API_PORT;
const INTERNAL_TOKEN = process.env.INTERNAL_API_TOKEN;

const ensurePeiwanWriteSession = async () => {
  const session = await getServerSession();
  if (!session?.discordId || !canManagePeiwan(session.discordId)) {
    return null;
  }
  if (isHowardReadOnlyDiscordId(session.discordId)) {
    return null;
  }
  return session;
};

async function callInternalSync(discordId: string) {
  if (!INTERNAL_PORT || !INTERNAL_TOKEN) {
    throw new Error('内部接口未配置（INTERNAL_API_PORT/INTERNAL_API_TOKEN）');
  }

  const endpoint = `http://${INTERNAL_HOST}:${INTERNAL_PORT}/internal/peiwan/sync-roles`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Internal-Token': INTERNAL_TOKEN,
    },
    body: JSON.stringify({ discordId }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof data?.error === 'string' ? data.error : `内部接口错误 (${response.status})`;
    throw new Error(message);
  }
  return data;
}

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ discordId: string }> },
) {
  const session = await ensurePeiwanWriteSession();
  if (!session) {
    return NextResponse.json({ error: '无权访问' }, { status: 403 });
  }

  const { discordId: rawDiscordId } = await context.params;
  const discordId = decodeURIComponent(rawDiscordId).trim();
  if (!discordId) {
    return NextResponse.json({ error: '缺少 Discord ID' }, { status: 400 });
  }

  try {
    const result = await callInternalSync(discordId);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
