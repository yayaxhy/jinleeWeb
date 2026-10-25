import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { generateDlmId } from '@/lib/dlm-id';
import { getServerSession } from '@/lib/session';
import { getWechatProgramSessionFromRequest } from '@/lib/wechat-program-session';
import { syncDiscordCurrentUserTx } from './current-dlm-user-sync';

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
  if (!webSession) {
    return null;
  }

  if (webSession.dlmId) {
    const dlmUser = await prisma.dlmUser.findUnique({
      where: { dlmId: webSession.dlmId },
      include: dlmUserWithMember,
    });

    if (!dlmUser || dlmUser.sessionVersion !== (webSession.sessionVersion ?? 1)) {
      return null;
    }

    // The web WeChat callback has already refreshed the WeChat profile. Do
    // not treat its display name as a Discord name if this user later binds
    // Discord as well.
    if (webSession.authProvider === 'wechat_web') {
      return {
        sessionSource: 'web',
        dlmUser,
        dlmId: dlmUser.dlmId,
        discordUserId: dlmUser.discordUserId ?? null,
      };
    }
  }

  if (!webSession.discordId) {
    return null;
  }

  const fallbackDiscordAvatar = buildDiscordAvatarUrl(webSession.discordId, webSession.avatar);
  const discordId = webSession.discordId;
  const ensured = await prisma.$transaction((tx) => syncDiscordCurrentUserTx(tx, {
    dlmId: webSession.dlmId,
    discordId,
    username: webSession.username,
    avatarUrl: fallbackDiscordAvatar,
  }, generateDlmId));
  if (!ensured || ensured.sessionVersion !== (webSession.sessionVersion ?? 1)) return null;

  return {
    sessionSource: 'web',
    dlmUser: ensured,
    dlmId: ensured.dlmId,
    discordUserId: ensured.discordUserId ?? null,
  };
};
