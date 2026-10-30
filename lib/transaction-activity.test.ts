import assert from 'node:assert/strict';
import test from 'node:test';
import { Prisma } from '@prisma/client';
import {
  activityTypes, incomeContribution, spendContribution,
  OPENING_SPEND_POLICY, LEADERBOARD_SPEND_POLICY, NET_LEADERBOARD_SPEND_POLICY,
  LEADERBOARD_INCOME_POLICY, AUTO_COMMISSION_INCOME_POLICY,
  type SpendPolicy, type TransactionActivity,
} from './transaction-activity';

const D = (value: string | number) => new Prisma.Decimal(value);
const row = (typeOfTransaction: string, delta: string): TransactionActivity => ({
  typeOfTransaction, deltaAmount: D(delta), balanceBefore: D(1000), balanceAfter: D(1000).add(delta),
});
const spend = (rows: TransactionActivity[], policy: SpendPolicy) =>
  rows.reduce((sum, entry) => sum.add(spendContribution(entry, policy)), D(0));

test('shared order and gift labels count only payer debits as customer spending', () => {
  for (const policy of [OPENING_SPEND_POLICY, LEADERBOARD_SPEND_POLICY, NET_LEADERBOARD_SPEND_POLICY]) {
    for (const type of ['点单', '打赏', '客服代打赏']) {
      assert.equal(spendContribution(row(type, '-100'), policy).toString(), '100');
      assert.equal(spendContribution(row(type, '75'), policy).toString(), '0');
    }
  }
});

test('worker income reversals are never new spend; payer refunds offset spend only', () => {
  for (const type of ['订单撤销', '打赏撤销']) {
    assert.equal(spendContribution(row(type, '-75'), NET_LEADERBOARD_SPEND_POLICY).toString(), '0');
    assert.equal(spendContribution(row(type, '100'), NET_LEADERBOARD_SPEND_POLICY).toString(), '-100');
    assert.equal(incomeContribution(row(type, '-75'), LEADERBOARD_INCOME_POLICY).toString(), '-75');
    assert.equal(incomeContribution(row(type, '100'), LEADERBOARD_INCOME_POLICY).toString(), '0');
  }
});

test('a worker who buys a service still has personal spending; only their earning rows are excluded', () => {
  const owner = { discordId: 'same-worker', status: 'PEIWAN' };
  const history = [
    { ...row('点单', '75'), ...owner },
    { ...row('打赏', '-40'), ...owner },
    { ...row('订单撤销', '-75'), ...owner },
  ];
  assert.equal(spend(history, NET_LEADERBOARD_SPEND_POLICY).toString(), '40');
});

test('recharge, withdrawals, transfers, operator adjustments and unrelated rewards are not customer spend', () => {
  for (const type of ['充值', '网站充值', '信用卡/银行卡充值', '提现', '余额转移-转出', '余额转移-转入',
    '扣款', '邀请奖励', '邀请提成', '邀请提成撤销', '手工加款', '刮刮乐中奖', '积木结算收益']) {
    for (const delta of ['-100', '100']) {
      assert.equal(spendContribution(row(type, delta), NET_LEADERBOARD_SPEND_POLICY).toString(), '0', type);
      assert.equal(spendContribution(row(type, delta), OPENING_SPEND_POLICY).toString(), '0', type);
    }
  }
});

test('opening excludes lottery while leaderboard keeps its existing eligible charge items', () => {
  assert.equal(spendContribution(row('抽奖消费', '-10'), OPENING_SPEND_POLICY).toString(), '0');
  assert.equal(spendContribution(row('抽奖消费', '-10'), LEADERBOARD_SPEND_POLICY).toString(), '10');
  assert.equal(spendContribution(row('抽奖消费', '-10'), NET_LEADERBOARD_SPEND_POLICY).toString(), '10');
  for (const type of ['红包发出', '试音花费']) {
    assert.equal(spendContribution(row(type, '-12'), OPENING_SPEND_POLICY).toString(), '12');
  }
  for (const type of ['刮刮乐购卡', '积木捣蛋鬼']) {
    assert.equal(spendContribution(row(type, '-12'), NET_LEADERBOARD_SPEND_POLICY).toString(), '0');
  }
});

test('coupon credit and its rollback form a pair so a fully reversed purchase has zero net spend', () => {
  const purchase = row('点单', '-100');
  const rebate = row('优惠返利', '10');
  const refund = row('订单撤销', '100');
  const rebateRollback = row('优惠返利撤销', '-10');
  for (const policy of [OPENING_SPEND_POLICY, NET_LEADERBOARD_SPEND_POLICY]) {
    assert.equal(spend([purchase, rebate], policy).toString(), '90');
    assert.equal(spend([purchase, rebate, refund, rebateRollback], policy).toString(), '0');
    assert.equal(spendContribution(row('优惠返利', '-10'), policy).toString(), '0');
    assert.equal(spendContribution(row('优惠返利撤销', '10'), policy).toString(), '0');
  }
  // The legacy leaderboard profile excludes both sides of the rebate pair.
  assert.equal(spend([purchase, rebate, refund, rebateRollback], LEADERBOARD_SPEND_POLICY).toString(), '0');
});

test('net policy subtracts red-envelope returns and leaves window clamping to each caller', () => {
  assert.equal(spend([row('红包发出', '-100'), row('红包退回', '20')], NET_LEADERBOARD_SPEND_POLICY).toString(), '80');
  assert.equal(spend([row('红包退回', '20')], OPENING_SPEND_POLICY).toString(), '-20');
  assert.equal(spendContribution(row('红包退回', '-20'), NET_LEADERBOARD_SPEND_POLICY).toString(), '0');
});

test('worker income benefits retain their own income policies and exclude customer payments', () => {
  for (const policy of [LEADERBOARD_INCOME_POLICY, AUTO_COMMISSION_INCOME_POLICY]) {
    assert.equal(incomeContribution(row('点单', '75'), policy).toString(), '75');
    assert.equal(incomeContribution(row('点单', '-100'), policy).toString(), '0');
    assert.equal(incomeContribution(row('充值', '100'), policy).toString(), '0');
    assert.equal(incomeContribution(row('优惠返利', '10'), policy).toString(), '0');
  }
  assert.equal(incomeContribution(row('试音收入', '15'), LEADERBOARD_INCOME_POLICY).toString(), '15');
  assert.equal(incomeContribution(row('试音收入', '15'), AUTO_COMMISSION_INCOME_POLICY).toString(), '0');
});

test('signed deltaAmount takes priority and nullable historical deltas fall back only to balance snapshots', () => {
  const current: TransactionActivity = { typeOfTransaction: '点单', deltaAmount: D('-10'), balanceBefore: null, balanceAfter: null };
  assert.equal(spendContribution(current, OPENING_SPEND_POLICY).toString(), '10');
  const historical = { ...row('点单', '-50'), deltaAmount: null, amountChange: D(50) };
  assert.equal(spendContribution(historical, OPENING_SPEND_POLICY).toString(), '50');
  const legacyWithoutDelta = { typeOfTransaction: '点单', balanceBefore: D(100), balanceAfter: D(175), amountChange: D(-75) };
  assert.equal(spendContribution(legacyWithoutDelta, OPENING_SPEND_POLICY).toString(), '0');
  const unknown = { typeOfTransaction: '点单', deltaAmount: null, balanceBefore: null, balanceAfter: null, amountChange: D(-1000) };
  assert.equal(spendContribution(unknown, OPENING_SPEND_POLICY).toString(), '0');
});

test('four-decimal money remains exact through contribution sums', () => {
  assert.equal(spend([
    row('打赏', '-0.1001'), row('打赏', '-0.2002'), row('优惠返利', '0.0002'), row('优惠返利撤销', '-0.0001'),
  ], OPENING_SPEND_POLICY).toString(), '0.3002');
});

test('query whitelists come from the same explicit policies without unrelated money flows', () => {
  const types = activityTypes(NET_LEADERBOARD_SPEND_POLICY);
  assert.equal(new Set(types).size, types.length);
  for (const type of ['抽奖消费', '订单撤销', '红包退回', '优惠返利', '优惠返利撤销']) assert.ok(types.includes(type));
  for (const type of ['充值', '提现', '余额转移-转出', '试音收入', '邀请提成']) assert.ok(!types.includes(type));
  assert.ok(!activityTypes(OPENING_SPEND_POLICY).includes('抽奖消费'));
  assert.ok(!activityTypes(AUTO_COMMISSION_INCOME_POLICY).includes('试音收入'));
});
