import { createHash } from 'node:crypto';

export class AuditionLegacyError extends Error {
  constructor(public code: string, message: string, public status = 409) { super(message); }
}
export type AuditionLegacyCommand = {
  requestId: string; inviteId: string; bossDlmId: string; workerDlmId: string;
  bossDiscordIdSnapshot: string; workerDiscordIdSnapshot: string; peiwanId: number; quotedGross: string;
  evidenceReference: string; evidenceNote: string; confirmedUnpaidAndNotJoined: true;
};
export const legacyMetadataFields = ['bossDlmId', 'workerDlmId', 'bossDiscordIdSnapshot', 'workerDiscordIdSnapshot', 'peiwanId', 'quotedGross'] as const;
export type LegacyMetadataField = typeof legacyMetadataFields[number];
export type AuditionLegacyInvite = {
  id: string; orderRequestId: string; bossId: string; workerId: string; roomChannelId: string; roomGuildId: string;
  bossDlmId: string | null; workerDlmId: string | null; bossDiscordIdSnapshot: string | null; workerDiscordIdSnapshot: string | null;
  peiwanId: number | null; quotedGross: string | null; status: string; failureReason: string | null;
  transactionId: string | null; grossAmount: string | null; feeAmount: string | null; netAmount: string | null;
  createdAt: string; updatedAt: string; expiresAt: string; acceptedAt: string | null; joinedAt: string | null;
  chargedAt: string | null; fulfilledAt: string | null; declinedAt: string | null; canceledAt: string | null;
};
export type AuditionLegacyEvidence = {
  invite: AuditionLegacyInvite;
  request: { orderId: string; ownerId: string; createdAt: string } | null;
  ledgers: Array<{ transactionId: string; type: string; createdAt: string; amount: string }>;
  audits: Array<{ id: string; paymentTransactionId: string; createdAt: string }>;
  payments: Array<{ transactionId: string; createdAt: string }>;
};
export type AuditionLegacyState = AuditionLegacyEvidence & {
  accounts: Array<{ dlmId: string; discordUserId: string | null }>;
  members: string[]; bindings: Array<{ dlmId: string; providerUserId: string }>;
  profile: { PEIWANID: number; discordUserId: string } | null;
  ownership: Array<{ identityKind: string; identityKey: string; originalDlmId: string; retiredAt: string }>;
};
export type AuditionLegacyReceipt = {
  requestId: string; inviteId: string; actorDiscordId: string; actorDlmId: string | null;
  inputHash: string; previewHash: string; beforeSnapshot: AuditionLegacyState; afterSnapshot: AuditionLegacyInvite;
  evidenceReference: string; evidenceNote: string; createdAt: string;
};
export interface AuditionLegacyStore {
  lockRequest(requestId: string): Promise<void>;
  lockParticipantsAndInvite(command: AuditionLegacyCommand): Promise<void>;
  receipt(requestId: string): Promise<AuditionLegacyReceipt | null>;
  receiptForInvite(inviteId: string): Promise<AuditionLegacyReceipt | null>;
  load(command: AuditionLegacyCommand): Promise<AuditionLegacyState | null>;
  fill(before: AuditionLegacyInvite, changes: Partial<Record<LegacyMetadataField, string | number>>): Promise<boolean>;
  save(receipt: AuditionLegacyReceipt): Promise<void>;
}
export type AuditionLegacyDatabase = { transaction<T>(body: (store: AuditionLegacyStore) => Promise<T>): Promise<T> };
const fail = (code: string, message: string, status = 409): never => { throw new AuditionLegacyError(code, message, status); };
const id = (v: unknown): v is string => typeof v === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(v);
const discord = (v: unknown): v is string => typeof v === 'string' && /^[0-9]{17,20}$/.test(v);
export const validLegacyRequestId = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
export function parseAuditionLegacyCommand(raw: unknown): AuditionLegacyCommand {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return fail('invalid_input', '请填写原邀请身份、报价及证据', 400);
  const r = raw as Record<string, unknown>;
  const keys = ['requestId', 'inviteId', ...legacyMetadataFields, 'evidenceReference', 'evidenceNote', 'confirmedUnpaidAndNotJoined'];
  if (Object.keys(r).some(k => !keys.includes(k)) || !validLegacyRequestId(r.requestId) || !id(r.inviteId) || !id(r.bossDlmId) || !id(r.workerDlmId) ||
    !discord(r.bossDiscordIdSnapshot) || !discord(r.workerDiscordIdSnapshot) || r.bossDlmId === r.workerDlmId || r.bossDiscordIdSnapshot === r.workerDiscordIdSnapshot ||
    !Number.isSafeInteger(r.peiwanId) || Number(r.peiwanId) < 1 || Number(r.peiwanId) > 2147483647 ||
    typeof r.quotedGross !== 'string' || !/^(0|[1-9]\d{0,14})(\.\d{1,2})?$/.test(r.quotedGross) ||
    typeof r.evidenceReference !== 'string' || r.evidenceReference.trim().length === 0 || r.evidenceReference.length > 500 ||
    typeof r.evidenceNote !== 'string' || r.evidenceNote.trim().length === 0 || r.evidenceNote.length > 2000 || r.confirmedUnpaidAndNotJoined !== true) {
    return fail('invalid_input', '请填写有效的原身份、原报价、凭据引用与核实说明，并确认未入房及未扣费；报价最多两位小数', 400);
  }
  const parts = r.quotedGross.split('.');
  return { ...r, requestId: r.requestId.toLowerCase(), quotedGross: `${parts[0]}.${(parts[1] ?? '').padEnd(2, '0')}`,
    evidenceReference: r.evidenceReference.trim(), evidenceNote: r.evidenceNote.trim() } as AuditionLegacyCommand;
}
function stable(value: unknown): string {
  const sort = (v: unknown): unknown => Array.isArray(v) ? v.map(sort) : v && typeof v === 'object'
    ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)).map(([k, val]) => [k, sort(val)])) : v;
  return JSON.stringify(sort(value));
}
const hash = (value: unknown) => createHash('sha256').update(stable(value)).digest('hex');
const amountEqual = (a: string, b: string) => {
  const canonical = (v: string) => { const [whole, part = ''] = v.split('.'); return `${whole}.${part.replace(/0+$/, '')}`; };
  return canonical(a) === canonical(b);
};
export function auditionLegacyBlockers(evidence: AuditionLegacyEvidence, now: Date): string[] {
  const r = evidence.invite, reasons: string[] = [];
  if (!['PENDING', 'ACCEPTED'].includes(r.status)) reasons.push('邀请已经不处于待接受或已接受状态');
  if (!Number.isFinite(Date.parse(r.expiresAt)) || Date.parse(r.expiresAt) <= now.getTime()) reasons.push('邀请已到期；补齐不会延长有效期');
  if ([r.transactionId, r.grossAmount, r.feeAmount, r.netAmount, r.joinedAt, r.chargedAt, r.fulfilledAt, r.declinedAt, r.canceledAt].some(v => v !== null)) reasons.push('已有入房、结算或终止迹象，请先核实原账，不能重新标成未付');
  if (r.failureReason) reasons.push('邀请留有异常说明，处理结果需先核实');
  if (r.status === 'PENDING' && r.acceptedAt !== null) reasons.push('待接受状态与接受时间不一致');
  if (r.status === 'ACCEPTED' && r.acceptedAt === null) reasons.push('已接受状态缺少原接受时间，本工具不能补造时间');
  if (evidence.ledgers.length || evidence.audits.length || evidence.payments.length) reasons.push('查到关联或同时间段双方的试音账务候选，请先逐笔查账');
  if (legacyMetadataFields.every(k => r[k] !== null)) reasons.push('原快照已完整，无需补齐，也不能覆盖');
  return reasons;
}
function buildPlan(state: AuditionLegacyState, command: AuditionLegacyCommand, actorDiscordId: string, now: Date) {
  const reasons = auditionLegacyBlockers(state, now);
  if (reasons.length) fail('requires_review', reasons.join('；'));
  const r = state.invite;
  if (r.id !== command.inviteId || r.bossId !== command.bossDiscordIdSnapshot || r.workerId !== command.workerDiscordIdSnapshot ||
    (state.request && (state.request.orderId !== r.orderRequestId || state.request.ownerId !== command.bossDiscordIdSnapshot))) fail('identity_conflict', '填写的原身份与现存邀请或派单记录冲突；不能从当前绑定猜测原身份');
  for (const [dlmId, dc] of [[command.bossDlmId, command.bossDiscordIdSnapshot], [command.workerDlmId, command.workerDiscordIdSnapshot]]) {
    if (state.accounts.filter(a => a.dlmId === dlmId && a.discordUserId === dc).length !== 1 || !state.members.includes(dc) ||
      state.bindings.some(b => (b.dlmId === dlmId || b.providerUserId === dc) && (b.dlmId !== dlmId || b.providerUserId !== dc))) {
      fail('identity_conflict', '原账户身份与现存账户或绑定冲突，请先逐笔核实');
    }
  }
  if (state.ownership.length) fail('identity_conflict', '原身份涉及邀请创建后的换号或迁移，请先核实历史归属；本工具不自动推断');
  if (state.profile?.PEIWANID !== command.peiwanId || state.profile.discordUserId !== command.workerDiscordIdSnapshot) fail('identity_conflict', '原陪玩编号与现存档案冲突');
  const changes: Partial<Record<LegacyMetadataField, string | number>> = {};
  for (const field of legacyMetadataFields) {
    if (r[field] === null) changes[field] = command[field];
    else if (field === 'quotedGross' ? !amountEqual(r.quotedGross!, command.quotedGross) : r[field] !== command[field]) fail('snapshot_conflict', '已保存的原快照不能覆盖，请按原记录核实');
  }
  return { previewHash: hash({ state, command, actorDiscordId }), changes, before: r, after: { ...r, ...changes } as AuditionLegacyInvite,
    evidence: state, scope: '仅补齐缺失身份与原报价；不修改状态、有效期、接受时间或任何账目，不触发消息和入房操作。' };
}
export function createAuditionLegacyService(db: AuditionLegacyDatabase, clock = () => new Date()) {
  const actor = (value: string) => { if (!discord(value)) fail('forbidden', '管理员身份无效', 403); };
  return {
    async query(actorDiscordId: string, requestId: string) {
      actor(actorDiscordId); if (!validLegacyRequestId(requestId)) fail('invalid_request', '请求编号格式无效', 400);
      return db.transaction(store => store.receipt(requestId.toLowerCase()));
    },
    async preview(actorDiscordId: string, raw: unknown) {
      actor(actorDiscordId); const command = parseAuditionLegacyCommand(raw);
      return db.transaction(async store => {
        if (await store.receiptForInvite(command.inviteId)) fail('already_repaired', '此邀请已有补齐回执，请查询原请求');
        const state = await store.load(command); if (!state) return fail('missing', '未找到原邀请', 404);
        return buildPlan(state, command, actorDiscordId, clock());
      });
    },
    async execute(actorDiscordId: string, actorDlmId: string | null, raw: unknown, previewHash: string, confirmed: boolean) {
      actor(actorDiscordId); const command = parseAuditionLegacyCommand(raw);
      if (!confirmed || !/^[0-9a-f]{64}$/.test(previewHash)) fail('confirmation_required', '请先查看预览并明确确认补齐', 400);
      return db.transaction(async store => {
        await store.lockRequest(command.requestId);
        const inputHash = hash({ command, actorDiscordId });
        const existing = await store.receipt(command.requestId);
        if (existing) {
          if (existing.inputHash !== inputHash || existing.actorDiscordId !== actorDiscordId || existing.previewHash !== previewHash) fail('request_conflict', '请求编号已用于其他资料，不可复用');
          return existing;
        }
        // Match the Bot's DLM → Member → PEIWAN → invitation lock order.
        await store.lockParticipantsAndInvite(command);
        if (await store.receiptForInvite(command.inviteId)) fail('already_repaired', '此邀请已由其他请求补齐，请查询原回执');
        const state = await store.load(command); if (!state) return fail('missing', '未找到原邀请', 404);
        const plan = buildPlan(state, command, actorDiscordId, clock());
        if (plan.previewHash !== previewHash) fail('preview_changed', '邀请或身份凭据已变化，请重新查看预览');
        if (!await store.fill(state.invite, plan.changes)) fail('concurrent_change', '邀请状态已变化，本次未补齐');
        const after = await store.load(command);
        if (!after || !amountEqual(after.invite.quotedGross ?? '', plan.after.quotedGross ?? '') || stable({ ...after.invite, quotedGross: plan.after.quotedGross, updatedAt: state.invite.updatedAt }) !== stable(plan.after)) return fail('write_mismatch', '补齐结果与预览不符，本次回滚');
        const receipt: AuditionLegacyReceipt = { requestId: command.requestId, inviteId: command.inviteId, actorDiscordId, actorDlmId,
          inputHash, previewHash, beforeSnapshot: state, afterSnapshot: after.invite, evidenceReference: command.evidenceReference,
          evidenceNote: command.evidenceNote, createdAt: clock().toISOString() };
        await store.save(receipt);
        return receipt;
      });
    },
  };
}
