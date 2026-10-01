import assert from 'node:assert/strict';
import test from 'node:test';
import { Prisma } from '@prisma/client';
import { calculateRecordedBankCash, rewindWalletTransactionChain } from './admin/monthly-financial-reports';

const amount = (value: string) => new Prisma.Decimal(value);

test('month-end wallet rewind follows balances when concurrent ledger timestamps are inverted', () => {
  const opening = rewindWalletTransactionChain(amount('2824.51'), [
    { balanceBefore: amount('2381.81'), balanceAfter: amount('2820.13') },
    { balanceBefore: amount('2820.13'), balanceAfter: amount('2824.51') },
  ]);
  assert.equal(opening.toString(), '2381.81');
});

test('month-end wallet rewind refuses a missing or disconnected transaction', () => {
  assert.throws(() => rewindWalletTransactionChain(amount('100'), [
    { balanceBefore: amount('50'), balanceAfter: amount('90') },
  ]), /无法接续/);
});

test('bank cash starts at zero and rolls forward using only recorded cash movements', () => {
  const september = calculateRecordedBankCash(amount('0'), amount('14636'), amount('1815.92'), amount('0'));
  assert.equal(september.movement.toString(), '12820.08');
  assert.equal(september.closing.toString(), '12820.08');

  const october = calculateRecordedBankCash(september.closing, amount('120'), amount('1064'), amount('0'));
  assert.equal(october.closing.toString(), '11876.08');
});
