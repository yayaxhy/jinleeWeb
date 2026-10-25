import { Prisma } from '@prisma/client';
import { asRecord, groupReportFacts, orderFromKey, stringId, uniqueIds, type ReportFactIssue } from './report-facts';

export type ManualAdjustmentSource = { id: string; originalTransactionId: string; status: string; createdAt: Date; details: unknown };
const decimal = (value: unknown) => {
  if (typeof value !== 'string') throw new Error('金额缺失');
  let result: Prisma.Decimal;
  try { result = new Prisma.Decimal(value); } catch { throw new Error('金额格式错误'); }
  if (!result.isFinite() || result.decimalPlaces() > 4) throw new Error('金额格式错误');
  return result;
};
const zero = () => new Prisma.Decimal(0);

/** Manual wallet operations change the platform wallet liability, never bank
 * cash. Classification explains that one net effect; it is not booked twice. */
export function summarizeManualAdjustmentRevenue(sources: ManualAdjustmentSource[], params: { start: Date; end: Date }) {
  const rows: Array<Record<string, string | null>> = []; const issues: ReportFactIssue[] = [];
  let walletNetDelta = zero();
  for (const group of groupReportFacts(sources, row => { const wallets = asRecord(asRecord(row.details)?.result)?.wallets; return [`id:${row.id}`, `source:${row.originalTransactionId}`, ...(Array.isArray(wallets) ? wallets.map(value => stringId(asRecord(value)?.transactionId)).filter(Boolean).map(id => `receipt:${id}`) : [])]; })) {
    const orderIds = uniqueIds(group.map(row => orderFromKey(row.originalTransactionId)));
    const ids = group.map(row => row.id);
    if (!group.some(row => !(row.createdAt instanceof Date) || !Number.isFinite(row.createdAt.getTime()) || (row.createdAt >= params.start && row.createdAt < params.end))) continue;
    const issue = (reason: string) => issues.push({ source: 'manual-adjustment', ids, orderIds, reason });
    if (group.length !== 1) { issue('重复人工调整记录，全部隔离，不选择其中一条计入。'); continue; }
    const row = group[0]; const details = asRecord(row.details);
    const reporting = asRecord(details?.reporting); const result = asRecord(details?.result); const source = asRecord(details?.source);
    let actual = zero();
    try {
      if (!(row.createdAt instanceof Date) || !Number.isFinite(row.createdAt.getTime())) throw new Error('人工调整发生时间缺失');
      if (row.status !== 'MANUAL_ADJUSTED' || details?.version !== 1 || details.mode !== 'LEGACY_MANUAL_ADJUSTMENT' || !source ||
          source.canonicalKey !== row.originalTransactionId || !Array.isArray(result?.wallets)) throw new Error('人工调整凭据格式或来源不一致');
      const usedWallets = new Set<string>(); const usedReceipts = new Set<string>();
      for (const value of result.wallets) {
        const wallet = asRecord(value); const dlmId = stringId(wallet?.dlmId); const receiptId = stringId(wallet?.transactionId);
        if (!wallet || !dlmId || !receiptId || usedWallets.has(dlmId) || usedReceipts.has(receiptId)) throw new Error('人工钱包或流水重复／缺失');
        usedWallets.add(dlmId); usedReceipts.add(receiptId);
        const income = decimal(wallet.incomeDelta); const recharge = decimal(wallet.rechargeDelta);
        const before = asRecord(wallet.before); const after = asRecord(wallet.after);
        if (!before || !after || !decimal(before.income).add(decimal(before.recharge)).eq(decimal(before.totalBalance)) ||
            !decimal(after.income).add(decimal(after.recharge)).eq(decimal(after.totalBalance)) || !decimal(after.income).sub(decimal(before.income)).eq(income) ||
            !decimal(after.recharge).sub(decimal(before.recharge)).eq(recharge) ||
            !decimal(after.totalBalance).sub(decimal(before.totalBalance)).eq(income.add(recharge))) throw new Error('人工钱包前后余额与实际变动不符');
        actual = actual.add(income).add(recharge);
      }
    } catch (error) {
      issue(error instanceof Error ? error.message : '人工调整事实待核实'); continue;
    }
    const profit = actual.neg();
    walletNetDelta = walletNetDelta.add(actual);
    const classified: Record<string, string | null> = {};
    try {
      for (const key of ['grossDelta', 'payoutDelta', 'referralDelta', 'discountDelta']) classified[key] = reporting?.[key] == null ? null : decimal(reporting[key]).toString();
      if (Object.values(classified).some(value => value === null)) issue('人工调整分类尚未完整填写；已发生的钱包净影响单列，未知分类不是零。');
      else if (!decimal(classified.grossDelta).sub(decimal(classified.payoutDelta)).sub(decimal(classified.referralDelta)).sub(decimal(classified.discountDelta)).eq(profit)) issue('人工分类净额与实际钱包负债变化不一致；仅计已核实钱包净影响，不能确认月报。');
    } catch { issue('人工调整分类金额格式错误；不推断原订单金额。'); }
    rows.push({ id: row.id, source: row.originalTransactionId, createdAt: row.createdAt.toISOString(),
      originalCreatedAt: typeof source?.createdAt === 'string' ? source.createdAt : null,
      walletNetDelta: actual.toString(), profitDelta: profit.toString(), ...classified,
      explanation: typeof reporting?.explanation === 'string' ? reporting.explanation : null,
      note: '人工平台钱包调整，收益影响为钱包净变动的相反数；不是银行／支付平台现金流，分类不重复计入。',
      walletJournal: JSON.stringify(result?.wallets), benefitJournal: JSON.stringify(Object.fromEntries(Object.entries(result ?? {}).filter(([key]) => key !== 'wallets'))),
    });
  }
  return { rows, walletNetDelta, profitDelta: walletNetDelta.neg(), issues };
}
