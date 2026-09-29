import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { generateDlmId } from '@/lib/dlm-id';
import { getServerSession } from '@/lib/session';
import { getWechatProgramSessionFromRequest } from '@/lib/wechat-program-session';

const dlmUserWithMember = {
  member: true,
} satisfies Prisma.DlmUserInclude;

export type CurrentDlmUser = {
  sessionSource: 'wechat_program' | 'web';
  dlmUser: Prisma.DlmUserGetPayload<{ include: typeof dlmUserWithMember }>;
  dlmId: string;
  discordUserId: string | null;
};

const buildDiscordAvatarUrl = (discordId: string, avatar?: string | null) => {
  if (!avatar) return null;
  return `https://cdn.discordapp.com/avatars/${discordId}/${avatar}.${avatar.startsWith('a_') ? 'gif' : 'png'}`;
};

export const getCurrentDlmUser = async (request?: Request): Promise<CurrentDlmUser | null> => {
  if (request) {
    const wechatProgramSession = await getWechatProgramSessionFromRequest(request);
    if (wechatProgramSession) {
      return {
        sessionSource: 'wechat_program',
        dlmUser: wechatProgramSession.dlmUser,
        dlmId: wechatProgramSession.dlmUser.dlmId,
        discordUserId: wechatProgramSession.dlmUser.discordUserId ?? null,
      };
    }
  }

  const webSession = await getServerSession();
  if (!webSession?.discordId) {
    return null;
  }

  const fallbackDiscordAvatar = buildDiscordAvatarUrl(webSession.discordId, webSession.avatar);
  const member = await prisma.member.findUnique({
    where: { discordUserId: webSession.discordId },
    select: {
      discordUserId: true,
      serverDisplayName: true,
      totalBalance: true,
      income: true,
      recharge: true,
      totalSpent: true,
    },
  });

  const dlmUser = webSession.dlmId
    ? await prisma.dlmUser.findUnique({
        where: { dlmId: webSession.dlmId },
        include: dlmUserWithMember,
      })
    : null;

  if (webSession.dlmId && !dlmUser) {
    return null;
  }

  const walletMirrorPatch = member
    ? {
        totalBalance: member.totalBalance,
        income: member.income,
        recharge: member.recharge,
        totalSpent: member.totalSpent,
      }
    : {};

  const ensured = dlmUser
    ? await prisma.dlmUser.update({
        where: { dlmId: dlmUser.dlmId },
        data: {
          discordUserId: webSession.discordId,
          discordDisplayName: member?.serverDisplayName ?? webSession.username,
          discordAvatarUrl: fallbackDiscordAvatar,
          ...walletMirrorPatch,
        },
        include: dlmUserWithMember,
      })
    : await prisma.dlmUser.upsert({
        where: { discordUserId: webSession.discordId },
        update: {
          discordDisplayName: member?.serverDisplayName ?? webSession.username,
          discordAvatarUrl: fallbackDiscordAvatar,
          ...walletMirrorPatch,
        },
        create: {
          dlmId: generateDlmId(),
          discordUserId: webSession.discordId,
          discordDisplayName: member?.serverDisplayName ?? webSession.username,
          discordAvatarUrl: fallbackDiscordAvatar,
          ...walletMirrorPatch,
        },
        include: dlmUserWithMember,
      });

  return {
    sessionSource: 'web',
    dlmUser: ensured,
    dlmId: ensured.dlmId,
    discordUserId: ensured.discordUserId ?? null,
  };
};
