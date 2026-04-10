import { ReferralType } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { isAdminDiscordId, isHowardDiscordId, isHowardReadOnlyDiscordId } from '@/lib/admin';
import { prisma } from '@/lib/prisma';
import { getReferralSnapshotForBinding } from '@/lib/referralPolicy';
import { getServerSession } from '@/lib/session';

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
const DISCORD_ID_PATTERN = /^\d+$/;

const validateDiscordId = (value: string) => DISCORD_ID_PATTERN.test(value);

const parseReferralType = (value?: string | null): ReferralType | null => {
  if (!value) return null;
  const upper = value.trim().toUpperCase();
  return Object.values(ReferralType).includes(upper as ReferralType) ? (upper as ReferralType) : null;
};

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ inviteeId: string }> },
) {
  const session = await ensureReferralWriteSession();
  if (!session) {
    return NextResponse.json({ error: '无权访问' }, { status: 403 });
  }

  const { inviteeId: rawInviteeId } = await context.params;
  const inviteeId = normalizeId(decodeURIComponent(rawInviteeId));
  if (!validateDiscordId(inviteeId)) {
    return NextResponse.json(
      { error: 'Referral 仅支持 Discord 用户，请填写纯数字 Discord ID。' },
      { status: 400 },
    );
  }

  const body = await request.json().catch(() => null);
  const type = parseReferralType(body?.type);
  const inviterId = normalizeId(body?.inviterId);

  if (!type && !inviterId) {
    return NextResponse.json({ error: '至少需要提供 type 或 inviterDiscordId' }, { status: 400 });
  }
  if (inviterId && inviterId === inviteeId) {
    return NextResponse.json({ error: '禁止自邀' }, { status: 400 });
  }
  if (inviterId && !validateDiscordId(inviterId)) {
    return NextResponse.json(
      { error: 'Referral 仅支持 Discord 用户，请填写纯数字 Discord ID。' },
      { status: 400 },
    );
  }

  const existingReferral = await prisma.referral.findUnique({
    where: { inviteeId },
    select: { type: true, inviterId: true },
  });
  if (!existingReferral) {
    return NextResponse.json({ error: '记录不存在' }, { status: 404 });
  }

  const invitee = await prisma.member.findUnique({ where: { discordUserId: inviteeId } });
  if (!invitee) {
    return NextResponse.json({ error: '被邀请人 Discord 用户不存在，请先绑定 Discord。' }, { status: 404 });
  }

  if (inviterId) {
    const inviter = await prisma.member.findUnique({ where: { discordUserId: inviterId } });
    if (!inviter) {
      return NextResponse.json({ error: '新的邀请人 Discord 用户不存在，请先绑定 Discord。' }, { status: 404 });
    }
  }

  const nextInviterId = inviterId || existingReferral.inviterId;
  const nextType = type || existingReferral.type;
  const snapshot = await getReferralSnapshotForBinding(nextInviterId, nextType);

  try {
    const updated = await prisma.referral.update({
      where: { inviteeId },
      data: {
        ...(type ? { type } : {}),
        ...(inviterId ? { inviterId } : {}),
        payoutRate: snapshot.payoutRate,
        payoutCap: snapshot.payoutCap,
        policyApplied: snapshot.policyApplied,
        policyRuleId: snapshot.policyRuleId,
        policyBoundAt: snapshot.policyBoundAt,
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
  const session = await ensureReferralWriteSession();
  if (!session) {
    return NextResponse.json({ error: '无权访问' }, { status: 403 });
  }

  const { inviteeId: rawInviteeId } = await context.params;
  const inviteeId = normalizeId(decodeURIComponent(rawInviteeId));
  if (!validateDiscordId(inviteeId)) {
    return NextResponse.json(
      { error: 'Referral 仅支持 Discord 用户，请填写纯数字 Discord ID。' },
      { status: 400 },
    );
  }

  try {
    const payoutCount = await prisma.referralPayout.count({
      where: { referralId: inviteeId },
    });
    if (payoutCount > 0) {
      return NextResponse.json(
        { error: '该绑定关系已产生邀请返利，禁止删除' },
        { status: 400 },
      );
    }

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
