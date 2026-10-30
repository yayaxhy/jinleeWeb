import assert from 'node:assert/strict';
import test from 'node:test';
import { Prisma } from '@prisma/client';
import { calculateActualSpend } from './opening-benefits';

test('weekly opening benefit spend uses the wallet balance direction', () => {
  const total = calculateActualSpend([
    // Positive amountChange values are ambiguous; the balance direction says
    // this is the other party's income and must not count as spend.
    {
      typeOfTransaction: '点单',
      balanceBefore: new Prisma.Decimal(100),
      balanceAfter: new Prisma.Decimal(306.27),
    },
    // A customer's order payment is also recorded with a positive magnitude,
    // but it reduces their balance and therefore counts as spend.
    {
      typeOfTransaction: '点单',
      balanceBefore: new Prisma.Decimal(1035),
      balanceAfter: new Prisma.Decimal(541.5),
    },
    {
      typeOfTransaction: '打赏',
      balanceBefore: new Prisma.Decimal(541.5),
      balanceAfter: new Prisma.Decimal(461.5),
    },
    // A credit from a discount or a refund offsets actual spend.
    {
      typeOfTransaction: '优惠返利',
      balanceBefore: new Prisma.Decimal(461.5),
      balanceAfter: new Prisma.Decimal(510.85),
    },
    {
      typeOfTransaction: '订单撤销',
      balanceBefore: new Prisma.Decimal(510.85),
      balanceAfter: new Prisma.Decimal(530.85),
    },
    // A debit with a reversal label must not reduce the spend total.
    {
      typeOfTransaction: '红包退回',
      balanceBefore: new Prisma.Decimal(530.85),
      balanceAfter: new Prisma.Decimal(520.85),
    },
  ]);

  assert.equal(total.toFixed(2), '504.15');
});

const movement = (typeOfTransaction: string, delta: string, filled = true) => ({
  typeOfTransaction,
  balanceBefore: new Prisma.Decimal('10000'),
  balanceAfter: new Prisma.Decimal('10000').add(delta),
  deltaAmount: filled ? new Prisma.Decimal(delta) : null,
});

test('earning over the target never qualifies a user, but their own purchases still count', () => {
  for (const filled of [true, false]) {
    const entries = [
      movement('点单', '5000', filled),
      movement('打赏', '3000', filled),
      movement('订单撤销', '-500', filled),
      movement('Stripe充值', '2000', filled),
      movement('提现', '-1000', filled),
      movement('账号合并转出', '-2000', filled),
      movement('抽奖消费', '-1000', filled),
      movement('点单', '-999', filled),
    ];
    assert.equal(calculateActualSpend(entries).toString(), '999');
    assert.equal(calculateActualSpend([...entries, movement('客服代打赏', '-1', filled)]).toString(), '1000');
  }
});

test('refunds offset spend and a reversed rebate restores it exactly once', () => {
  const entries = [
    movement('点单', '-1000'),
    movement('优惠返利', '50'),
  ];
  assert.equal(calculateActualSpend(entries).toString(), '950');
  assert.equal(calculateActualSpend([...entries, movement('优惠返利撤销', '-50')]).toString(), '1000');
  assert.equal(calculateActualSpend([...entries, movement('订单撤销', '1000')]).toString(), '0');
  assert.equal(calculateActualSpend([
    movement('红包发出', '-10.0001'), movement('红包退回', '10.0001'),
    movement('试音花费', '-0.0001'),
  ]).toString(), '0.0001');
});
