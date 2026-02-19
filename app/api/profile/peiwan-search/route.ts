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
  const parsedId = Number.parseInt(keyword, 10);

  const rows = await prisma.pEIWAN.findMany({
    where: {
      OR: [
        Number.isInteger(parsedId) ? { PEIWANID: parsedId } : undefined,
        { discordUserId: { contains: keyword, mode: 'insensitive' } },
        { serverDisplayName: { contains: keyword, mode: 'insensitive' } },
        { member: { serverDisplayName: { contains: keyword, mode: 'insensitive' } } },
      ].filter(Boolean) as Array<Record<string, unknown>>,
    },
    orderBy: [{ PEIWANID: 'asc' }],
    take: 10,
    include: {
      member: { select: { serverDisplayName: true } },
    },
  });

  return NextResponse.json({
    data: rows.map((row) => ({
      id: row.PEIWANID,
      discordUserId: row.discordUserId,
      serverDisplayName: row.serverDisplayName ?? row.member?.serverDisplayName ?? row.discordUserId,
    })),
  });
}

