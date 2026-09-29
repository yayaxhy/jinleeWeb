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
