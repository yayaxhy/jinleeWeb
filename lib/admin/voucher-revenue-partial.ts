import { Prisma, type IndividualTransaction, type OrderDiscountAudit } from '@prisma/client';
import { DiscountRevenueFactsError, summarizeDiscountRevenue, type DiscountRevenueParams, type DiscountRevenueRevert, type DiscountRevenueSources } from './discount-revenue';
import { summarizeVoucherReversals, type VoucherReversalRow } from './voucher-reversal';
import { asRecord, groupReportFacts, orderFromKey, stringId, uniqueIds, type ReportFactIssue } from './report-facts';

type Kind = 'coupon' | 'pointshop' | 'lottery';
type Item = { type: 'revert'; row: DiscountRevenueRevert } | { type: 'audit'; row: OrderDiscountAudit } | { type: 'receipt'; row: IndividualTransaction };
const voucherKey = (kind: unknown, id: unknown) => ['coupon', 'pointshop', 'lottery'].includes(String(kind)) && stringId(id) ? `${kind}:${id}` : null;
function keysFor(item: Item): string[] {
  if (item.type === 'receipt') return [`receipt:${item.row.transactionId}`];
  if (item.type === 'audit') return [`order:${item.row.orderId}`, `audit:${item.row.id}`, `receipt:${item.row.rebateTransactionId}`];
  const row = item.row; const details = asRecord(row.details); const rollback = asRecord(details?.discountRollback);
  const keys = uniqueIds([row.id && `revert:${row.id}`, row.originalTransactionId && `source:${row.originalTransactionId}`,
    orderFromKey(row.originalTransactionId) && `order:${orderFromKey(row.originalTransactionId)}`,
    stringId(rollback?.auditId) && `audit:${rollback!.auditId}`,
    stringId(rollback?.originalTransactionId) && `receipt:${rollback!.originalTransactionId}`,
    stringId(rollback?.reversalTransactionId) && `receipt:${rollback!.reversalTransactionId}`]);
  return keys;
}
const lifecycleTime = (value: unknown): number | null => {
  const n = value instanceof Date ? value.getTime() : typeof value === 'string' ? Date.parse(value) : NaN;
  return Number.isFinite(n) ? n : null;
};
function voucherClaims(item: Item, audits: OrderDiscountAudit[]): Array<{ key: string; at: number | null }> {
  if (item.type === 'receipt') return [];
  if (item.type === 'audit') { const key = voucherKey(item.row.voucherKind, item.row.voucherId); return key ? [{ key, at: lifecycleTime(item.row.consumedAt) }] : []; }
  const details = asRecord(item.row.details), rollback = asRecord(details?.discountRollback);
  const result: Array<{ key: string; at: number | null }> = [];
  const key = voucherKey(rollback?.voucherKind, rollback?.voucherId);
  if (key) {
    const matching = audits.filter(audit => audit.id === rollback?.auditId);
    result.push({ key, at: matching.length === 1 ? lifecycleTime(matching[0].consumedAt) : null });
  }
  if (Array.isArray(details?.voucherRollbacks)) for (const entry of details.voucherRollbacks) {
    const value = asRecord(entry), key = voucherKey(value?.kind, value?.voucherId);
    if (key) result.push({ key, at: lifecycleTime(value?.consumedAt) });
  }
  return result;
}
const isInRange = (date: Date, params: DiscountRevenueParams) => date instanceof Date && Number.isFinite(date.getTime()) && date >= params.start && date < params.end;

/** Validate whole connected order/receipt/voucher groups with the original
 * strict readers. Never accept the first of duplicate claims or keep only one
 * side of an unverified reversal. */
export function summarizeVoucherRevenuePartial(sources: DiscountRevenueSources, reverts: DiscountRevenueRevert[], params: DiscountRevenueParams,
  blockedOrderIds: ReadonlySet<string> = new Set()) {
  const items: Item[] = [...reverts.map(row => ({ type: 'revert' as const, row })), ...sources.audits.map(row => ({ type: 'audit' as const, row })),
    ...sources.receipts.map(row => ({ type: 'receipt' as const, row }))];
  // Known independent consumptions of a restored voucher are separate facts.
  // An unknown lifecycle still connects every candidate for that voucher.
  const claims = new Map(items.map(item => [item, voucherClaims(item, sources.audits)]));
  const unknown = new Set([...claims.values()].flat().filter(c => c.at === null).map(c => c.key));
  const groupKeys = (item: Item) => [...keysFor(item), ...claims.get(item)!.map(c => unknown.has(c.key) ? `voucher:${c.key}` : `life:${c.key}:${c.at}`)];
  const rows: VoucherReversalRow[] = []; const discountRebateRows: ReturnType<typeof summarizeDiscountRevenue>['discountRebateRows'] = [];
  const issues: ReportFactIssue[] = []; const blockedVoucherKeys = new Set<string>(); const omittedVoucherKinds = new Set<Kind>();
  let unlinkedDiscountFacts = false;
  const identifiedReceiptIds = new Set<string>();
  for (const group of groupReportFacts(items, groupKeys)) {
    const groupReverts = group.filter((item): item is Extract<Item, { type: 'revert' }> => item.type === 'revert').map(item => item.row);
    const audits = group.filter((item): item is Extract<Item, { type: 'audit' }> => item.type === 'audit').map(item => item.row);
    const receipts = group.filter((item): item is Extract<Item, { type: 'receipt' }> => item.type === 'receipt').map(item => item.row);
    const orderIds = uniqueIds([...audits.map(row => row.orderId), ...groupReverts.map(row => orderFromKey(row.originalTransactionId))]);
    const ids = uniqueIds([...audits.map(row => row.id), ...receipts.map(row => row.transactionId), ...groupReverts.map(row => row.id)]);
    const groupClaims = group.flatMap(item => claims.get(item)!);
    const groupVoucherKeys = uniqueIds(groupClaims.map(c => c.key));
    // Old settled groups entirely before this period do not contaminate a new
    // period. Future reversals may still carry this period's original use.
    const relevant = receipts.some(row => isInRange(row.timeCreatedAt, params)) || audits.some(row => isInRange(row.consumedAt, params)) ||
      groupReverts.some(row => row.createdAt >= params.start || !(row.createdAt instanceof Date) || !Number.isFinite(row.createdAt.getTime()));
    if (!relevant) continue;
    try {
      if (orderIds.some(id => blockedOrderIds.has(id))) throw new DiscountRevenueFactsError('同原单结算凭据待核实');
      if (new Set(audits.map(row => row.orderId)).size !== audits.length) throw new DiscountRevenueFactsError('同原单存在多份折扣审计');
      const lifecycleClaims = new Set<string>();
      for (const revert of groupReverts) {
        if (!(revert.createdAt instanceof Date) || !Number.isFinite(revert.createdAt.getTime())) throw new DiscountRevenueFactsError('撤销发生时间缺失');
        const payload = asRecord(revert.details)?.voucherRollbacks;
        if (Array.isArray(payload)) for (const item of payload) {
          const value = asRecord(item);
          if (!value) continue;
          const key = JSON.stringify([value.kind, value.voucherId ?? null, value.consumedAt, value.amount, value.dlmId ?? null]);
          if (lifecycleClaims.has(key)) throw new DiscountRevenueFactsError('重复或无法区分的券消费生命周期，不能选择其中一条');
          lifecycleClaims.add(key);
        }
      }
      const revertIds = new Set<string>(); const originalIds = new Set<string>();
      for (const revert of groupReverts) {
        if ((revert.id && revertIds.has(revert.id)) || (revert.originalTransactionId && originalIds.has(revert.originalTransactionId))) throw new DiscountRevenueFactsError('重复撤销记录，不能选择其中一条');
        if (revert.id) revertIds.add(revert.id); if (revert.originalTransactionId) originalIds.add(revert.originalTransactionId);
      }
      const discount = summarizeDiscountRevenue({ ...sources, audits, receipts }, params, groupReverts);
      const generic = summarizeVoucherReversals(groupReverts.filter(row => !discount.discountRevertIds.has(row.id!)), params);
      rows.push(...generic.rows, ...discount.voucherRows); discountRebateRows.push(...discount.discountRebateRows);
      if (audits.length) receipts.forEach(row => identifiedReceiptIds.add(row.transactionId));
    } catch (error) {
      if (!(error instanceof DiscountRevenueFactsError)) throw error;
      issues.push({ source: 'discount', ids, orderIds, reason: error.message });
      for (const key of groupVoucherKeys) {
        const currentAt = lifecycleTime(sources.live.get(key)?.consumedAt);
        // Only exclude the mutable live row when it is the unverified use (or
        // cannot be distinguished), not a clearly later independent use.
        if (currentAt === null || groupClaims.some(c => c.key === key && (c.at === null || c.at === currentAt))) blockedVoucherKeys.add(key);
      }
      // Without a voucher identity, even its live consumption cannot safely be
      // separated from the broken restoration. Omit that cost category, with
      // an explicit gap, rather than silently adding an unpaired original.
      if (groupReverts.length && !groupVoucherKeys.length) {
        const knownKinds = uniqueIds(groupReverts.flatMap(row => {
          const payload = asRecord(row.details)?.voucherRollbacks;
          return Array.isArray(payload) ? payload.map(value => stringId(asRecord(value)?.kind)) : [];
        })).filter((kind): kind is Kind => ['coupon', 'pointshop', 'lottery'].includes(kind));
        for (const kind of knownKinds.length ? knownKinds : ['coupon', 'pointshop', 'lottery'] as const) omittedVoucherKinds.add(kind);
        if (!receipts.length && !audits.length) unlinkedDiscountFacts = true;
      }
    }
  }
  // An entirely unidentified rollback may refer to an otherwise standalone
  // rebate. Keep identified groups; do not guess which orphan receipt is safe.
  const trustedRebateRows = unlinkedDiscountFacts ? discountRebateRows.filter(row => identifiedReceiptIds.has(row.transactionId)) : discountRebateRows;
  const trustedRows = rows.filter(row => !omittedVoucherKinds.has(row.kind));
  if (omittedVoucherKinds.size) issues.push({ source: 'voucher', ids: [], orderIds: [],
    reason: `旧撤销缺少可定位的券编号，本次部分合计未纳入以下整类券成本及调整：${[...omittedVoucherKinds].join('、')}；不是成本为零。` });
  if (unlinkedDiscountFacts && trustedRebateRows.length !== discountRebateRows.length) issues.push({ source: 'discount', ids: [], orderIds: [],
    reason: '存在完全无法定位的旧折扣撤销，无法确认归属的独立返利流水暂未计入；未挑选某条流水作为原记录。' });
  const total = (kind: Kind) => trustedRows.reduce((sum, row) => row.kind === kind ? sum.add(row.amount) : sum, new Prisma.Decimal(0));
  const sumRebate = (type: string) => trustedRebateRows.reduce((sum, row) => row.typeOfTransaction === type ? sum.add(row.amountChange) : sum, new Prisma.Decimal(0));
  const discountOriginalAmount = sumRebate('优惠返利'); const discountRecoveredAmount = sumRebate('优惠返利撤销');
  return { rows: trustedRows, couponAdjustment: total('coupon'), pointShopAdjustment: total('pointshop'), lotteryAdjustment: total('lottery'),
    discountRebateRows: trustedRebateRows, discountOriginalAmount, discountRecoveredAmount,
    discountNetAmount: discountOriginalAmount.sub(discountRecoveredAmount), issues, blockedVoucherKeys, omittedVoucherKinds,
    blockedOrderIds: new Set(issues.flatMap(issue => issue.orderIds)) };
}
