import { renderSiteCopy } from "@/lib/site-copy-server";
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from '@/lib/session';

type UpdatePreferencePayload = {
  enabled?: boolean;
};

export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session?.discordId) {
    return NextResponse.json({ error: await renderSiteCopy("site.app.api.profile.vip.role.sync.preference.route.e8041a8c9358") }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as UpdatePreferencePayload;
  if (typeof body.enabled !== 'boolean') {
    return NextResponse.json({ error: await renderSiteCopy("site.app.api.profile.vip.role.sync.preference.route.3e64edf2ea33") }, { status: 400 });
  }

  const member = await prisma.member.findUnique({
    where: { discordUserId: session.discordId },
    select: { discordUserId: true },
  });
  if (!member) {
    return NextResponse.json({ error: await renderSiteCopy("site.app.api.profile.vip.role.sync.preference.route.da7a5079cce5") }, { status: 403 });
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
