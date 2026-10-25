import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { Prisma } from '@prisma/client';
import {
  loadOrderRevenue, OrderRevenueFactsError, summarizeOrderRevenue,
  type OrderRevenueSourceRow, type OrderRevenueReversalSourceRow,
} from './admin/order-revenue';

const D = (value: string) => new Prisma.Decimal(value);
const october = { start: new Date('2026-10-01T00:00:00Z'), end: new Date('2026-11-01T00:00:00Z') };
const november = { start: october.end, end: new Date('2026-12-01T00:00:00Z') };
const source = (overrides: Partial<OrderRevenueSourceRow> = {}): OrderRevenueSourceRow => ({
  orderId: 'O1', orderStatus: 'ENDED', displayNo: 1, endedAt: new Date('2026-10-10T12:00:00Z'),
  auditId: 'A1', auditOrderId: 'O1', auditCreatedAt: new Date('2026-10-10T12:00:00Z'),
  gross: D('100'), netAmount: D('80'), feeAmount: D('20'), hostId: 'HOST', workerId: 'WORKER',
  bossReferralInviterId: 'INVITER', bossReferralAmount: D('2'),
  workerReferralInviterId: null, workerReferralAmount: null,
  auditVersion: 2, referralLedgerFacts: { version: 1, boss: { transactionId: 'IT-REF-1' }, worker: null },
  ...overrides,
});
const reversal = (audit = source(), overrides: Partial<OrderRevenueReversalSourceRow> = {}): OrderRevenueReversalSourceRow => ({
  ...audit, revertId: 'R1', originalTransactionId: 'ORDER:O1', revertCreatedAt: new Date('2026-10-11T12:00:00Z'), revertStatus: 'SUCCESS',
  details: { orderId: 'O1', gross: '100', netAmount: '80', referralRollbacks: [{
    kind: 'boss', originalTransactionId: 'IT-REF-1', originalInviterId: 'INVITER', amount: '2',
    // Current owner may have changed after a DLM merge. Exclusion follows the
    // original inviter for both postings, never today's Discord binding.
    dlmId: 'NEW-DLM', discordUserId: 'NEW-OWNER', reversalTransactionId: 'IT-REV-1',
  }] }, ...overrides,
});
const noReferral = (): OrderRevenueSourceRow => source({
  bossReferralInviterId: null, bossReferralAmount: null,
  referralLedgerFacts: { version: 1, boss: null, worker: null },
});

/** Executes the real production loader. The injected boundary returns only
 * the joined facts; it cannot fetch a database or payment provider. */
async function load(originals: OrderRevenueSourceRow[], reversals: OrderRevenueReversalSourceRow[], params = october) {
  const calls: Prisma.Sql[] = [];
  const result = await loadOrderRevenue({
    async $queryRaw<T>(query: Prisma.Sql): Promise<T> {
      calls.push(query);
      const sql = query.text;
      assert.doesNotMatch(sql, /"ReferralPayout"|o\."grossAmount"|o\."netAmount"/);
      assert.deepEqual(query.values.slice(-2), [params.start, params.end]);
      if (sql.includes('FROM "revert" r')) {
        assert.match(sql, /LEFT JOIN "order_audit"/);
        assert.match(sql, /r\."status" = 'SUCCESS'/);
        assert.match(sql, /r\."originalTransactionId" LIKE 'ORDER:%'/);
        assert.match(sql, /r\."createdAt" >=/);
        return reversals as T;
      }
      assert.match(sql, /FULL OUTER JOIN "Order"/);
      assert.match(sql, /oa\."createdAt" >=/);
      assert.match(sql, /o\."status" = 'ENDED'/);
      return originals as T;
    },
  }, params);
  assert.equal(calls.length, 2);
  return result;
}

test('production loader keeps original facts and reverses exactly once in the same month', async () => {
  const result = await load([source()], [reversal()]);
  assert.equal(result.orderGross.toString(), '100');
  assert.equal(result.orderNet.toString(), '80');
  assert.equal(result.orderFee.toString(), '20');
  assert.equal(result.revertedOrderGross.toString(), '100');
  assert.equal(result.revertedOrderNet.toString(), '80');
  assert.equal(result.revertedOrderFee.toString(), '20');
  assert.equal(result.orderGrossNet.toString(), '0');
  assert.equal(result.orderNetNet.toString(), '0');
  assert.equal(result.orderFeeNet.toString(), '0');
  assert.equal(result.referralExpense.amount.toString(), '0');
  assert.deepEqual(result.referralRows.map((row) => [row.phase, row.amount.toString()]), [['original', '2'], ['reversal', '-2']]);
  assert.equal(result.referralExpense.count, 2);
});

test('a cross-month reversal leaves October earned income and original referral expense unchanged', async () => {
  const later = reversal(source(), { revertCreatedAt: new Date('2026-11-05T12:00:00Z') });
  const before = await load([source()], []);
  // Defensive filtering also rejects an out-of-window reversal from an adapter.
  const after = await load([source()], [later]);
  assert.deepEqual(after, before);
  assert.equal(after.orderFeeNet.toString(), '20');
  assert.equal(after.referralExpense.amount.toString(), '2');
});

test('November reports only the October reversal and referral recovery, even after payout deletion', async () => {
  const result = await load([], [reversal(source(), { revertCreatedAt: new Date('2026-11-05T12:00:00Z') })], november);
  assert.equal(result.orderRows.length, 0);
  assert.equal(result.orderGrossNet.toString(), '-100');
  assert.equal(result.orderNetNet.toString(), '-80');
  assert.equal(result.orderFeeNet.toString(), '-20');
  assert.equal(result.referralExpense.amount.toString(), '-2');
  assert.equal(result.referralRows[0].originalTransactionId, 'IT-REF-1');
  assert.equal(result.referralRows[0].reversalTransactionId, 'IT-REV-1');
});

test('original audit time assigns settlement to one month even if mutable Order endedAt differs', async () => {
  const audit = source({ endedAt: november.start });
  const old = await load([audit], []);
  const next = await load([audit], [], november);
  assert.equal(old.orderFee.toString(), '20');
  assert.equal(next.orderFee.toString(), '0');
});

test('PENDING and FAILED markers never create a financial reversal', async () => {
  const result = await load([source()], [reversal(source(), { revertStatus: 'PENDING' }), reversal(source(), { revertStatus: 'FAILED' })]);
  assert.equal(result.orderFeeNet.toString(), '20');
  assert.equal(result.referralExpense.amount.toString(), '2');
});

test('duplicate success markers block reporting rather than double-subtracting', async () => {
  await assert.rejects(load([source()], [reversal(), reversal(source(), { revertId: 'R2' })]), /重复.*撤销标记/);
});

test('a completed order without an audit blocks instead of interpreting cleared money as zero', async () => {
  await assert.rejects(load([source({ auditId: null, auditOrderId: null, gross: null, netAmount: null, feeAmount: null })], []), OrderRevenueFactsError);
});

test('an orphan success marker is visible through the left join and blocks reporting', async () => {
  await assert.rejects(load([], [reversal(source({ auditId: null, auditOrderId: null, orderId: null }))]), /缺少原结算审计/);
});

test('legacy explicit absent referral pairs remain reportable without inventing receipt history', async () => {
  const audit = { ...noReferral(), auditVersion: 1, referralLedgerFacts: null };
  const result = await load([audit], [reversal(audit, { details: { orderId: 'O1', gross: '100', netAmount: '80' } })]);
  assert.equal(result.referralRows.length, 0);
  assert.equal(result.orderFeeNet.toString(), '0');
});

test('legacy positive referrals retain the original expense without depending on current payout records', async () => {
  const result = await load([source({ auditVersion: 1, referralLedgerFacts: null })], []);
  assert.equal(result.referralExpense.amount.toString(), '2');
  assert.equal(result.referralRows[0].originalTransactionId, null);
});

test('legacy positive referral reversal without actual clawback receipt blocks, never assumes full recovery', async () => {
  const audit = source({ auditVersion: 1, referralLedgerFacts: null });
  await assert.rejects(load([], [reversal(audit, { details: { orderId: 'O1', gross: '100', netAmount: '80' } })]), /实际返佣撤回凭据/);
});

test('one missing referral fact, a mismatched amount or non-finite amount blocks the report', async () => {
  for (const audit of [source({ bossReferralAmount: null }), source({ bossReferralInviterId: null }), source({ feeAmount: D('19') }), source({ gross: D('NaN') })]) {
    await assert.rejects(load([audit], []), OrderRevenueFactsError);
  }
});

test('unknown audit versions and v2 missing zero-award receipts fail closed', async () => {
  for (const audit of [source({ auditVersion: 3 }), source({ auditVersion: null }),
    source({ referralLedgerFacts: { version: 9, boss: { transactionId: 'IT-REF-1' }, worker: null } }),
    { ...noReferral(), referralLedgerFacts: null },
    { ...noReferral(), referralLedgerFacts: { version: 1, boss: null } },
  ]) {
    await assert.rejects(load([audit], []), OrderRevenueFactsError);
  }
});

test('mismatched reversal amounts and missing details are rejected', async () => {
  for (const details of [null, { orderId: 'O1', gross: '0', netAmount: '80' }]) {
    await assert.rejects(load([], [reversal(source(), { details })]), OrderRevenueFactsError);
  }
});

test('v2 receipt mismatch and duplicate rollback entries block rather than synthesizing recovery', async () => {
  const original = reversal();
  const details = original.details as { referralRollbacks: Array<Record<string, unknown>> };
  for (const referralRollbacks of [
    [{ ...details.referralRollbacks[0], amount: '1' }],
    [{ ...details.referralRollbacks[0], originalTransactionId: 'OTHER' }],
    [{ ...details.referralRollbacks[0], reversalTransactionId: 'IT-REF-1' }],
    [details.referralRollbacks[0], details.referralRollbacks[0]],
  ]) {
    await assert.rejects(load([], [{ ...original, details: { ...original.details as object, referralRollbacks } }]), OrderRevenueFactsError);
  }
});

test('one inviter paid by both host and worker retains two distinct receipts and refunds', async () => {
  const audit = source({ workerReferralInviterId: 'INVITER', workerReferralAmount: D('3'),
    referralLedgerFacts: { version: 1, boss: { transactionId: 'IT-REF-1' }, worker: { transactionId: 'IT-REF-2' } } });
  const prior = reversal(audit);
  const result = await load([audit], [{ ...prior, details: {
    ...prior.details as object, referralRollbacks: [
      ...(prior.details as { referralRollbacks: object[] }).referralRollbacks,
      { kind: 'worker', originalTransactionId: 'IT-REF-2', originalInviterId: 'INVITER', amount: '3', reversalTransactionId: 'IT-REV-2' },
    ],
  } }]);
  assert.equal(result.referralExpense.count, 4);
  assert.equal(result.referralExpense.amount.toString(), '0');
});

test('exclusion follows original inviter for both postings after account ownership changes', () => {
  const excludedOriginal = summarizeOrderRevenue([source()], [reversal()], { ...october, excludeDiscordIds: ['INVITER'] });
  const excludedCurrent = summarizeOrderRevenue([source()], [reversal()], { ...october, excludeDiscordIds: ['NEW-OWNER'] });
  assert.equal(excludedOriginal.referralRows.length, 0);
  assert.equal(excludedCurrent.referralRows.length, 2);
  assert.equal(excludedOriginal.orderGross.toString(), '100');
});

test('new-entity boundary excludes old original orders and their later reversals', async () => {
  const audit = source({ auditCreatedAt: new Date('2026-09-25T19:26:50.956Z') });
  const result = await load([], [reversal(audit)]);
  assert.equal(result.orderFeeNet.toString(), '0');
  assert.equal(result.referralExpense.amount.toString(), '0');
});

test('date boundaries are inclusive start, exclusive end and preserve exact four-place money', async () => {
  const audit = { ...noReferral(), gross: D('99999999999999.9999'), netAmount: D('99999999999998.9998'), feeAmount: D('1.0001'), auditCreatedAt: october.start };
  const result = await load([audit], []);
  assert.equal(result.orderGross.toString(), '99999999999999.9999');
  assert.equal(result.orderFee.toString(), '1.0001');
  assert.equal((await load([{ ...audit, auditCreatedAt: october.end }], [])).orderFee.toString(), '0');
});

test('query failures propagate, never becoming an empty queue or zero report', async () => {
  await assert.rejects(loadOrderRevenue({ async $queryRaw<T>(): Promise<T> { throw new Error('offline injected query failure'); } }, october), /injected query failure/);
});

test('all three production reports consume the shared facts and export original plus reversal details', () => {
  for (const filename of ['lib/admin/monthly-financial-reports.ts', 'app/api/admin/revenue/export/route.ts', 'app/admin/revenue/page.tsx']) {
    const sourceText = readFileSync(filename, 'utf8');
    assert.match(sourceText, /loadRevenueFacts\(prisma,/);
    assert.match(sourceText, /orderRevenue\.referralExpense/);
    assert.match(sourceText, /giftPaidNet\.add\(orderGrossNet\)/);
    assert.match(sourceText, /giftFeeNet\.add\(orderFeeNet\)/);
    assert.doesNotMatch(sourceText, /getRevenueOrderReferralRows|prisma\.order\.(aggregate|findMany)/);
    assert.match(sourceText, /订单当期冲销抽成/);
    if (!filename.endsWith('page.tsx')) {
      assert.match(sourceText, /'订单原结算审计'/);
      assert.match(sourceText, /'订单当期撤销明细'/);
    }
  }
});
