import assert from 'node:assert/strict';
import test from 'node:test';
import { Prisma } from '@prisma/client';
import { calculateActualSpend } from './opening-benefits';

test('weekly opening benefit spend ignores order and gift income', () => {
  const total = calculateActualSpend([
    { typeOfTransaction: '点单', amountChange: new Prisma.Decimal(206.27) },
    { typeOfTransaction: '打赏', amountChange: new Prisma.Decimal(30.03) },
    { typeOfTransaction: '点单', amountChange: new Prisma.Decimal(-120) },
    { typeOfTransaction: '打赏', amountChange: new Prisma.Decimal(-80) },
    { typeOfTransaction: '订单撤销', amountChange: new Prisma.Decimal(20) },
    { typeOfTransaction: '红包退回', amountChange: new Prisma.Decimal(-10) },
  ]);

  assert.equal(total.toFixed(2), '180.00');
});
