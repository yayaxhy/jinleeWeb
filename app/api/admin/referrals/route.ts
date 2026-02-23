import { ReferralType } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { canViewReferrals, isAdminDiscordId, isHowardDiscordId, isHowardReadOnlyDiscordId } from '@/lib/admin';
import { prisma } from '@/lib/prisma';
import {
  buildReferralInviteeIneligibleMessage,
  checkReferralInviteeEligibility,
} from '@/lib/referralEligibility';
import { getServerSession } from '@/lib/session';

const ensureReferralReadSession = async () => {
  const session = await getServerSession();
  if (!session?.discordId || !canViewReferrals(session.discordId)) {
    return null;
  }
  return session;
};

const ensureReferralWriteSession = async () => {
  const session = await getServerSession();
  if (!session?.discordId) return null;
  if (isHowardReadOnlyDiscordId(session.discordId)) return null;
  if (isAdminDiscordId(session.discordId) || isHowardDiscordId(session.discordId)) {
    return session;
  }
  return null;
};

const normalizeId = (value?: string | null) => value?.trim() ?? '';

const parseReferralType = (value?: string | null): ReferralType | null => {
  if (!value) return null;
  const upper = value.trim().toUpperCase();
  return Object.values(ReferralType).includes(upper as ReferralType) ? (upper as ReferralType) : null;
};

export async function GET(request: NextRequest) {
  const session = await ensureReferralReadSession();
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

  const [total, referralsRaw] = await Promise.all([
    prisma.referral.count({ where }),
    prisma.referral.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        invitee: { select: { serverDisplayName: true } },
        inviter: { select: { serverDisplayName: true } },
      },
    }),
  ]);

  const referrals = referralsRaw.map((row) => ({
    inviteeId: row.inviteeId,
    inviterId: row.inviterId,
    type: row.type,
    createdAt: row.createdAt,
    inviteeDisplayName: row.invitee?.serverDisplayName ?? null,
    inviterDisplayName: row.inviter?.serverDisplayName ?? null,
  }));

  return NextResponse.json({ referrals, total });
}

export async function POST(request: Request) {
  const session = await ensureReferralWriteSession();
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

  const [inviteeEligibility, inviter] = await Promise.all([
    checkReferralInviteeEligibility(inviteeId),
    prisma.member.findUnique({ where: { discordUserId: inviterId } }),
  ]);
  if (!inviteeEligibility) {
    return NextResponse.json({ error: '被邀请人不存在，请先创建成员' }, { status: 404 });
  }
  if (!inviteeEligibility.ok) {
    return NextResponse.json(
      { error: buildReferralInviteeIneligibleMessage(inviteeEligibility) },
      { status: 400 },
    );
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
