import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from '@/lib/session';

type BlacklistPayload = {
  blockedId?: string;
};

const blacklistEntrySelect = {
  blockedId: true,
  createdAt: true,
  blocked: {
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
  },
} as const;

const formatEntry = (
  row: {
    blockedId: string;
    createdAt: Date;
    blocked: {
      discordUserId: string;
      serverDisplayName: string | null;
      status: 'LAOBAN' | 'PEIWAN';
      peiwan: { PEIWANID: number; serverDisplayName: string | null } | null;
    };
  },
) => ({
  discordUserId: row.blockedId,
  displayName: row.blocked.peiwan?.serverDisplayName ?? row.blocked.serverDisplayName ?? row.blocked.discordUserId,
  statusLabel: row.blocked.status === 'PEIWAN' ? '陪玩' : '老板',
  peiwanId: row.blocked.peiwan?.PEIWANID ?? null,
  createdAtLabel: row.createdAt.toISOString().slice(0, 10),
});

async function getSessionMemberId() {
  const session = await getServerSession();
  if (!session?.discordId) {
    return { error: NextResponse.json({ error: '未登录' }, { status: 401 }) };
  }

  const member = await prisma.member.findUnique({
    where: { discordUserId: session.discordId },
    select: { discordUserId: true },
  });
  if (!member) {
    return { error: NextResponse.json({ error: '仅限已有会员使用黑名单功能' }, { status: 403 }) };
  }

  return { blockerId: member.discordUserId };
}

export async function GET() {
  const sessionMember = await getSessionMemberId();
  if ('error' in sessionMember) {
    return sessionMember.error;
  }

  const rows = await prisma.blacklist.findMany({
    where: { blockerId: sessionMember.blockerId },
    orderBy: { createdAt: 'desc' },
    select: blacklistEntrySelect,
  });

  return NextResponse.json({
    data: rows.map(formatEntry),
  });
}

export async function POST(request: Request) {
  const sessionMember = await getSessionMemberId();
  if ('error' in sessionMember) {
    return sessionMember.error;
  }

  const body = (await request.json().catch(() => ({}))) as BlacklistPayload;
  const blockedId = body.blockedId?.trim();
  if (!blockedId) {
    return NextResponse.json({ error: '缺少拉黑对象' }, { status: 400 });
  }
  if (blockedId === sessionMember.blockerId) {
    return NextResponse.json({ error: '不能将自己加入黑名单' }, { status: 400 });
  }

  const target = await prisma.member.findUnique({
    where: { discordUserId: blockedId },
    select: { discordUserId: true },
  });
  if (!target) {
    return NextResponse.json({ error: '未找到该用户' }, { status: 404 });
  }

  const entry = await prisma.blacklist.upsert({
    where: {
      blockerId_blockedId: {
        blockerId: sessionMember.blockerId,
        blockedId,
      },
    },
    update: {},
    create: {
      blockerId: sessionMember.blockerId,
      blockedId,
    },
    select: blacklistEntrySelect,
  });

  return NextResponse.json({
    ok: true,
    entry: formatEntry(entry),
  });
}

export async function DELETE(request: Request) {
  const sessionMember = await getSessionMemberId();
  if ('error' in sessionMember) {
    return sessionMember.error;
  }

  const body = (await request.json().catch(() => ({}))) as BlacklistPayload;
  const blockedId = body.blockedId?.trim();
  if (!blockedId) {
    return NextResponse.json({ error: '缺少解除对象' }, { status: 400 });
  }

  await prisma.blacklist.deleteMany({
    where: {
      blockerId: sessionMember.blockerId,
      blockedId,
    },
  });

  return NextResponse.json({ ok: true });
}
