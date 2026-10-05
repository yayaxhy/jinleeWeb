import { MiniConversationType } from '@prisma/client';
import { NextResponse } from 'next/server';

import { canViewKefuWorkspace } from '@/lib/admin';
import { prisma } from '@/lib/prisma';
import { getServerSession } from '@/lib/session';

const nameOf = (user: { discordDisplayName: string | null; wechatDisplayName: string | null; member: { serverDisplayName: string | null } | null } | null) =>
  user?.discordDisplayName || user?.member?.serverDisplayName || user?.wechatDisplayName || '未知用户';

export async function GET() {
  const session = await getServerSession();
  if (!session?.discordId || !canViewKefuWorkspace(session.discordId)) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
  }
  const rows = await prisma.miniConversation.findMany({
    where: { type: MiniConversationType.SUPPORT },
    include: {
      userA: { include: { member: { select: { serverDisplayName: true } } } },
      messages: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
    orderBy: { updatedAt: 'desc' },
    take: 200,
  });
  return NextResponse.json({
    ok: true,
    conversations: rows.map((row) => ({
      id: row.id,
      userName: nameOf(row.userA),
      userDlmId: row.userAId,
      lastMessage: row.messages[0]?.body ?? '',
      updatedAt: row.updatedAt.toISOString(),
    })),
  });
}
