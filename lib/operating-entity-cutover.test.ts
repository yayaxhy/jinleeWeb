import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
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

test('customer-facing operational readers keep the legacy-data boundary', () => {
  const requiredGuards: Array<[string, RegExp[]]> = [
    [
      'app/api/orders/discountable/route.ts',
      [/createdAt:\s*newEntityOnlyTime\(\)/],
    ],
    [
      'lib/home-page-data.ts',
      [
        /timeCreatedAt:\s*\{\s*\.\.\.newEntityOnlyTime\(start\)/,
        /createdAt:\s*newEntityOnlyTime\(recentOrderAndGiftCutoff\)/,
        /firstSeenAt\.getTime\(\) > NEW_ENTITY_OPERATIONS_STARTED_AT\.getTime\(\)/,
      ],
    ],
    [
      'app/api/peiwan/route.ts',
      [/ordersAsWorker:[\s\S]*?createdAt:\s*newEntityOnlyTime\(\)/, /createdAt:\s*newEntityOnlyTime\(recentActivityCutoff\)/],
    ],
    [
      'lib/farm.ts',
      [/createdAt:\s*newEntityOnlyTime\(\)/],
    ],
    [
      'lib/mini-program-account.ts',
      [/where:\s*\{\s*OR:\s*participantWhere,\s*createdAt:\s*newEntityOnlyTime\(\)/, /NEW_ENTITY_OPERATIONS_STARTED_AT/],
    ],
    [
      'lib/mini-program.ts',
      [/status:\s*OrderStatus\.RUNNING,\s*createdAt:\s*newEntityOnlyTime\(\)/],
    ],
    [
      'lib/bossProfile.ts',
      [
        /status:\s*OrderStatus\.ENDED,\s*createdAt:\s*newEntityOnlyTime\(\)/,
        /ownerId:\s*bossId,\s*createdAt:\s*newEntityOnlyTime\(\)/,
        /firstSeenAt:\s*newEntityOnlyTime\(\)/,
      ],
    ],
  ];

  for (const [file, patterns] of requiredGuards) {
    const source = readFileSync(path.join(process.cwd(), file), 'utf8');
    for (const pattern of patterns) {
      assert.match(source, pattern, `${file} must preserve its new-entity data guard`);
    }
  }
});

test('monthly report uses purchase ledger and excludes old vouchers', () => {
  const source = readFileSync(path.join(process.cwd(), 'lib/admin/monthly-financial-reports.ts'), 'utf8');
  assert.match(source, /typeOfTransaction: '刮刮乐购卡'/);
  assert.match(source, /issuedAt: newEntityOnlyTime\(\)/);
  assert.match(source, /pointShopGrant\.findMany/);
  assert.match(source, /priorPeriodExpenseAdjustmentTotal/);
  assert.match(source, /isNewEntityReportMonth\(previousMonthKey\) \? \[previousMonthKey, monthKey\] : \[monthKey\]/);
});
