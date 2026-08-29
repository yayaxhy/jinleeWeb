import assert from 'node:assert/strict';
import test from 'node:test';
import { formatAmountDown, formatAmountDown2 } from './numberFormat';

test('formatAmountDown keeps the requested ledger precision', () => {
  assert.equal(formatAmountDown('367.105', 4), '367.1050');
  assert.equal(formatAmountDown('0.005', 4), '0.0050');
  assert.equal(formatAmountDown('367.11', 4), '367.1100');
});

test('formatAmountDown2 keeps the existing two-decimal behavior', () => {
  assert.equal(formatAmountDown2('1.2399'), '1.23');
  assert.equal(formatAmountDown2('600'), '600.00');
  assert.equal(formatAmountDown2(null), '—');
});
