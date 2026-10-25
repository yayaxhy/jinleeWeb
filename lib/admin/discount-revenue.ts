import { Prisma, type OrderDiscountAudit, type IndividualTransaction } from '@prisma/client';
import { asRecord, stringId, uniqueIds } from './report-facts';
import { NEW_ENTITY_OPERATIONS_STARTED_AT } from '../operating-entity-cutover';

export type DiscountRevenueRevert = { id?: string; originalTransactionId?: string; createdAt: Date; details: unknown };
export type DiscountRevenueParams = { start: Date; end: Date; excludeDlmIds?: string[] };
export type DiscountVoucherPosting = {
  kind: 'coupon' | 'pointshop' | 'lottery'; phase: 'original' | 'reversal'; source: string;
  auditId: string; voucherId: string; consumedAt: Date; amount: Prisma.Decimal; eventAt: Date;
};
type Client = Pick<Prisma.TransactionClient, 'orderDiscountAudit' | 'individualTransaction' | 'coupon' | 'pointShopGrant' | 'lotteryDraw'>;
export class DiscountRevenueFactsError extends Error {
  constructor(detail: string) { super(`订单折扣凭据需人工核实（${detail}），不能计算报表。`); this.name = 'DiscountRevenueFactsError'; }
}
const fail = (detail: string): never => { throw new DiscountRevenueFactsError(detail); };
const record = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value));
const text = (value: unknown, label: string) => typeof value === 'string' && value ? value : fail(label);
const date = (value: unknown) => {
  const result = value instanceof Date ? value : typeof value === 'string' ? new Date(value) : null;
  return result && Number.isFinite(result.getTime()) ? result : fail('缺少发生时间');
};
const amount = (value: unknown) => {
  if (!(value instanceof Prisma.Decimal) && typeof value !== 'string') return fail('缺少金额');
  let result: Prisma.Decimal;
  try { result = new Prisma.Decimal(value); } catch { return fail('金额格式错误'); }
  return result.isFinite() && result.gt(0) && result.decimalPlaces() <= 4 ? result : fail('金额无效');
};
const inRange = (value: Date, params: DiscountRevenueParams) => value >= params.start && value < params.end;
type Claim = { revert: DiscountRevenueRevert; value: Record<string, unknown>; auditId: string; originalId: string; reversalId: string };

function claimsFrom(reverts: DiscountRevenueRevert[]) {
  const claims: Claim[] = [];
  const used = new Set<string>();
  for (const revert of reverts) {
    if (!record(revert.details) || revert.details.discountRollback == null) continue;
    const value = revert.details.discountRollback;
    if (!record(value) || !revert.id || !revert.originalTransactionId) return fail('撤销标记缺失');
    const auditId = text(value.auditId, '折扣审计编号缺失');
    const originalId = text(value.originalTransactionId, '原返利流水缺失');
    const reversalId = text(value.reversalTransactionId, '追回流水缺失');
    if (originalId === reversalId || [auditId, originalId, reversalId].some(id => used.has(id))) fail('重复折扣撤销凭据');
    [auditId, originalId, reversalId].forEach(id => used.add(id));
    claims.push({ revert, value, auditId, originalId, reversalId });
  }
  return claims;
}

function checkReceipt(row: IndividualTransaction | undefined, expectedType: string, expectedAmount?: Prisma.Decimal) {
  if (!row) return fail('流水已缺失');
  if (expectedType !== '优惠返利' && expectedType !== '优惠返利撤销') return fail('流水类型错误');
  const value = amount(row.amountChange);
  const delta = row.balanceAfter.sub(row.balanceBefore);
  if (row.typeOfTransaction !== expectedType || (expectedAmount && !value.eq(expectedAmount)) ||
      !delta.eq(expectedType === '优惠返利' ? value : value.neg())) fail('流水金额或方向不一致');
  date(row.timeCreatedAt);
  return row;
}

/** No singleton: mocks exercise the production reads and receipt verification.
 * Live vouchers are consulted only to deduplicate the exact prior consumption;
 * later use of the same voucher is a separate lifecycle and remains counted. */

export type DiscountLiveVoucher = { issuedAt: Date; status: string | null; consumedAt: Date | null; amount: Prisma.Decimal | null; orderId: string | null; dlmId: string | null };
export type DiscountRevenueSources = { audits: OrderDiscountAudit[]; receipts: IndividualTransaction[]; live: Map<string, DiscountLiveVoucher> };
export async function loadDiscountRevenueSources(client: Client, params: DiscountRevenueParams, reverts: DiscountRevenueRevert[], includePeriodAudits = false, extraVoucherKeys: string[] = []) {
  const claims = reverts.map(revert => asRecord(asRecord(revert.details)?.discountRollback)).filter((value): value is Record<string, unknown> => Boolean(value));
  const auditIds = uniqueIds(claims.map(value => stringId(value.auditId)));
  const receiptIds = uniqueIds(claims.flatMap(value => [stringId(value.originalTransactionId), stringId(value.reversalTransactionId)]));
  const [audits, receipts] = await Promise.all([
    client.orderDiscountAudit.findMany({ where: includePeriodAudits ? { OR: [{ id: { in: auditIds } }, { consumedAt: { gte: params.start, lt: params.end } }, { orderId: { in: reverts.map(row => row.originalTransactionId?.startsWith('ORDER:') ? row.originalTransactionId.slice(6) : '').filter(Boolean) } }] } : { id: { in: auditIds } } }),
    client.individualTransaction.findMany({ where: { OR: [
      { typeOfTransaction: { in: ['优惠返利', '优惠返利撤销'] }, timeCreatedAt: { gte: params.start, lt: params.end } },
      { transactionId: { in: receiptIds } },
    ] }, orderBy: { timeCreatedAt: 'desc' } }),
  ]);
  const legacyVoucherKeys = reverts.flatMap(revert => {
    const payload = asRecord(revert.details)?.voucherRollbacks;
    return Array.isArray(payload) ? payload.map(value => { const row = asRecord(value); return stringId(row?.kind) && stringId(row?.voucherId) ? `${row!.kind}:${row!.voucherId}` : ''; }) : [];
  });
  const allVoucherKeys = [...extraVoucherKeys, ...legacyVoucherKeys];
  const ids = (kind: string) => uniqueIds([...audits.filter(row => row.voucherKind === kind).map(row => row.voucherId), ...allVoucherKeys.filter(key => key.startsWith(`${kind}:`)).map(key => key.slice(kind.length + 1))]);
  const [coupons, grants, draws] = await Promise.all([
    client.coupon.findMany({ where: { id: { in: ids('coupon') } }, select: { id: true, issuedAt: true, status: true, consumedAt: true, consumeAmount: true, orderId: true, dlmId: true } }),
    client.pointShopGrant.findMany({ where: { id: { in: ids('pointshop') } }, select: { id: true, issuedAt: true, deliveryType: true, deliveryStatus: true, couponStatus: true, consumedAt: true, consumeAmount: true, consumeOrderId: true, dlmId: true } }),
    client.lotteryDraw.findMany({ where: { id: { in: ids('lottery') } }, select: { id: true, createdAt: true, status: true, consumeAt: true, consumeAmount: true, consumeOrderId: true, dlmId: true } }),
  ]);
  const live = new Map<string, { issuedAt: Date; status: string | null; consumedAt: Date | null; amount: Prisma.Decimal | null; orderId: string | null; dlmId: string | null }>([
    ...coupons.map(row => [`coupon:${row.id}`, { issuedAt: row.issuedAt, status: row.status, consumedAt: row.consumedAt, amount: row.consumeAmount, orderId: row.orderId, dlmId: row.dlmId }] as const),
    ...grants.map(row => [`pointshop:${row.id}`, { status: row.deliveryType === 'COUPON' && row.deliveryStatus === 'DELIVERED' ? row.couponStatus : null,
      issuedAt: row.issuedAt, consumedAt: row.consumedAt, amount: row.consumeAmount, orderId: row.consumeOrderId, dlmId: row.dlmId }] as const),
    ...draws.map(row => [`lottery:${row.id}`, { issuedAt: row.createdAt, status: row.status, consumedAt: row.consumeAt, amount: row.consumeAmount, orderId: row.consumeOrderId, dlmId: row.dlmId }] as const),
  ]);
  return { audits, receipts, live };
}

export function summarizeDiscountRevenue(sources: DiscountRevenueSources, params: DiscountRevenueParams, reverts: DiscountRevenueRevert[]) {
  const { audits, receipts, live } = sources;
  const claims = claimsFrom(reverts);
  const auditMap = new Map(audits.map(row => [row.id, row]));
  const receiptMap = new Map(receipts.map(row => [row.transactionId, row]));
  if (auditMap.size !== audits.length || receiptMap.size !== receipts.length) fail('重复审计或流水');
  const voucherRows: DiscountVoucherPosting[] = [];
  const handledReversalIds = new Set<string>();
  const discountRevertIds = new Set<string>();
  const lifecycleIds = new Set<string>();
  const excluded = new Set(params.excludeDlmIds ?? []);
  for (const claim of claims) {
    const audit: OrderDiscountAudit | undefined = auditMap.get(claim.auditId);
    const { value, revert } = claim;
    if (!audit || audit.auditVersion !== 1 || revert.originalTransactionId !== `ORDER:${audit.orderId}` ||
        audit.rebateTransactionId !== claim.originalId || value.voucherId !== audit.voucherId || value.voucherKind !== audit.voucherKind ||
        !['coupon', 'pointshop', 'lottery'].includes(audit.voucherKind)) return fail('撤销与折扣审计不一致');
    const expected = amount(audit.amount);
    if (!amount(value.amount).eq(expected) || !audit.rechargeDelta.eq(expected) ||
        !record(revert.details) || !amount(revert.details.discountRollbackAmount).eq(expected)) return fail('撤销金额与审计不一致');
    const issuedAt = date(audit.voucherIssuedAt);
    const consumedAt = date(audit.consumedAt);
    const expiresAt = date(audit.voucherExpiresAt);
    const reversedAt = date(revert.createdAt);
    if (issuedAt > consumedAt || expiresAt <= consumedAt || consumedAt > reversedAt ||
        date(value.expiresAt).getTime() !== expiresAt.getTime() ||
        (value.status !== 'RESTORED' && value.status !== 'EXPIRED') ||
        (value.status === 'RESTORED' && expiresAt <= reversedAt)) fail('券生命周期不一致');
    const original = checkReceipt(receiptMap.get(claim.originalId), '优惠返利', expected);
    const recovered = checkReceipt(receiptMap.get(claim.reversalId), '优惠返利撤销', expected);
    if (!original.dlmId || !recovered.dlmId || original.discordId !== audit.ownerDiscordId || original.thirdPartydiscordId !== audit.workerDiscordId ||
        original.timeCreatedAt.getTime() !== consumedAt.getTime() || recovered.thirdPartydiscordId !== audit.workerDiscordId ||
        recovered.timeCreatedAt < consumedAt || original.dlmId !== recovered.dlmId) fail('返利流水归属或时间不一致');
    // Receipt DLM foreign keys follow account merges; the audit's owner is a
    // historical snapshot and must not route or invalidate a merged account.
    const lifecycle = `${audit.voucherKind}:${audit.voucherId}:${consumedAt.toISOString()}`;
    if (lifecycleIds.has(lifecycle)) fail('重复券消费生命周期');
    lifecycleIds.add(lifecycle);
    handledReversalIds.add(claim.reversalId);
    discountRevertIds.add(revert.id!);
    const generic = revert.details.voucherRollbacks;
    if (generic !== undefined) {
      if (!Array.isArray(generic)) return fail('旧券撤销凭据格式错误');
      for (const old of generic) {
        if (!record(old) || old.kind !== audit.voucherKind || old.voucherId !== audit.voucherId ||
            date(old.consumedAt).getTime() !== consumedAt.getTime() || date(old.issuedAt).getTime() !== issuedAt.getTime() ||
            !amount(old.amount).eq(expected)) fail('新旧券撤销凭据不能匹配，拒绝重复推算');
      }
      if (generic.length > 1) fail('重复旧券撤销凭据');
    }
    const current = live.get(`${audit.voucherKind}:${audit.voucherId}`);
    const sameConsumption = Boolean(current && current.consumedAt?.getTime() === consumedAt.getTime());
    if (sameConsumption && (current!.orderId !== audit.orderId || !current!.amount?.eq(expected) ||
        date(current!.issuedAt).getTime() !== issuedAt.getTime() ||
        (audit.voucherKind !== 'lottery' && current!.status !== 'USED'))) fail('当前券与原消费事实不一致');
    // Filtering follows the original rebate wallet, not the voucher's later
    // owner. No guessed CouponSource: show these as separate audit adjustments.
    if (issuedAt <= NEW_ENTITY_OPERATIONS_STARTED_AT || excluded.has(original.dlmId!)) continue;
    const common = { kind: audit.voucherKind as DiscountVoucherPosting['kind'], source: '订单折扣审计调整',
      auditId: audit.id, voucherId: audit.voucherId, consumedAt };
    if (inRange(consumedAt, params) && !(sameConsumption && !excluded.has(current!.dlmId ?? ''))) {
      voucherRows.push({ ...common, phase: 'original', amount: expected, eventAt: consumedAt });
    }
    if (inRange(reversedAt, params)) voucherRows.push({ ...common, phase: 'reversal', amount: expected.neg(), eventAt: reversedAt });
  }
  const discountRebateRows = receipts.filter(row => inRange(row.timeCreatedAt, params)).map(row => {
    checkReceipt(row, row.typeOfTransaction);
    if (row.typeOfTransaction === '优惠返利撤销' && !handledReversalIds.has(row.transactionId)) fail('追回流水缺少成功撤销审计');
    return { ...row, signedAmount: row.typeOfTransaction === '优惠返利撤销' ? row.amountChange.neg() : row.amountChange };
  });
  const sum = (type: string) => discountRebateRows.reduce((total, row) => row.typeOfTransaction === type ? total.add(row.amountChange) : total, new Prisma.Decimal(0));
  const originalAmount = sum('优惠返利');
  const recoveredAmount = sum('优惠返利撤销');
  return { voucherRows, discountRevertIds, discountRebateRows, originalAmount, recoveredAmount, netAmount: originalAmount.sub(recoveredAmount) };
}

export async function loadDiscountRevenue(client: Client, params: DiscountRevenueParams, reverts: DiscountRevenueRevert[]) {
  // Preserve the strict API for callers that need an all-or-error calculation.
  claimsFrom(reverts);
  return summarizeDiscountRevenue(await loadDiscountRevenueSources(client, params, reverts), params, reverts);
}
