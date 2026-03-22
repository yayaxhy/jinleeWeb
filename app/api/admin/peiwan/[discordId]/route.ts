import { NextRequest, NextResponse } from 'next/server';
import { canManagePeiwan, isHowardReadOnlyDiscordId } from '@/lib/admin';
import { prisma } from '@/lib/prisma';
import { buildPeiwanDataObject, normalizePeiwanPayload } from '@/lib/peiwan/payload';
import { getServerSession } from '@/lib/session';
import { MemberStatus } from '@prisma/client';

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

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ discordId: string }> },
) {
  const session = await ensurePeiwanWriteSession();
  if (!session) {
    return NextResponse.json({ error: '无权访问' }, { status: 403 });
  }

  const { discordId: rawDiscordId } = await context.params;
  const discordId = decodeURIComponent(rawDiscordId);

  try {
    const body = await request.json();
    const payload = normalizePeiwanPayload({ ...body, discordUserId: discordId }, { allowPeiwanId: true });
    const { discordUserId } = payload;
    const data = buildPeiwanDataObject(payload);
    const nextCommissionRate = payload.commissionRate.toString();

    const updated = await prisma.$transaction(async (tx) => {
      const existing = await tx.pEIWAN.findUnique({ where: { discordUserId } });
      if (!existing) throw new Error('Record to update not found');

      const targetId = payload.peiwanId ?? existing.PEIWANID;
      if (targetId !== existing.PEIWANID) {
        const conflict = await tx.pEIWAN.findUnique({ where: { PEIWANID: targetId } });
        if (conflict) {
          throw new Error('陪玩ID 已被占用');
        }
      }

      const autoCommissionBuff = await tx.autoCommissionBuff.findUnique({
        where: { userId: discordUserId },
        select: { activeUntil: true },
      });
      const autoCommissionActive =
        !!autoCommissionBuff?.activeUntil && new Date(autoCommissionBuff.activeUntil).getTime() > Date.now();
      const commissionRateChanged = existing.commissionRate.toString() !== nextCommissionRate;

      const updatedPeiwan = await tx.pEIWAN.update({
        where: { discordUserId },
        data: {
          PEIWANID: targetId,
          ...data,
          ...(!autoCommissionActive && commissionRateChanged
            ? { baseCommissionRate: nextCommissionRate }
            : {}),
        },
      });

      return updatedPeiwan;
    });

    return NextResponse.json({ peiwanId: updated.PEIWANID, type: updated.type }, { status: 200 });
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
  const session = await ensurePeiwanWriteSession();
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
