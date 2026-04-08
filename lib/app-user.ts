import { AccountProvider, Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

const appUserWithMember = {
  member: true,
} satisfies Prisma.AppUserInclude;

export type AppUserWithMember = Prisma.AppUserGetPayload<{
  include: typeof appUserWithMember;
}>;

type EnsureDiscordAppUserInput = {
  discordUserId: string;
  displayName?: string | null;
  avatarUrl?: string | null;
  profile?: Prisma.InputJsonValue;
};

type EnsureMiniProgramAppUserInput = {
  openId: string;
  unionId?: string | null;
  displayName?: string | null;
  avatarUrl?: string | null;
  profile?: Prisma.InputJsonValue;
};

const buildUserPatch = (displayName?: string | null, avatarUrl?: string | null) => {
  const data: Prisma.AppUserUpdateInput = {};

  if (displayName !== undefined) {
    data.displayName = displayName;
  }
  if (avatarUrl !== undefined) {
    data.avatarUrl = avatarUrl;
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

export const summarizeAppUser = (user: AppUserWithMember) => {
  return {
    id: user.id,
    displayName: user.displayName ?? null,
    avatarUrl: user.avatarUrl ?? null,
    memberLinked: Boolean(user.memberDiscordUserId),
    memberDiscordUserId: user.memberDiscordUserId ?? null,
    memberStatus: user.member?.status ?? null,
  };
};

export const ensureAppUserForDiscordMember = async ({
  discordUserId,
  displayName,
  avatarUrl,
  profile,
}: EnsureDiscordAppUserInput) => {
  return prisma.$transaction(async (tx) => {
    const existingBinding = await tx.accountBinding.findUnique({
      where: {
        provider_providerUserId: {
          provider: AccountProvider.DISCORD,
          providerUserId: discordUserId,
        },
      },
      include: {
        user: {
          include: appUserWithMember,
        },
      },
    });

    if (existingBinding) {
      await tx.accountBinding.update({
        where: { id: existingBinding.id },
        data: buildBindingPatch(profile),
      });

      return tx.appUser.update({
        where: { id: existingBinding.userId },
        data: {
          ...buildUserPatch(displayName, avatarUrl),
          memberDiscordUserId: existingBinding.user.memberDiscordUserId ?? discordUserId,
        },
        include: appUserWithMember,
      });
    }

    const reusableUser = await tx.appUser.findUnique({
      where: { memberDiscordUserId: discordUserId },
      include: appUserWithMember,
    });

    const user = reusableUser
      ? await tx.appUser.update({
          where: { id: reusableUser.id },
          data: {
            ...buildUserPatch(displayName, avatarUrl),
            memberDiscordUserId: discordUserId,
          },
          include: appUserWithMember,
        })
      : await tx.appUser.create({
          data: {
            displayName: displayName ?? null,
            avatarUrl: avatarUrl ?? null,
            memberDiscordUserId: discordUserId,
          },
          include: appUserWithMember,
        });

    await tx.accountBinding.create({
      data: {
        userId: user.id,
        provider: AccountProvider.DISCORD,
        providerUserId: discordUserId,
        lastLoginAt: new Date(),
        ...(profile !== undefined ? { profile } : {}),
      },
    });

    return user;
  });
};

export const ensureAppUserForMiniProgram = async ({
  openId,
  unionId,
  displayName,
  avatarUrl,
  profile,
}: EnsureMiniProgramAppUserInput) => {
  return prisma.$transaction(async (tx) => {
    const existingBinding = await tx.accountBinding.findUnique({
      where: {
        provider_providerUserId: {
          provider: AccountProvider.WECHAT_MINIPROGRAM,
          providerUserId: openId,
        },
      },
      include: {
        user: {
          include: appUserWithMember,
        },
      },
    });

    if (existingBinding) {
      await tx.accountBinding.update({
        where: { id: existingBinding.id },
        data: buildBindingPatch(profile, unionId),
      });

      const user = await tx.appUser.update({
        where: { id: existingBinding.userId },
        data: buildUserPatch(displayName, avatarUrl),
        include: appUserWithMember,
      });

      return { user, bindingId: existingBinding.id };
    }

    const reusableBinding =
      unionId != null
        ? await tx.accountBinding.findFirst({
            where: {
              provider: AccountProvider.WECHAT_MINIPROGRAM,
              unionId,
            },
            include: {
              user: {
                include: appUserWithMember,
              },
            },
          })
        : null;

    const user = reusableBinding
      ? await tx.appUser.update({
          where: { id: reusableBinding.userId },
          data: buildUserPatch(displayName, avatarUrl),
          include: appUserWithMember,
        })
      : await tx.appUser.create({
          data: {
            displayName: displayName ?? null,
            avatarUrl: avatarUrl ?? null,
          },
          include: appUserWithMember,
        });

    const binding = await tx.accountBinding.create({
      data: {
        userId: user.id,
        provider: AccountProvider.WECHAT_MINIPROGRAM,
        providerUserId: openId,
        unionId: unionId ?? null,
        lastLoginAt: new Date(),
        ...(profile !== undefined ? { profile } : {}),
      },
    });

    return { user, bindingId: binding.id };
  });
};
