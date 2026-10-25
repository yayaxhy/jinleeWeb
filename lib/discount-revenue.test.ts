import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { Prisma, type IndividualTransaction, type OrderDiscountAudit } from '@prisma/client';
import { DiscountRevenueFactsError, loadDiscountRevenue } from './admin/discount-revenue';
import { getVoucherReversalAdjustments } from './admin/voucher-reversal';

const D = (value: string) => new Prisma.Decimal(value);
const october = { start: new Date('2026-10-01Z'), end: new Date('2026-11-01Z') };
const november = { start: october.end, end: new Date('2026-12-01Z') };
const consumedAt = new Date('2026-10-10T12:00:00Z');
const reversedAt = new Date('2026-11-05T12:00:00Z');

function fixture(kind: 'coupon' | 'pointshop' | 'lottery' = 'coupon') {
  const audit: OrderDiscountAudit = {
    id: 'DA1', orderId: 'O1', auditVersion: 1, voucherKind: kind, voucherId: 'V1', rebateTransactionId: 'IT1',
    ownerDlmId: 'OLD-DLM', ownerDiscordId: 'BOSS', workerDlmId: 'WORKER-DLM', workerDiscordId: 'WORKER',
    amount: D('10'), rechargeDelta: D('10'), voucherIssuedAt: new Date('2026-10-02Z'),
    voucherExpiresAt: new Date('2026-12-01Z'), consumedAt, voucherType: 'DISCOUNT_90', voucherLabel: '九折券', createdAt: consumedAt,
  };
  const original: IndividualTransaction = { transactionId: 'IT1', timeCreatedAt: consumedAt, discordId: 'BOSS', dlmId: 'CURRENT-DLM',
    thirdPartydiscordId: 'WORKER', balanceBefore: D('100'), balanceAfter: D('110'), amountChange: D('10'), typeOfTransaction: '优惠返利' };
  const recovered: IndividualTransaction = { ...original, transactionId: 'IT2', discordId: 'CURRENT-BOSS', timeCreatedAt: reversedAt,
    balanceBefore: D('200'), balanceAfter: D('190'), typeOfTransaction: '优惠返利撤销' };
  const rollback = { auditId: 'DA1', originalTransactionId: 'IT1', reversalTransactionId: 'IT2', amount: '10',
    status: 'RESTORED', expiresAt: audit.voucherExpiresAt.toISOString(), voucherKind: kind, voucherId: 'V1' };
  const revert = { id: 'R1', originalTransactionId: 'ORDER:O1', createdAt: reversedAt,
    details: { discountRollbackAmount: '10', discountRollback: rollback } as Record<string, unknown> };
  const state = { audits: [audit], receipts: [original, recovered], reverts: [revert],
    live: { id: 'V1', issuedAt: audit.voucherIssuedAt, createdAt: audit.voucherIssuedAt,
      status: 'ACTIVE', couponStatus: 'ACTIVE', deliveryType: 'COUPON', deliveryStatus: 'DELIVERED', consumedAt: null as Date | null,
      consumeAt: null as Date | null, consumeAmount: null as Prisma.Decimal | null,
      orderId: null as string | null, consumeOrderId: null as string | null, dlmId: 'VOUCHER-NEW-OWNER' } };
  const client = {
    revert: { findMany: async (args: { where: unknown }) => {
      assert.deepEqual(args.where, { status: 'SUCCESS', createdAt: { gt: new Date('2026-09-25T19:26:50.956Z') } });
      return state.reverts;
    } },
    orderDiscountAudit: { findMany: async () => state.audits },
    individualTransaction: { findMany: async (args: { where: { OR: object[] } }) => {
      assert.equal(args.where.OR.length, 2); // period ledger OR exact cross-period receipt IDs
      return state.receipts;
    } },
    coupon: { findMany: async () => kind === 'coupon' ? [state.live] : [] },
    pointShopGrant: { findMany: async () => kind === 'pointshop' ? [state.live] : [] },
    lotteryDraw: { findMany: async () => kind === 'lottery' ? [state.live] : [] },
  } as unknown as Parameters<typeof loadDiscountRevenue>[0] & Parameters<typeof getVoucherReversalAdjustments>[1];
  return { state, client, audit, original, recovered, revert, rollback };
}

test('production voucher loader preserves original October coupon cost and original rebate after November reversal', async () => {
  const f = fixture();
  const report = await getVoucherReversalAdjustments(october, f.client);
  assert.equal(report.couponAdjustment.toString(), '10');
  assert.equal(report.discountOriginalAmount.toString(), '10');
  assert.equal(report.discountRecoveredAmount.toString(), '0');
  assert.equal(report.discountNetAmount.toString(), '10');
  assert.equal(report.rows[0].source, '订单折扣审计调整');
});

test('production loader posts only the recovery and negative coupon cost in November', async () => {
  const f = fixture();
  const report = await getVoucherReversalAdjustments(november, f.client);
  assert.equal(report.couponAdjustment.toString(), '-10');
  assert.equal(report.discountOriginalAmount.toString(), '0');
  assert.equal(report.discountRecoveredAmount.toString(), '10');
  assert.equal(report.discountNetAmount.toString(), '-10');
  assert.equal(report.discountRebateRows[0].amountChange.toString(), '10');
  assert.equal(report.discountRebateRows[0].signedAmount.toString(), '-10');
});

test('same-period original and reversal net to zero once for coupon, pointshop and lottery', async () => {
  for (const kind of ['coupon', 'pointshop', 'lottery'] as const) {
    const f = fixture(kind);
    const report = await getVoucherReversalAdjustments({ start: october.start, end: november.end }, f.client);
    assert.equal(report.discountNetAmount.toString(), '0');
    assert.equal(report.couponAdjustment.add(report.pointShopAdjustment).add(report.lotteryAdjustment).toString(), '0');
    assert.equal(report.rows.length, 2);
  }
});

test('a later use of the same voucher remains a separate lifecycle from the restored original cost', async () => {
  const f = fixture();
  f.state.live = { ...f.state.live, status: 'USED', consumedAt: new Date('2026-11-10Z'), consumeAmount: D('7'), orderId: 'O2' };
  const old = await getVoucherReversalAdjustments(october, f.client);
  const next = await getVoucherReversalAdjustments(november, f.client);
  assert.equal(old.couponAdjustment.toString(), '10');
  assert.equal(next.couponAdjustment.toString(), '-10');
  assert.equal(D('7').add(next.couponAdjustment).toString(), '-3'); // actual live cost + this historical adjustment
});

test('an exact live consumption is not added again; different kind with same ID cannot deduplicate it', async () => {
  for (const kind of ['coupon', 'pointshop', 'lottery'] as const) {
    const f = fixture(kind);
    f.state.live = { ...f.state.live, status: 'USED', couponStatus: 'USED', consumedAt, consumeAt: consumedAt,
      consumeAmount: D('10'), orderId: 'O1', consumeOrderId: 'O1' };
    const report = await getVoucherReversalAdjustments(october, f.client);
    assert.equal(report.rows.length, 0);
    f.state.live.consumeAmount = D('9');
    await assert.rejects(getVoucherReversalAdjustments(october, f.client), /当前券与原消费/);
  }
});

test('same pointshop lifecycle must satisfy the actual report delivery and issue-date predicates before deduplication', async () => {
  for (const invalid of ['PENDING', 'FAILED', 'ISSUED_BEFORE_CUTOVER']) {
    const f = fixture('pointshop');
    f.state.live = { ...f.state.live, couponStatus: 'USED', consumedAt, consumeAmount: D('10'), consumeOrderId: 'O1' };
    if (invalid === 'ISSUED_BEFORE_CUTOVER') f.state.live.issuedAt = new Date('2026-09-01Z');
    else f.state.live.deliveryStatus = invalid;
    await assert.rejects(getVoucherReversalAdjustments(october, f.client), /当前券与原消费/);
  }
});

test('matching new and generic evidence counts one lifecycle; missing IDs or mismatches are refused', async () => {
  const f = fixture();
  const generic = { kind: 'coupon', voucherId: 'V1', issuedAt: f.audit.voucherIssuedAt.toISOString(), consumedAt: consumedAt.toISOString(), amount: '10' };
  f.revert.details.voucherRollbacks = [generic];
  assert.equal((await getVoucherReversalAdjustments(october, f.client)).couponAdjustment.toString(), '10');
  for (const row of [{ ...generic, voucherId: undefined }, { ...generic, amount: '9' }, { ...generic, kind: 'lottery' }]) {
    f.revert.details.voucherRollbacks = [row];
    await assert.rejects(getVoucherReversalAdjustments(october, f.client), DiscountRevenueFactsError);
  }
});

test('duplicate reversal markers and duplicate generic entries cannot double subtract', async () => {
  const f = fixture();
  f.state.reverts.push({ ...f.revert, id: 'R2' });
  await assert.rejects(getVoucherReversalAdjustments(november, f.client), /重复折扣/);
  f.state.reverts.pop();
  const generic = { kind: 'coupon', voucherId: 'V1', issuedAt: f.audit.voucherIssuedAt.toISOString(), consumedAt: consumedAt.toISOString(), amount: '10' };
  f.revert.details.voucherRollbacks = [generic, generic];
  await assert.rejects(getVoucherReversalAdjustments(november, f.client), /重复旧券/);
});

test('expired voucher reversal recovers the original cost without treating it as usable again', async () => {
  const f = fixture();
  f.audit.voucherExpiresAt = new Date('2026-10-20Z');
  f.rollback.expiresAt = f.audit.voucherExpiresAt.toISOString();
  f.rollback.status = 'EXPIRED';
  f.state.live.status = 'EXPIRED';
  const report = await getVoucherReversalAdjustments(november, f.client);
  assert.equal(report.couponAdjustment.toString(), '-10');
  f.rollback.status = 'RESTORED';
  await assert.rejects(getVoucherReversalAdjustments(november, f.client), /生命周期/);
});

test('missing audit, either receipt or wrong signed wallet movement fails closed', async () => {
  for (const mutation of [
    (f: ReturnType<typeof fixture>) => { f.state.audits = []; },
    (f: ReturnType<typeof fixture>) => { f.state.receipts = [f.recovered]; },
    (f: ReturnType<typeof fixture>) => { f.state.receipts = [f.original]; },
    (f: ReturnType<typeof fixture>) => { f.recovered.balanceAfter = D('210'); },
    (f: ReturnType<typeof fixture>) => { f.original.balanceAfter = D('100'); },
    (f: ReturnType<typeof fixture>) => { f.rollback.amount = '9'; },
  ]) {
    const f = fixture(); mutation(f);
    await assert.rejects(getVoucherReversalAdjustments(november, f.client), DiscountRevenueFactsError);
  }
});

test('orphan recovery ledger and legacy positive discount reversal with no audit do not silently vanish', async () => {
  const f = fixture();
  f.state.reverts = [];
  await assert.rejects(getVoucherReversalAdjustments(november, f.client), /缺少成功撤销/);
  f.state.receipts = [f.original];
  f.state.reverts = [{ ...f.revert, details: { discountRollbackAmount: '10' } }];
  await assert.rejects(getVoucherReversalAdjustments(november, f.client), /旧撤销记录/);
});

test('current receipt owner can differ from historical audit after merge; unrelated recovery owner fails', async () => {
  const f = fixture();
  assert.notEqual(f.audit.ownerDlmId, f.original.dlmId);
  assert.equal((await getVoucherReversalAdjustments(november, f.client)).discountRecoveredAmount.toString(), '10');
  f.recovered.dlmId = 'WRONG';
  await assert.rejects(getVoucherReversalAdjustments(november, f.client), /归属或时间/);
});

test('voucher exclusion applies to original rebate wallet without suppressing unfiltered rebate summary', async () => {
  const f = fixture();
  const report = await getVoucherReversalAdjustments({ ...november, excludeDlmIds: ['CURRENT-DLM'] }, f.client);
  assert.equal(report.rows.length, 0);
  assert.equal(report.discountNetAmount.toString(), '-10');
});

test('rebate recovery is assigned by actual debit ledger time, not positive amountChange or marker time', async () => {
  const f = fixture();
  f.revert.createdAt = new Date('2026-10-31T23:59:59.999Z');
  const octoberReport = await getVoucherReversalAdjustments(october, f.client);
  const novemberReport = await getVoucherReversalAdjustments(november, f.client);
  assert.equal(octoberReport.discountNetAmount.toString(), '10');
  assert.equal(novemberReport.discountNetAmount.toString(), '-10');
});

test('live query failure cannot turn missing voucher data into a guessed adjustment', async () => {
  const f = fixture();
  f.client.coupon.findMany = (() => { throw new Error('offline fixture unavailable'); }) as typeof f.client.coupon.findMany;
  await assert.rejects(getVoucherReversalAdjustments(october, f.client), /fixture unavailable/);
});

test('three production reports consume signed rebate and unified coupon recovery exactly once', () => {
  for (const file of ['lib/admin/monthly-financial-reports.ts', 'app/api/admin/revenue/export/route.ts', 'app/admin/revenue/page.tsx']) {
    const source = readFileSync(file, 'utf8');
    assert.match(source, /loadRevenueFacts\(/);
    assert.match(source, /discountNetAmount/);
    assert.match(source, /voucherReversals\.lotteryAdjustment/);
    assert.match(source, /voucherReversals\.pointShopAdjustment/);
    assert.match(source, /当期优惠返利追回/);
    assert.doesNotMatch(source, /discountRebateWhere|discountRebateAgg/);
  }
});
