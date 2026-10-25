import assert from 'node:assert/strict';
import test from 'node:test';
import { Prisma } from '@prisma/client';
import { summarizeManualVoucherRevenue } from './admin/manual-voucher-revenue';
import { summarizeManualAdjustmentRevenue, type ManualAdjustmentSource } from './admin/manual-adjustment-revenue';
import type { DiscountLiveVoucher } from './admin/discount-revenue';

const D = (value: string) => new Prisma.Decimal(value);
const october = { start: new Date('2026-10-01Z'), end: new Date('2026-11-01Z') };
const november = { start: october.end, end: new Date('2026-12-01Z') };
const issuedAt = new Date('2026-10-02Z'), consumedAt = new Date('2026-10-10Z');
function fixture(model: 'coupon' | 'lotteryDraw' | 'pointShopGrant' = 'coupon', when = new Date('2026-10-15Z')) {
  const before = { id: 'V1', dlmId: 'B', issuedAt: issuedAt.toISOString(), createdAt: issuedAt.toISOString(),
    status: 'USED', couponStatus: 'USED', consumedAt: consumedAt.toISOString(), consumeAt: consumedAt.toISOString(), consumeAmount: '20',
    orderId: 'O1', consumeOrderId: 'O1', deliveryType: 'COUPON', deliveryStatus: 'DELIVERED' };
  const record: ManualAdjustmentSource = { id: 'M1', originalTransactionId: 'ORDER:O1', status: 'MANUAL_ADJUSTED', createdAt: when,
    details: { version: 1, mode: 'LEGACY_MANUAL_ADJUSTMENT', source: { canonicalKey: 'ORDER:O1', createdAt: '2026-10-10T00:00:00Z' },
      result: { vouchers: [{ model, id: 'V1', owner: { dlmId: 'B' }, before }], wallets: [
        { dlmId: 'B', transactionId: 'ITMA1', incomeDelta: '80', rechargeDelta: '0', before: { income: '100', recharge: '0', totalBalance: '100' }, after: { income: '180', recharge: '0', totalBalance: '180' } },
        { dlmId: 'W', transactionId: 'ITMA2', incomeDelta: '-75', rechargeDelta: '0', before: { income: '100', recharge: '0', totalBalance: '100' }, after: { income: '25', recharge: '0', totalBalance: '25' } },
      ] }, reporting: { grossDelta: '-80', payoutDelta: '-75', referralDelta: '0', discountDelta: '0' } } };
  const current: DiscountLiveVoucher = { issuedAt, consumedAt: null, status: 'ACTIVE', amount: null, orderId: null, dlmId: 'B' };
  const key = model === 'coupon' ? 'coupon:V1' : model === 'pointShopGrant' ? 'pointshop:V1' : 'lottery:V1';
  return { record, before, current, key };
}
test('same-month manual restoration retains original voucher expense; profit -walletNet is not repeated as voucher reversal', () => {
  for (const model of ['coupon', 'pointShopGrant', 'lotteryDraw'] as const) {
    const f = fixture(model); const cost = summarizeManualVoucherRevenue([f.record], new Map([[f.key, f.current]]), october);
    const manual = summarizeManualAdjustmentRevenue([f.record], october);
    assert.equal(cost.issues.length, 0); assert.equal(cost.rows.length, 1); assert.equal(cost.rows[0].amount.toString(), '20');
    assert.equal(cost.rows[0].phase, 'original'); assert.equal(manual.profitDelta.toString(), '-5');
    assert.equal(D('25').sub(cost.rows[0].amount).add(manual.profitDelta).toString(), '0');
  }
});
test('cross-month manual restoration preserves October expense and only posts actual wallet profit effect in November', () => {
  const f = fixture('coupon', new Date('2026-11-05Z')); const live = new Map([[f.key, f.current]]);
  assert.equal(summarizeManualVoucherRevenue([f.record], live, october).rows[0].amount.toString(), '20');
  assert.equal(summarizeManualAdjustmentRevenue([f.record], october).profitDelta.toString(), '0');
  assert.equal(summarizeManualVoucherRevenue([f.record], live, november).rows.length, 0);
  assert.equal(summarizeManualAdjustmentRevenue([f.record], november).profitDelta.toString(), '-5');
});
test('a later consumption of the same restored voucher stays separate from the preserved original cost', () => {
  const f = fixture(); f.current = { ...f.current, consumedAt: new Date('2026-10-21Z'), status: 'USED', amount: D('7'), orderId: 'O2' };
  const result = summarizeManualVoucherRevenue([f.record], new Map([[f.key, f.current]]), october);
  assert.equal(result.rows[0].amount.toString(), '20'); assert.equal(f.current.amount!.add(result.rows[0].amount).toString(), '27');
});
test('the exact original consumption still present in live fields is not added twice', () => {
  const f = fixture(); f.current = { ...f.current, consumedAt, status: 'USED', amount: D('20'), orderId: 'O1' };
  assert.equal(summarizeManualVoucherRevenue([f.record], new Map([[f.key, f.current]]), october).rows.length, 0);
});
test('duplicate or incomplete manual voucher receipts become explicit gaps without guessing costs', () => {
  const f = fixture(); const live = new Map([[f.key, f.current]]);
  const duplicate = summarizeManualVoucherRevenue([f.record, f.record], live, october);
  assert.equal(duplicate.rows.length, 0); assert.equal(duplicate.issues.length, 1);
  (f.before as any).consumeAmount = null;
  const incomplete = summarizeManualVoucherRevenue([f.record], live, october);
  assert.equal(incomplete.rows.length, 0); assert.equal(incomplete.issues.length, 1); assert(incomplete.blockedVoucherKeys.has('coupon:V1'));
});

test('manual original cost follows both DLM and source-specific Discord exclusions, including legacy null DLM', () => {
  for (const model of ['coupon', 'lotteryDraw', 'pointShopGrant'] as const) {
    const f = fixture(model); const row = f.before as any;
    row.dlmId = null;
    row[model === 'coupon' ? 'discordId' : model === 'lotteryDraw' ? 'userId' : 'discordUserId'] = 'old-discord';
    const live = new Map([[f.key, f.current]]);
    assert.equal(summarizeManualVoucherRevenue([f.record], live, { ...october, excludeDiscordIds: ['old-discord'] }).rows.length, 0);
    const entry = (f.record.details as any).result.vouchers[0]; entry.owner.discordId = 'current-discord';
    assert.equal(summarizeManualVoucherRevenue([f.record], live, { ...october, excludeDiscordIds: ['current-discord'] }).rows.length, 0);
    assert.equal(summarizeManualVoucherRevenue([f.record], live, { ...october, excludeDlmIds: ['B'] }).rows.length, 0);
    assert.equal(summarizeManualVoucherRevenue([f.record], live, { ...october, excludeDiscordIds: ['unrelated'] }).rows.length, 1);
  }
});
