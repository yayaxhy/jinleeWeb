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

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ inviteeId: string }> },
) {
  const session = await ensureAdminSession();
  if (!session) {
    return NextResponse.json({ error: '无权访问' }, { status: 403 });
  }

  const { inviteeId: rawInviteeId } = await context.params;
  const inviteeId = decodeURIComponent(rawInviteeId);

  const body = await request.json().catch(() => null);
  const type = parseReferralType(body?.type);
  const inviterId = normalizeId(body?.inviterId);

  if (!type && !inviterId) {
    return NextResponse.json({ error: '至少需要提供 type 或 inviterId' }, { status: 400 });
  }

  if (inviterId && inviterId === inviteeId) {
    return NextResponse.json({ error: '禁止自邀' }, { status: 400 });
  }

  if (inviterId) {
    const inviter = await prisma.member.findUnique({ where: { discordUserId: inviterId } });
    if (!inviter) {
      return NextResponse.json({ error: '新的邀请人不存在，请先创建成员' }, { status: 404 });
    }
  }

  try {
    const updated = await prisma.referral.update({
      where: { inviteeId },
      data: {
        ...(type ? { type } : {}),
        ...(inviterId ? { inviterId } : {}),
      },
    });
    return NextResponse.json({ referral: updated }, { status: 200 });
  } catch (error) {
    const message = (error as Error).message;
    if (message.includes('Record to update not found')) {
      return NextResponse.json({ error: '记录不存在' }, { status: 404 });
    }
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ inviteeId: string }> },
) {
  const session = await ensureAdminSession();
  if (!session) {
    return NextResponse.json({ error: '无权访问' }, { status: 403 });
  }

  const { inviteeId: rawInviteeId } = await context.params;
  const inviteeId = decodeURIComponent(rawInviteeId);

  try {
    await prisma.referral.delete({ where: { inviteeId } });
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    const message = (error as Error).message;
    if (message.includes('Record to delete does not exist')) {
      return NextResponse.json({ error: '记录不存在' }, { status: 404 });
    }
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
