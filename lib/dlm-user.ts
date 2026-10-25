import { ensureWechatIdentityTx } from './wechat-identity-transaction';
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

export async function ensureDlmUserForDiscordMemberTx(tx: Prisma.TransactionClient, input: EnsureDiscordDlmUserInput, verifiedRegistration = false): Promise<DlmUserWithMember> {
  const { discordUserId, displayName, avatarUrl, profile } = input;
  if (!/^\d{15,22}$/.test(discordUserId)) throw new Error('discord_identity_not_loginable');
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${'discord-identity:' + discordUserId}, 0))`;
  const where = { provider_providerUserId: { provider: AccountProvider.DISCORD, providerUserId: discordUserId } };
  const before = await tx.accountBinding.findUnique({ where });
  let existingUser = before ? await tx.dlmUser.findUnique({ where: { dlmId: before.dlmId } }) : await tx.dlmUser.findUnique({ where: { discordUserId } });
  if (existingUser) {
    await tx.$queryRaw`SELECT "dlmId" FROM "DlmUser" WHERE "dlmId" = ${existingUser.dlmId} FOR UPDATE`;
    const current = await tx.dlmUser.findUnique({ where: { dlmId: existingUser.dlmId } });
    const binding = await tx.accountBinding.findUnique({ where });
    if (!current || current.discordUserId !== discordUserId || (before && (binding?.id !== before.id || binding.dlmId !== current.dlmId))) throw new Error('discord_binding_changed');
    existingUser = current;
  }
  if (verifiedRegistration) {
    await tx.$executeRaw`SELECT set_config('app.allow_retired_discord_registration', 'on', true)`;
    await tx.member.upsert({ where: { discordUserId }, create: { discordUserId, serverDisplayName: displayName ?? null, ...(existingUser ? { totalBalance: existingUser.totalBalance, income: existingUser.income, recharge: existingUser.recharge, totalSpent: existingUser.totalSpent } : {}) }, update: { ...(displayName !== undefined ? { serverDisplayName: displayName } : {}) } });
  }
  await tx.$queryRaw`SELECT "discordUserId" FROM "Member" WHERE "discordUserId" = ${discordUserId} FOR UPDATE`;
  const member = await tx.member.findUnique({ where: { discordUserId } });
  if (!member) throw new Error('discord_member_missing');
  const point = await tx.loyaltyPoint.findUnique({ where: { discordUserId }, select: { points: true } });
  const wallet = { totalBalance: member.totalBalance, income: member.income, recharge: member.recharge, totalSpent: member.totalSpent,
    ...(point ? { loyaltyPoints: point.points } : {}) };
  const dlmUser = existingUser ? await tx.dlmUser.update({ where: { dlmId: existingUser.dlmId }, data: { ...buildDiscordProfilePatch(displayName, avatarUrl), ...wallet }, include: dlmUserWithMember })
    : await tx.dlmUser.create({ data: { dlmId: generateDlmId(), discordUserId, ...buildDiscordProfilePatch(displayName, avatarUrl), ...wallet }, include: dlmUserWithMember });
  if (before) await tx.accountBinding.update({ where: { id: before.id }, data: buildBindingPatch(profile) });
  else await tx.accountBinding.create({ data: { dlmId: dlmUser.dlmId, provider: AccountProvider.DISCORD, providerUserId: discordUserId, lastLoginAt: new Date(), ...(profile !== undefined ? { profile } : {}) } });
  return dlmUser;
}

export const ensureDlmUserForDiscordMember = (input: EnsureDiscordDlmUserInput): Promise<DlmUserWithMember> =>
  prisma.$transaction(tx => ensureDlmUserForDiscordMemberTx(tx, input));

/** Only call after Discord OAuth has verified this identity. Never use for cookie restoration. */
export const ensureVerifiedDiscordLogin = (input: EnsureDiscordDlmUserInput): Promise<DlmUserWithMember> =>
  prisma.$transaction(tx => ensureDlmUserForDiscordMemberTx(tx, input, true));

export const ensureDlmUserForWechatProgram = (input: EnsureWechatProgramDlmUserInput): Promise<{ dlmUser: DlmUserWithMember; bindingId: string }> => prisma.$transaction(tx => ensureWechatIdentityTx(tx, { ...input, provider: AccountProvider.WECHAT_MINIPROGRAM }, generateDlmId));

/**
 * Connect a WeChat Open Platform website login to the same DLM account as the
 * mini program. `unionId` is the only stable cross-application identifier, so
 * callers must require it before creating a first binding. An existing website
 * binding can still log in if WeChat temporarily omits profile fields.
 */
export const ensureDlmUserForWechatWeb = (input: EnsureWechatWebDlmUserInput): Promise<{ dlmUser: DlmUserWithMember; bindingId: string }> => prisma.$transaction(tx => ensureWechatIdentityTx(tx, { ...input, provider: AccountProvider.WECHAT_WEB }, generateDlmId));
