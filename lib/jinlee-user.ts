import { AccountProvider, Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { generateJinleeId } from '@/lib/jinlee-id';
import { getHighestVipLevelByTotalSpent, getVipLevelLabel } from '@/lib/vip-levels';

const jinleeUserWithMember = {
  member: true,
} satisfies Prisma.JinleeUserInclude;

export type JinleeUserWithMember = Prisma.JinleeUserGetPayload<{
  include: typeof jinleeUserWithMember;
}>;

type EnsureDiscordJinleeUserInput = {
  discordUserId: string;
  displayName?: string | null;
  avatarUrl?: string | null;
  profile?: Prisma.InputJsonValue;
};

type EnsureWechatProgramJinleeUserInput = {
  openId: string;
  unionId?: string | null;
  displayName?: string | null;
  avatarUrl?: string | null;
  profile?: Prisma.InputJsonValue;
};

type JinleeProfilePatch = {
  discordDisplayName?: string | null;
  discordAvatarUrl?: string | null;
  wechatDisplayName?: string | null;
  wechatAvatarUrl?: string | null;
};

const buildDiscordProfilePatch = (
  displayName?: string | null,
  avatarUrl?: string | null,
): JinleeProfilePatch => {
  const data: JinleeProfilePatch = {};

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
): JinleeProfilePatch => {
  const data: JinleeProfilePatch = {};

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

export const summarizeJinleeUser = (user: JinleeUserWithMember) => {
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

export const ensureJinleeUserForDiscordMember = async ({
  discordUserId,
  displayName,
  avatarUrl,
  profile,
}: EnsureDiscordJinleeUserInput): Promise<JinleeUserWithMember> => {
  return prisma.$transaction(async (tx) => {
    const existingBinding = await tx.accountBinding.findUnique({
      where: {
        provider_providerUserId: {
          provider: AccountProvider.DISCORD,
          providerUserId: discordUserId,
        },
      },
      include: {
        jinleeUser: {
          include: jinleeUserWithMember,
        },
      },
    });

    if (existingBinding) {
      await tx.accountBinding.update({
        where: { id: existingBinding.id },
        data: buildBindingPatch(profile),
      });

      return tx.jinleeUser.update({
        where: { jinleeId: existingBinding.jinleeId },
        data: {
          ...buildDiscordProfilePatch(displayName, avatarUrl),
          discordUserId: existingBinding.jinleeUser.discordUserId ?? discordUserId,
        },
        include: jinleeUserWithMember,
      });
    }

    const reusableUser = await tx.jinleeUser.findUnique({
      where: { discordUserId },
      include: jinleeUserWithMember,
    });

    const jinleeUser = reusableUser
      ? await tx.jinleeUser.update({
          where: { jinleeId: reusableUser.jinleeId },
          data: {
            ...buildDiscordProfilePatch(displayName, avatarUrl),
            discordUserId,
          },
          include: jinleeUserWithMember,
        })
      : await tx.jinleeUser.create({
          data: {
            jinleeId: generateJinleeId(),
            discordUserId,
            ...buildDiscordProfilePatch(displayName, avatarUrl),
          },
          include: jinleeUserWithMember,
        });

    await tx.accountBinding.create({
      data: {
        jinleeId: jinleeUser.jinleeId,
        provider: AccountProvider.DISCORD,
        providerUserId: discordUserId,
        lastLoginAt: new Date(),
        ...(profile !== undefined ? { profile } : {}),
      },
    });

    return jinleeUser;
  });
};

export const ensureJinleeUserForWechatProgram = async ({
  openId,
  unionId,
  displayName,
  avatarUrl,
  profile,
}: EnsureWechatProgramJinleeUserInput): Promise<{ jinleeUser: JinleeUserWithMember; bindingId: string }> => {
  return prisma.$transaction(async (tx) => {
    const existingBinding = await tx.accountBinding.findUnique({
      where: {
        provider_providerUserId: {
          provider: AccountProvider.WECHAT_MINIPROGRAM,
          providerUserId: openId,
        },
      },
      include: {
        jinleeUser: {
          include: jinleeUserWithMember,
        },
      },
    });

    if (existingBinding) {
      await tx.accountBinding.update({
        where: { id: existingBinding.id },
        data: buildBindingPatch(profile, unionId),
      });

      const jinleeUser = await tx.jinleeUser.update({
        where: { jinleeId: existingBinding.jinleeId },
        data: buildWechatProfilePatch(displayName, avatarUrl),
        include: jinleeUserWithMember,
      });

      return { jinleeUser, bindingId: existingBinding.id };
    }

    const reusableBinding =
      unionId != null
        ? await tx.accountBinding.findFirst({
            where: {
              provider: AccountProvider.WECHAT_MINIPROGRAM,
              unionId,
            },
            include: {
              jinleeUser: {
                include: jinleeUserWithMember,
              },
            },
          })
        : null;

    const jinleeUser = reusableBinding
      ? await tx.jinleeUser.update({
          where: { jinleeId: reusableBinding.jinleeId },
          data: buildWechatProfilePatch(displayName, avatarUrl),
          include: jinleeUserWithMember,
        })
      : await tx.jinleeUser.create({
          data: {
            jinleeId: generateJinleeId(),
            ...buildWechatProfilePatch(displayName, avatarUrl),
          },
          include: jinleeUserWithMember,
        });

    const binding = await tx.accountBinding.create({
      data: {
        jinleeId: jinleeUser.jinleeId,
        provider: AccountProvider.WECHAT_MINIPROGRAM,
        providerUserId: openId,
        unionId: unionId ?? null,
        lastLoginAt: new Date(),
        ...(profile !== undefined ? { profile } : {}),
      },
    });

    return { jinleeUser, bindingId: binding.id };
  });
};
