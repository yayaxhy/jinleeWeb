import { Prisma } from '@prisma/client';
import type { SessionSnapshot } from '../types/session';
import type { GiftExecutionIntent, GiftRecoveryRecord } from './gift-execution-client';
import { giftExecutionIntentHash, parseGiftExecutionIntent, stableGiftExecutionJson } from './gift-execution-review';
import { normalizeTargetConfirmationScope, type TargetConfirmationEvidence } from './target-confirmation';
import { GIFT_NAME_BY_PRIZE_NAME } from './voucherCatalog';
import { giftHistoryActorMatches, giftHistoryOriginalOwners } from './gift-history-ownership';

export type RecoveryKind = GiftRecoveryRecord['kind'];
export class GiftRecoveryConflict extends Error {
  constructor(message = '赠礼登记与当前账号或赠礼内容不符，请查询原编号。', public status = 409) { super(message); }
}
export const isWebGiftRequestId = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
export const isRecoveryKind = (value: unknown): value is RecoveryKind => value === 'VOUCHER_GIFT' || value === 'DELEGATED_GIFT';
export type GiftRecoveryDb = Pick<Prisma.TransactionClient, 'giftExecutionRequest' | 'dlmUser' | 'dlmAdminOperation' | '$queryRaw' | 'accountOwnership'>;
const select = { requestId: true, kind: true, intent: true, intentHash: true, createdAt: true,
  recoveryOwnerDlmId: true, recoveryOwnerDiscordId: true, recoverySnapshot: true } satisfies Prisma.GiftExecutionRequestSelect;
type Row = Prisma.GiftExecutionRequestGetPayload<{ select: typeof select }>;
const json = (value: unknown) => value as Prisma.InputJsonValue;
const object = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new GiftRecoveryConflict();
  return value as Record<string, unknown>;
};
const display = (value: unknown): string => {
  if (typeof value !== 'string' || !value.trim() || value.length > 256 || /[\u0000-\u001f\u007f]/.test(value)) throw new GiftRecoveryConflict();
  return value;
};

/** Registration records an immutable signed intention only. Business POST still
 * rechecks current vouchers/bindings before forwarding any financial work. */
export function buildGiftRecoveryPreparation(proof: TargetConfirmationEvidence, kind: RecoveryKind, payerDisplayName: string) {
  const delegated = kind === 'DELEGATED_GIFT';
  if (proof.scope.purpose !== (delegated ? 'delegated-gift' : 'gift') || !proof.caller.discordUserId) throw new GiftRecoveryConflict();
  const payer = delegated ? proof.payer : proof.caller;
  const voucher = proof.selectedVoucher;
  if (!payer || (!delegated && !voucher) || (delegated && voucher)) throw new GiftRecoveryConflict();
  const intent = parseGiftExecutionIntent({ version: 1, kind, payerDlmId: payer.dlmId, payerDiscordId: payer.discordUserId,
    receiverDlmId: proof.target.dlmId, receiverDiscordId: proof.target.discordUserId, receiverPeiwanId: proof.target.peiwanId ?? null,
    operatorDiscordId: delegated ? proof.caller.discordUserId : null,
    giftName: delegated ? proof.scope.giftName : GIFT_NAME_BY_PRIZE_NAME[voucher!.prizeName] ?? voucher!.prizeName.replace(/代金券$/, ''),
    quantity: delegated ? new Prisma.Decimal(proof.scope.quantity!).toFixed() : '1', anonymous: false, feedAnonymous: delegated,
    source: delegated ? 'delegate' : 'regular', transactionLabel: delegated ? '客服代打赏' : null, expenseReason: null,
    notifyGiverPointsDm: !delegated, lotteryVoucherId: voucher?.source === 'lottery' ? voucher.voucherId : null,
    couponVoucherId: voucher && voucher.source !== 'lottery' ? voucher.voucherId : null });
  return { intent, snapshot: { target: { displayName: display(proof.target.displayName), dlmId: intent.receiverDlmId!,
    discordUserId: intent.receiverDiscordId, peiwanId: intent.receiverPeiwanId },
    payerDisplayName: display(proof.payer?.displayName ?? payerDisplayName), scope: normalizeTargetConfirmationScope(proof.scope) } };
}
export type GiftRecoveryPreparation = ReturnType<typeof buildGiftRecoveryPreparation>;

async function requireSession(db: GiftRecoveryDb, session: SessionSnapshot) {
  if (!session.dlmId || !session.discordId) throw new GiftRecoveryConflict('请重新登录后查询赠礼。', 401);
  const current = await db.dlmUser.findUnique({ where: { dlmId: session.dlmId }, select: {
    discordUserId: true, sessionVersion: true, member: { select: { discordUserId: true } },
  } });
  if (!current || current.sessionVersion !== (session.sessionVersion ?? 1) || current.discordUserId !== session.discordId ||
    current.member?.discordUserId !== session.discordId) throw new GiftRecoveryConflict('登录状态已变化，请重新登录。', 401);
  return { dlmId: session.dlmId, discordId: session.discordId };
}
function requireIntentOwner(intent: GiftExecutionIntent, session: SessionSnapshot) {
  if (intent.kind === 'VOUCHER_GIFT' ? intent.payerDlmId !== session.dlmId || intent.payerDiscordId !== session.discordId
    : intent.kind !== 'DELEGATED_GIFT' || intent.operatorDiscordId !== session.discordId) throw new GiftRecoveryConflict();
}
function record(row: Row, session: SessionSnapshot): GiftRecoveryRecord {
  if (row.recoveryOwnerDlmId !== session.dlmId || row.recoveryOwnerDiscordId !== session.discordId || !isRecoveryKind(row.kind) ||
    !isWebGiftRequestId(row.requestId)) throw new GiftRecoveryConflict();
  const intent = parseGiftExecutionIntent(row.intent);
  requireIntentOwner(intent, session);
  if (intent.kind !== row.kind || row.intentHash !== giftExecutionIntentHash(intent) || stableGiftExecutionJson(intent) !== stableGiftExecutionJson(row.intent)) throw new GiftRecoveryConflict();
  const snapshot = object(row.recoverySnapshot); const target = object(snapshot.target);
  const scope = normalizeTargetConfirmationScope(snapshot.scope);
  if (Object.keys(snapshot).sort().join(',') !== 'payerDisplayName,scope,target' || Object.keys(target).sort().join(',') !== 'discordUserId,displayName,dlmId,peiwanId' ||
    target.dlmId !== intent.receiverDlmId || target.discordUserId !== intent.receiverDiscordId || target.peiwanId !== intent.receiverPeiwanId ||
    scope.purpose !== (row.kind === 'DELEGATED_GIFT' ? 'delegated-gift' : 'gift')) throw new GiftRecoveryConflict();
  return { version: 1, actor: { dlmId: row.recoveryOwnerDlmId!, discordId: row.recoveryOwnerDiscordId }, requestId: row.requestId, kind: row.kind,
    createdAt: row.createdAt.toISOString(), phase: 'UNCONFIRMED', intent,
    target: { displayName: display(target.displayName), dlmId: intent.receiverDlmId!, discordUserId: intent.receiverDiscordId, peiwanId: intent.receiverPeiwanId },
    payerDisplayName: display(snapshot.payerDisplayName), scope: {
      purpose: scope.purpose, target: scope.target,
      ...(scope.prizeName !== null ? { prizeName: scope.prizeName } : {}),
      ...(scope.couponId !== null ? { couponId: scope.couponId } : {}),
      ...(scope.lotteryId !== null ? { lotteryId: scope.lotteryId } : {}),
      ...(scope.payerDlmId !== null ? { payerDlmId: scope.payerDlmId } : {}),
      ...(scope.giftName !== null ? { giftName: scope.giftName } : {}),
      ...(scope.quantity !== null ? { quantity: scope.quantity } : {}),
    } };
}
/** Caller must wrap this in a SERIALIZABLE transaction. Metadata and original
 * Bot-compatible registration are inserted together; an existing row is never claimed. */
export async function registerGiftRecovery(db: GiftRecoveryDb, session: SessionSnapshot, requestId: string, prepared: GiftRecoveryPreparation) {
  const owner = await requireSession(db, session);
  if (!isWebGiftRequestId(requestId)) throw new GiftRecoveryConflict('赠礼编号无效。', 400);
  requestId = requestId.toLowerCase();
  const intent = parseGiftExecutionIntent(prepared.intent); requireIntentOwner(intent, session);
  const existing = await db.giftExecutionRequest.findUnique({ where: { requestId }, select: { requestId: true } });
  if (!existing && await db.dlmAdminOperation.findUnique({ where: { requestId }, select: { id: true } })) throw new GiftRecoveryConflict();
  const inserted = await db.giftExecutionRequest.createMany({ data: { requestId, kind: intent.kind, intent: json(intent), intentHash: giftExecutionIntentHash(intent),
    status: 'PENDING', recoveryOwnerDlmId: owner.dlmId, recoveryOwnerDiscordId: owner.discordId, recoverySnapshot: json(prepared.snapshot) }, skipDuplicates: true });
  await db.$queryRaw`SELECT "requestId" FROM "GiftExecutionRequest" WHERE "requestId" = ${requestId} FOR UPDATE`;
  const row = await db.giftExecutionRequest.findUnique({ where: { requestId }, select });
  if (!row) throw new GiftRecoveryConflict();
  const saved = record(row, session);
  if (stableGiftExecutionJson(saved.intent) !== stableGiftExecutionJson(intent) ||
    stableGiftExecutionJson(normalizeTargetConfirmationScope(saved.scope)) !== stableGiftExecutionJson(normalizeTargetConfirmationScope(prepared.snapshot.scope))) throw new GiftRecoveryConflict();
  return { record: saved, created: inserted.count === 1 };
}
/** Required before forwarding Web financial POST; Discord Bot requests retain
 * their existing registration protocol and need no Web ownership metadata. */
export async function assertPreparedGiftRecovery(db: GiftRecoveryDb, session: SessionSnapshot, requestId: unknown, intent: GiftExecutionIntent) {
  await requireSession(db, session);
  if (!isWebGiftRequestId(requestId)) throw new GiftRecoveryConflict();
  const row = await db.giftExecutionRequest.findUnique({ where: { requestId: requestId.toLowerCase() }, select });
  if (!row || stableGiftExecutionJson(record(row, session).intent) !== stableGiftExecutionJson(parseGiftExecutionIntent(intent))) throw new GiftRecoveryConflict();
}
const PAGE_SIZE = 20;
function decodeCursor(cursor: string | null) {
  if (!cursor) return null;
  try {
    if (cursor.length > 400) throw new Error();
    const value = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    if (!Array.isArray(value) || value.length !== 2 || typeof value[0] !== 'string' || new Date(value[0]).toISOString() !== value[0] || !isWebGiftRequestId(value[1])) throw new Error();
    return { createdAt: new Date(value[0]), requestId: value[1].toLowerCase() };
  } catch { throw new GiftRecoveryConflict('列表分页参数无效。', 400); }
}
/** Original registration and execution remain strict. Approved migration owners
 * receive a read-only copy whose original actor/intent are never rewritten. */
export async function loadGiftRecoveryList(db: GiftRecoveryDb, session: SessionSnapshot, kind: RecoveryKind, cursor: string | null, now = new Date()) {
  const owner = await requireSession(db, session); const after = decodeCursor(cursor);
  const owners = await giftHistoryOriginalOwners(db, owner.dlmId);
  const rows = await db.giftExecutionRequest.findMany({ where: { recoveryOwnerDlmId: { in: owners }, kind,
    AND: [{ OR: [{ status: { notIn: ['COMPLETED', 'ABANDONED'] } }, { updatedAt: { gte: new Date(now.getTime() - 30 * 86400000) } }] },
      ...(after ? [{ OR: [{ createdAt: { lt: after.createdAt } }, { createdAt: after.createdAt, requestId: { lt: after.requestId } }] }] : [])] },
    orderBy: [{ createdAt: 'desc' }, { requestId: 'desc' }], take: PAGE_SIZE + 1, select });
  const page = rows.slice(0, PAGE_SIZE); const last = page.at(-1);
  const records = await Promise.all(page.map(async row => {
    const originalActor = { dlmId: row.recoveryOwnerDlmId, discordId: row.recoveryOwnerDiscordId };
    if (!originalActor.dlmId || !await giftHistoryActorMatches(db, originalActor, owner)) throw new GiftRecoveryConflict();
    const original = record(row, { ...session, dlmId: originalActor.dlmId, discordId: originalActor.discordId });
    if (originalActor.dlmId === owner.dlmId && originalActor.discordId === owner.discordId) return original;
    return { ...original, actor: owner, inherited: true as const, originalActor: { ...originalActor, dlmId: originalActor.dlmId } };
  }));
  return { records, nextCursor: rows.length > PAGE_SIZE && last
    ? Buffer.from(JSON.stringify([last.createdAt.toISOString(), last.requestId])).toString('base64url') : null };
}
