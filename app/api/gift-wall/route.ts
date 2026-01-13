import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const resolveDiscordId = async (discordId: string | null, peiwanIdRaw: string | null) => {
  if (discordId) return discordId;
  if (!peiwanIdRaw) return null;
  const peiwanId = Number.parseInt(peiwanIdRaw, 10);
  if (!Number.isFinite(peiwanId) || peiwanId <= 0) return null;
  const peiwan = await prisma.pEIWAN.findUnique({
    where: { PEIWANID: peiwanId },
    select: { discordUserId: true },
  });
  return peiwan?.discordUserId ?? null;
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const discordId = url.searchParams.get('discordId');
  const peiwanIdRaw = url.searchParams.get('peiwanId');
  const resolvedId = await resolveDiscordId(discordId, peiwanIdRaw);

  if (!resolvedId) {
    return NextResponse.json({ ok: false, error: 'missing_user' }, { status: 400 });
  }

  const peiwan = await prisma.pEIWAN.findUnique({
    where: { discordUserId: resolvedId },
    select: { discordUserId: true },
  });
  if (!peiwan) {
    return NextResponse.json({ ok: false, error: 'not_peiwan' }, { status: 404 });
  }

  const [gifts, unlocks] = await Promise.all([
    prisma.gift.findMany({
      where: { active: true },
      select: { GiftName: true, giftImage: { select: { fileName: true, category: true } } },
      orderBy: { GiftName: 'asc' },
    }),
    prisma.peiwanGiftUnlock.findMany({
      where: { discordUserId: resolvedId },
      select: { giftName: true, unlockedAt: true },
    }),
  ]);

  const unlockedMap = new Map(unlocks.map((row) => [row.giftName, row.unlockedAt]));
  const data = gifts
    .filter((gift) => gift.giftImage?.fileName)
    .map((gift) => ({
      giftName: gift.GiftName,
      imageUrl: gift.giftImage?.fileName ? `/gift-wall/${gift.giftImage.fileName}` : null,
      category: gift.giftImage?.category ?? '默认',
      unlocked: unlockedMap.has(gift.GiftName),
      unlockedAt: unlockedMap.get(gift.GiftName)?.toISOString() ?? null,
    }));
  const visibleGifts = data.filter((gift) => gift.category !== '老板');
  const unlockedCount = visibleGifts.filter((gift) => gift.unlocked).length;

  return NextResponse.json({
    ok: true,
    discordUserId: resolvedId,
    total: visibleGifts.length,
    unlockedCount,
    gifts: visibleGifts,
  });
}
