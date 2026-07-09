import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from '@/lib/session';

type UpdatePreferencePayload = {
  enabled?: boolean;
};

export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session?.discordId) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as UpdatePreferencePayload;
  if (typeof body.enabled !== 'boolean') {
    return NextResponse.json({ error: '参数错误' }, { status: 400 });
  }

  const member = await prisma.member.findUnique({
    where: { discordUserId: session.discordId },
    select: { discordUserId: true },
  });
  if (!member) {
    return NextResponse.json({ error: '仅限已有会员修改该设置' }, { status: 403 });
  }

  const profile = await prisma.vipBenefitProfile.upsert({
    where: { discordUserId: session.discordId },
    update: { roleOptOut: !body.enabled },
    create: {
      discordUserId: session.discordId,
      roleOptOut: !body.enabled,
    },
    select: { roleOptOut: true },
  });

  return NextResponse.json({
    ok: true,
    enabled: profile.roleOptOut !== true,
  });
}
