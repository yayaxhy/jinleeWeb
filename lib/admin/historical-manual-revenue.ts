import type { Prisma } from '@prisma/client';
import { NEW_ENTITY_OPERATIONS_STARTED_AT } from '../operating-entity-cutover';
import { summarizeManualAdjustmentRevenue } from './manual-adjustment-revenue';
import { manualVoucherKeys, summarizeManualVoucherRevenue, type ManualVoucherLiveRow } from './manual-voucher-revenue';

type Client = Pick<Prisma.TransactionClient, 'revert' | 'coupon' | 'pointShopGrant' | 'lotteryDraw'>;

/** Compatibility for already posted manual adjustments only. Ordinary orders,
 * gifts and successful reversals retain the existing report calculations. */
export async function loadHistoricalManualRevenue(client: Client, params: {
  start: Date; end: Date; excludeDlmIds?: string[];
}) {
  const records = await client.revert.findMany({
    where: { status: 'MANUAL_ADJUSTED', createdAt: { gt: NEW_ENTITY_OPERATIONS_STARTED_AT } },
    select: { id: true, originalTransactionId: true, status: true, createdAt: true, details: true },
  });
  const keys = manualVoucherKeys(records);
  const ids = (kind: string) => keys.filter(key => key.startsWith(`${kind}:`)).map(key => key.slice(kind.length + 1));
  const [coupons, grants, draws] = await Promise.all([
    ids('coupon').length ? client.coupon.findMany({ where: { id: { in: ids('coupon') } },
      select: { id: true, issuedAt: true, status: true, consumedAt: true, consumeAmount: true, orderId: true, dlmId: true } }) : [],
    ids('pointshop').length ? client.pointShopGrant.findMany({ where: { id: { in: ids('pointshop') } },
      select: { id: true, issuedAt: true, couponStatus: true, consumedAt: true, consumeAmount: true, consumeOrderId: true, dlmId: true } }) : [],
    ids('lottery').length ? client.lotteryDraw.findMany({ where: { id: { in: ids('lottery') } },
      select: { id: true, createdAt: true, status: true, consumeAt: true, consumeAmount: true, consumeOrderId: true, dlmId: true } }) : [],
  ]);
  const live = new Map<string, ManualVoucherLiveRow>();
  for (const row of coupons) live.set(`coupon:${row.id}`, { issuedAt: row.issuedAt, status: row.status,
    consumedAt: row.consumedAt, amount: row.consumeAmount, orderId: row.orderId, dlmId: row.dlmId });
  for (const row of grants) live.set(`pointshop:${row.id}`, { issuedAt: row.issuedAt, status: row.couponStatus,
    consumedAt: row.consumedAt, amount: row.consumeAmount, orderId: row.consumeOrderId, dlmId: row.dlmId });
  for (const row of draws) live.set(`lottery:${row.id}`, { issuedAt: row.createdAt, status: row.status,
    consumedAt: row.consumeAt, amount: row.consumeAmount, orderId: row.consumeOrderId, dlmId: row.dlmId });
  const manualAdjustments = summarizeManualAdjustmentRevenue(records, params);
  const vouchers = summarizeManualVoucherRevenue(records, live, params);
  if (manualAdjustments.issues.length || vouchers.issues.length) {
    console.error('[reports] historical manual adjustment evidence', [...manualAdjustments.issues, ...vouchers.issues]);
  }
  return { manualAdjustments, voucherRows: vouchers.rows };
}
