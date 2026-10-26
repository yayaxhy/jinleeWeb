import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';
import type { SessionSnapshot } from '../types/session';
import type { GiftExecutionIntent, GiftExecutionReview } from './gift-execution-client';
import { giftHistoryActorMatches, giftHistoryDlmMatches, giftHistoryPaymentOwnerMatches } from './gift-history-ownership';

export const validGiftExecutionLookupId = (value: unknown): value is string => typeof value === 'string' &&
  (/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value) || /^discord:gift:\d{17,20}:\d{17,20}$/.test(value));
export const normalizeGiftExecutionId = (value: string) => value.startsWith('discord:gift:') ? value : value.toLowerCase();
export function stableGiftExecutionJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableGiftExecutionJson).join(',')}]`;
  return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableGiftExecutionJson((value as Record<string, unknown>)[key])}`).join(',')}}`;
}
const object = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('requires_review');
  return value as Record<string, unknown>;
};
function text(value: unknown, max = 120): string {
  if (typeof value !== 'string' || !value || value.length > max || value.trim() !== value || /[\u0000-\u001f\u007f]/.test(value)) throw new Error('requires_review');
  return value;
}
const nullable = (value: unknown, max = 120) => value === null ? null : text(value, max);
const discord = (value: unknown) => { const result = text(value, 20); if (!/^\d{17,20}$/.test(result)) throw new Error('requires_review'); return result; };
const bool = (value: unknown) => { if (typeof value !== 'boolean') throw new Error('requires_review'); return value; };
function amount(value: unknown, positive = false) {
  if (typeof value !== 'string' || value.length > 512 || !/^\d+(?:\.\d+)?$/.test(value)) throw new Error('requires_review');
  const result = new Prisma.Decimal(value);
  if (!result.isFinite() || result.lt(0) || (positive && result.isZero()) || result.decimalPlaces() > 400 || result.gte('1000000000000000')) throw new Error('requires_review');
  return result.toFixed();
}
const fields = ['version', 'kind', 'payerDlmId', 'payerDiscordId', 'receiverDlmId', 'receiverDiscordId', 'receiverPeiwanId', 'operatorDiscordId',
  'giftName', 'quantity', 'anonymous', 'feedAnonymous', 'source', 'transactionLabel', 'expenseReason', 'notifyGiverPointsDm', 'lotteryVoucherId', 'couponVoucherId'];
/** Mirrors the Bot v1 immutable protocol; this function never resolves an identity. */
export function parseGiftExecutionIntent(raw: unknown): GiftExecutionIntent {
  const row = object(raw);
  if (Object.keys(row).length !== fields.length || fields.some(key => !(key in row)) || row.version !== 1 ||
    !['VOUCHER_GIFT', 'DELEGATED_GIFT', 'DISCORD_GIFT'].includes(String(row.kind)) || !['regular', 'service', 'delegate'].includes(String(row.source))) throw new Error('requires_review');
  const profile = row.receiverPeiwanId;
  if (profile !== null && (typeof profile !== 'number' || !Number.isSafeInteger(profile) || profile < 1 || profile > 2147483647)) throw new Error('requires_review');
  const intent: GiftExecutionIntent = { version: 1, kind: row.kind as GiftExecutionIntent['kind'], payerDlmId: nullable(row.payerDlmId),
    payerDiscordId: row.payerDiscordId === null ? null : discord(row.payerDiscordId), receiverDlmId: nullable(row.receiverDlmId), receiverDiscordId: discord(row.receiverDiscordId),
    receiverPeiwanId: profile as number | null, operatorDiscordId: row.operatorDiscordId === null ? null : discord(row.operatorDiscordId),
    giftName: typeof row.giftName === 'string' ? text(row.giftName.normalize('NFKC').trim(), 200) : text(row.giftName, 200), quantity: amount(row.quantity, true),
    anonymous: bool(row.anonymous), feedAnonymous: bool(row.feedAnonymous), source: row.source as GiftExecutionIntent['source'],
    transactionLabel: nullable(row.transactionLabel, 100), expenseReason: nullable(row.expenseReason, 500), notifyGiverPointsDm: bool(row.notifyGiverPointsDm),
    lotteryVoucherId: nullable(row.lotteryVoucherId), couponVoucherId: nullable(row.couponVoucherId) };
  if ((intent.kind !== 'DISCORD_GIFT' && (!intent.payerDlmId || !intent.receiverDlmId)) ||
    (intent.kind !== 'DELEGATED_GIFT' && !intent.payerDiscordId) ||
    (intent.kind === 'DELEGATED_GIFT' && (!intent.operatorDiscordId || !intent.receiverPeiwanId || intent.source !== 'delegate')) ||
    (intent.kind === 'DISCORD_GIFT' && !intent.operatorDiscordId) || intent.payerDiscordId === intent.receiverDiscordId ||
    (intent.payerDlmId !== null && intent.payerDlmId === intent.receiverDlmId) ||
    (intent.kind === 'VOUCHER_GIFT' ? Number(intent.lotteryVoucherId !== null) + Number(intent.couponVoucherId !== null) !== 1
      : intent.lotteryVoucherId !== null || intent.couponVoucherId !== null)) throw new Error('requires_review');
  return intent;
}
export const giftExecutionIntentHash = (intent: GiftExecutionIntent) => createHash('sha256').update('gift-execution-intent:v1\n').update(stableGiftExecutionJson(parseGiftExecutionIntent(intent))).digest('hex');
export type GiftExecutionReadDb = Pick<Prisma.TransactionClient, 'giftExecutionRequest' | 'giftAudit' | 'individualTransaction' | 'transaction' | 'dlmAdminOperation' | 'revert' | 'dlmUser' | 'accountOwnership' | 'detachedDiscordAccount'>;
const auditSelect = {
  id: true, auditVersion: true, giverDlmId: true, giverDiscordId: true, receiverDlmId: true, giverId: true, receiverId: true, receiverPeiwanId: true,
  paymentTransactionId: true, individualTransactionId: true, orderId: true, giftName: true, quantity: true, unitPrice: true, gross: true, payable: true,
  pointsEarned: true, receiverRate: true, feeAmount: true, netAmount: true, heartGain: true, voucherConsumption: true, voucherIds: true, couponIds: true,
} satisfies Prisma.GiftAuditSelect;
const resultFields = ['txId', 'giftName', 'quantity', 'unitPrice', 'gross', 'payable', 'pointsEarned', 'receiverRate', 'feeAmount', 'netAmount', 'heartGain'];
function resultSnapshot(raw: unknown) {
  const input = object(raw);
  if (resultFields.some(key => !(key in input)) || Object.keys(input).some(key => ![...resultFields, 'imageUrl', 'giverLoyaltyLines'].includes(key))) throw new Error('requires_review');
  const result: Record<string, unknown> = { txId: text(input.txId), giftName: text(input.giftName, 200) };
  for (const key of resultFields.slice(2)) result[key] = amount(input[key], key === 'quantity' || key === 'gross');
  if ('imageUrl' in input) result.imageUrl = text(input.imageUrl, 2048);
  if ('giverLoyaltyLines' in input) {
    if (!Array.isArray(input.giverLoyaltyLines) || input.giverLoyaltyLines.length > 20) throw new Error('requires_review');
    result.giverLoyaltyLines = input.giverLoyaltyLines.map(value => text(value, 500));
  }
  if (stableGiftExecutionJson(result) !== stableGiftExecutionJson(raw)) throw new Error('requires_review');
  return result as Record<(typeof resultFields)[number], string> & { imageUrl?: string; giverLoyaltyLines?: string[] };
}

async function validSession(db: GiftExecutionReadDb, session: SessionSnapshot) {
  if (!session.dlmId) return false;
  const current = await db.dlmUser.findUnique({ where: { dlmId: session.dlmId }, select: {
    discordUserId: true, sessionVersion: true, member: { select: { discordUserId: true } },
  } });
  return !!current && current.sessionVersion === (session.sessionVersion ?? 1) && current.discordUserId === (session.discordId ?? null) &&
    (current.discordUserId === null || current.member?.discordUserId === current.discordUserId);
}
/** Staff recovery is limited to requests they actually registered or operated.
 * A browser-supplied intent never establishes delegated ownership. */
async function ownsDelegatedRequest(db: GiftExecutionReadDb, session: SessionSnapshot,
  row: { kind: string; intent: Prisma.JsonValue; intentHash: string; recoveryOwnerDlmId: string | null; recoveryOwnerDiscordId: string | null },
  intent: GiftExecutionIntent, canReviewOwnDelegated: boolean) {
  if (!canReviewOwnDelegated || !session.dlmId || !session.discordId || row.kind !== 'DELEGATED_GIFT' ||
      intent.kind !== 'DELEGATED_GIFT' || !intent.operatorDiscordId || row.intentHash !== giftExecutionIntentHash(intent) ||
      stableGiftExecutionJson(row.intent) !== stableGiftExecutionJson(intent)) return false;
  if (row.recoveryOwnerDlmId != null || row.recoveryOwnerDiscordId != null) {
    if (!row.recoveryOwnerDlmId || row.recoveryOwnerDiscordId !== intent.operatorDiscordId) return false;
    return giftHistoryActorMatches(db,
      { dlmId: row.recoveryOwnerDlmId, discordId: row.recoveryOwnerDiscordId },
      { dlmId: session.dlmId, discordId: session.discordId });
  }
  // Legacy Bot registrations predate recovery owners but retain their original
  // operator in the server's immutable intent. Require the same current staff ID.
  return intent.operatorDiscordId === session.discordId;
}
type Audit = Prisma.GiftAuditGetPayload<{ select: typeof auditSelect }>;
/** Same immutable voucher lifecycle evidence as the Bot writer/reader, without
 * reading current voucher rows that may already have been restored or reused. */
function verifyVouchers(audit: Audit, intent: GiftExecutionIntent) {
  const ids = (value: unknown): string[] => {
    if (value == null) return [];
    if (!Array.isArray(value)) throw new Error('requires_review');
    const result = value.map(item => text(item, 300));
    if (new Set(result).size !== result.length) throw new Error('requires_review');
    return result;
  };
  const same = (a: string[], b: string[]) => a.length === b.length && [...a].sort().every((value, index) => value === [...b].sort()[index]);
  const voucherIds = ids(audit.voucherIds); const couponIds = ids(audit.couponIds);
  if (audit.voucherConsumption === null) {
    if (voucherIds.length || couponIds.length || !audit.gross.eq(audit.payable) || intent.lotteryVoucherId || intent.couponVoucherId) throw new Error('requires_review');
    return;
  }
  const payload = object(audit.voucherConsumption);
  if (Object.keys(payload).length !== 2 || payload.version !== 1 || !Array.isArray(payload.vouchers)) throw new Error('requires_review');
  const keys = ['kind', 'voucherId', 'voucherType', 'itemSku', 'source', 'label', 'ownerDlmId', 'ownerDiscordId', 'targetDlmId',
    'targetDiscordId', 'issuedAt', 'expiresAt', 'consumedAt', 'amount', 'discountAmount', 'consumptionKey', 'requestId'];
  const iso = (value: unknown) => { const result = text(value, 300); if (!Number.isFinite(Date.parse(result)) || new Date(result).toISOString() !== result) throw new Error('requires_review'); return result; };
  const decimal = (value: unknown, precision: number) => {
    const result = new Prisma.Decimal(amount(value)); if (result.decimalPlaces() > precision) throw new Error('requires_review'); return result;
  };
  const facts = payload.vouchers.map(value => {
    const fact = object(value);
    if (Object.keys(fact).length !== keys.length || keys.some(key => !(key in fact)) || !['coupon', 'pointshop', 'lottery'].includes(String(fact.kind))) throw new Error('requires_review');
    for (const key of ['voucherId', 'source', 'label', 'ownerDlmId', 'targetDlmId', 'targetDiscordId', 'consumptionKey']) text(fact[key], 300);
    for (const key of ['voucherType', 'itemSku', 'ownerDiscordId', 'requestId']) nullable(fact[key], 300);
    const issued = iso(fact.issuedAt); const consumed = iso(fact.consumedAt); const expires = fact.expiresAt === null ? null : iso(fact.expiresAt);
    decimal(fact.amount, 4); const discount = decimal(fact.discountAmount, 10);
    // The owner Discord is the voucher row's historical field, which may differ
    // after a binding migration. The target is supplied by this fixed intent.
    if (fact.consumptionKey !== `GIFT:${audit.id}` || fact.ownerDlmId !== audit.giverDlmId || fact.targetDlmId !== audit.receiverDlmId ||
      fact.targetDiscordId !== intent.receiverDiscordId ||
      Date.parse(issued) > Date.parse(consumed) || (expires !== null && Date.parse(expires) <= Date.parse(consumed)) ||
      (fact.kind === 'coupon' && (!fact.voucherType || expires === null || fact.itemSku !== null || fact.requestId !== null)) ||
      (fact.kind === 'pointshop' && (!fact.itemSku || fact.source !== 'POINT_SHOP' || fact.requestId !== null)) ||
      (fact.kind === 'lottery' && (!fact.voucherType || fact.itemSku !== null || fact.source !== 'LOTTERY'))) throw new Error('requires_review');
    return { kind: String(fact.kind), id: String(fact.voucherId), discount };
  });
  const all = facts.map(fact => fact.id);
  if (new Set(all).size !== all.length || !same(all, [...new Set([...voucherIds, ...couponIds])]) ||
    !same(facts.filter(fact => fact.kind !== 'lottery').map(fact => fact.id), couponIds) ||
    !Prisma.Decimal.min(facts.reduce((sum, fact) => sum.add(fact.discount), new Prisma.Decimal(0)), audit.gross).eq(audit.gross.sub(audit.payable)) ||
    (intent.lotteryVoucherId && !facts.some(fact => fact.kind === 'lottery' && fact.id === intent.lotteryVoucherId)) ||
    (intent.couponVoucherId && !facts.some(fact => fact.kind !== 'lottery' && fact.id === intent.couponVoucherId))) throw new Error('requires_review');
}

/** SELECT-only reader. Approved ownership mapping grants historical read access;
 * it never changes the captured intent or authorizes another execution. */
export async function loadGiftExecutionReview(db: GiftExecutionReadDb, session: SessionSnapshot, isAdmin: boolean, requestId: string, canReviewOwnDelegated = false): Promise<GiftExecutionReview | null> {
  if (!validGiftExecutionLookupId(requestId) || !await validSession(db, session)) return null;
  requestId = normalizeGiftExecutionId(requestId);
  const row = await db.giftExecutionRequest.findUnique({ where: { requestId }, select: {
    requestId: true, kind: true, intent: true, intentHash: true, status: true, giftAuditId: true, result: true,
    recoveryOwnerDlmId: true, recoveryOwnerDiscordId: true,
  } });
  if (!row) return null;
  let intent: GiftExecutionIntent;
  try { intent = parseGiftExecutionIntent(row.intent); } catch { return null; }
  let authorizedAudit: Audit | null = null;
  if (!isAdmin && !await ownsDelegatedRequest(db, session, row, intent, canReviewOwnDelegated)) {
    if (!session.dlmId) return null;
    const current = { dlmId: session.dlmId, discordId: session.discordId ?? null };
    if (intent.payerDlmId !== null && !await giftHistoryActorMatches(db,
      { dlmId: intent.payerDlmId, discordId: intent.payerDiscordId }, current)) return null;
    // A Discord-only registration has no original DLM evidence until completion.
    // Reusing its Discord cannot grant the new DLM access to a pending request.
    if (intent.payerDlmId === null && row.status !== 'COMPLETED') return null;
    if (intent.payerDlmId === null) {
      // Establish ownership before exposing even incomplete request details.
      // A malformed result or hash must not bypass the original DLM evidence.
      if (!row.giftAuditId) return null;
      authorizedAudit = await db.giftAudit.findUnique({ where: { id: row.giftAuditId }, select: auditSelect });
      if (!authorizedAudit || authorizedAudit.auditVersion !== 2 || authorizedAudit.giverDiscordId !== intent.payerDiscordId ||
        !await giftHistoryActorMatches(db, { dlmId: authorizedAudit.giverDlmId, discordId: authorizedAudit.giverDiscordId }, current)) return null;
    }
  }
  const base: GiftExecutionReview = { requestId, status: 'REQUIRES_REVIEW', verified: false, intent, giftAuditId: row.giftAuditId,
    transactionId: null, individualTransactionId: null, giftName: intent.giftName, quantity: intent.quantity, gross: null, payable: null,
    reverted: false, reverts: [], message: '打赏结果仍需核实，请联系客服，勿重复打赏。' };
  try {
    const discordId = requestId.startsWith('discord:gift:');
    if (row.requestId !== requestId || row.kind !== intent.kind || row.intentHash !== giftExecutionIntentHash(intent) ||
      stableGiftExecutionJson(row.intent) !== stableGiftExecutionJson(intent) || discordId !== (intent.kind === 'DISCORD_GIFT') ||
      (discordId && requestId.split(':')[3] !== intent.receiverDiscordId)) return base;
    const operation = await db.dlmAdminOperation.findUnique({ where: { requestId }, select: {
      type: true, status: true, operatorDiscordId: true, dlmId: true, details: true, result: true,
    } });
    if (row.status === 'PENDING' || row.status === 'ABANDONED') {
      if (row.giftAuditId !== null || row.result !== null || operation) return base;
      return { ...base, giftAuditId: null, status: row.status, verified: row.status === 'ABANDONED',
        message: row.status === 'ABANDONED' ? '这笔打赏已取消。本次操作不退款；如需再次打赏，请重新确认。' : '打赏结果尚未确认，暂时无法确定是否已扣款。请查询进度或联系客服，勿重复打赏。' };
    }
    if (row.status !== 'COMPLETED' || !row.giftAuditId || row.result === null) return base;
    const result = resultSnapshot(row.result);
    const audit = authorizedAudit ?? await db.giftAudit.findUnique({ where: { id: row.giftAuditId }, select: auditSelect });
    if (!audit || audit.auditVersion !== 2 || !audit.giverDlmId || !audit.receiverDlmId || audit.giverDlmId === audit.receiverDlmId ||
      (intent.payerDlmId !== null && audit.giverDlmId !== intent.payerDlmId) || (intent.receiverDlmId !== null && audit.receiverDlmId !== intent.receiverDlmId) ||
      audit.giverDiscordId !== intent.payerDiscordId || audit.giverId !== (intent.payerDiscordId ?? intent.payerDlmId) ||
      audit.receiverId !== intent.receiverDiscordId || (intent.receiverPeiwanId !== null && audit.receiverPeiwanId !== intent.receiverPeiwanId) ||
      audit.paymentTransactionId !== result.txId || audit.giftName !== intent.giftName || result.giftName !== intent.giftName || result.quantity !== intent.quantity ||
      !audit.quantity.eq(new Prisma.Decimal(intent.quantity).toDecimalPlaces(4, Prisma.Decimal.ROUND_HALF_UP))) return base;
    for (const key of ['unitPrice', 'gross', 'payable', 'pointsEarned', 'receiverRate', 'feeAmount', 'netAmount'] as const) {
      if (!audit[key].eq(new Prisma.Decimal(result[key]).toDecimalPlaces(key === 'receiverRate' ? 6 : 4, Prisma.Decimal.ROUND_HALF_UP))) return base;
    }
    if (!new Prisma.Decimal(result.unitPrice).mul(result.quantity).eq(result.gross) ||
      !new Prisma.Decimal(result.feeAmount).add(result.netAmount).eq(result.gross) ||
      new Prisma.Decimal(result.payable).gt(result.gross) || !Number.isSafeInteger(audit.heartGain) || Math.round(Number(result.heartGain)) !== audit.heartGain) return base;
    verifyVouchers(audit, intent);
    if (intent.kind === 'DELEGATED_GIFT') {
      if (!operation || operation.type !== 'DELEGATED_GIFT' || operation.status !== 'COMPLETED' || !await giftHistoryDlmMatches(db, intent.payerDlmId, operation.dlmId) ||
        operation.operatorDiscordId !== intent.operatorDiscordId || stableGiftExecutionJson(operation.details) !== stableGiftExecutionJson({ giftExecutionVersion: 1, intentHash: row.intentHash, intent }) ||
        stableGiftExecutionJson(operation.result) !== stableGiftExecutionJson({ ...result, transactionId: result.txId, giftAuditId: audit.id, requestId })) return base;
    } else if (operation) return base;
    const [payment, ledger, reverts] = await Promise.all([
      db.transaction.findUnique({ where: { Transid: result.txId }, select: { Transid: true, orderID: true, fromId: true, toId: true,
        fromDlmId: true, toDlmId: true, amount: true, feeAmount: true, netAmount: true } }),
      db.individualTransaction.findUnique({ where: { transactionId: audit.individualTransactionId }, select: { transactionId: true, discordId: true, dlmId: true,
        thirdPartydiscordId: true, typeOfTransaction: true, amountChange: true, balanceBefore: true, balanceAfter: true } }),
      db.revert.findMany({ where: { originalTransactionId: audit.individualTransactionId }, select: { id: true, status: true, createdAt: true } }),
    ]);
    if (!payment || payment.Transid !== result.txId || payment.orderID !== audit.orderId ||
      !await giftHistoryPaymentOwnerMatches(db, { dlmId: audit.giverDlmId, discordId: audit.giverDiscordId }, { dlmId: payment.fromDlmId, memberKey: payment.fromId }) ||
      !await giftHistoryPaymentOwnerMatches(db, { dlmId: audit.receiverDlmId, discordId: audit.receiverId }, { dlmId: payment.toDlmId, memberKey: payment.toId }) || !payment.amount.eq(audit.gross) ||
      !payment.feeAmount.eq(audit.feeAmount) || !payment.netAmount.eq(audit.netAmount) ||
      !ledger || ledger.transactionId !== audit.individualTransactionId || ledger.discordId !== audit.giverDiscordId || !await giftHistoryDlmMatches(db, audit.giverDlmId, ledger.dlmId) ||
      ledger.thirdPartydiscordId !== audit.receiverId || ledger.typeOfTransaction !== (intent.transactionLabel ?? '打赏') ||
      !ledger.amountChange.eq(audit.payable) || !ledger.balanceBefore.sub(ledger.balanceAfter).eq(ledger.amountChange)) return base;
    return { ...base, status: 'COMPLETED', verified: true, transactionId: result.txId, individualTransactionId: audit.individualTransactionId,
      gross: result.gross, payable: result.payable, reverted: reverts.some(revert => revert.status === 'SUCCESS'),
      reverts: reverts.map(revert => ({ id: revert.id, status: revert.status, createdAt: revert.createdAt.toISOString() })),
      message: '这笔打赏已完成，本次查询不会重复扣款。如需确认退款或通知情况，请查看记录或联系客服。' };
  } catch { return base; }
}

export class GiftExecutionReviewConflict extends Error {
  constructor() { super('暂时无法取消这笔打赏，请保留编号并联系客服核实。'); }
}
/** Existing requests always use their stored intent. A missing v1 Web request
 * needs the complete locally persisted intent; an ID alone cannot prove it. */
export async function prepareGiftExecutionAbandon(db: GiftExecutionReadDb, session: SessionSnapshot, isAdmin: boolean, requestId: string, rawIntent?: unknown, canReviewOwnDelegated = false) {
  if (!validGiftExecutionLookupId(requestId) || !await validSession(db, session)) return null;
  requestId = normalizeGiftExecutionId(requestId);
  const existing = await db.giftExecutionRequest.findUnique({ where: { requestId }, select: { requestId: true } });
  if (existing) {
    const review = await loadGiftExecutionReview(db, session, isAdmin, requestId, canReviewOwnDelegated);
    if (!review) return null;
    // The verified current owner may cancel an inherited pending request using
    // its original intent. Bot locks and checks execution evidence before canceling;
    // this does not authorize replaying the original financial POST.
    if (review.status === 'REQUIRES_REVIEW') throw new GiftExecutionReviewConflict();
    if (rawIntent !== undefined) {
      let provided: GiftExecutionIntent;
      try { provided = parseGiftExecutionIntent(rawIntent); } catch { throw new GiftExecutionReviewConflict(); }
      if (stableGiftExecutionJson(provided) !== stableGiftExecutionJson(review.intent) || stableGiftExecutionJson(rawIntent) !== stableGiftExecutionJson(provided)) throw new GiftExecutionReviewConflict();
    }
    return { requestId, intent: review.intent, review };
  }
  let intent: GiftExecutionIntent;
  try { intent = parseGiftExecutionIntent(rawIntent); } catch { throw new GiftExecutionReviewConflict(); }
  if (intent.kind === 'DISCORD_GIFT' || requestId.startsWith('discord:gift:') || stableGiftExecutionJson(rawIntent) !== stableGiftExecutionJson(intent)) throw new GiftExecutionReviewConflict();
  if (!isAdmin && (intent.payerDlmId !== session.dlmId || intent.payerDiscordId !== (session.discordId ?? null))) return null;
  const legacy = await db.dlmAdminOperation.findUnique({ where: { requestId }, select: { id: true } });
  if (legacy) throw new GiftExecutionReviewConflict();
  return { requestId, intent, review: null };
}
