import assert from 'node:assert/strict';
import test from 'node:test';
import {
  NEW_ENTITY_OPERATIONS_STARTED_AT,
  newEntityOnlyTime,
  newEntityReportStart,
} from './operating-entity-cutover';

test('new operating entity filters exclude the exact legacy settlement timestamp', () => {
  assert.deepEqual(newEntityOnlyTime(), { gt: NEW_ENTITY_OPERATIONS_STARTED_AT });
  assert.deepEqual(newEntityOnlyTime(new Date('2026-09-25T19:00:00.000Z')), {
    gt: NEW_ENTITY_OPERATIONS_STARTED_AT,
  });

  const later = new Date('2026-09-25T20:00:00.000Z');
  assert.deepEqual(newEntityOnlyTime(later), { gte: later });
  assert.equal(newEntityReportStart(new Date('2026-09-25T19:00:00.000Z')).toISOString(), '2026-09-25T19:26:50.957Z');
  assert.equal(newEntityReportStart(later), later);
});
