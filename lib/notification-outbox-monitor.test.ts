import assert from 'node:assert/strict';
import test from 'node:test';
import { listOutboxDeliveries } from './notification-outbox-monitor';
test('monitor redacts claims, retains Discord-only recipients and reports bounded eligibility', async () => {
  const now = new Date('2026-10-24T10:00:00Z'); let count = 0;
  const row = { id: 'task', recipientDlmId: null, recipientDiscordId: '123', title: '资料更新', event: 'PEIWAN_PROFILE_UPDATED', status: 'PROCESSING', attempts: 1,
    claimToken: 'private-claim', body: 'private-body', error: 'delivery_outcome_unknown', createdAt: now, updatedAt: now, nextAttemptAt: now, leaseUntil: now };
  const result = await listOutboxDeliveries({ guildNotificationOutbox: {
    count: async ({ where }: any) => { if (++count === 2) { assert.equal(where.attempts.lt, 3); assert.equal(where.createdAt.gt.toISOString(), '2026-10-23T10:00:00.000Z'); } return 1; },
    findMany: async () => [row],
  } } as any, { page: 5, pageSize: 10 }, now);
  assert.equal(result.page, 1); assert.equal(result.deliveries[0].userName, '123'); assert.equal(result.deliveries[0].status, 'UNCERTAIN'); assert(result.deliveries[0].canRetry);
  assert.doesNotMatch(JSON.stringify(result), /private-claim|private-body/);
});
