import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { NEW_ENTITY_OPERATIONS_STARTED_AT } from '@/lib/operating-entity-cutover';

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
    const payload = Array.isArray(details.voucherRollbacks) ? details.voucherRollbacks : null;
    if (!payload) {
      const oldVoucherIds = Array.isArray(details.voucherIds) ? details.voucherIds.length : 0;
      const oldCouponIds = Array.isArray(details.couponIds) ? details.couponIds.length : 0;
      const oldDiscount = new Prisma.Decimal(typeof details.discountRollbackAmount === 'string' ? details.discountRollbackAmount : 0);
      if (oldVoucherIds || oldCouponIds || oldDiscount.gt(0)) {
        throw new Error('存在未记录券成本明细的旧撤销记录，请人工核对后再确认报表。');
      }
      continue;
    }
    for (const item of payload) {
      const rollback = parseRollback(item);
      if (!rollback) throw new Error('券撤销审计数据格式错误，不能计算报表。');
      if (rollback.dlmId && excluded.has(rollback.dlmId)) continue;
      const issuedAt = new Date(rollback.issuedAt);
      const consumedAt = new Date(rollback.consumedAt);
      const amount = new Prisma.Decimal(rollback.amount);
      if (Number.isNaN(issuedAt.getTime()) || Number.isNaN(consumedAt.getTime()) || !amount.isFinite() || amount.lt(0)) {
        throw new Error('券撤销审计数据无效，不能计算报表。');
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
}) {
  const reverts = await prisma.revert.findMany({
    where: { status: 'SUCCESS', createdAt: { gt: NEW_ENTITY_OPERATIONS_STARTED_AT } },
    select: { createdAt: true, details: true },
  });
  return summarizeVoucherReversals(reverts, params);
}
