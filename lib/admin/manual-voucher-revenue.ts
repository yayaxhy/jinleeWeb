import { Prisma } from '@prisma/client';
import { NEW_ENTITY_OPERATIONS_STARTED_AT } from '../operating-entity-cutover';
import type { DiscountRevenueSources } from './discount-revenue';
import type { ManualAdjustmentSource } from './manual-adjustment-revenue';
import type { VoucherReversalRow } from './voucher-reversal';
import { asRecord, groupReportFacts, orderFromKey, stringId, uniqueIds, type ReportFactIssue } from './report-facts';

const kindFor = (model: unknown) => model === 'coupon' ? 'coupon' : model === 'pointShopGrant' ? 'pointshop' : model === 'lotteryDraw' ? 'lottery' : null;
export const manualVoucherKeys = (sources: ManualAdjustmentSource[]) => uniqueIds(sources.flatMap(row => {
  const values = asRecord(asRecord(row.details)?.result)?.vouchers;
  return Array.isArray(values) ? values.map(value => { const entry = asRecord(value); const kind = kindFor(entry?.model); return kind && stringId(entry?.id) ? `${kind}:${entry!.id}` : null; }) : [];
}));
const date = (value: unknown) => {
  const result = typeof value === 'string' ? new Date(value) : null;
  if (!result || !Number.isFinite(result.getTime())) throw new Error('人工恢复券缺少原消费日期');
  return result;
};
const amount = (value: unknown) => {
  if (typeof value !== 'string') throw new Error('人工恢复券缺少原消费金额');
  let result: Prisma.Decimal;
  try { result = new Prisma.Decimal(value); } catch { throw new Error('人工恢复券原消费金额无效'); }
  if (!result.isFinite() || result.lt(0) || result.decimalPlaces() > 4) throw new Error('人工恢复券原消费金额无效');
  return result;
};

/** Restoring a voucher clears its live consumption fields. Preserve the old
 * cost in its original period, exactly once. The manual wallet profit effect
 * already represents this disposition; do not also reverse this expense. */
export function summarizeManualVoucherRevenue(sources: ManualAdjustmentSource[], live: DiscountRevenueSources['live'],
  params: { start: Date; end: Date; excludeDlmIds?: string[]; excludeDiscordIds?: string[] }) {
  const entries = sources.flatMap(record => {
    const details = asRecord(record.details); const result = asRecord(details?.result);
    return Array.isArray(result?.vouchers) ? result.vouchers.map((value, index) => ({ record, entry: asRecord(value), index })) : [];
  });
  const excluded = new Set(params.excludeDlmIds ?? []);
  const excludedDiscord = new Set(params.excludeDiscordIds ?? []);
  const rows: Array<VoucherReversalRow & { voucherKey: string; originalTransactionId: string }> = []; const issues: ReportFactIssue[] = [];
  const blockedVoucherKeys = new Set<string>(); const blockedOrderIds = new Set<string>();
  for (const group of groupReportFacts(entries, ({ record, entry, index }) => {
    const before = asRecord(entry?.before); const kind = kindFor(entry?.model);
    return [`entry:${record.id}:${index}`, ...(kind && stringId(entry?.id) ? [`life:${kind}:${entry!.id}:${before?.consumedAt ?? before?.consumeAt ?? 'unknown'}`] : [])];
  })) {
    const selected = group[0]; const before = asRecord(selected.entry?.before);
    const rawTime = before?.consumedAt ?? before?.consumeAt;
    const knownTime = typeof rawTime === 'string' ? new Date(rawTime) : null;
    if (knownTime && Number.isFinite(knownTime.getTime()) && (knownTime < params.start || knownTime >= params.end)) continue;
    if (!knownTime && selected.record.createdAt < params.start) continue;
    const ids = uniqueIds(group.flatMap(item => [item.record.id, stringId(item.entry?.id)]));
    const orderIds = uniqueIds(group.map(item => orderFromKey(item.record.originalTransactionId)));
    try {
      if (group.length !== 1) throw new Error('同一原券消费出现重复人工恢复凭据，不能重复保留费用');
      const { record, entry } = selected; const details = asRecord(record.details); const kind = kindFor(entry?.model);
      if (!entry || !before || !kind || !stringId(entry.id) || before.id !== entry.id || record.status !== 'MANUAL_ADJUSTED' ||
          details?.version !== 1 || details.mode !== 'LEGACY_MANUAL_ADJUSTMENT' || asRecord(details.source)?.canonicalKey !== record.originalTransactionId) throw new Error('人工恢复券凭据与来源不一致');
      const consumedAt = date(rawTime); const issuedAt = date(before.issuedAt ?? before.createdAt); const originalAmount = amount(before.consumeAmount);
      const status = kind === 'pointshop' ? before.couponStatus : before.status;
      if (status !== 'USED' || issuedAt > consumedAt || consumedAt > record.createdAt ||
          (kind === 'pointshop' && (before.deliveryType !== 'COUPON' || before.deliveryStatus !== 'DELIVERED'))) throw new Error('人工恢复券的原消费状态或日期不一致');
      if (issuedAt <= NEW_ENTITY_OPERATIONS_STARTED_AT || originalAmount.isZero()) continue;
      const owner = asRecord(entry.owner);
      const ownerDlmIds = uniqueIds([stringId(before.dlmId), stringId(entry.ownerDlmId), stringId(owner?.dlmId)]);
      const originalDiscordId = stringId(kind === 'coupon' ? before.discordId : kind === 'lottery' ? before.userId : before.discordUserId);
      const ownerDiscordIds = uniqueIds([originalDiscordId, stringId(owner?.discordId), stringId(owner?.memberKey)]);
      if (ownerDlmIds.some(id => excluded.has(id)) || ownerDiscordIds.some(id => excludedDiscord.has(id))) continue;
      const current = live.get(`${kind}:${entry.id}`);
      const sameConsumption = current?.consumedAt?.getTime() === consumedAt.getTime();
      if (sameConsumption) {
        const originalOrder = before.orderId ?? before.consumeOrderId ?? null;
        if (!current.amount?.eq(originalAmount) || current.issuedAt.getTime() !== issuedAt.getTime() || current.orderId !== originalOrder ||
            (kind !== 'lottery' && current.status !== 'USED')) throw new Error('当前券与人工处置前原消费快照不一致');
        if (!excluded.has(current.dlmId ?? '')) continue;
      }
      rows.push({ kind, voucherKey: `${kind}:${entry.id}`, originalTransactionId: record.originalTransactionId, phase: 'original', source: '人工恢复券：保留原消费成本', amount: originalAmount, eventAt: consumedAt });
    } catch (error) {
      issues.push({ source: 'voucher', ids, orderIds, reason: error instanceof Error ? error.message : '人工恢复券原费用待核实' });
      orderIds.forEach(id => blockedOrderIds.add(id));
      for (const { entry } of group) { const kind = kindFor(entry?.model); if (kind && stringId(entry?.id)) blockedVoucherKeys.add(`${kind}:${entry!.id}`); }
    }
  }
  return { rows, issues, blockedVoucherKeys, blockedOrderIds };
}
