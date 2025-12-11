import { NextRequest, NextResponse } from 'next/server';
import { isAdminDiscordId } from '@/lib/admin';
import { prisma } from '@/lib/prisma';
import { buildPeiwanDataObject, normalizePeiwanPayload } from '@/lib/peiwan/payload';
import { getServerSession } from '@/lib/session';
import { MemberStatus, Prisma } from '@prisma/client';

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

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ discordId: string }> },
) {
  const session = await ensureAdminSession();
  if (!session) {
    return NextResponse.json({ error: '无权访问' }, { status: 403 });
  }

  const { discordId: rawDiscordId } = await context.params;
  const token = decodeURIComponent(rawDiscordId).trim();
  const numericId = Number(token);
  const searchByPeiwanId = Number.isSafeInteger(numericId) && numericId > 0;
  if (!token) {
    return NextResponse.json({ error: '缺少陪玩ID' }, { status: 400 });
  }

  try {
    const existing =
      (searchByPeiwanId
        ? await prisma.pEIWAN.findUnique({ where: { PEIWANID: numericId } })
        : null) || (await prisma.pEIWAN.findUnique({ where: { discordUserId: token } }));

    if (!existing) {
      return NextResponse.json({ error: '未找到陪玩' }, { status: 404 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.peiwanDeletion.create({
        data: {
          peiwanId: existing.PEIWANID,
          discordUserId: existing.discordUserId,
          deletedBy: session.discordId,
        },
      });

      await tx.member.update({
        where: { discordUserId: existing.discordUserId },
        data: { status: MemberStatus.LAOBAN },
      });
    });

    return NextResponse.json(
      {
        success: true,
        peiwanId: existing.PEIWANID,
        discordUserId: existing.discordUserId,
        message: '已记录删除并下架陪玩，不再出现在列表',
      },
      { status: 200 },
    );
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
