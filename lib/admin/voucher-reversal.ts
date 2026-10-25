import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { NEW_ENTITY_OPERATIONS_STARTED_AT } from '@/lib/operating-entity-cutover';
import { DiscountRevenueFactsError, loadDiscountRevenue } from './discount-revenue';

type VoucherKind = 'coupon' | 'pointshop' | 'lottery';

type VoucherRollback = {
  kind: VoucherKind;
  dlmId: string | null;
  source?: string;
  issuedAt: string;
  consumedAt: string;
  amount: string;
};

export type VoucherReversalRow = {
  kind: VoucherKind;
  phase: 'original' | 'reversal';
  source: string;
  amount: Prisma.Decimal;
  eventAt: Date;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === 'object' && !Array.isArray(value));

const checkedDecimal = (value: string | number) => {
  try { const result = new Prisma.Decimal(value); if (!result.isFinite()) throw new Error(); return result; }
  catch { throw new DiscountRevenueFactsError('券撤销金额格式错误'); }
};

const parseRollback = (value: unknown): VoucherRollback | null => {
  if (!isRecord(value)) return null;
  if (value.kind !== 'coupon' && value.kind !== 'pointshop' && value.kind !== 'lottery') return null;
  if (typeof value.issuedAt !== 'string' || typeof value.consumedAt !== 'string' || typeof value.amount !== 'string') return null;
  return {
    kind: value.kind,
    dlmId: typeof value.dlmId === 'string' ? value.dlmId : null,
    source: typeof value.source === 'string' ? value.source : undefined,
    issuedAt: value.issuedAt,
    consumedAt: value.consumedAt,
    amount: value.amount,
  };
};

type RevertLike = { createdAt: Date; details: unknown };

export function summarizeVoucherReversals(reverts: RevertLike[], params: {
  start: Date;
  end: Date;
  excludeDlmIds?: string[];
}) {
  const excluded = new Set(params.excludeDlmIds ?? []);
  const rows: VoucherReversalRow[] = [];

  for (const revert of reverts) {
    const details = isRecord(revert.details) ? revert.details : {};
    if (details.voucherRollbacks != null && !Array.isArray(details.voucherRollbacks)) throw new DiscountRevenueFactsError('券撤销审计数据格式错误');
    const payload = Array.isArray(details.voucherRollbacks) ? details.voucherRollbacks : null;
    if (!payload) {
      const oldVoucherIds = Array.isArray(details.voucherIds) ? details.voucherIds.length : 0;
      const oldCouponIds = Array.isArray(details.couponIds) ? details.couponIds.length : 0;
      const oldDiscount = checkedDecimal(typeof details.discountRollbackAmount === 'string' ? details.discountRollbackAmount : 0);
      if (oldVoucherIds || oldCouponIds || oldDiscount.gt(0)) {
        throw new DiscountRevenueFactsError('存在未记录券成本明细的旧撤销记录');
      }
      continue;
    }
    for (const item of payload) {
      const rollback = parseRollback(item);
      if (!rollback) throw new DiscountRevenueFactsError('券撤销审计数据格式错误');
      if (rollback.dlmId && excluded.has(rollback.dlmId)) continue;
      const issuedAt = new Date(rollback.issuedAt);
      const consumedAt = new Date(rollback.consumedAt);
      const amount = checkedDecimal(rollback.amount);
      if (Number.isNaN(issuedAt.getTime()) || Number.isNaN(consumedAt.getTime()) || !amount.isFinite() || amount.lt(0)) {
        throw new DiscountRevenueFactsError('券撤销审计数据无效');
      }
      if (issuedAt <= NEW_ENTITY_OPERATIONS_STARTED_AT || amount.isZero()) continue;
      if (consumedAt >= params.start && consumedAt < params.end) {
        rows.push({ kind: rollback.kind, phase: 'original', source: rollback.source ?? '', amount, eventAt: consumedAt });
      }
      if (revert.createdAt >= params.start && revert.createdAt < params.end) {
        rows.push({ kind: rollback.kind, phase: 'reversal', source: rollback.source ?? '', amount: amount.neg(), eventAt: revert.createdAt });
      }
    }
  }

  const total = (kind: VoucherKind) => rows.reduce(
    (sum, row) => row.kind === kind ? sum.add(row.amount) : sum,
    new Prisma.Decimal(0),
  );
  return { rows, couponAdjustment: total('coupon'), pointShopAdjustment: total('pointshop'), lotteryAdjustment: total('lottery') };
}

export async function getVoucherReversalAdjustments(params: {
  start: Date;
  end: Date;
  excludeDlmIds?: string[];
}, client: Pick<Prisma.TransactionClient, 'revert' | 'orderDiscountAudit' | 'individualTransaction' | 'coupon' | 'pointShopGrant' | 'lotteryDraw'> = prisma) {
  const reverts = await client.revert.findMany({
    where: { status: 'SUCCESS', createdAt: { gt: NEW_ENTITY_OPERATIONS_STARTED_AT } },
    select: { id: true, originalTransactionId: true, createdAt: true, details: true },
  });
  const discount = await loadDiscountRevenue(client, params, reverts);
  // Matched generic payloads represent the same lifecycle as discountRollback,
  // and have already been verified. Count them once through the audit reader.
  const generic = summarizeVoucherReversals(reverts.filter(row => !discount.discountRevertIds.has(row.id)), params);
  const rows: VoucherReversalRow[] = [...generic.rows, ...discount.voucherRows];
  const total = (kind: VoucherKind) => rows.reduce((sum, row) => row.kind === kind ? sum.add(row.amount) : sum, new Prisma.Decimal(0));
  return { rows, couponAdjustment: total('coupon'), pointShopAdjustment: total('pointshop'), lotteryAdjustment: total('lottery'),
    discountRebateRows: discount.discountRebateRows,
    discountOriginalAmount: discount.originalAmount, discountRecoveredAmount: discount.recoveredAmount, discountNetAmount: discount.netAmount,
  };
}
