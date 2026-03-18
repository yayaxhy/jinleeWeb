import { ReferralType } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { isAdminDiscordId, isHowardDiscordId, isHowardReadOnlyDiscordId } from '@/lib/admin';
import { prisma } from '@/lib/prisma';
import { getServerSession } from '@/lib/session';

const ensureWriteSession = async () => {
  const session = await getServerSession();
  if (!session?.discordId) return null;
  if (isHowardReadOnlyDiscordId(session.discordId)) return null;
  if (isAdminDiscordId(session.discordId) || isHowardDiscordId(session.discordId)) return session;
  return null;
};

const normalizeId = (value?: string | null) => value?.trim() ?? '';
const parseReferralType = (value?: string | null): ReferralType | null => {
  if (!value) return null;
  const upper = value.trim().toUpperCase();
  return Object.values(ReferralType).includes(upper as ReferralType) ? (upper as ReferralType) : null;
};

const parseDecimal = (value: unknown, field: string) => {
  if (value === null || value === undefined || value === '') return null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) {
    throw new Error(`${field} 必须为非负数字`);
  }
  return numeric;
};

const parseDate = (value: unknown, field: string) => {
  if (value === null || value === undefined || value === '') return null;
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) {
    throw new Error(`${field} 时间格式无效`);
  }
  return date;
};

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ policyId: string }> },
) {
  const session = await ensureWriteSession();
  if (!session) {
    return NextResponse.json({ error: '无权访问' }, { status: 403 });
  }

  try {
    const { policyId } = await context.params;
    const body = await request.json().catch(() => null);
    const inviterId = normalizeId(body?.inviterId);
    const referralType = body?.referralType === '' ? null : parseReferralType(body?.referralType);
    const rate = parseDecimal(body?.rate, '返利比例');
    const capAmount = parseDecimal(body?.capAmount, '返利上限');
    const startsAt = parseDate(body?.startsAt, '开始时间');
    const endsAt = parseDate(body?.endsAt, '结束时间');
    const enabled = body?.enabled === undefined ? undefined : Boolean(body.enabled);
    const note = typeof body?.note === 'string' ? body.note.trim() || null : undefined;

    if (startsAt && endsAt && startsAt > endsAt) {
      return NextResponse.json({ error: '结束时间不能早于开始时间' }, { status: 400 });
    }

    if (inviterId) {
      const inviter = await prisma.member.findUnique({ where: { discordUserId: inviterId } });
      if (!inviter) {
        return NextResponse.json({ error: '邀请人不存在，请先创建成员' }, { status: 404 });
      }
    }

    const updated = await prisma.referralPolicy.update({
      where: { id: policyId },
      data: {
        ...(inviterId ? { inviterId } : {}),
        ...(body?.referralType !== undefined ? { referralType } : {}),
        ...(rate !== null ? { rate } : {}),
        ...(body?.capAmount !== undefined ? { capAmount } : {}),
        ...(body?.startsAt !== undefined ? { startsAt } : {}),
        ...(body?.endsAt !== undefined ? { endsAt } : {}),
        ...(enabled !== undefined ? { enabled } : {}),
        ...(note !== undefined ? { note } : {}),
      },
    });

    return NextResponse.json({ policy: updated });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ policyId: string }> },
) {
  const session = await ensureWriteSession();
  if (!session) {
    return NextResponse.json({ error: '无权访问' }, { status: 403 });
  }

  try {
    const { policyId } = await context.params;
    await prisma.referralPolicy.delete({ where: { id: policyId } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}

