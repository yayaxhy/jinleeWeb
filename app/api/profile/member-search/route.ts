import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from '@/lib/session';

export async function GET(request: Request) {
  const session = await getServerSession();
  if (!session?.discordId) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  const url = new URL(request.url);
  const keywordRaw = (url.searchParams.get('keyword') ?? '').trim();
  if (!keywordRaw) {
    return NextResponse.json({ data: [] });
  }

  const keyword = keywordRaw.slice(0, 64);
  const parsedPeiwanId = Number.parseInt(keyword, 10);
  const orFilters = [
    { discordUserId: { contains: keyword, mode: 'insensitive' as const } },
    { serverDisplayName: { contains: keyword, mode: 'insensitive' as const } },
    { peiwan: { is: { serverDisplayName: { contains: keyword, mode: 'insensitive' as const } } } },
    Number.isInteger(parsedPeiwanId) ? { peiwan: { is: { PEIWANID: parsedPeiwanId } } } : undefined,
  ].filter(Boolean) as Array<Record<string, unknown>>;

  const rows = await prisma.member.findMany({
    where: {
      discordUserId: { not: session.discordId },
      OR: orFilters,
    },
    orderBy: [{ status: 'asc' }, { serverDisplayName: 'asc' }],
    take: 10,
    select: {
      discordUserId: true,
      serverDisplayName: true,
      status: true,
      peiwan: {
        select: {
          PEIWANID: true,
          serverDisplayName: true,
        },
      },
    },
  });

  return NextResponse.json({
    data: rows.map((row) => ({
      discordUserId: row.discordUserId,
      displayName: row.peiwan?.serverDisplayName ?? row.serverDisplayName ?? row.discordUserId,
      statusLabel: row.status === 'PEIWAN' ? '陪玩' : '老板',
      peiwanId: row.peiwan?.PEIWANID ?? null,
    })),
  });
}
