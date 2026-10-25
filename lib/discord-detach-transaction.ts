import { migrationDelegate, migrationExtraOwnerFields } from './account-migration-records';
import { createHash, randomUUID } from 'node:crypto';
import { AccountProvider, Prisma } from '@prisma/client';
import { lockWechatOwnersTx, WECHAT_PROVIDERS } from './wechat-identity-transaction';
import { lockManualQuotaOwnersTx, remapManualQuotaOwnersTx } from './manual-quota-transfer';

export class DiscordDetachError extends Error { constructor(public readonly code: string) { super(code); } }
const json = (value: unknown): Prisma.InputJsonValue => JSON.parse(JSON.stringify(value));

export async function detachDiscordAccountTx(tx: Prisma.TransactionClient, input: {
  dlmId: string; expectedSessionVersion: number; rolePlan: Prisma.InputJsonValue;
}) {
  await lockWechatOwnersTx(tx, [input.dlmId]);
  const before = await tx.dlmUser.findUnique({ where: { dlmId: input.dlmId }, select: { discordUserId: true } });
  if (!before?.discordUserId) throw new DiscordDetachError('channel_not_bound');
  const oldId = before.discordUserId; const memberKey = `detached:${input.dlmId}`;
  for (const id of [oldId, memberKey].sort()) await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${'discord-identity:' + id}, 0))`;
  await tx.$queryRaw`SELECT "dlmId" FROM "DlmUser" WHERE "dlmId" = ${input.dlmId} FOR UPDATE`;
  await tx.$queryRaw`SELECT "discordUserId" FROM "Member" WHERE "discordUserId" = ${oldId} FOR UPDATE`;
  const user = await tx.dlmUser.findUnique({ where: { dlmId: input.dlmId }, include: { member: true, accountBindings: true } });
  if (!user || user.discordUserId !== oldId || user.sessionVersion !== input.expectedSessionVersion) throw new DiscordDetachError('binding_state_changed');
  if (!user.accountBindings.some(b => WECHAT_PROVIDERS.some(provider => provider === b.provider))) throw new DiscordDetachError('last_login_method_forbidden');
  if (!user.accountBindings.some(b => b.provider === AccountProvider.DISCORD && b.providerUserId === oldId) || !user.member) throw new DiscordDetachError('binding_state_changed');
  if (await tx.detachedDiscordAccount.findUnique({ where: { ownerDlmId: user.dlmId } }) || await tx.member.findUnique({ where: { discordUserId: memberKey } })) throw new DiscordDetachError('detached_identity_conflict');
  const suppliedPlan = input.rolePlan as Record<string, unknown>;
  const source = suppliedPlan.source as Record<string, unknown> | undefined;
  const target = suppliedPlan.target as Record<string, unknown> | undefined;
  if (suppliedPlan.version !== 1 || source?.discordId !== oldId || source?.dlmId !== user.dlmId || target?.discordId !== null || target?.dlmId !== user.dlmId) throw new DiscordDetachError('role_plan_changed');
  const [peiwan, points, autoBuff, previous, withdrawalAccount, vipPreference, hearts] = await Promise.all([
    tx.pEIWAN.findUnique({ where: { discordUserId: oldId } }),
    tx.loyaltyPoint.findUnique({ where: { discordUserId: oldId } }),
    tx.autoCommissionBuff.findUnique({ where: { userId: oldId } }),
    tx.accountMigration.findFirst({ where: { targetDlmId: user.dlmId, status: 'COMPLETED' }, orderBy: { createdAt: 'desc' }, select: { autoCommissionProgressDiscordId: true, inheritedAutoCommissionUntil: true } }),
    tx.withdrawalAccount.findUnique({ where: { discordUserId: oldId } }),
    tx.vipBenefitProfile.findUnique({ where: { discordUserId: oldId }, select: { roleOptOut: true } }),
    tx.heartCounter.findMany({ where: { OR: [{ fromMemberId: oldId }, { toMemberId: oldId }] }, select: { fromMemberId: true, toMemberId: true } }),
  ]);
  const inheritedAutoCommissionUntil = [autoBuff?.activeUntil, previous?.inheritedAutoCommissionUntil]
    .filter((date): date is Date => date instanceof Date && Number.isFinite(date.getTime()))
    .sort((a, b) => b.getTime() - a.getTime())[0] ?? null;
  const heartDiscordIds = [...new Set(hearts.flatMap(row => [row.fromMemberId, row.toMemberId]))];
  const heartPeerOwners = await tx.dlmUser.findMany({ where: { discordUserId: { in: heartDiscordIds.filter(id => id !== oldId) } }, select: { dlmId: true, discordUserId: true } });
  const rolePlan = json({ ...suppliedPlan, createdAt: new Date().toISOString(),
    source: { dlmId: user.dlmId, discordId: oldId, peiwanId: peiwan?.PEIWANID ?? null },
    target: { dlmId: user.dlmId, discordId: null, peiwanId: peiwan?.PEIWANID ?? null },
    sourceWasPeiwan: !!peiwan, targetIsPeiwan: false, vipRoleOptOut: vipPreference?.roleOptOut === true,
    fuxingActiveUntil: inheritedAutoCommissionUntil?.toISOString() ?? null, heartDiscordIds,
    heartPeerOwners: heartPeerOwners.map(peer => ({ dlmId: peer.dlmId, discordId: peer.discordUserId })),
  });
  const quotaLocks = await lockManualQuotaOwnersTx(tx, [oldId, memberKey]);
  await tx.$executeRaw`SELECT set_config('bot.skip_recharge_notify', 'true', true)`;
  await tx.$executeRaw`SELECT set_config('app.suppress_peiwan_notifications', 'on', true)`;
  // Fill historical ownership once before the Discord identity is released.
  // Snapshot fields in immutable gift/audition/order audit data are not rewritten.
  await tx.coupon.updateMany({ where: { discordId: oldId, dlmId: null }, data: { dlmId: user.dlmId } });
  await tx.recharge.updateMany({ where: { toWhom: oldId, dlmId: null }, data: { dlmId: user.dlmId } });
  await tx.withdraw.updateMany({ where: { discordId: oldId, dlmId: null }, data: { dlmId: user.dlmId } });
  await tx.individualTransaction.updateMany({ where: { discordId: oldId, dlmId: null }, data: { dlmId: user.dlmId } });
  await tx.lotteryDraw.updateMany({ where: { userId: oldId, dlmId: null }, data: { dlmId: user.dlmId } });
  await tx.order.updateMany({ where: { hostId: oldId, hostDlmId: null }, data: { hostDlmId: user.dlmId } });
  await tx.loyaltyPoint.updateMany({ where: { discordUserId: oldId, dlmId: null }, data: { dlmId: user.dlmId } });
  await tx.withdrawalAccount.updateMany({ where: { discordUserId: oldId, dlmId: null }, data: { dlmId: user.dlmId } });
  await tx.pointShopCart.updateMany({ where: { discordUserId: oldId, dlmId: null }, data: { dlmId: user.dlmId } });
  await tx.pointShopOrder.updateMany({ where: { discordUserId: oldId, dlmId: null }, data: { dlmId: user.dlmId } });
  await tx.pointShopGrant.updateMany({ where: { discordUserId: oldId, dlmId: null }, data: { dlmId: user.dlmId } });
  await tx.pointShopPointLedger.updateMany({ where: { discordUserId: oldId, dlmId: null }, data: { dlmId: user.dlmId } });
  await tx.transaction.updateMany({ where: { fromId: oldId, fromDlmId: null }, data: { fromDlmId: user.dlmId } });
  await tx.transaction.updateMany({ where: { toId: oldId, toDlmId: null }, data: { toDlmId: user.dlmId } });
  await tx.commission.updateMany({ where: { fromId: oldId, fromDlmId: null }, data: { fromDlmId: user.dlmId } });
  await tx.commission.updateMany({ where: { toId: oldId, toDlmId: null }, data: { toDlmId: user.dlmId } });
  await tx.accountBinding.deleteMany({ where: { dlmId: user.dlmId, provider: AccountProvider.DISCORD } });
  await tx.wechatProgramSession.deleteMany({ where: { dlmId: user.dlmId } });
  await tx.dlmUser.update({ where: { dlmId: user.dlmId }, data: {
    discordUserId: null, discordDisplayName: null, discordAvatarUrl: null, sessionVersion: { increment: 1 },
    totalBalance: user.member.totalBalance, income: user.member.income, recharge: user.member.recharge, totalSpent: user.member.totalSpent,
    loyaltyPoints: points?.points ?? user.loyaltyPoints,
    withdrawAccount1: withdrawalAccount?.account1 ?? user.withdrawAccount1,
    withdrawAccount2: withdrawalAccount?.account2 ?? user.withdrawAccount2,
    withdrawAccount3: withdrawalAccount?.account3 ?? user.withdrawAccount3,
  } });
  // PostgreSQL foreign keys cascade the internal key to all Member-owned rows;
  // there is no second spendable copy under the released Discord identity.
  await tx.member.update({ where: { discordUserId: oldId }, data: { discordUserId: memberKey } });
  await remapManualQuotaOwnersTx(tx, [{ from: oldId, to: memberKey }], quotaLocks);
  // Member foreign keys cascade, but these explicit current-owner columns do
  // not all have FKs. Share the full-merge registry so a later attachment finds
  // the parked activity instead of a recycled Discord account inheriting it.
  const quotaModels = new Set(['ManualQuotaBatch', 'ManualQuotaRestoration', 'FlowBuff', 'SpendBuff']);
  for (const [model, fields] of Object.entries(migrationExtraOwnerFields)) {
    if (quotaModels.has(model)) continue;
    for (const field of fields.member ?? []) {
      await migrationDelegate(tx, model).updateMany({ where: { [field]: oldId }, data: { [field]: memberKey } });
    }
  }
  await tx.referral.updateMany({ where: { OR: [{ inviteeId: memberKey }, { inviterId: memberKey }] }, data: { enabled: false } });
  await tx.referralPolicy.updateMany({ where: { inviterId: oldId }, data: { enabled: false } });
  const id = `detach:${randomUUID()}`;
  const result = { dlmId: user.dlmId, memberKey, previousDiscordId: oldId, loggedOut: true };
  const snapshot = json({ user, peiwan, autoBuff });
  await tx.detachedDiscordAccount.create({ data: { ownerDlmId: user.dlmId, memberKey, originalDiscordId: oldId } });
  await tx.accountMigration.create({ data: {
    id, mode: 'DETACH', sourceDlmId: user.dlmId, targetDlmId: user.dlmId, sourceDiscordId: oldId, targetDiscordId: null,
    sourcePeiwanId: peiwan?.PEIWANID, targetPeiwanId: peiwan?.PEIWANID, actorDlmId: user.dlmId, actorDiscordId: oldId,
    previewHash: createHash('sha256').update(JSON.stringify(snapshot)).digest('hex'), snapshot, result, rolePlan,
    inheritedAutoCommissionUntil,
    autoCommissionProgressDiscordId: previous?.autoCommissionProgressDiscordId ?? oldId,
  } });
  await tx.accountOwnership.updateMany({ where: { currentDlmId: user.dlmId }, data: { currentDiscordId: null, migrationId: id } });
  await tx.accountOwnership.upsert({ where: { identityKind_identityKey_originalDlmId: { identityKind: 'DISCORD', identityKey: oldId, originalDlmId: user.dlmId } },
    create: { identityKind: 'DISCORD', identityKey: oldId, originalDlmId: user.dlmId, currentDlmId: user.dlmId, currentDiscordId: null, currentPeiwanId: peiwan?.PEIWANID, migrationId: id, retiredAt: new Date() },
    update: { currentDlmId: user.dlmId, currentDiscordId: null, currentPeiwanId: peiwan?.PEIWANID, migrationId: id, retiredAt: new Date() },
  });
  return { provider: AccountProvider.DISCORD, loggedOut: true, migrationId: id };
}
