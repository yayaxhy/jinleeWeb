import { Prisma } from '@prisma/client';
import { NEW_ENTITY_OPERATIONS_STARTED_AT } from '../operating-entity-cutover';
import { loadOrderRevenueSources, summarizeOrderRevenuePartial, type OrderRevenueParams } from './order-revenue';
import { loadDiscountRevenueSources } from './discount-revenue';
import { summarizeVoucherRevenuePartial } from './voucher-revenue-partial';
import { manualVoucherKeys, summarizeManualVoucherRevenue } from './manual-voucher-revenue';
import { summarizeManualAdjustmentRevenue } from './manual-adjustment-revenue';
import { orderFromKey, reportCompleteness } from './report-facts';

type Client = Pick<Prisma.TransactionClient, '$queryRaw' | 'revert' | 'orderDiscountAudit' | 'individualTransaction' | 'coupon' | 'pointShopGrant' | 'lotteryDraw'>;
export async function loadRevenueFacts(client: Client, params: OrderRevenueParams & { excludeDlmIds?: string[] }) {
  const [orderSources, reverts, manualRows] = await Promise.all([
    loadOrderRevenueSources(client, params),
    client.revert.findMany({ where: { status: 'SUCCESS', createdAt: { gt: NEW_ENTITY_OPERATIONS_STARTED_AT } },
      select: { id: true, originalTransactionId: true, createdAt: true, details: true } }),
    client.revert.findMany({ where: { status: 'MANUAL_ADJUSTED', createdAt: { gt: NEW_ENTITY_OPERATIONS_STARTED_AT } },
      select: { id: true, originalTransactionId: true, status: true, createdAt: true, details: true } }),
  ]);
  const discountSources = await loadDiscountRevenueSources(client, params, reverts, true, manualVoucherKeys(manualRows));
  const manualVouchers = summarizeManualVoucherRevenue(manualRows, discountSources.live, params);
  const blocked = new Set<string>(manualVouchers.blockedOrderIds);
  let orderRevenue = summarizeOrderRevenuePartial(orderSources.originals, orderSources.reversals, params, blocked);
  let voucherReversals = summarizeVoucherRevenuePartial(discountSources, reverts, params, orderRevenue.blockedOrderIds);
  const foundIssues = [...manualVouchers.issues, ...orderRevenue.issues, ...voucherReversals.issues];
  // Propagate across shared order/voucher/receipt identities until stable; all
  // passes operate on the same loaded facts, without repeated database reads.
  for (;;) {
    const previous = blocked.size;
    orderRevenue.blockedOrderIds.forEach(id => blocked.add(id)); voucherReversals.blockedOrderIds.forEach(id => blocked.add(id));
    orderRevenue = summarizeOrderRevenuePartial(orderSources.originals, orderSources.reversals, params, blocked);
    voucherReversals = summarizeVoucherRevenuePartial(discountSources, reverts, params, blocked);
    foundIssues.push(...orderRevenue.issues, ...voucherReversals.issues);
    if (previous === blocked.size) break;
  }
  manualVouchers.blockedVoucherKeys.forEach(key => voucherReversals.blockedVoucherKeys.add(key));
  // Preserve original consumption costs cleared by manual restoration. Never
  // add a negative reversal here: wallet profit impact is booked separately.
  const preservedManualRows = manualVouchers.rows.filter(row => {
    const orderId = orderFromKey(row.originalTransactionId);
    return (!orderId || !blocked.has(orderId)) && !voucherReversals.blockedVoucherKeys.has(row.voucherKey) && !voucherReversals.omittedVoucherKinds.has(row.kind);
  });
  voucherReversals.rows.push(...preservedManualRows);
  for (const row of preservedManualRows) {
    if (row.kind === 'coupon') voucherReversals.couponAdjustment = voucherReversals.couponAdjustment.add(row.amount);
    if (row.kind === 'pointshop') voucherReversals.pointShopAdjustment = voucherReversals.pointShopAdjustment.add(row.amount);
    if (row.kind === 'lottery') voucherReversals.lotteryAdjustment = voucherReversals.lotteryAdjustment.add(row.amount);
  }
  const manualAdjustments = summarizeManualAdjustmentRevenue(manualRows, params);
  const issueMap = new Map<string, (typeof foundIssues)[number]>();
  for (const issue of [...foundIssues, ...manualAdjustments.issues]) { const key = JSON.stringify([issue.source, [...issue.ids].sort(), [...issue.orderIds].sort()]); if (!issueMap.has(key)) issueMap.set(key, issue); }
  const issues = [...issueMap.values()];
  if (orderRevenue.commissionUnattributed) issues.push({ source: 'order', ids: [], orderIds: [],
    reason: '异常订单缺少可定位的抽成流水编号；抽成汇总只保留已核实订单与礼物审计部分，无法归属的其他抽成未计入。' });
  const voucherWhere = (kind: 'coupon' | 'pointshop' | 'lottery'): { id?: { in?: string[]; notIn?: string[] } } => {
    if (voucherReversals.omittedVoucherKinds.has(kind)) return { id: { in: [] } };
    const ids = [...voucherReversals.blockedVoucherKeys].filter(key => key.startsWith(`${kind}:`)).map(key => key.slice(kind.length + 1));
    return ids.length ? { id: { notIn: ids } } : {};
  };
  const commissionWhere = orderRevenue.blockedCommissionTransactionIds.size ? { transactionId: { notIn: [...orderRevenue.blockedCommissionTransactionIds] } } : {};
  return { orderRevenue, voucherReversals, manualAdjustments, completeness: reportCompleteness(issues), voucherWhere, commissionWhere,
    commissionUnattributed: orderRevenue.commissionUnattributed };
}
