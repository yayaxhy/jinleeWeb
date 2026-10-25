import assert from 'node:assert/strict';
import test from 'node:test';
import type { PrismaClient } from '@prisma/client';
import { runClaimedDelivery } from './notification-delivery';
import { runNotificationRetryBatch, summarizeDeliveryResults } from './notification-retry-batch';

test('a genuine empty retry queue reports success with zero errors and no delivery calls', async () => {
  const logs: string[] = [];
  const result = await runNotificationRetryBatch({
    list: async () => [],
    deliver: async () => { assert.fail('empty queue must not deliver'); },
    log: (line) => logs.push(line),
  });
  assert.deepEqual(result, { ok: true, attempted: 0, uncertain: 0, channelErrors: 0, notificationErrors: 0, batchErrors: 0, processingErrors: 0 });
  assert.deepEqual(logs, []);
});

test('queue database failure is observable and never confused with an empty queue', async () => {
  const logs: string[] = [];
  const result = await runNotificationRetryBatch({
    list: async () => { throw new Error('postgres://secret@example.test/account'); },
    deliver: async () => { assert.fail('failed list must not deliver'); },
    log: (line) => logs.push(line),
  });
  assert.equal(result.ok, false);
  assert.equal(result.batchErrors, 1);
  assert.equal(result.processingErrors, 1);
  assert.equal(result.error, 'notification_retry_incomplete');
  assert.equal(logs.length, 1);
  assert.match(logs[0], /batchErrors=1/);
  assert.ok(!JSON.stringify([result, logs]).includes('secret'));
});

test('a claim database rejection is counted while sibling channels still settle', async () => {
  const db = { guildNotificationDelivery: {
    updateMany: async () => { throw new Error('credential-containing database error'); },
  } } as unknown as Pick<PrismaClient, 'guildNotificationDelivery'>;
  const logs: string[] = [];
  const result = await runNotificationRetryBatch({
    list: async () => [{ id: 'notice' }],
    deliver: async () => Promise.allSettled([
      runClaimedDelivery(db, 'notice', 'DISCORD', async () => { assert.fail('failed claim must never send'); }),
      Promise.resolve('completed' as const),
      Promise.resolve('not_claimed' as const),
    ]),
    log: (line) => logs.push(line),
  });
  assert.equal(result.ok, false);
  assert.equal(result.attempted, 1);
  assert.equal(result.channelErrors, 1);
  assert.equal(result.notificationErrors, 0);
  assert.equal(result.processingErrors, 1);
  assert.match(logs[0], /channelErrors=1/);
  assert.ok(!JSON.stringify([result, logs]).includes('credential'));
});

test('notification read errors and channel claim errors both survive the nested settled results', async () => {
  const result = await runNotificationRetryBatch({
    list: async () => [{ id: 'read-fails' }, { id: 'partial' }],
    deliver: async (id) => {
      if (id === 'read-fails') throw new Error('private recipient details');
      return Promise.allSettled([
        Promise.resolve('uncertain' as const),
        Promise.resolve('completed' as const),
        Promise.reject(new Error('private provider details')),
      ]);
    },
    log: () => undefined,
  });
  assert.deepEqual(result, {
    ok: false, attempted: 2, uncertain: 1, channelErrors: 1, notificationErrors: 1,
    batchErrors: 0, processingErrors: 2, error: 'notification_retry_incomplete',
  });
});

test('deleted notifications and contested claims are harmless while uncertainty remains visible', () => {
  const result = summarizeDeliveryResults([
    { status: 'fulfilled', value: undefined },
    { status: 'fulfilled', value: [
      { status: 'fulfilled', value: 'not_claimed' },
      { status: 'fulfilled', value: 'uncertain' },
    ] },
  ]);
  assert.equal(result.ok, true);
  assert.equal(result.attempted, 1);
  assert.equal(result.uncertain, 1);
  assert.equal(result.processingErrors, 0);
});
