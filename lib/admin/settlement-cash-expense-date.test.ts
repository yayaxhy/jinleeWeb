import assert from 'node:assert/strict';
import test from 'node:test';
import { parseActualPaidOn } from './settlement-cash-expense-date';

const now = new Date('2026-11-02T15:00:00.000Z');

test('late entry keeps the actual October payment month', () => {
  const paidOn = parseActualPaidOn('2026-10-20', now);
  assert.equal(paidOn?.monthKey, '2026-10');
  assert.equal(paidOn?.date.toISOString(), '2026-10-20T00:00:00.000Z');
});

test('invalid, future and pre-cutover payment dates are rejected', () => {
  for (const value of ['2026-02-30', '2026-11-03', '2026-09-24', '11/02/2026', '']) {
    assert.equal(parseActualPaidOn(value, now), null);
  }
});
