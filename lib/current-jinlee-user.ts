import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { generateJinleeId } from '@/lib/jinlee-id';
import { getServerSession } from '@/lib/session';
import { getWechatProgramSessionFromRequest } from '@/lib/wechat-program-session';

const jinleeUserWithMember = {
  member: true,
} satisfies Prisma.JinleeUserInclude;

export type CurrentJinleeUser = {
  sessionSource: 'wechat_program' | 'web';
  jinleeUser: Prisma.JinleeUserGetPayload<{ include: typeof jinleeUserWithMember }>;
  jinleeId: string;
  discordUserId: string | null;
};

const buildDiscordAvatarUrl = (discordId: string, avatar?: string | null) => {
  if (!avatar) return null;
  return `https://cdn.discordapp.com/avatars/${discordId}/${avatar}.${avatar.startsWith('a_') ? 'gif' : 'png'}`;
};

export const getCurrentJinleeUser = async (request?: Request): Promise<CurrentJinleeUser | null> => {
  if (request) {
    const wechatProgramSession = await getWechatProgramSessionFromRequest(request);
    if (wechatProgramSession) {
      return {
        sessionSource: 'wechat_program',
        jinleeUser: wechatProgramSession.jinleeUser,
        jinleeId: wechatProgramSession.jinleeUser.jinleeId,
        discordUserId: wechatProgramSession.jinleeUser.discordUserId ?? null,
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

  const jinleeUser = webSession.jinleeId
    ? await prisma.jinleeUser.findUnique({
        where: { jinleeId: webSession.jinleeId },
        include: jinleeUserWithMember,
      })
    : null;

  if (webSession.jinleeId && !jinleeUser) {
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

  const ensured = jinleeUser
    ? await prisma.jinleeUser.update({
        where: { jinleeId: jinleeUser.jinleeId },
        data: {
          discordUserId: webSession.discordId,
          discordDisplayName: member?.serverDisplayName ?? webSession.username,
          discordAvatarUrl: fallbackDiscordAvatar,
          ...walletMirrorPatch,
        },
        include: jinleeUserWithMember,
      })
    : await prisma.jinleeUser.upsert({
        where: { discordUserId: webSession.discordId },
        update: {
          discordDisplayName: member?.serverDisplayName ?? webSession.username,
          discordAvatarUrl: fallbackDiscordAvatar,
          ...walletMirrorPatch,
        },
        create: {
          jinleeId: generateJinleeId(),
          discordUserId: webSession.discordId,
          discordDisplayName: member?.serverDisplayName ?? webSession.username,
          discordAvatarUrl: fallbackDiscordAvatar,
          ...walletMirrorPatch,
        },
        include: jinleeUserWithMember,
      });

  return {
    sessionSource: 'web',
    jinleeUser: ensured,
    jinleeId: ensured.jinleeId,
    discordUserId: ensured.discordUserId ?? null,
  };
};
