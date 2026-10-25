import assert from 'node:assert/strict';
import test from 'node:test';
import { Prisma, type OrderDiscountAudit, type IndividualTransaction } from '@prisma/client';
import { summarizeOrderRevenuePartial, type OrderRevenueSourceRow, type OrderRevenueReversalSourceRow } from './admin/order-revenue';
import { summarizeVoucherRevenuePartial } from './admin/voucher-revenue-partial';
import { summarizeManualAdjustmentRevenue, type ManualAdjustmentSource } from './admin/manual-adjustment-revenue';
import { assertReportComplete, reportCompleteness, reportIssueRows, reportStatusRows } from './admin/report-facts';
import { loadRevenueFacts } from './admin/revenue-facts';

const D = (v: string) => new Prisma.Decimal(v);
const params = { start: new Date('2026-10-01Z'), end: new Date('2026-11-01Z') };
const originalAt = new Date('2026-10-10T12:00:00Z');
const reverseAt = new Date('2026-10-15T12:00:00Z');
const order = (id = 'O1'): OrderRevenueSourceRow => ({ orderId: id, auditOrderId: id, auditId: `A-${id}`, paymentTransactionId: `PAY-${id}`,
  orderStatus: 'ENDED', displayNo: 1, endedAt: originalAt, auditCreatedAt: originalAt, gross: D('100'), netAmount: D('80'), feeAmount: D('20'),
  hostId: 'BOSS', workerId: 'WORKER', bossReferralInviterId: null, bossReferralAmount: null, workerReferralInviterId: null, workerReferralAmount: null,
  auditVersion: 1, referralLedgerFacts: null });
const reversal = (id = 'O1'): OrderRevenueReversalSourceRow => ({ ...order(id), revertId: `R-${id}`, originalTransactionId: `ORDER:${id}`,
  revertCreatedAt: reverseAt, revertStatus: 'SUCCESS', details: { orderId: id, gross: '100', netAmount: '80' } });
function discount(id = 'O1') {
  const audit: OrderDiscountAudit = { id: `DA-${id}`, orderId: id, auditVersion: 1, voucherKind: 'coupon', voucherId: `V-${id}`, rebateTransactionId: `IT-${id}`,
    ownerDlmId: 'B', ownerDiscordId: 'BOSS', workerDlmId: 'W', workerDiscordId: 'WORKER', amount: D('10'), rechargeDelta: D('10'),
    voucherIssuedAt: new Date('2026-10-02Z'), voucherExpiresAt: new Date('2026-12-01Z'), consumedAt: originalAt, voucherType: 'DISCOUNT_90', voucherLabel: '折扣券', createdAt: originalAt };
  const original: IndividualTransaction = { transactionId: `IT-${id}`, timeCreatedAt: originalAt, dlmId: 'B', discordId: 'BOSS', thirdPartydiscordId: 'WORKER',
    balanceBefore: D('100'), balanceAfter: D('110'), amountChange: D('10'), typeOfTransaction: '优惠返利' };
  const recovered: IndividualTransaction = { ...original, transactionId: `REV-${id}`, timeCreatedAt: reverseAt, balanceBefore: D('110'), balanceAfter: D('100'), typeOfTransaction: '优惠返利撤销' };
  const revert = { id: `R-${id}`, originalTransactionId: `ORDER:${id}`, createdAt: reverseAt, details: {
    orderId: id, gross: '100', netAmount: '80', discountRollbackAmount: '10',
    discountRollback: { auditId: audit.id, originalTransactionId: original.transactionId, reversalTransactionId: recovered.transactionId,
      amount: '10', status: 'RESTORED', expiresAt: audit.voucherExpiresAt.toISOString(), voucherKind: 'coupon', voucherId: audit.voucherId },
  } };
  return { audit, original, recovered, revert };
}

test('99 valid orders remain visible when one settlement is incomplete; strict error details retained', () => {
  const rows = Array.from({ length: 100 }, (_, index) => order(`O${index}`)); rows[53].netAmount = null;
  const result = summarizeOrderRevenuePartial(rows, [], params);
  assert.equal(result.orderRows.length, 99); assert.equal(result.orderGross.toString(), '9900');
  assert.equal(result.issues.length, 1); assert.deepEqual(result.issues[0].orderIds, ['O53']);
  assert.match(result.issues[0].reason, /结算金额缺失/); assert.deepEqual([...result.blockedCommissionTransactionIds], ['PAY-O53']);
});
test('broken reversal excludes its original and all related postings, preserving unrelated orders', () => {
  const bad = reversal(); bad.details = { orderId: 'O1', gross: '100', netAmount: '79' };
  const result = summarizeOrderRevenuePartial([order(), order('GOOD')], [bad], params);
  assert.deepEqual(result.orderRows.map(row => row.orderId), ['GOOD']); assert.equal(result.revertedOrderRows.length, 0);
  assert.equal(result.orderGrossNet.toString(), '100');
});
test('duplicate original and duplicate reversal candidates are all isolated, regardless of input order', () => {
  for (const rows of [[order(), { ...order(), gross: D('200'), netAmount: D('180') }], [{ ...order(), gross: D('200'), netAmount: D('180') }, order()]]) {
    const result = summarizeOrderRevenuePartial([...rows, order('GOOD')], [], params);
    assert.deepEqual(result.orderRows.map(row => row.orderId), ['GOOD']);
  }
  assert.equal(summarizeOrderRevenuePartial([order()], [reversal(), reversal()], params).orderRows.length, 0);
});
test('shared cross-order receipt conflicts cannot select a trustworthy-looking first row', () => {
  const a = order('A'), b = order('B');
  for (const row of [a, b]) Object.assign(row, { auditVersion: 2, bossReferralInviterId: 'I', bossReferralAmount: D('1'), referralLedgerFacts: { version: 1, boss: { transactionId: 'SAME' }, worker: null } });
  const result = summarizeOrderRevenuePartial([a, b, order('GOOD')], [], params);
  assert.deepEqual(result.orderRows.map(row => row.orderId), ['GOOD']); assert.deepEqual(new Set(result.issues[0].orderIds), new Set(['A', 'B']));
});
test('cross-month reversal keeps only the valid actual-period reversal, with original fact reference', () => {
  const row = reversal(); row.auditCreatedAt = new Date('2026-09-28Z'); row.endedAt = row.auditCreatedAt;
  const result = summarizeOrderRevenuePartial([], [row], params);
  assert.equal(result.orderRows.length, 0); assert.equal(result.revertedOrderRows.length, 1); assert.equal(result.orderGrossNet.toString(), '-100');
});
test('mixed good and bad discount pairs exclude both sides and live voucher for the bad group', () => {
  const good = discount('GOOD'), bad = discount('BAD'); bad.recovered.balanceAfter = D('103');
  const result = summarizeVoucherRevenuePartial({ audits: [good.audit, bad.audit], receipts: [good.original, good.recovered, bad.original, bad.recovered], live: new Map() }, [good.revert, bad.revert], params);
  assert.deepEqual(result.discountRebateRows.map(row => row.transactionId), ['IT-GOOD', 'REV-GOOD']); assert.equal(result.rows.length, 2);
  assert.equal(result.discountNetAmount.toString(), '0'); assert(result.blockedVoucherKeys.has('coupon:V-BAD')); assert(result.blockedOrderIds.has('BAD'));
});
test('duplicate discount evidence or duplicate receipt rows reject entire connected lifecycle', () => {
  const f = discount();
  for (const variant of ['revert', 'receipt'] as const) {
    const result = summarizeVoucherRevenuePartial({ audits: [f.audit], receipts: [f.original, f.recovered, ...(variant === 'receipt' ? [f.original] : [])], live: new Map() },
      [f.revert, ...(variant === 'revert' ? [{ ...f.revert, id: 'R-OTHER' }] : [])], params);
    assert.equal(result.rows.length, 0); assert.equal(result.discountRebateRows.length, 0); assert.equal(result.issues.length, 1);
  }
});
test('malformed legacy voucher amount is a scoped issue instead of losing the report or guessing zero', () => {
  const legacy = { id: 'R-LEGACY', originalTransactionId: 'ORDER:BAD', createdAt: reverseAt,
    details: { voucherRollbacks: [{ kind: 'coupon', issuedAt: '2026-10-02Z', consumedAt: originalAt.toISOString(), amount: 'broken' }] } };
  const result = summarizeVoucherRevenuePartial({ audits: [], receipts: [], live: new Map() }, [legacy], params);
  assert(result.issues.length >= 1); assert(result.omittedVoucherKinds.has('coupon')); assert.equal(result.rows.length, 0);
});
test('unrelated unidentified rollback never retains only one side of a validated discount pair', () => {
  const f = discount();
  const unknown = { id: 'UNKNOWN', originalTransactionId: 'ORDER:UNKNOWN', createdAt: reverseAt, details: { couponIds: ['unknown'] } };
  const result = summarizeVoucherRevenuePartial({ audits: [f.audit], receipts: [f.original, f.recovered], live: new Map() }, [f.revert, unknown], params);
  assert.equal(result.discountRebateRows.length, 2); assert.equal(result.discountNetAmount.toString(), '0'); assert.equal(result.rows.length, 0);
});
function manual(deltas: string[], reporting: Record<string, string | null> = { grossDelta: '-100', payoutDelta: '-75', referralDelta: '0', discountDelta: '0' }): ManualAdjustmentSource {
  return { id: 'MANUAL1', originalTransactionId: 'ORDER:OLD', status: 'MANUAL_ADJUSTED', createdAt: reverseAt, details: { version: 1, mode: 'LEGACY_MANUAL_ADJUSTMENT',
    source: { kind: 'ORDER', canonicalKey: 'ORDER:OLD', createdAt: '2026-09-28T00:00:00.000Z' }, reporting,
    result: { wallets: deltas.map((delta, index) => ({ dlmId: `D${index}`, transactionId: `ITMA${index}`, incomeDelta: delta, rechargeDelta: '0',
      before: { income: '100', recharge: '0', totalBalance: '100' }, after: { income: D('100').add(delta).toString(), recharge: '0', totalBalance: D('100').add(delta).toString() } })) } } };
}
test('manual wallet +100/-75 affects profit -25 once, in actual month, without cash-flow posting', () => {
  const result = summarizeManualAdjustmentRevenue([manual(['100', '-75'])], params);
  assert.equal(result.walletNetDelta.toString(), '25'); assert.equal(result.profitDelta.toString(), '-25'); assert.equal(result.issues.length, 0);
  assert.equal(result.rows[0].grossDelta, '-100'); assert.equal(result.rows[0].originalCreatedAt, '2026-09-28T00:00:00.000Z');
  assert.equal(summarizeManualAdjustmentRevenue([manual(['100', '-75'])], { start: new Date('2026-09-01Z'), end: params.start }).rows.length, 0);
});
test('manual transfer with zero wallet net has no profit effect', () => {
  const result = summarizeManualAdjustmentRevenue([manual(['100', '-100'], { grossDelta: '0', payoutDelta: '0', referralDelta: '0', discountDelta: '0' })], params);
  assert.equal(result.profitDelta.toString(), '0'); assert.equal(result.issues.length, 0);
});
test('missing or unbalanced manual classification retains proven wallet impact but blocks confirmation', () => {
  for (const grossDelta of [null, '-90']) {
    const result = summarizeManualAdjustmentRevenue([manual(['100', '-75'], { grossDelta, payoutDelta: '-75', referralDelta: '0', discountDelta: '0' })], params);
    assert.equal(result.profitDelta.toString(), '-25'); assert.equal(result.issues.length, 1);
    assert.throws(() => assertReportComplete(reportCompleteness(result.issues)), /不能确认/);
    assert.equal(result.rows[0].grossDelta, grossDelta);
  }
});
test('duplicate manual records and reused receipt across different originals are all isolated', () => {
  const row = manual(['100', '-75']);
  for (const other of [row, { ...row, id: 'OTHER', originalTransactionId: 'ORDER:OTHER' }]) {
    const result = summarizeManualAdjustmentRevenue([row, other], params);
    assert.equal(result.rows.length, 0); assert.equal(result.walletNetDelta.toString(), '0'); assert.equal(result.issues.length, 1);
  }
});
test('manual actual balance mismatch is unknown, never booked using command deltas alone', () => {
  const row = manual(['100', '-75']); (row.details as any).result.wallets[0].after.income = '201';
  const result = summarizeManualAdjustmentRevenue([row], params); assert.equal(result.rows.length, 0); assert.equal(result.issues.length, 1);
});
test('unified loader propagates bad discount group into original order and commission exclusion', async () => {
  const f = discount('BAD'); f.recovered.balanceAfter = D('101');
  const client = { $queryRaw: async (sql: Prisma.Sql) => sql.text.includes('FROM "revert" r') ? [reversal('BAD')] : [order('BAD'), order('GOOD')],
    revert: { findMany: async (args: any) => args.where.status === 'SUCCESS' ? [f.revert] : [] }, orderDiscountAudit: { findMany: async () => [f.audit] },
    individualTransaction: { findMany: async () => [f.original, f.recovered] }, coupon: { findMany: async () => [] }, pointShopGrant: { findMany: async () => [] }, lotteryDraw: { findMany: async () => [] } };
  const result = await loadRevenueFacts(client as any, params);
  assert.deepEqual(result.orderRevenue.orderRows.map(row => row.orderId), ['GOOD']); assert.equal(result.orderRevenue.revertedOrderRows.length, 0);
  assert.deepEqual(result.voucherWhere('coupon'), { id: { notIn: ['V-BAD'] } }); assert.deepEqual(result.commissionWhere, { transactionId: { notIn: ['PAY-BAD'] } });
  assert.equal(result.completeness.complete, false); assert(reportIssueRows(result.completeness).some(row => row.reason.includes('流水金额或方向')));
  assert.equal(reportStatusRows(result.completeness)[0].value, '不完整：仅已核实部分，不是完整总账');
});
test('database query failures are not disguised as a partially verified report', async () => {
  const client = { $queryRaw: async () => { throw new Error('offline unavailable'); }, revert: { findMany: async () => [] } };
  await assert.rejects(loadRevenueFacts(client as any, params), /offline unavailable/);
});

test('an invalid old use cannot hide a verified later use of the same restored voucher', () => {
  const old = discount('OLD'), current = discount('CURRENT');
  old.recovered.balanceAfter = D('103');
  current.audit.voucherId = old.audit.voucherId;
  current.audit.consumedAt = new Date('2026-10-20T12:00:00Z');
  current.original.timeCreatedAt = current.audit.consumedAt;
  current.recovered.timeCreatedAt = current.revert.createdAt = new Date('2026-10-22T12:00:00Z');
  current.revert.details.discountRollback.voucherId = old.audit.voucherId;
  const live = new Map([[`coupon:${old.audit.voucherId}`, { issuedAt: current.audit.voucherIssuedAt, status: 'USED', consumedAt: current.audit.consumedAt,
    amount: D('10'), orderId: current.audit.orderId, dlmId: 'B' }]]);
  const result = summarizeVoucherRevenuePartial({ audits: [old.audit, current.audit], receipts: [old.original, old.recovered, current.original, current.recovered], live }, [old.revert, current.revert], params);
  assert.deepEqual(result.discountRebateRows.map(row => row.transactionId), ['IT-CURRENT', 'REV-CURRENT']);
  assert.deepEqual([...result.blockedOrderIds], ['OLD']);
  assert.equal(result.blockedVoucherKeys.has(`coupon:${old.audit.voucherId}`), false);
  assert.equal(result.rows.length, 1); assert.equal(result.rows[0].amount.toString(), '-10');
});
