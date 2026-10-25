import assert from 'node:assert/strict';
import test from 'node:test';
import { DELIVERY_HOLD_PREFIX, DELIVERY_MAX_AGE_MS, DELIVERY_RETRY_DELAY_MS, describeDelivery, runClaimedDelivery } from './notification-delivery';
import { deliveryRow, deliveryStore, TEST_NOW } from './notification-test-support';

const description = (row: ReturnType<typeof deliveryRow>, now: number) => describeDelivery({ ...row, notificationCreatedAt: row.notification.createdAt }, now);

test('scheduler and staff cannot concurrently claim the same Discord DM', async () => {
  const row = deliveryRow(); const f = deliveryStore([row]);
  let calls = 0; let release!: () => void;
  const provider = new Promise<void>(resolve => { release = resolve; });
  const jobs = Array.from({ length: 20 }, () => runClaimedDelivery(f.db, 'notice', 'DISCORD', async () => {
    calls++; await provider; return { status: 'SENT' };
  }, () => TEST_NOW));
  await Promise.resolve(); assert.equal(calls, 1); assert.equal(row.attempts, 1);
  release(); const outcomes = await Promise.all(jobs);
  assert.equal(outcomes.filter(value => value === 'completed').length, 1);
  assert.equal(row.status, 'SENT'); assert.ok(row.sentAt);
});

test('sent, skipped and exhausted Discord rows never resend; disabled channels never claim', async () => {
  for (const patch of [{ status: 'SENT' }, { status: 'SKIPPED' }, { status: 'FAILED', attempts: 3 }, { channel: 'EMAIL' as const }, { channel: 'WEB_PUSH' as const }]) {
    const row = deliveryRow(patch); const f = deliveryStore([row]);
    assert.equal(await runClaimedDelivery(f.db, 'notice', row.channel, async () => { assert.fail('forbidden delivery'); }, () => TEST_NOW), 'not_claimed');
    assert.equal(description(row, TEST_NOW).canRetry, false);
  }
});

test('known failures have five-minute spacing and three attempts including the first', async () => {
  const row = deliveryRow(); const f = deliveryStore([row]); let now = TEST_NOW; let sends = 0;
  const send = async () => { sends++; return { status: 'FAILED' as const, error: 'discord_rejected_429' }; };
  for (let i = 0; i < 6; i++) {
    await runClaimedDelivery(f.db, 'notice', 'DISCORD', send, () => now);
    assert.equal(await runClaimedDelivery(f.db, 'notice', 'DISCORD', send, () => now + DELIVERY_RETRY_DELAY_MS - 1), 'not_claimed');
    now += DELIVERY_RETRY_DELAY_MS;
  }
  assert.equal(sends, 3); assert.equal(row.attempts, 3); assert.equal(description(row, now).canRetry, false);
});

test('unknown sends retain a token but become eligible for finite retry after five minutes', async () => {
  const row = deliveryRow(); const f = deliveryStore([row]); let now = TEST_NOW; let sends = 0;
  const send = async () => { sends++; throw new Error('lost reply'); };
  for (let i = 0; i < 3; i++) {
    assert.equal(await runClaimedDelivery(f.db, 'notice', 'DISCORD', send, () => now), 'uncertain');
    assert.ok(row.error?.startsWith(DELIVERY_HOLD_PREFIX));
    assert.equal(description(row, now).canRetry, false);
    now += DELIVERY_RETRY_DELAY_MS;
    assert.equal(description(row, now).canRetry, i < 2);
  }
  assert.equal(await runClaimedDelivery(f.db, 'notice', 'DISCORD', send, () => now), 'not_claimed');
  assert.equal(sends, 3); assert.match(description(row, now).error!, /已达 3 次上限/);
  assert.ok(!JSON.stringify(description(row, now)).includes(DELIVERY_HOLD_PREFIX));
});

test('lost successful receipt can retry once the lease expires without erasing the original claim', async () => {
  const row = deliveryRow(); const f = deliveryStore([row]); f.failReceipt(); let sends = 0;
  const send = async () => { sends++; return { status: 'SENT' as const }; };
  assert.equal(await runClaimedDelivery(f.db, 'notice', 'DISCORD', send, () => TEST_NOW), 'uncertain');
  assert.equal(await runClaimedDelivery(f.db, 'notice', 'DISCORD', send, () => TEST_NOW + 1), 'not_claimed');
  f.failReceipt(false);
  assert.equal(await runClaimedDelivery(f.db, 'notice', 'DISCORD', send, () => TEST_NOW + DELIVERY_RETRY_DELAY_MS), 'completed');
  assert.equal(sends, 2); assert.equal(row.status, 'SENT');
});

test('a stale attempt cannot overwrite the newer receipt after its five-minute lease expires', async () => {
  const row = deliveryRow(); const f = deliveryStore([row]); let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const old = runClaimedDelivery(f.db, 'notice', 'DISCORD', async () => { await gate; return { status: 'FAILED', error: 'late rejection' }; }, () => TEST_NOW);
  await Promise.resolve();
  assert.equal(await runClaimedDelivery(f.db, 'notice', 'DISCORD', async () => ({ status: 'SENT' }), () => TEST_NOW + DELIVERY_RETRY_DELAY_MS), 'completed');
  release(); assert.equal(await old, 'uncertain');
  assert.equal(row.status, 'SENT'); assert.equal(row.error, null); assert.equal(row.attempts, 2);
});

test('age is checked at the actual atomic claim, including direct duplicate-publish paths', async () => {
  for (const age of [DELIVERY_MAX_AGE_MS, DELIVERY_MAX_AGE_MS + 1]) {
    const row = deliveryRow(); const f = deliveryStore([row]);
    assert.equal(await runClaimedDelivery(f.db, 'notice', 'DISCORD', async () => { assert.fail('expired'); }, () => TEST_NOW + age), 'not_claimed');
    assert.equal(description(row, TEST_NOW + age).canRetry, false);
  }
});

test('legacy held claims can retry after lease expiry but never after the creation deadline', async () => {
  const row = deliveryRow({ attempts: 1, error: `${DELIVERY_HOLD_PREFIX}legacy-token` }); const f = deliveryStore([row]);
  assert.equal(await runClaimedDelivery(f.db, 'notice', 'DISCORD', async () => ({ status: 'SENT' }), () => TEST_NOW + DELIVERY_RETRY_DELAY_MS), 'completed');
  const expired = deliveryRow({ attempts: 1, error: `${DELIVERY_HOLD_PREFIX}legacy-token` });
  assert.equal(description(expired, TEST_NOW + DELIVERY_MAX_AGE_MS).canRetry, false);
});

test('future or invalid creation timestamps are not presented as retryable', () => {
  for (const createdAt of [new Date(TEST_NOW + 1), new Date(NaN)]) {
    const row = deliveryRow({ notification: { createdAt } });
    assert.equal(description(row, TEST_NOW).canRetry, false);
  }
});


test('the transport receives the exact acquired claim token', async () => {
  const row = deliveryRow(); const f = deliveryStore([row]);
  await runClaimedDelivery(f.db, 'notice', 'DISCORD', async claimToken => {
    assert.equal(claimToken, row.error);
    assert.match(claimToken, /^delivery_hold:in_flight_or_uncertain:/);
    return { status: 'SENT' };
  }, () => TEST_NOW);
  assert.equal(row.status, 'SENT');
});
