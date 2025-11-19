import { NextRequest, NextResponse } from 'next/server';
import { isAdminDiscordId } from '@/lib/admin';
import { prisma } from '@/lib/prisma';
import { buildPeiwanDataObject, normalizePeiwanPayload } from '@/lib/peiwan/payload';
import { getServerSession } from '@/lib/session';

const ensureAdminSession = async () => {
  const session = await getServerSession();
  if (!session?.discordId || !isAdminDiscordId(session.discordId)) {
    return null;
  }
  return session;
};

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ discordId: string }> },
) {
  const session = await ensureAdminSession();
  if (!session) {
    return NextResponse.json({ error: '无权访问' }, { status: 403 });
  }

  const { discordId: rawDiscordId } = await context.params;
  const discordId = decodeURIComponent(rawDiscordId);

  try {
    const body = await request.json();
    const payload = normalizePeiwanPayload({ ...body, discordUserId: discordId });
    const { discordUserId } = payload;
    const data = buildPeiwanDataObject(payload);

    const updated = await prisma.pEIWAN.update({
      where: { discordUserId },
      data,
    });

    return NextResponse.json({ peiwanId: updated.PEIWANID }, { status: 200 });
  } catch (error) {
    const message = (error as Error).message;
    if (message.includes('Record to update not found')) {
      return NextResponse.json({ error: '未找到该陪玩' }, { status: 404 });
    }
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
