import { NextRequest, NextResponse } from 'next/server';
import { MemberStatus, PeiwanStatus } from '@prisma/client';
import { isAdminDiscordId } from '@/lib/admin';
import { prisma } from '@/lib/prisma';
import { getServerSession } from '@/lib/session';

const ensureAdminSession = async () => {
  const session = await getServerSession();
  if (!session?.discordId || !isAdminDiscordId(session.discordId)) {
    return null;
  }
  return session;
};

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ discordId: string }> },
) {
  const session = await ensureAdminSession();
  if (!session) {
    return NextResponse.json({ error: '无权访问' }, { status: 403 });
  }

  const { discordId: rawDiscordId } = await context.params;
  const token = decodeURIComponent(rawDiscordId).trim();
  if (!token) {
    return NextResponse.json({ error: '缺少陪玩ID' }, { status: 400 });
  }

  const numericId = Number(token);
  const searchByPeiwanId = Number.isSafeInteger(numericId) && numericId > 0;

  try {
    const existing =
      (searchByPeiwanId
        ? await prisma.pEIWAN.findUnique({ where: { PEIWANID: numericId } })
        : null) || (await prisma.pEIWAN.findUnique({ where: { discordUserId: token } }));

    if (!existing) {
      return NextResponse.json({ error: '未找到陪玩' }, { status: 404 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.peiwanDeletion.deleteMany({ where: { peiwanId: existing.PEIWANID } });
      await tx.member.update({
        where: { discordUserId: existing.discordUserId },
        data: { status: MemberStatus.PEIWAN },
      });
      await tx.pEIWAN.update({
        where: { PEIWANID: existing.PEIWANID },
        data: { status: PeiwanStatus.free },
      });
    });

    return NextResponse.json(
      {
        success: true,
        peiwanId: existing.PEIWANID,
        discordUserId: existing.discordUserId,
        message: '已恢复陪玩，上架生效',
      },
      { status: 200 },
    );
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
