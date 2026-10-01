import assert from 'node:assert/strict';
import test from 'node:test';
import { summarizeVoucherReversals } from './admin/voucher-reversal';

const revert = {
  createdAt: new Date('2026-10-02T12:00:00Z'),
  details: {
    voucherRollbacks: [{
      kind: 'coupon', dlmId: 'member', source: 'MANUAL_GRANT',
      issuedAt: '2026-09-26T12:00:00Z', consumedAt: '2026-09-28T12:00:00Z', amount: '10',
    }],
  },
};

test('cross-month coupon refund keeps original cost and reverses it in refund month', () => {
  const september = summarizeVoucherReversals([revert], {
    start: new Date('2026-09-25T19:26:50.957Z'), end: new Date('2026-09-30T22:00:00Z'),
  });
  const october = summarizeVoucherReversals([revert], {
    start: new Date('2026-09-30T22:00:00Z'), end: new Date('2026-10-31T23:00:00Z'),
  });
  assert.equal(september.couponAdjustment.toString(), '10');
  assert.equal(october.couponAdjustment.toString(), '-10');
});

test('same-month coupon refund nets to zero and excluded accounts are ignored', () => {
  const sameMonth = summarizeVoucherReversals([revert], {
    start: new Date('2026-09-25T19:26:50.957Z'), end: new Date('2026-10-31T23:00:00Z'),
  });
  const excluded = summarizeVoucherReversals([revert], {
    start: new Date('2026-09-25T19:26:50.957Z'), end: new Date('2026-10-31T23:00:00Z'),
    excludeDlmIds: ['member'],
  });
  assert.equal(sameMonth.couponAdjustment.toString(), '0');
  assert.equal(excluded.rows.length, 0);
});
