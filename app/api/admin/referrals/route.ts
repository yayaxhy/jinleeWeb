import { ReferralType } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
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

const normalizeId = (value?: string | null) => value?.trim() ?? '';

const parseReferralType = (value?: string | null): ReferralType | null => {
  if (!value) return null;
  const upper = value.trim().toUpperCase();
  return Object.values(ReferralType).includes(upper as ReferralType) ? (upper as ReferralType) : null;
};

export async function GET(request: NextRequest) {
  const session = await ensureAdminSession();
  if (!session) {
    return NextResponse.json({ error: '无权访问' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const inviteeId = normalizeId(searchParams.get('inviteeId'));
  const inviterId = normalizeId(searchParams.get('inviterId'));
  const type = parseReferralType(searchParams.get('type'));

  const where = {
    ...(inviteeId ? { inviteeId } : {}),
    ...(inviterId ? { inviterId } : {}),
    ...(type ? { type } : {}),
  };

  const [total, referrals] = await Promise.all([
    prisma.referral.count({ where }),
    prisma.referral.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
  ]);

  return NextResponse.json({ referrals, total });
}

export async function POST(request: Request) {
  const session = await ensureAdminSession();
  if (!session) {
    return NextResponse.json({ error: '无权访问' }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const inviteeId = normalizeId(body?.inviteeId);
  const inviterId = normalizeId(body?.inviterId);
  const type = parseReferralType(body?.type);

  if (!inviteeId || !inviterId || !type) {
    return NextResponse.json({ error: 'inviteeId、inviterId、type 均为必填' }, { status: 400 });
  }
  if (inviteeId === inviterId) {
    return NextResponse.json({ error: '禁止自邀' }, { status: 400 });
  }

  const existing = await prisma.referral.findUnique({ where: { inviteeId } });
  if (existing) {
    return NextResponse.json({ error: '该被邀请人已存在邀请记录' }, { status: 409 });
  }

  const [invitee, inviter] = await Promise.all([
    prisma.member.findUnique({ where: { discordUserId: inviteeId } }),
    prisma.member.findUnique({ where: { discordUserId: inviterId } }),
  ]);
  if (!invitee) {
    return NextResponse.json({ error: '被邀请人不存在，请先创建成员' }, { status: 404 });
  }
  if (!inviter) {
    return NextResponse.json({ error: '邀请人不存在，请先创建成员' }, { status: 404 });
  }

  const created = await prisma.referral.create({
    data: {
      inviteeId,
      inviterId,
      type,
    },
  });

  return NextResponse.json({ referral: created }, { status: 201 });
}
