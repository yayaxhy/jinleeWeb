import assert from 'node:assert/strict';
import test from 'node:test';
import { Prisma } from '@prisma/client';
import { getGiftReferralExpenseSummary } from './admin/revenue-expense';
import { buildCentralEuropeanMonthRange } from './centralEuropeanDateRange';
import { NEW_ENTITY_OPERATIONS_STARTED_AT } from './operating-entity-cutover';

const october = buildCentralEuropeanMonthRange(2026, 10);
const september = buildCentralEuropeanMonthRange(2026, 9);

function stubQueries(gross: string, reversed: string) {
  const queries: Prisma.Sql[] = [];
  const db = { $queryRaw: async (query: Prisma.Sql) => {
    queries.push(query);
    const isReversal = query.sql.includes('JOIN "revert"');
    return [{ amount: new Prisma.Decimal(isReversal ? reversed : gross), count: isReversal ? 2 : 36 }];
  } } as unknown as Pick<Prisma.TransactionClient, '$queryRaw'>;
  return { db, queries };
}

test('two reversed gift referrals reduce expense by 0.92 without requiring IDs in aggregate results', async () => {
  const { db } = stubQueries('57.64', '0.92');
  const summary = await getGiftReferralExpenseSummary(october, db);
  assert.equal(summary.amount.toString(), '56.72');
  assert.equal(summary.count, 34);
});

test('a later-month reversal is booked by reversal time and can produce a negative monthly cost', async () => {
  const { db, queries } = stubQueries('0', '0.92');
  const summary = await getGiftReferralExpenseSummary(october, db);
  const reversal = queries.find(query => query.sql.includes('JOIN "revert"'))!;
  assert.match(reversal.sql, /r\."status" = 'SUCCESS'/);
  assert.match(reversal.sql, /r\."createdAt" >=/);
  assert.match(reversal.sql, /r\."createdAt" </);
  assert.doesNotMatch(reversal.sql, /ga\."createdAt" >=/);
  assert.deepEqual(reversal.values.slice(-3), [NEW_ENTITY_OPERATIONS_STARTED_AT, october.start, october.end]);
  assert.equal(summary.amount.toString(), '-0.92');
});

test('original costs remain in their month and inviter exclusions apply to both sides', async () => {
  const { db, queries } = stubQueries('0.92', '0');
  const summary = await getGiftReferralExpenseSummary({ ...september, excludeDiscordIds: ['excluded-inviter'] }, db);
  assert.equal(summary.amount.toString(), '0.92');
  for (const query of queries) {
    assert.match(query.sql, /ga\."bossReferralInviterId" NOT IN/);
    assert.match(query.sql, /ga\."workerReferralInviterId" NOT IN/);
    assert.ok(query.values.includes('excluded-inviter'));
    assert.ok(query.values.some(value => value instanceof Date && value.getTime() === NEW_ENTITY_OPERATIONS_STARTED_AT.getTime() + 1));
  }
});
