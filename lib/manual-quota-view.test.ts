import assert from 'node:assert/strict';
import test from 'node:test';
import { summarizeManualQuota } from './manual-quota-view';

const now = new Date('2026-10-22T00:00:00Z');
const early = new Date('2026-10-23T00:00:00Z');
const later = new Date('2026-12-23T00:00:00Z');

test('effective quota includes restored batches without extending their original expiry to a renewed base', () => {
  const summary = summarizeManualQuota({ remainingExtra: '5000', expiresAt: later }, [{ remainingExtra: '20', expiresAt: early }], now);
  assert.equal(summary.remaining, '5020'); assert.equal(summary.nextExpiresAt, early.toISOString());
  assert.deepEqual(summary.periods, [
    { amount: '20', expiresAt: early.toISOString(), restored: true },
    { amount: '5000', expiresAt: later.toISOString(), restored: false },
  ]);
});

test('expired and exactly expired restored quota is excluded even when ordinary quota is renewed', () => {
  const summary = summarizeManualQuota({ remainingExtra: '5000', expiresAt: later }, [
    { remainingExtra: '20', expiresAt: now }, { remainingExtra: '100', expiresAt: new Date(0) },
  ], now);
  assert.equal(summary.remaining, '5000'); assert.equal(summary.periods.length, 1);
});

test('restoration-only quota is visible and decimal precision is retained across periods', () => {
  const summary = summarizeManualQuota(null, [{ remainingExtra: '0.1234', expiresAt: early }, { remainingExtra: '0.0001', expiresAt: later }], now);
  assert.equal(summary.remaining, '0.1235'); assert.equal(summary.periods.length, 2);
});

test('consumed and negative residuals do not create available quota or an expiry label', () => {
  assert.deepEqual(summarizeManualQuota({ remainingExtra: 0, expiresAt: later }, [{ remainingExtra: -10, expiresAt: early }], now), {
    remaining: '0', nextExpiresAt: null, periods: [],
  });
});


test('ordinary batches, legacy balance and restorations contribute to one total while each keeps its expiry', () => {
  const summary = summarizeManualQuota({ remainingExtra: 100, expiresAt: early }, [{ remainingExtra: 20, expiresAt: early }], now, [
    { remainingExtra: 5000, expiresAt: later }, { remainingExtra: 200, expiresAt: new Date('2026-11-11T00:00:00Z') },
    { remainingExtra: 80, expiresAt: now }, { remainingExtra: 0, expiresAt: later },
  ]);
  assert.equal(summary.remaining, '5320'); assert.equal(summary.periods.length, 4);
  assert.deepEqual(summary.periods.map(row => row.expiresAt), [early.toISOString(), early.toISOString(), '2026-11-11T00:00:00.000Z', later.toISOString()]);
  assert.equal(summary.periods.filter(row => row.restored).length, 1);
});

test('fresh ordinary batch never makes expired legacy, ordinary or restored amounts visible again', () => {
  const summary = summarizeManualQuota({ remainingExtra: 100, expiresAt: now }, [{ remainingExtra: 50, expiresAt: now }], now,
    [{ remainingExtra: 200, expiresAt: now }, { remainingExtra: 5000, expiresAt: later }]);
  assert.equal(summary.remaining, '5000'); assert.equal(summary.periods.length, 1);
});
