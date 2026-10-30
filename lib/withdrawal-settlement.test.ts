import assert from 'node:assert/strict';
import test from 'node:test';
import { Prisma, SettlementPayoutStatus } from '@prisma/client';
import { buildCentralEuropeanMonthRange } from './centralEuropeanDateRange';
import { summarizeWithdrawalSettlement, type WithdrawalSettlementRow } from './admin/withdrawal-settlement';

const amount = (value: string) => new Prisma.Decimal(value);
const date = (value: string) => new Date(value);
const september = buildCentralEuropeanMonthRange(2026, 9);
const october = buildCentralEuropeanMonthRange(2026, 10);
const november = buildCentralEuropeanMonthRange(2026, 11);
const request: WithdrawalSettlementRow = {
  id: 'w1', amount: amount('100'), createdAt: date('2026-09-26T12:00:00Z'), settlementPayout: null,
};
const payout = {
  id: 'p1', amount: amount('100'), status: SettlementPayoutStatus.PAID,
  paidAt: date('2026-10-02T12:00:00Z'), voidedAt: null,
};

test('request deducts the wallet but remains payable until the owner confirms payment', () => {
  const summary = summarizeWithdrawalSettlement([request], [], september);
  assert.equal(summary.requested.toString(), '100');
  assert.equal(summary.netOutflow.toString(), '0');
  assert.equal(summary.pendingAtEnd.toString(), '100');
});

test('September request paid in October leaves September cash intact and is October cash outflow', () => {
  const row = { ...request, settlementPayout: payout };
  const sep = summarizeWithdrawalSettlement([row], [], september);
  const oct = summarizeWithdrawalSettlement([row], [], october);
  assert.equal(sep.netOutflow.toString(), '0');
  assert.equal(sep.pendingAtEnd.toString(), '100');
  assert.equal(oct.requested.toString(), '0');
  assert.equal(oct.paid.toString(), '100');
  assert.equal(oct.pendingAtEnd.toString(), '0');
});

test('later void and repayment preserve historical cash and month-end payable balances', () => {
  const row = { ...request, settlementPayout: { ...payout, paidAt: date('2026-11-02T12:00:00Z') } };
  const history = [{ targetId: payout.id, originalAt: date('2026-09-27T12:00:00Z'), createdAt: date('2026-10-02T12:00:00Z') }];
  const sep = summarizeWithdrawalSettlement([row], history, september);
  const oct = summarizeWithdrawalSettlement([row], history, october);
  const nov = summarizeWithdrawalSettlement([row], history, november);
  assert.equal(sep.netOutflow.toString(), '100');
  assert.equal(sep.pendingAtEnd.toString(), '0');
  assert.equal(oct.netOutflow.toString(), '-100');
  assert.equal(oct.pendingAtEnd.toString(), '100');
  assert.equal(nov.netOutflow.toString(), '100');
  assert.equal(nov.pendingAtEnd.toString(), '0');
  assert.equal(sep.netOutflow.add(oct.netOutflow).add(nov.netOutflow).toString(), '100');
});

test('current void is counted once with audit history and works for older rows without history', () => {
  const row = { ...request, settlementPayout: { ...payout, status: SettlementPayoutStatus.VOIDED, voidedAt: date('2026-10-03T12:00:00Z') } };
  const history = [{ targetId: payout.id, originalAt: payout.paidAt, createdAt: row.settlementPayout.voidedAt }];
  for (const reversals of [history, []]) {
    const summary = summarizeWithdrawalSettlement([row], reversals, october);
    assert.equal(summary.paid.toString(), '100');
    assert.equal(summary.reversed.toString(), '100');
    assert.equal(summary.netOutflow.toString(), '0');
    assert.equal(summary.pendingAtEnd.toString(), '100');
  }
});

test('multiple payment cycles still reconcile to the single currently paid amount', () => {
  const row = { ...request, settlementPayout: { ...payout, paidAt: date('2026-10-05T12:00:00Z') } };
  const history = [
    { targetId: payout.id, originalAt: date('2026-09-27T12:00:00Z'), createdAt: date('2026-09-28T12:00:00Z') },
    { targetId: payout.id, originalAt: date('2026-09-29T12:00:00Z'), createdAt: date('2026-10-02T12:00:00Z') },
  ];
  const sep = summarizeWithdrawalSettlement([row], history, september);
  const oct = summarizeWithdrawalSettlement([row], history, october);
  assert.equal(sep.paid.toString(), '200');
  assert.equal(sep.reversed.toString(), '100');
  assert.equal(sep.pendingAtEnd.toString(), '0');
  assert.equal(oct.netOutflow.toString(), '0');
  assert.equal(oct.pendingAtEnd.toString(), '0');
  assert.equal(sep.netOutflow.add(oct.netOutflow).toString(), '100');
});

test('end is exclusive and legacy-entity withdrawals never enter the new report', () => {
  const rows = [
    { ...request, settlementPayout: { ...payout, paidAt: september.end } },
    { ...request, id: 'legacy', createdAt: date('2026-09-25T19:26:50.956Z'), settlementPayout: payout },
    { ...request, id: 'future', createdAt: september.end },
  ];
  const summary = summarizeWithdrawalSettlement(rows, [], september);
  assert.equal(summary.requested.toString(), '100');
  assert.equal(summary.paid.toString(), '0');
  assert.equal(summary.pendingAtEnd.toString(), '100');
});
