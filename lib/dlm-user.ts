import { AccountProvider, Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { generateDlmId } from '@/lib/dlm-id';
import { getHighestVipLevelByTotalSpent, getVipLevelLabel } from '@/lib/vip-levels';

const dlmUserWithMember = {
  member: true,
} satisfies Prisma.DlmUserInclude;

export type DlmUserWithMember = Prisma.DlmUserGetPayload<{
  include: typeof dlmUserWithMember;
}>;

type EnsureDiscordDlmUserInput = {
  discordUserId: string;
  displayName?: string | null;
  avatarUrl?: string | null;
  profile?: Prisma.InputJsonValue;
};

type EnsureWechatProgramDlmUserInput = {
  openId: string;
  unionId?: string | null;
  displayName?: string | null;
  avatarUrl?: string | null;
  profile?: Prisma.InputJsonValue;
};

type EnsureWechatWebDlmUserInput = EnsureWechatProgramDlmUserInput;

type DlmProfilePatch = {
  discordDisplayName?: string | null;
  discordAvatarUrl?: string | null;
  wechatDisplayName?: string | null;
  wechatAvatarUrl?: string | null;
};

const buildDiscordProfilePatch = (
  displayName?: string | null,
  avatarUrl?: string | null,
): DlmProfilePatch => {
  const data: DlmProfilePatch = {};

  if (displayName !== undefined) {
    data.discordDisplayName = displayName;
  }
  if (avatarUrl !== undefined) {
    data.discordAvatarUrl = avatarUrl;
  }

  return data;
};

const buildWechatProfilePatch = (
  displayName?: string | null,
  avatarUrl?: string | null,
): DlmProfilePatch => {
  const data: DlmProfilePatch = {};

  if (displayName !== undefined) {
    data.wechatDisplayName = displayName;
  }
  if (avatarUrl !== undefined) {
    data.wechatAvatarUrl = avatarUrl;
  }

  return data;
};

const buildBindingPatch = (
  profile?: Prisma.InputJsonValue,
  unionId?: string | null,
): Prisma.AccountBindingUpdateInput => {
  const data: Prisma.AccountBindingUpdateInput = {
    lastLoginAt: new Date(),
  };

  if (profile !== undefined) {
    data.profile = profile;
  }
  if (unionId !== undefined) {
    data.unionId = unionId;
  }

  return data;
};

export const summarizeDlmUser = (user: DlmUserWithMember) => {
  const displayName = user.discordDisplayName ?? user.member?.serverDisplayName ?? user.wechatDisplayName ?? null;
  const avatarUrl = user.discordAvatarUrl ?? user.wechatAvatarUrl ?? null;
  const totalBalance = user.member?.totalBalance ?? user.totalBalance;
  const income = user.member?.income ?? user.income;
  const recharge = user.member?.recharge ?? user.recharge;
  const totalSpent = user.member?.totalSpent ?? user.totalSpent;
  const loyaltyPoints = user.loyaltyPoints;
  const vipLevel = getHighestVipLevelByTotalSpent(totalSpent.toString());

  return {
    displayName,
    avatarUrl,
    discordDisplayName: user.discordDisplayName ?? user.member?.serverDisplayName ?? null,
    discordAvatarUrl: user.discordAvatarUrl ?? null,
    wechatDisplayName: user.wechatDisplayName ?? null,
    wechatAvatarUrl: user.wechatAvatarUrl ?? null,
    memberLinked: Boolean(user.discordUserId),
    discordUserId: user.discordUserId ?? null,
    memberStatus: user.member?.status ?? null,
    totalBalance: totalBalance.toString(),
    income: income.toString(),
    recharge: recharge.toString(),
    totalSpent: totalSpent.toString(),
    loyaltyPoints: loyaltyPoints.toString(),
    vipLevel,
    vipLevelLabel: getVipLevelLabel(vipLevel),
    miniAvailability: user.miniAvailability,
    miniCriticalNotifications: user.miniCriticalNotifications,
    miniMessageNotifications: user.miniMessageNotifications,
    miniDispatchNotifications: user.miniDispatchNotifications,
  };
};

export const ensureDlmUserForDiscordMember = async ({
  discordUserId,
  displayName,
  avatarUrl,
  profile,
}: EnsureDiscordDlmUserInput): Promise<DlmUserWithMember> => {
  return prisma.$transaction(async (tx) => {
    const existingBinding = await tx.accountBinding.findUnique({
      where: {
        provider_providerUserId: {
          provider: AccountProvider.DISCORD,
          providerUserId: discordUserId,
        },
      },
      include: {
        dlmUser: {
          include: dlmUserWithMember,
        },
      },
    });

    if (existingBinding) {
      await tx.accountBinding.update({
        where: { id: existingBinding.id },
        data: buildBindingPatch(profile),
      });

      return tx.dlmUser.update({
        where: { dlmId: existingBinding.dlmId },
        data: {
          ...buildDiscordProfilePatch(displayName, avatarUrl),
          discordUserId: existingBinding.dlmUser.discordUserId ?? discordUserId,
        },
        include: dlmUserWithMember,
      });
    }

    const reusableUser = await tx.dlmUser.findUnique({
      where: { discordUserId },
      include: dlmUserWithMember,
    });

    const dlmUser = reusableUser
      ? await tx.dlmUser.update({
          where: { dlmId: reusableUser.dlmId },
          data: {
            ...buildDiscordProfilePatch(displayName, avatarUrl),
            discordUserId,
          },
          include: dlmUserWithMember,
        })
      : await tx.dlmUser.create({
          data: {
            dlmId: generateDlmId(),
            discordUserId,
            ...buildDiscordProfilePatch(displayName, avatarUrl),
          },
          include: dlmUserWithMember,
        });

    await tx.accountBinding.create({
      data: {
        dlmId: dlmUser.dlmId,
        provider: AccountProvider.DISCORD,
        providerUserId: discordUserId,
        lastLoginAt: new Date(),
        ...(profile !== undefined ? { profile } : {}),
      },
    });

    return dlmUser;
  });
};

export const ensureDlmUserForWechatProgram = async ({
  openId,
  unionId,
  displayName,
  avatarUrl,
  profile,
}: EnsureWechatProgramDlmUserInput): Promise<{ dlmUser: DlmUserWithMember; bindingId: string }> => {
  return prisma.$transaction(async (tx) => {
    const existingBinding = await tx.accountBinding.findUnique({
      where: {
        provider_providerUserId: {
          provider: AccountProvider.WECHAT_MINIPROGRAM,
          providerUserId: openId,
        },
      },
      include: {
        dlmUser: {
          include: dlmUserWithMember,
        },
      },
    });

    if (existingBinding) {
      await tx.accountBinding.update({
        where: { id: existingBinding.id },
        data: buildBindingPatch(profile, unionId),
      });

      const dlmUser = await tx.dlmUser.update({
        where: { dlmId: existingBinding.dlmId },
        data: buildWechatProfilePatch(displayName, avatarUrl),
        include: dlmUserWithMember,
      });

      return { dlmUser, bindingId: existingBinding.id };
    }

    const reusableBinding =
      unionId != null
        ? await tx.accountBinding.findFirst({
            where: {
              provider: {
                in: [AccountProvider.WECHAT_MINIPROGRAM, AccountProvider.WECHAT_WEB],
              },
              unionId,
            },
            include: {
              dlmUser: {
                include: dlmUserWithMember,
              },
            },
          })
        : null;

    const dlmUser = reusableBinding
      ? await tx.dlmUser.update({
          where: { dlmId: reusableBinding.dlmId },
          data: buildWechatProfilePatch(displayName, avatarUrl),
          include: dlmUserWithMember,
        })
      : await tx.dlmUser.create({
          data: {
            dlmId: generateDlmId(),
            ...buildWechatProfilePatch(displayName, avatarUrl),
          },
          include: dlmUserWithMember,
        });

    const binding = await tx.accountBinding.create({
      data: {
        dlmId: dlmUser.dlmId,
        provider: AccountProvider.WECHAT_MINIPROGRAM,
        providerUserId: openId,
        unionId: unionId ?? null,
        lastLoginAt: new Date(),
        ...(profile !== undefined ? { profile } : {}),
      },
    });

    return { dlmUser, bindingId: binding.id };
  });
};

/**
 * Connect a WeChat Open Platform website login to the same DLM account as the
 * mini program. `unionId` is the only stable cross-application identifier, so
 * callers must require it before creating a first binding. An existing website
 * binding can still log in if WeChat temporarily omits profile fields.
 */
export const ensureDlmUserForWechatWeb = async ({
  openId,
  unionId,
  displayName,
  avatarUrl,
  profile,
}: EnsureWechatWebDlmUserInput): Promise<{ dlmUser: DlmUserWithMember; bindingId: string }> => {
  return prisma.$transaction(async (tx) => {
    const existingBinding = await tx.accountBinding.findUnique({
      where: {
        provider_providerUserId: {
          provider: AccountProvider.WECHAT_WEB,
          providerUserId: openId,
        },
      },
      include: {
        dlmUser: {
          include: dlmUserWithMember,
        },
      },
    });

    if (existingBinding) {
      if (unionId && existingBinding.unionId && existingBinding.unionId !== unionId) {
        throw new Error('WECHAT_WEB_ACCOUNT_MISMATCH');
      }

      await tx.accountBinding.update({
        where: { id: existingBinding.id },
        data: buildBindingPatch(profile, unionId),
      });

      const dlmUser = await tx.dlmUser.update({
        where: { dlmId: existingBinding.dlmId },
        data: buildWechatProfilePatch(displayName, avatarUrl),
        include: dlmUserWithMember,
      });

      return { dlmUser, bindingId: existingBinding.id };
    }

    if (!unionId) {
      throw new Error('WECHAT_WEB_UNIONID_REQUIRED');
    }

    const reusableBinding = await tx.accountBinding.findFirst({
      where: {
        provider: {
          in: [AccountProvider.WECHAT_MINIPROGRAM, AccountProvider.WECHAT_WEB],
        },
        unionId,
      },
      include: {
        dlmUser: {
          include: dlmUserWithMember,
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const dlmUser = reusableBinding
      ? await tx.dlmUser.update({
          where: { dlmId: reusableBinding.dlmId },
          data: buildWechatProfilePatch(displayName, avatarUrl),
          include: dlmUserWithMember,
        })
      : await tx.dlmUser.create({
          data: {
            dlmId: generateDlmId(),
            ...buildWechatProfilePatch(displayName, avatarUrl),
          },
          include: dlmUserWithMember,
        });

    const binding = await tx.accountBinding.create({
      data: {
        dlmId: dlmUser.dlmId,
        provider: AccountProvider.WECHAT_WEB,
        providerUserId: openId,
        unionId,
        lastLoginAt: new Date(),
        ...(profile !== undefined ? { profile } : {}),
      },
    });

    return { dlmUser, bindingId: binding.id };
  });
};
