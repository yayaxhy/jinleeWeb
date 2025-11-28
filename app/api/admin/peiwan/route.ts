import { NextResponse } from 'next/server';
import { isAdminDiscordId } from '@/lib/admin';
import { prisma } from '@/lib/prisma';
import { buildPeiwanDataObject, normalizePeiwanPayload } from '@/lib/peiwan/payload';
import { getServerSession } from '@/lib/session';
import { registerPeiwanProfile } from '@/lib/peiwan/registerPeiwan';

const ensureAdminSession = async () => {
  const session = await getServerSession();
  if (!session?.discordId || !isAdminDiscordId(session.discordId)) {
    return null;
  }
  return session;
};

export async function POST(request: Request) {
  const session = await ensureAdminSession();
  if (!session) {
    return NextResponse.json({ error: '无权访问' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const payload = normalizePeiwanPayload(body, { allowPeiwanId: true });
    const { discordUserId, peiwanId } = payload;

    const existing = await prisma.pEIWAN.findUnique({ where: { discordUserId } });
    if (existing) {
      return NextResponse.json({ error: '该 Discord ID 已存在陪玩资料' }, { status: 409 });
    }
    if (peiwanId) {
      const idConflict = await prisma.pEIWAN.findUnique({ where: { PEIWANID: peiwanId } });
      if (idConflict) {
        return NextResponse.json({ error: '该陪玩 ID 已被占用' }, { status: 409 });
      }
    }

    await prisma.member.upsert({
      where: { discordUserId },
      update: { status: 'PEIWAN' },
      create: {
        discordUserId,
        status: 'PEIWAN',
      },
    });

    const aggregate = await prisma.pEIWAN.aggregate({ _max: { PEIWANID: true } });
    const nextPeiwanId = peiwanId ?? (aggregate._max.PEIWANID ?? 0) + 1;
    const data = buildPeiwanDataObject(payload);
    const created = await prisma.pEIWAN.create({
      data: {
        PEIWANID: nextPeiwanId,
        discordUserId,
        ...data,
      },
    });

    await registerPeiwanProfile(discordUserId);

    return NextResponse.json({ peiwanId: created.PEIWANID }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
