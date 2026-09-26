import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getBerlinDateKey,
  getBerlinWeekKey,
  getNextBerlinMidnight,
  isOpeningBenefitsActive,
} from './opening-benefit-rules';

test('Berlin claim keys use the local day around midnight', () => {
  assert.equal(getBerlinDateKey(new Date('2026-10-25T21:30:00.000Z')), '2026-10-25');
  assert.equal(getBerlinDateKey(new Date('2026-10-25T23:30:00.000Z')), '2026-10-26');
});

test('Berlin next midnight remains correct across the autumn DST change', () => {
  assert.equal(
    getNextBerlinMidnight(new Date('2026-10-25T21:30:00.000Z')).toISOString(),
    '2026-10-25T23:00:00.000Z',
  );
});

test('weekly claims use Berlin Monday as their period key', () => {
  assert.equal(getBerlinWeekKey(new Date('2026-09-27T21:30:00.000Z')), '2026-09-21');
  assert.equal(getBerlinWeekKey(new Date('2026-09-27T22:30:00.000Z')), '2026-09-28');
});

test('opening benefits include all of 1 December in Berlin', () => {
  assert.equal(isOpeningBenefitsActive(new Date('2026-12-01T22:59:59.000Z')), true);
  assert.equal(isOpeningBenefitsActive(new Date('2026-12-01T23:00:00.000Z')), false);
});
