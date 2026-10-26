import { renderSiteCopy } from "@/lib/site-copy-server";
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentDlmUser } from '@/lib/current-dlm-user';

export const runtime = 'nodejs';

const ensureEditablePeiwan = async (request?: Request) => {
  const currentUser = await getCurrentDlmUser(request);
  const discordUserId = currentUser?.discordUserId?.trim();
  if (!discordUserId) {
    return { error: NextResponse.json({ error: await renderSiteCopy("site.app.api.profile.audition.invite.preference.route.e8041a8c9358") }, { status: 401 }) };
  }

  const member = await prisma.member.findUnique({
    where: { discordUserId },
    include: { peiwan: true },
  });
  if (!member || member.status !== 'PEIWAN' || !member.peiwan) {
    return { error: NextResponse.json({ error: await renderSiteCopy("site.app.api.profile.audition.invite.preference.route.3cdf0657c5ed") }, { status: 403 }) };
  }

  const deletionRecord = await prisma.peiwanDeletion.findUnique({
    where: { peiwanId: member.peiwan.PEIWANID },
    select: { peiwanId: true },
  });
  if (deletionRecord) {
    return { error: NextResponse.json({ error: await renderSiteCopy("site.app.api.profile.audition.invite.preference.route.e80e8677d567") }, { status: 403 }) };
  }

  return {
    discordUserId,
    peiwan: member.peiwan,
  };
};

export async function POST(request: Request) {
  try {
    const current = await ensureEditablePeiwan(request);
    if ('error' in current) {
      return current.error;
    }

    const body = await request.json().catch(() => ({}));
    const enabled = body?.enabled;
    if (typeof enabled !== 'boolean') {
      return NextResponse.json({ error: await renderSiteCopy("site.app.api.profile.audition.invite.preference.route.825d9c887174") }, { status: 400 });
    }
    if (enabled && !current.peiwan.voicePreviewUrl) {
      return NextResponse.json({ error: await renderSiteCopy("site.app.api.profile.audition.invite.preference.route.9fa559a03ec9") }, { status: 400 });
    }

    await prisma.pEIWAN.update({
      where: { discordUserId: current.discordUserId },
      data: { auditionInviteEnabled: enabled },
    });

    return NextResponse.json({ ok: true, enabled });
  } catch (error) {
    console.error('[audition-invite-preference] save failed', error);
    const message = '保存失败，请稍后再试';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
