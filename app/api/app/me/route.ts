import { NextResponse } from 'next/server';
import { summarizeAppUser } from '@/lib/app-user';
import { getMiniProgramSessionFromRequest, revokeMiniProgramSession } from '@/lib/mini-program-session';
import { prisma } from '@/lib/prisma';
import { getServerSession } from '@/lib/session';

const buildMemberPayload = (
  member:
    | {
        discordUserId: string;
        status: string;
        serverDisplayName: string | null;
        totalBalance: { toString(): string };
        income: { toString(): string };
        recharge: { toString(): string };
        totalSpent: { toString(): string };
      }
    | null
    | undefined,
) => {
  if (!member) {
    return { linked: false };
  }

  return {
    linked: true,
    discordUserId: member.discordUserId,
    status: member.status,
    serverDisplayName: member.serverDisplayName ?? null,
    totalBalance: member.totalBalance.toString(),
    income: member.income.toString(),
    recharge: member.recharge.toString(),
    totalSpent: member.totalSpent.toString(),
  };
};

export async function GET(request: Request) {
  const miniProgramSession = await getMiniProgramSessionFromRequest(request);
  if (miniProgramSession) {
    return NextResponse.json({
      ok: true,
      sessionSource: 'mini_program',
      user: summarizeAppUser(miniProgramSession.user),
      member: buildMemberPayload(miniProgramSession.user.member),
    });
  }

  const webSession = await getServerSession();
  if (!webSession?.discordId) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const appUser = webSession.userId
    ? await prisma.appUser.findUnique({
        where: { id: webSession.userId },
        include: { member: true },
      })
    : await prisma.appUser.findFirst({
        where: { memberDiscordUserId: webSession.discordId },
        include: { member: true },
      });

  if (!appUser) {
    return NextResponse.json({ ok: false, error: 'app_user_not_found' }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    sessionSource: 'web',
    user: summarizeAppUser(appUser),
    member: buildMemberPayload(appUser.member),
  });
}

export async function DELETE(request: Request) {
  await revokeMiniProgramSession(request);
  return NextResponse.json({ ok: true });
}
