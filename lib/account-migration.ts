import { Prisma, type PrismaClient } from '@prisma/client';
import { lockManualQuotaOwnersTx } from './manual-quota-transfer';
import { lockDlmWalletsTx } from './dlm-wallet-lock';
import { lockWechatOwnersTx, WECHAT_PROVIDERS } from './wechat-identity-transaction';
import { isBackofficeDiscordId, canViewStripePricing } from './admin';
import { getHighestVipLevelByTotalSpent } from './vip-levels';
import {
  archiveMigrationRow, archiveMigrationTree, deleteArchivedMigrationRow, migrationConflict,
  migrationDelegate as db, migrationJson, migrationModels, migrationOwnerFields,
  migrationRowKey, updateMigrationRow, type MigrationArchiveContext, type MigrationRow,
} from './account-migration-records';
import {
  latestMigrationExpiry, mergeMigrationPeiwan, migrationCanonical, migrationDecimal as dec,
  migrationPlanFingerprint, migrationSum, nonemptyMigrationValue, preferMigrationTarget,
} from './account-migration-policy';

export type AccountMigrationRoleSnapshot = {
  sourceRoleIds: string[]; targetRoleIds: string[]; gameRoleIds: string[]; reminderRoleIds: string[];
};
export type AccountMigrationInput = {
  sourceDlmId: string; targetDlmId: string;
  actorDlmId?: string | null; actorDiscordId?: string | null;
  mode: 'ADMIN' | 'SELF_SERVICE';
  roleSnapshot: AccountMigrationRoleSnapshot;
  expectedSourceSessionVersion?: number; expectedTargetSessionVersion?: number;
};
export type AccountMigrationExecuteInput = AccountMigrationInput & { requestId: string; expectedPreviewHash: string };
export class AccountMigrationError extends Error {
  constructor(message: string, readonly code = 'migration_conflict', readonly status = 409) { super(message); this.name = 'AccountMigrationError'; }
}
function fail(message: string, code?: string): never { throw new AccountMigrationError(message, code); }
const text = (value: unknown) => typeof value === 'string' ? value : null;
const number = (value: unknown) => typeof value === 'number' ? value : null;
const isDiscord = (value: unknown): value is string => typeof value === 'string' && /^\d{17,20}$/.test(value);
const emptyRoles = () => ({ sourceRoleIds: [], targetRoleIds: [], gameRoleIds: [], reminderRoleIds: [] });
const reserved = new Set(['DlmUser', 'Member', 'PEIWAN', 'AccountBinding', 'WechatProgramSession', 'DetachedDiscordAccount',
  'AccountMigration', 'AccountOwnership', 'AccountMigrationArchive']);
const special = new Set(['LoyaltyPoint', 'WithdrawalAccount', 'VipBenefitProfile', 'CommissionBuff', 'AutoCommissionBuff',
  'FlowBuff', 'SpendBuff', 'FarmProfile', 'HeartCounter', 'Blacklist', 'Referral', 'MiniConversation']);

type State = {
  source: MigrationRow; target: MigrationRow; sourceMember: MigrationRow | null; targetMember: MigrationRow | null;
  sourceKey: string | null; targetKey: string | null; sourceDiscord: string | null; targetDiscord: string | null;
  sourcePeiwan: MigrationRow | null; targetPeiwan: MigrationRow | null;
  sourceDetached: MigrationRow | null; targetDetached: MigrationRow | null;
  rows: Record<string, MigrationRow[]>;
};
const one = (rows: MigrationRow[], field: string, value: unknown) => value == null ? null : rows.find(row => row[field] === value) ?? null;
const ownerPair = (state: State, model: string, key = 'userId') => [one(state.rows[model] ?? [], key, state.sourceKey), one(state.rows[model] ?? [], key, state.targetKey)] as const;
const identityIds = (state: State) => [state.sourceKey, state.targetKey].filter((value): value is string => !!value);

async function loadState(tx: Prisma.TransactionClient, input: AccountMigrationInput): Promise<State> {
  if (!input.sourceDlmId || input.sourceDlmId === input.targetDlmId) fail('请选择两个不同账户', 'migration_invalid_accounts');
  const users = await db(tx, 'DlmUser').findMany({ where: { dlmId: { in: [input.sourceDlmId, input.targetDlmId] } } });
  const source = one(users, 'dlmId', input.sourceDlmId), target = one(users, 'dlmId', input.targetDlmId);
  if (!source || !target) fail('账户不存在或已迁移，请按原请求编号查询', 'migration_account_missing');
  const detached = await db(tx, 'DetachedDiscordAccount').findMany({ where: { ownerDlmId: { in: [input.sourceDlmId, input.targetDlmId] } } });
  const sourceDetached = one(detached, 'ownerDlmId', source.dlmId), targetDetached = one(detached, 'ownerDlmId', target.dlmId);
  const sourceKey = text(source.discordUserId) ?? text(sourceDetached?.memberKey);
  const targetKey = text(target.discordUserId) ?? text(targetDetached?.memberKey);
  const memberIds = [sourceKey, targetKey].filter((value): value is string => !!value);
  const members = memberIds.length ? await db(tx, 'Member').findMany({ where: { discordUserId: { in: memberIds } } }) : [];
  const sourceMember = one(members, 'discordUserId', sourceKey), targetMember = one(members, 'discordUserId', targetKey);
  if ((sourceKey && !sourceMember) || (targetKey && !targetMember)) fail('账户钱包缺失，请先核实账户数据');
  if (sourceKey && !targetKey) fail('接收账户需要先完成 Discord 身份验证或解绑保管登记');
  const profiles = memberIds.length ? await db(tx, 'PEIWAN').findMany({ where: { discordUserId: { in: memberIds } } }) : [];
  const sourcePeiwan = one(profiles, 'discordUserId', sourceKey), targetPeiwan = one(profiles, 'discordUserId', targetKey);
  const peiwanIds = profiles.map(row => row.PEIWANID);
  const rows: Record<string, MigrationRow[]> = { DlmUser: users, Member: members, PEIWAN: profiles, DetachedDiscordAccount: detached };
  for (const model of migrationModels) {
    if (reserved.has(model.name)) continue;
    const fields = migrationOwnerFields(model.name);
    const clauses: MigrationRow[] = [
      ...[...fields.dlm].map(field => ({ [field]: { in: [input.sourceDlmId, input.targetDlmId] } })),
      ...[...fields.member].map(field => ({ [field]: { in: memberIds } })),
      ...[...fields.peiwan].map(field => ({ [field]: { in: peiwanIds } })),
    ];
    if (clauses.length) rows[model.name] = await db(tx, model.name).findMany({ where: { OR: clauses } });
  }
  // Old receipts may predate DLM ownership. Preserve their original Discord
  // fact while attaching current ownership before either wallet is retired.
  const legacyIncome = memberIds.length ? await db(tx, 'IndividualTransaction').findMany({ where: { dlmId: null, discordId: { in: memberIds } } }) : [];
  rows.IndividualTransaction = [...(rows.IndividualTransaction ?? []), ...legacyIncome];
  rows.AccountBinding = await db(tx, 'AccountBinding').findMany({ where: { dlmId: { in: [input.sourceDlmId, input.targetDlmId] } } });
  const unionIds = [...new Set(rows.AccountBinding.filter(row => WECHAT_PROVIDERS.includes(row.provider as typeof WECHAT_PROVIDERS[number])).map(row => text(row.unionId)).filter((id): id is string => !!id))];
  if (unionIds.length) {
    const owners = await db(tx, 'AccountBinding').findMany({ where: { provider: { in: WECHAT_PROVIDERS }, unionId: { in: unionIds } } });
    if (owners.some(row => row.dlmId !== source.dlmId && row.dlmId !== target.dlmId)) fail('同一微信身份还关联了第三个账户，请先核实；本次未迁移', 'wechat_identity_conflict');
  }
  rows.ReferralPolicy = sourceKey ? await db(tx, 'ReferralPolicy').findMany({ where: { inviterId: sourceKey } }) : [];
  return { source, target, sourceMember, targetMember, sourceKey, targetKey, sourcePeiwan, targetPeiwan, sourceDetached, targetDetached,
    sourceDiscord: isDiscord(source.discordUserId) ? source.discordUserId : text(sourceDetached?.originalDiscordId),
    targetDiscord: isDiscord(target.discordUserId) ? target.discordUserId : null, rows };
}

function assertState(input: AccountMigrationInput, state: State, now: Date) {
  if (!state.sourceDetached && state.sourceDiscord && (isBackofficeDiscordId(state.sourceDiscord) || canViewStripePricing(state.sourceDiscord))) fail('旧账号仍在网站管理权限名单中，请先由有权管理员完成权限交接', 'migration_privileged_source');
  if (input.expectedSourceSessionVersion !== undefined && state.source.sessionVersion !== input.expectedSourceSessionVersion ||
      input.expectedTargetSessionVersion !== undefined && state.target.sessionVersion !== input.expectedTargetSessionVersion) fail('登录身份已变化，请重新验证', 'migration_session_changed');
  for (const [user, member] of [[state.source, state.sourceMember], [state.target, state.targetMember]] as const) {
    if (!dec(user.income).add(dec(user.recharge)).eq(dec(user.totalBalance))) fail('账户分项余额与总余额不一致，请先核实');
    if (member && !(user.dlmId === state.source.dlmId ? state.sourceDetached : state.targetDetached)) for (const field of ['income', 'recharge', 'totalBalance', 'totalSpent']) {
      if (!dec(user[field]).eq(dec(member[field]))) fail('网站与 Discord 钱包金额不一致，请先核实');
    }
  }
  for (const model of ['ManualQuotaBatch', 'ManualQuotaRestoration']) for (const row of state.rows[model] ?? []) {
    if (!['flow', 'spend'].includes(String(row.kind)) || dec(row.remainingExtra).lt(0)) fail('双倍额度批次异常，请先核实');
  }
  const ids = new Set(identityIds(state));
  if ((state.rows.Order ?? []).some(row => ['PENDING', 'RUNNING'].includes(String(row.status))) ||
      (state.rows.DispatchRequest ?? []).some(row => row.status === 'OPEN' &&
        (!(row.expiresAt instanceof Date) || !Number.isFinite(row.expiresAt.getTime()) || row.expiresAt > now)) ||
      (state.rows.AuditionInvite ?? []).some(row => ['PENDING', 'ACCEPTED'].includes(String(row.status))) ||
      (state.rows.WorkerLock ?? []).some(row => ids.has(String(row.workerId)))) fail('迁移前提不满足：仍有待接／运行订单、开放派单或试音，请结束原业务后重新预览', 'migration_active_business');
  // Internal Bot preflight verifies guild authorization and role snapshots. A
  // missing snapshot cannot be replaced with caller-selected role IDs in a route.
  for (const key of ['sourceRoleIds', 'targetRoleIds', 'gameRoleIds', 'reminderRoleIds'] as const) {
    if (!Array.isArray(input.roleSnapshot?.[key]) || input.roleSnapshot[key].some(id => !isDiscord(id))) fail('角色核验结果无效', 'migration_role_preflight_required');
  }
}

function wallet(state: State) {
  return Object.fromEntries(['totalBalance', 'income', 'recharge', 'totalSpent', 'loyaltyPoints'].map(field => [field, migrationSum(state.source[field], state.target[field])])) as Record<string, Prisma.Decimal>;
}
function summary(state: State, source: boolean) {
  const account = source ? state.source : state.target;
  const member = source ? state.sourceMember : state.targetMember;
  const peiwan = source ? state.sourcePeiwan : state.targetPeiwan;
  return { dlmId: account.dlmId, discordId: source ? state.sourceDiscord : state.targetDiscord,
    displayName: member?.serverDisplayName ?? account.wechatDisplayName ?? account.dlmId,
    wallet: Object.fromEntries(['totalBalance', 'income', 'recharge', 'totalSpent', 'loyaltyPoints'].map(field => [field, dec(account[field]).toString()])),
    peiwanId: peiwan?.PEIWANID ?? null };
}
function projection(state: State, now: Date) {
  const totals = wallet(state);
  const base = dec(state.targetPeiwan?.baseCommissionRate ?? state.targetMember?.baseCommissionRate ?? state.sourcePeiwan?.baseCommissionRate ?? state.sourceMember?.baseCommissionRate ?? '0.75');
  const [sourceAuto, targetAuto] = ownerPair(state, 'AutoCommissionBuff');
  const inherited = latestMigrationExpiry(now, sourceAuto?.activeUntil, targetAuto?.activeUntil);
  const commissionRate = inherited && base.lt('0.91') ? dec('0.91') : base;
  const member = { ...state.targetMember, discordUserId: state.targetKey, baseCommissionRate: base, commissionRate };
  const peiwan = mergeMigrationPeiwan(state.sourcePeiwan, state.targetPeiwan, member, totals.totalBalance);
  const vipLevel = getHighestVipLevelByTotalSpent(totals.totalSpent.toString());
  const beforeLevel = Math.max(getHighestVipLevelByTotalSpent(dec(state.source.totalSpent).toString()), getHighestVipLevelByTotalSpent(dec(state.target.totalSpent).toString()));
  const suppressedVipLevels = Array.from({ length: Math.max(0, vipLevel - beforeLevel) }, (_, i) => beforeLevel + i + 1);
  return { totals, base, commissionRate, peiwan, inherited, vipLevel, suppressedVipLevels };
}

export async function previewAccountMigrationTx(tx: Prisma.TransactionClient, input: AccountMigrationInput, now = new Date()) {
  const state = await loadState(tx, input);
  assertState(input, state, now);
  const plan = projection(state, now);
  const previewHash = migrationPlanFingerprint(state.rows, input.roleSnapshot);
  const conflicts: Array<{ model: string; recordKey: string; policy: string }> = [];
  if (state.sourceKey && state.targetKey) for (const name of ['FarmPlot', 'LotteryPity', 'VoicePointSession', 'BlockStackPlayer', 'PointShopCart']) {
    const fields = migrationOwnerFields(name);
    for (const row of state.rows[name] ?? []) {
      const patch: MigrationRow = Object.fromEntries([...fields.member].filter(field => row[field] === state.sourceKey).map(field => [field, state.targetKey]));
      if (row.dlmId === state.source.dlmId) patch.dlmId = state.target.dlmId;
      if (Object.keys(patch).length && (name === 'PointShopCart' && row.status === 'OPEN' && (state.rows.PointShopCart ?? []).some(other => other.id !== row.id && other.dlmId === state.target.dlmId && other.status === 'OPEN') || name === 'VoicePointSession' && row.leftAt == null || await migrationConflict(tx, name, row, patch))) {
        conflicts.push({ model: name, recordKey: JSON.stringify(migrationRowKey(name, row)), policy: '完整归档后跳过，不转换为可用资产或进度' });
      }
    }
  }
  return { version: 1, previewHash, source: summary(state, true), target: summary(state, false),
    mergedWallet: Object.fromEntries(Object.entries(plan.totals).map(([field, value]) => [field, value.toString()])),
    peiwanId: plan.peiwan?.PEIWANID ?? null, vipLevel: plan.vipLevel, suppressedVipLevels: plan.suppressedVipLevels,
    conflicts, notice: '兼容资产及历史合并，旧账号删除；原始证据归档，双方会话失效。余额按执行时最新值，资料／权益变化需重新预览。角色单独续办，不重转资金。' };
}

async function mergeSimpleSingleton(context: MigrationArchiveContext, state: State, model: string, field: string, data: MigrationRow) {
  const [source, target] = ownerPair(state, model, field);
  if (target) await updateMigrationRow(context, model, target, data);
  else if (source) await updateMigrationRow(context, model, source, { ...data, [field]: state.targetKey });
  else if (state.targetKey) await db(context.tx, model).create({ data: { ...data, [field]: state.targetKey } });
  if (source && target) await deleteArchivedMigrationRow(context, model, source, 'MERGED_SINGLETON');
}

async function mergeIdentities(context: MigrationArchiveContext, state: State) {
  const { tx } = context;
  // Revoke both sides before moving bindings. Nothing is reissued in this transaction.
  const sessions = await db(tx, 'WechatProgramSession').findMany({ where: { dlmId: { in: [state.source.dlmId, state.target.dlmId] } } });
  for (const session of sessions) await deleteArchivedMigrationRow(context, 'WechatProgramSession', session, 'SESSION_REVOKED');
  const targetBindings = state.rows.AccountBinding.filter(row => row.dlmId === state.target.dlmId);
  const targetWechat = targetBindings.filter(row => WECHAT_PROVIDERS.includes(row.provider as typeof WECHAT_PROVIDERS[number]));
  for (const binding of state.rows.AccountBinding.filter(row => row.dlmId === state.source.dlmId)) {
    const wechat = WECHAT_PROVIDERS.includes(binding.provider as typeof WECHAT_PROVIDERS[number]);
    const sameWechat = wechat && !!binding.unionId && targetWechat.some(row => row.unionId === binding.unionId);
    if (wechat && (!targetWechat.length || sameWechat)) await updateMigrationRow(context, 'AccountBinding', binding, { dlmId: state.target.dlmId });
    else await deleteArchivedMigrationRow(context, 'AccountBinding', binding, 'RETIRED_LOGIN_CREDENTIAL');
  }
}

async function mergeRights(context: MigrationArchiveContext, state: State, plan: ReturnType<typeof projection>, now: Date) {
  if (!state.targetKey) return;
  const [sourceVip, targetVip] = ownerPair(state, 'VipBenefitProfile', 'discordUserId');
  await mergeSimpleSingleton(context, state, 'VipBenefitProfile', 'discordUserId', {
    roleOptOut: targetVip?.roleOptOut ?? false, announcementEnabled: targetVip?.announcementEnabled ?? true,
    lastSettledVipLevel: Math.max(plan.vipLevel, Number(sourceVip?.lastSettledVipLevel ?? 0), Number(targetVip?.lastSettledVipLevel ?? 0)),
    dispatchImageUrl: preferMigrationTarget(sourceVip?.dispatchImageUrl, targetVip?.dispatchImageUrl) ?? null,
  });
  const [sourceCommission, targetCommission] = ownerPair(state, 'CommissionBuff');
  const expiresAt = latestMigrationExpiry(now, sourceCommission?.expiresAt, targetCommission?.expiresAt);
  if (expiresAt) {
    for (const row of [sourceCommission, targetCommission]) if (row && row.expiresAt instanceof Date && row.expiresAt > now && !dec(row.boost).eq('0.01')) fail('存在非标准抽成权益，请先核实');
    await mergeSimpleSingleton(context, state, 'CommissionBuff', 'userId', { boost: dec('0.01'), expiresAt });
  } else if (sourceCommission) await deleteArchivedMigrationRow(context, 'CommissionBuff', sourceCommission, 'EXPIRED_NOT_REACTIVATED');
  for (const [model, kind] of [['FlowBuff', 'flow'], ['SpendBuff', 'spend']] as const) {
    const [source] = ownerPair(state, model);
    if (!source) continue;
    const remaining = dec(source.remainingExtra);
    if (remaining.lt(0)) fail('旧普通额度存在负数，请先核实');
    // Preserve expired history as an expired ordinary batch, never restoration.
    if (remaining.gt(0)) await db(context.tx, 'ManualQuotaBatch').create({ data: {
      id: `${context.migrationId}:${kind}`, userId: state.targetKey, kind,
      remainingExtra: remaining, expiresAt: source.expiresAt, createdAt: source.createdAt,
    } });
    await deleteArchivedMigrationRow(context, model, source, 'MOVED_TO_INDEPENDENT_ORDINARY_BATCH');
  }
  const [sourceAuto, targetAuto] = ownerPair(state, 'AutoCommissionBuff');
  if (targetAuto) await updateMigrationRow(context, 'AutoCommissionBuff', targetAuto, { activeUntil: plan.inherited });
  else if (plan.inherited) await db(context.tx, 'AutoCommissionBuff').create({ data: {
    userId: state.targetKey, targetShare: dec('0.91'), thresholdAmount: dec(12000), windowDays: 30,
    windowStart: now, windowEnd: now, currentAmount: dec(0), activeUntil: plan.inherited,
    tierExpiries: Prisma.JsonNull, lastQualifiedAt: null,
  } });
  if (sourceAuto) await deleteArchivedMigrationRow(context, 'AutoCommissionBuff', sourceAuto, 'OLD_PROGRESS_NOT_INHERITED');
  const [sourceWithdrawal, targetWithdrawal] = ownerPair(state, 'WithdrawalAccount', 'discordUserId');
  if (sourceWithdrawal || targetWithdrawal) await mergeSimpleSingleton(context, state, 'WithdrawalAccount', 'discordUserId', {
    dlmId: state.target.dlmId,
    ...Object.fromEntries(['account1', 'account2', 'account3'].map(field => [field, preferMigrationTarget(sourceWithdrawal?.[field], targetWithdrawal?.[field]) ?? null])),
  });
  await mergeSimpleSingleton(context, state, 'LoyaltyPoint', 'discordUserId', { dlmId: state.target.dlmId, points: plan.totals.loyaltyPoints });
}

async function mergePairs(context: MigrationArchiveContext, state: State, model: 'HeartCounter' | 'Blacklist') {
  if (!state.sourceKey || !state.targetKey) return;
  const fields = model === 'HeartCounter' ? ['fromMemberId', 'toMemberId'] : ['blockerId', 'blockedId'];
  for (const row of state.rows[model] ?? []) {
    if (!fields.some(field => row[field] === state.sourceKey)) continue;
    const patch = Object.fromEntries(fields.map(field => [field, row[field] === state.sourceKey ? state.targetKey : row[field]]));
    if (patch[fields[0]] === patch[fields[1]]) {
      await deleteArchivedMigrationRow(context, model, row, 'SELF_RELATION_HISTORY_ONLY');
      continue;
    }
    const duplicate = await migrationConflict(context.tx, model, row, patch);
    if (duplicate) {
      if (model === 'HeartCounter') await updateMigrationRow(context, model, duplicate, { total: Number(duplicate.total) + Number(row.total) });
      await deleteArchivedMigrationRow(context, model, row, 'MERGED_RELATION');
    } else await updateMigrationRow(context, model, row, patch);
  }
}

async function endReferralRelationships(context: MigrationArchiveContext, state: State) {
  const carry: Array<MigrationRow> = [];
  const retained = one(state.rows.Referral ?? [], 'inviteeId', state.targetKey);
  for (const referral of state.rows.Referral ?? []) {
    if (referral.inviterId !== state.sourceKey && referral.inviteeId !== state.sourceKey) continue;
    const payouts = await db(context.tx, 'ReferralPayout').findMany({ where: { referralId: referral.inviteeId } });
    if (referral.inviteeId === state.sourceKey && retained && retained.inviterId !== state.sourceKey && retained.inviterId === referral.inviterId) {
      carry.push({ inviterId: referral.inviterId, inviteeDlmId: state.target.dlmId, type: retained.type,
        amount: payouts.reduce((sum, row) => sum.add(dec(row.amount)), dec(0)).toString(),
        payouts: payouts.map(row => ({ id: row.id, referralId: row.referralId, orderId: row.orderId, amount: dec(row.amount).toString() })) });
    }
    for (const payout of payouts) await deleteArchivedMigrationRow(context, 'ReferralPayout', payout, 'RELATION_ENDED_PAYOUT_HISTORY');
    await deleteArchivedMigrationRow(context, 'Referral', referral, 'OLD_INVITATION_RELATION_ENDED');
  }
  for (const policy of state.rows.ReferralPolicy ?? []) await deleteArchivedMigrationRow(context, 'ReferralPolicy', policy, 'OLD_INVITATION_POLICY_ENDED');
  return carry;
}

async function mergeConversations(context: MigrationArchiveContext, state: State) {
  for (const row of state.rows.MiniConversation ?? []) {
    if (row.userAId !== state.source.dlmId && row.userBId !== state.source.dlmId) continue;
    const a = row.userAId === state.source.dlmId ? state.target.dlmId : row.userAId;
    const b = row.userBId === state.source.dlmId ? state.target.dlmId : row.userBId;
    const patch: MigrationRow = { userAId: a, userBId: b };
    if (row.type === 'SYSTEM') patch.peerKey = `system:${a}`;
    if (row.type === 'SUPPORT') patch.peerKey = `support:${a}`;
    if (a && a === b) {
      patch.type = 'SYSTEM'; patch.peerKey = `migration-history:${context.migrationId}:${row.id}`;
      // The read-only system channel keeps both directions/messages and evidence.
      patch.userBId = null;
      await updateMigrationRow(context, 'MiniConversation', row, patch);
      continue;
    }
    const canonicalIds = [a, b].filter((id): id is string => typeof id === 'string').sort();
    if (row.type === 'DIRECT' && canonicalIds.length === 2) patch.peerKey = canonicalIds.join(':');
    const duplicate = await db(context.tx, 'MiniConversation').findFirst({ where: {
      type: row.type, id: { not: row.id }, OR: [{ userAId: a, userBId: b }, { userAId: b, userBId: a }],
    } });
    if (!duplicate) { await updateMigrationRow(context, 'MiniConversation', row, patch); continue; }
    const minRead = (left: unknown, right: unknown) => left instanceof Date && right instanceof Date ? new Date(Math.min(left.getTime(), right.getTime())) : null;
    const readFor = (participant: unknown) => a === participant ? row.userALastReadAt : row.userBLastReadAt;
    await updateMigrationRow(context, 'MiniConversation', duplicate, {
      userALastReadAt: minRead(duplicate.userALastReadAt, readFor(duplicate.userAId)),
      userBLastReadAt: minRead(duplicate.userBLastReadAt, readFor(duplicate.userBId)),
      adminWatched: Boolean(duplicate.adminWatched || row.adminWatched),
    });
    for (const message of await db(context.tx, 'MiniMessage').findMany({ where: { conversationId: row.id } })) {
      await updateMigrationRow(context, 'MiniMessage', message, { conversationId: duplicate.id });
    }
    await deleteArchivedMigrationRow(context, 'MiniConversation', row, 'MERGED_CHAT_MESSAGES_PRESERVED');
  }
}

async function mergeDuplicate(context: MigrationArchiveContext, model: string, row: MigrationRow, duplicate: MigrationRow, patch: MigrationRow) {
  const { tx } = context;
  if (['FarmPlot', 'LotteryPity', 'BlockStackPlayer'].includes(model)) {
    await archiveMigrationTree(context, model, row, 'INCOMPATIBLE_ACTIVE_PROGRESS'); return;
  }
  if (model === 'PointShopOrder') {
    // Both purchases and their grants/ledger survive. Namespace only the owner-
    // scoped request key; the original key remains in immutable archive evidence.
    await updateMigrationRow(context, model, row, { ...patch, requestKey: `migration:${context.migrationId}:${row.id}:${String(row.requestKey)}` }); return;
  }
  if (model === 'VipBenefitGrant') {
    const instances = await db(tx, 'VipBenefitGrantInstance').findMany({ where: { grantId: { in: [row.id, duplicate.id] } } });
    let sequence = Math.max(0, ...instances.filter(item => item.grantId === duplicate.id).map(item => Number(item.sequence)));
    for (const instance of instances.filter(item => item.grantId === row.id)) await updateMigrationRow(context, 'VipBenefitGrantInstance', instance, { grantId: duplicate.id, sequence: ++sequence });
  } else if (model === 'DispatchCandidate') {
    for (const order of await db(tx, 'Order').findMany({ where: { dispatchCandidateId: row.id } })) await updateMigrationRow(context, 'Order', order, { dispatchCandidateId: duplicate.id });
  } else if (model === 'DailySnapshot') {
    const sums = Object.fromEntries(['totalBalance', 'income', 'recharge', 'totalEarn', 'totalSpent'].filter(field => Object.hasOwn(row, field)).map(field => [field, migrationSum(row[field], duplicate[field])]));
    if (Object.keys(sums).length) await updateMigrationRow(context, model, duplicate, sums);
  } else if (model === 'FarmVisit') {
    await updateMigrationRow(context, model, duplicate, { visitCount: Number(row.visitCount) + Number(duplicate.visitCount) });
  } else if (['PeiwanGiftUnlock', 'PeiwanGiftRewardClaim', 'OpeningBenefitClaim', 'RedEnvelopeClaim', 'GuildJoinRecord',
    'InviteLinkUsage', 'FarmPlotHelp', 'PeiwanGameProfile', 'PeiwanDeletion', 'OrderRequestClick'].includes(model)) {
    // Duplicate entitlement stays claimed. Original evidence, including every
    // issued voucher ID/claim amount, is retained separately; never reissue.
  } else if (['BossProfile', 'ManualWechatBoss', 'AuditionRoom'].includes(model)) {
    const scalarPatch = Object.fromEntries(Object.entries(row).filter(([field, value]) => !Object.hasOwn(patch, field) && nonemptyMigrationValue(value) && !nonemptyMigrationValue(duplicate[field]) && !['id', 'createdAt', 'updatedAt'].includes(field)));
    if (Object.keys(scalarPatch).length) await updateMigrationRow(context, model, duplicate, scalarPatch);
  } else fail(`尚未定义 ${model} 的唯一记录冲突处置，原数据已保留，请更新迁移方案`, 'migration_unknown_unique_conflict');
  await deleteArchivedMigrationRow(context, model, row, 'DUPLICATE_STATE_ORIGINAL_EVIDENCE_PRESERVED');
}

async function mergeGenericOwners(context: MigrationArchiveContext, state: State) {
  const retiringPeiwan = state.sourcePeiwan && state.targetPeiwan ? state.targetPeiwan.PEIWANID : null;
  const primaryPeiwan = state.sourcePeiwan?.PEIWANID ?? state.targetPeiwan?.PEIWANID ?? null;
  for (const model of migrationModels) {
    if (reserved.has(model.name) || special.has(model.name)) continue;
    const fields = migrationOwnerFields(model.name);
    for (const original of state.rows[model.name] ?? []) {
      // A preceding duplicate merge may have moved a child; reread its live row.
      const row = await db(context.tx, model.name).findFirst({ where: migrationRowKey(model.name, original) });
      if (!row) continue;
      const patch: MigrationRow = {};
      for (const field of fields.dlm) if (row[field] === state.source.dlmId) patch[field] = state.target.dlmId;
      for (const field of fields.member) if (state.sourceKey && row[field] === state.sourceKey) patch[field] = state.targetKey;
      if (model.name === 'IndividualTransaction' && row.dlmId == null && (row.discordId === state.sourceKey || row.discordId === state.targetKey)) patch.dlmId = state.target.dlmId;
      for (const field of fields.peiwan) if (retiringPeiwan != null && row[field] === retiringPeiwan) patch[field] = primaryPeiwan;
      if (!Object.keys(patch).length) continue;
      if (model.name === 'VoicePointSession' && row.leftAt == null) {
        await archiveMigrationTree(context, model.name, row, 'OPEN_VOICE_SESSION_NOT_TRANSFERRED'); continue;
      }
      if (model.name === 'PointShopCart' && row.status === 'OPEN' && (state.rows.PointShopCart ?? []).some(other => other.id !== row.id && other.dlmId === state.target.dlmId && other.status === 'OPEN')) {
        await archiveMigrationTree(context, model.name, row, 'DUPLICATE_OPEN_CART'); continue;
      }
      if (model.name === 'FarmVisit' && (patch.viewerDiscordId ?? row.viewerDiscordId) === (patch.targetDiscordId ?? row.targetDiscordId)) {
        await deleteArchivedMigrationRow(context, model.name, row, 'SELF_VISIT_HISTORY_ONLY'); continue;
      }
      const duplicate = await migrationConflict(context.tx, model.name, row, patch);
      if (duplicate) await mergeDuplicate(context, model.name, row, duplicate, patch);
      else await updateMigrationRow(context, model.name, row, patch);
    }
  }
}

async function mergeFarm(context: MigrationArchiveContext, state: State) {
  if (!state.sourceKey || !state.targetKey) return;
  const [source, target] = ownerPair(state, 'FarmProfile', 'discordUserId');
  if (!source) return;
  if (!target) {
    // Parent PK update cascades its plots/logs; archive every affected row first.
    for (const model of ['FarmPlot', 'FarmActionLog']) for (const row of state.rows[model] ?? []) if (row.discordUserId === state.sourceKey) await archiveMigrationRow(context, model, row, 'OWNERSHIP_CASCADE_RECORDED');
    await updateMigrationRow(context, 'FarmProfile', source, { discordUserId: state.targetKey });
  } else await updateMigrationRow(context, 'FarmProfile', target, {
    coins: migrationSum(source.coins, target.coins), experience: Number(source.experience) + Number(target.experience),
    unlockedPlots: Math.max(Number(source.unlockedPlots), Number(target.unlockedPlots)),
  });
}

async function mergeProfile(context: MigrationArchiveContext, state: State, plan: ReturnType<typeof projection>) {
  if (!plan.peiwan || !state.targetKey) return;
  const primary = state.sourcePeiwan ?? state.targetPeiwan!;
  if (state.sourcePeiwan && state.targetPeiwan) {
    // All PEIWAN foreign keys have been moved by mergeGenericOwners first.
    for (const model of migrationModels) for (const relation of model.fields.filter(field => field.kind === 'object' && field.type === 'PEIWAN' && field.relationFromFields?.length)) {
      const where = Object.fromEntries(relation.relationFromFields!.map((field, i) => [field, state.targetPeiwan![relation.relationToFields![i]]]));
      if (await db(context.tx, model.name).count({ where })) fail(`陪玩历史关联尚未完整处理：${model.name}`);
    }
    await deleteArchivedMigrationRow(context, 'PEIWAN', state.targetPeiwan, 'MERGED_INTO_OLD_PEIWAN_ID');
  }
  const games = await db(context.tx, 'PeiwanGameProfile').findMany({ where: { peiwanId: primary.PEIWANID } });
  const type = games.some(row => ['MASTER', 'DEMON_GUARD'].includes(String(row.tier))) ? '大神陪玩'
    : games.some(row => ['TECH', 'TRAINEE'].includes(String(row.tier))) ? '技术陪玩' : '娱乐陪玩';
  const { PEIWANID: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...patch } = plan.peiwan;
  void _id; void _createdAt; void _updatedAt;
  await updateMigrationRow(context, 'PEIWAN', primary, { ...patch, type });
}

async function recordOwnership(context: MigrationArchiveContext, state: State, plan: ReturnType<typeof projection>, now: Date) {
  const data = { currentDlmId: state.target.dlmId, currentDiscordId: state.targetDiscord,
    currentPeiwanId: plan.peiwan?.PEIWANID ?? null, migrationId: context.migrationId };
  // Flatten every prior edge that currently points at the retiring account.
  await db(context.tx, 'AccountOwnership').updateMany({ where: { currentDlmId: state.source.dlmId }, data });
  // Target's former profile identity must also resolve to the retained old ID.
  if (state.targetPeiwan && state.sourcePeiwan) await db(context.tx, 'AccountOwnership').updateMany({ where: { currentDlmId: state.target.dlmId }, data: { currentPeiwanId: plan.peiwan!.PEIWANID } });
  const aliases: Array<{ identityKind: string; identityKey: string; originalDlmId: string }> = [
    { identityKind: 'DLM', identityKey: String(state.source.dlmId), originalDlmId: String(state.source.dlmId) },
  ];
  if (state.sourceDiscord) aliases.push({ identityKind: 'DISCORD', identityKey: state.sourceDiscord, originalDlmId: String(state.source.dlmId) });
  if (state.sourcePeiwan) aliases.push({ identityKind: 'PEIWAN', identityKey: String(state.sourcePeiwan.PEIWANID), originalDlmId: String(state.source.dlmId) });
  if (state.targetPeiwan && state.sourcePeiwan) aliases.push({ identityKind: 'PEIWAN', identityKey: String(state.targetPeiwan.PEIWANID), originalDlmId: String(state.target.dlmId) });
  for (const alias of aliases) {
    const existing = await db(context.tx, 'AccountOwnership').findFirst({ where: alias });
    if (existing) await db(context.tx, 'AccountOwnership').updateMany({ where: { id: existing.id }, data });
    else await db(context.tx, 'AccountOwnership').create({ data: { ...alias, ...data, retiredAt: now } });
  }
}

async function assertNoSourceReferences(tx: Prisma.TransactionClient, state: State) {
  for (const model of migrationModels) {
    if (reserved.has(model.name)) continue;
    for (const relation of model.fields.filter(field => field.kind === 'object' && field.relationFromFields?.length)) {
      const original = relation.type === 'DlmUser' ? state.source : relation.type === 'Member' ? state.sourceMember : null;
      if (!original) continue;
      const where = Object.fromEntries(relation.relationFromFields!.map((field, index) => [field, original[relation.relationToFields![index]]]));
      if (await db(tx, model.name).count({ where })) fail(`旧账号仍有关联 ${model.name}，迁移已回滚，未删除账户`, 'migration_remaining_relations');
    }
  }
}

export async function executeAccountMigrationTx(tx: Prisma.TransactionClient, input: AccountMigrationExecuteInput, now = new Date()) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.requestId)) fail('迁移请求编号无效', 'migration_request_id');
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`account-migration:${input.requestId}`}, 0))`;
  const existing = await db(tx, 'AccountMigration').findUnique({ where: { id: input.requestId } });
  if (existing) {
    if (existing.sourceDlmId !== input.sourceDlmId || existing.targetDlmId !== input.targetDlmId || existing.mode !== input.mode ||
        existing.actorDlmId !== (input.actorDlmId ?? null) || existing.actorDiscordId !== (input.actorDiscordId ?? null)) fail('该迁移编号已用于另一请求', 'migration_request_conflict');
    return existing.result as unknown as AccountMigrationResult;
  }
  const bindingsBefore = await lockWechatOwnersTx(tx, [input.sourceDlmId, input.targetDlmId]);
  const before = await loadState(tx, input);
  for (const id of identityIds(before).sort()) await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`discord-identity:${id}`}, 0))`;
  await lockDlmWalletsTx(tx, [before.source, before.target].map(row => ({ dlmId: String(row.dlmId), discordUserId: text(row.discordUserId) })));
  for (const detached of [before.sourceDetached, before.targetDetached]) if (detached) await tx.$queryRaw`SELECT "discordUserId" FROM "Member" WHERE "discordUserId" = ${String(detached.memberKey)} FOR UPDATE`;
  const bindingsAfter = await tx.accountBinding.findMany({ where: { dlmId: { in: [input.sourceDlmId, input.targetDlmId] }, provider: { in: WECHAT_PROVIDERS } }, select: { id: true, dlmId: true, unionId: true, provider: true, providerUserId: true } });
  if (migrationCanonical(bindingsBefore) !== migrationCanonical(bindingsAfter)) fail('微信身份已变化，请重新预览', 'migration_binding_changed');
  await lockManualQuotaOwnersTx(tx, identityIds(before));
  const state = await loadState(tx, input);
  assertState(input, state, now);
  if (migrationPlanFingerprint(state.rows, input.roleSnapshot) !== input.expectedPreviewHash) fail('身份、资料或权益已变化，请重新预览；本次未迁移', 'migration_preview_changed');
  const plan = projection(state, now);
  // Do not let database change-listeners mislabel a wallet move as recharge.
  await tx.$queryRaw`SELECT set_config('bot.skip_recharge_notify', 'true', true), set_config('app.suppress_peiwan_notifications', 'on', true)`;
  const context: MigrationArchiveContext = { tx, migrationId: input.requestId, counts: {}, skipped: [], archived: new Set() };
  const heartDiscordIds = [...new Set((state.rows.HeartCounter ?? []).flatMap(row => [row.fromMemberId, row.toMemberId]).filter(isDiscord))];
  const targetVip = one(state.rows.VipBenefitProfile ?? [], 'discordUserId', state.targetKey);
  const heartPeers = heartDiscordIds.length ? await db(tx, 'DlmUser').findMany({ where: { discordUserId: { in: heartDiscordIds } }, select: { dlmId: true, discordUserId: true } }) : [];
  const rolePlan = { version: 1, createdAt: now.toISOString(),
    heartPeerOwners: heartPeers.map(row => ({ dlmId: row.dlmId, discordId: row.discordUserId })),
    source: { dlmId: state.source.dlmId, discordId: state.sourceDetached ? null : state.sourceDiscord, peiwanId: state.sourcePeiwan?.PEIWANID ?? null },
    target: { dlmId: state.target.dlmId, discordId: state.targetDiscord, peiwanId: plan.peiwan?.PEIWANID ?? null },
    ...input.roleSnapshot, sourceWasPeiwan: !!state.sourcePeiwan, targetIsPeiwan: !!plan.peiwan,
    vipRoleOptOut: targetVip?.roleOptOut ?? false, fuxingActiveUntil: plan.inherited?.toISOString() ?? null,
    heartDiscordIds: [...new Set([...heartDiscordIds.filter(id => !state.sourceDetached || id !== state.sourceDiscord), ...[state.sourceDetached ? null : state.sourceDiscord, state.targetDiscord].filter(isDiscord)])],
  };
  if (state.sourceDetached) {
    const previous = await db(tx, 'AccountMigration').findFirst({ where: { mode: 'DETACH', targetDlmId: state.source.dlmId }, orderBy: { createdAt: 'desc' } });
    const oldPlan = previous?.rolePlan as AccountMigrationRoleSnapshot | null;
    for (const key of ['gameRoleIds', 'reminderRoleIds'] as const) rolePlan[key] = [...new Set([...rolePlan[key], ...(oldPlan?.[key] ?? [])])].sort();
  }
  const sourceAliases = await db(tx, 'AccountOwnership').findMany({ where: { identityKind: 'DLM', currentDlmId: state.source.dlmId }, select: { originalDlmId: true } });
  const priorTarget = await db(tx, 'AccountMigration').findFirst({ where: { targetDlmId: state.target.dlmId }, orderBy: { createdAt: 'desc' } });
  const progressDiscordId = text(priorTarget?.autoCommissionProgressDiscordId) ?? state.targetDiscord ?? text(state.targetDetached?.originalDiscordId);
  await db(tx, 'AccountMigration').create({ data: {
    id: input.requestId, mode: input.mode, sourceDlmId: state.source.dlmId, targetDlmId: state.target.dlmId,
    sourceDiscordId: state.sourceDiscord, targetDiscordId: state.targetDiscord,
    sourcePeiwanId: state.sourcePeiwan?.PEIWANID ?? null, targetPeiwanId: plan.peiwan?.PEIWANID ?? null,
    actorDlmId: input.actorDlmId ?? null, actorDiscordId: input.actorDiscordId ?? null, previewHash: input.expectedPreviewHash,
    status: 'COMPLETED', snapshot: migrationJson({ source: state.source, target: state.target, sourceMember: state.sourceMember,
      targetMember: state.targetMember, sourcePeiwan: state.sourcePeiwan, targetPeiwan: state.targetPeiwan,
      targetAutoCommission: ownerPair(state, 'AutoCommissionBuff')[1], suppressedVipLevels: plan.suppressedVipLevels,
      excludedAutoCommissionOrigins: [{ dlmIds: [...new Set([state.source.dlmId, ...sourceAliases.map(row => row.originalDlmId)])], through: now.toISOString() }],
      excludedAutoCommissionTransactionIds: (state.rows.IndividualTransaction ?? []).filter(row => row.dlmId === state.source.dlmId || row.dlmId == null && row.discordId === state.sourceKey).map(row => row.transactionId) }),
    result: {}, rolePlan: migrationJson(rolePlan), inheritedAutoCommissionUntil: plan.inherited,
    autoCommissionProgressDiscordId: progressDiscordId, rolesStatus: state.sourceDiscord || state.targetDiscord ? 'PENDING' : 'COMPLETED',
  } });
  await mergeIdentities(context, state);
  await mergeRights(context, state, plan, now);
  await mergePairs(context, state, 'HeartCounter');
  await mergePairs(context, state, 'Blacklist');
  const referralCapCarry = await endReferralRelationships(context, state);
  await mergeConversations(context, state);
  await mergeFarm(context, state);
  await mergeGenericOwners(context, state);
  await mergeProfile(context, state, plan);
  const [sourceFarm, targetFarm] = ownerPair(state, 'FarmProfile', 'discordUserId');
  if (sourceFarm && targetFarm) {
    if (await db(tx, 'FarmPlot').count({ where: { discordUserId: state.sourceKey } }) || await db(tx, 'FarmActionLog').count({ where: { discordUserId: state.sourceKey } })) fail('农场关联尚未完整处理');
    await deleteArchivedMigrationRow(context, 'FarmProfile', sourceFarm, 'MERGED_FARM');
  }
  const targetPatch: MigrationRow = { ...plan.totals, sessionVersion: { increment: 1 } };
  for (const field of ['withdrawAccount1', 'withdrawAccount2', 'withdrawAccount3', 'wechatDisplayName', 'wechatAvatarUrl']) targetPatch[field] = preferMigrationTarget(state.source[field], state.target[field]) ?? null;
  await updateMigrationRow(context, 'DlmUser', state.target, targetPatch);
  if (state.targetMember) await updateMigrationRow(context, 'Member', state.targetMember, {
    ...Object.fromEntries(['totalBalance', 'income', 'recharge', 'totalSpent'].map(field => [field, plan.totals[field]])),
    commissionRate: plan.commissionRate, baseCommissionRate: plan.base, status: plan.peiwan ? 'PEIWAN' : state.targetMember.status,
  });
  await recordOwnership(context, state, plan, now);
  if (state.sourceDetached) await deleteArchivedMigrationRow(context, 'DetachedDiscordAccount', state.sourceDetached, 'DETACHED_STORAGE_MERGED');
  await assertNoSourceReferences(tx, state);
  if (await db(tx, 'AccountBinding').count({ where: { dlmId: state.source.dlmId } }) || await db(tx, 'WechatProgramSession').count({ where: { dlmId: state.source.dlmId } })) fail('旧登录关联尚未完整处理');
  await archiveMigrationRow(context, 'DlmUser', state.source, 'RETIRED_ACCOUNT');
  // Source deletion invalidates its cookies; target version increment invalidates
  // its cookies. The detached Member is deleted only after all owner links moved.
  const sourceDeleted = await db(tx, 'DlmUser').deleteMany({ where: { dlmId: state.source.dlmId, sessionVersion: state.source.sessionVersion } });
  if (sourceDeleted.count !== 1) fail('旧账号状态已变化，迁移已回滚');
  if (state.sourceMember) await deleteArchivedMigrationRow(context, 'Member', state.sourceMember, 'RETIRED_MEMBER');
  const result: AccountMigrationResult = { requestId: input.requestId, completed: true, sourceDlmId: input.sourceDlmId,
    targetDlmId: input.targetDlmId, mergedWallet: Object.fromEntries(Object.entries(plan.totals).map(([field, value]) => [field, value.toString()])),
    peiwanId: number(plan.peiwan?.PEIWANID), changed: context.counts, skipped: context.skipped,
    rolesStatus: state.sourceDiscord || state.targetDiscord ? 'PENDING' : 'COMPLETED',
    warnings: ['资产与历史已合并，旧账号已删除；双方需重新登录。角色在后台单独续办，勿再次转移资金。'] };
  const saved = await db(tx, 'AccountMigration').findUnique({ where: { id: input.requestId } });
  await db(tx, 'AccountMigration').updateMany({ where: { id: input.requestId }, data: {
    result: migrationJson(result), snapshot: migrationJson({ ...(saved!.snapshot as MigrationRow), referralCapCarry }),
  } });
  return result;
}

export type AccountMigrationResult = {
  requestId: string; completed: true; sourceDlmId: string; targetDlmId: string; mergedWallet: Record<string, string>;
  peiwanId: number | null; changed: Record<string, number>;
  skipped: Array<{ model: string; recordKey: string; reason: string }>; rolesStatus: string; warnings: string[];
};
export const runAccountMigration = (client: PrismaClient, input: AccountMigrationExecuteInput) =>
  client.$transaction(tx => executeAccountMigrationTx(tx, input), { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 60000 });

export { emptyRoles as emptyAccountMigrationRoleSnapshot };
