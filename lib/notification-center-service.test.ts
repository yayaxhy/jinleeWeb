import assert from 'node:assert/strict';
import test from 'node:test';
import { createGuildNotificationService, pendingOrderNotificationId, type GuildNotificationInput } from './notification-center-service';
import { DELIVERY_MAX_AGE_MS, DELIVERY_RETRY_DELAY_MS, type DeliveryOutcome } from './notification-delivery';
import { deliveryRow, deliveryStore, matches, TEST_NOW, type TestDelivery } from './notification-test-support';
import { notifyDispatchSubscribers, notifyMiniProgramUser } from './mini-program-subscribe';

type Note = { id: string; dlmId: string; event: string; title: string; body: string; href: string | null; details: unknown; dedupeKey: string | null; createdAt: Date; readAt: Date | null; dlmUser: { discordUserId: string | null } };
function fixture() {
  let now = TEST_NOW; let sends = 0; let reads = 0; let outcome: DeliveryOutcome | 'throw' = { status: 'SENT' };
  const notes: Note[] = []; const deliveries: TestDelivery[] = [];
  const payloads: Array<Parameters<Parameters<typeof createGuildNotificationService>[0]['sendDiscord']>[0]> = [];
  let order: { status: string; createdAt: Date; workerId: string; worker: { dlmUser: { dlmId: string } | null } } | null = {
    status: 'PENDING', createdAt: new Date(TEST_NOW), workerId: 'discord-user', worker: { dlmUser: { dlmId: 'DLM1' } },
  };
  const store = deliveryStore(deliveries);
  const view = (note: Note) => ({ ...note, deliveries: deliveries.filter(row => row.notificationId === note.id) });
  const create = async ({ data }: { data: Record<string, unknown> }) => {
    const { deliveries: nested, ...fields } = data;
    const note = { ...fields, id: `note-${notes.length}`, details: fields.details ?? null, dedupeKey: fields.dedupeKey ?? null,
      createdAt: new Date(now), readAt: null, dlmUser: { discordUserId: 'discord-user' } } as Note;
    notes.push(note);
    const rows = (nested as { create: Array<Partial<TestDelivery>> }).create;
    for (const row of rows) deliveries.push(deliveryRow({ ...row, id: `${note.id}-${row.channel}`, notificationId: note.id, notification: note, updatedAt: new Date(now) }));
    return view(note);
  };
  const db = {
    ...store.db,
    guildNotification: {
      create,
      upsert: async ({ where, create: data }: { where: { dedupeKey: string }; create: Record<string, unknown> }) => {
        const existing = notes.find(note => note.dedupeKey === where.dedupeKey);
        return existing ? view(existing) : create({ data });
      },
      findUnique: async ({ where }: { where: { id: string } }) => {
        const note = notes.find(note => note.id === where.id); return note ? view(note) : null;
      },
      findMany: async ({ where, take }: { where: unknown; take: number }) => notes.map(view).filter(note => matches(note, where)).slice(0, take),
      updateMany: async ({ where, data }: { where: unknown; data: { readAt: Date } }) => {
        const found = notes.filter(note => matches(note, where)); found.forEach(note => { note.readAt = data.readAt; }); return { count: found.length };
      },
    },
    order: { findUnique: async () => { reads++; return order; } },
  } as unknown as Parameters<typeof createGuildNotificationService>[0]['db'];
  const service = createGuildNotificationService({ db, now: () => now, sendDiscord: async payload => {
    payloads.push(payload);
    assert.equal(payload.claimToken, deliveries.find(row => row.notificationId === payload.notificationId)?.error);
    sends++; if (outcome === 'throw') throw new Error('lost provider response'); return outcome;
  } });
  return { service, notes, deliveries, payloads, sends: () => sends, reads: () => reads, setNow: (value: number) => { now = value; },
    setOutcome: (value: DeliveryOutcome | 'throw') => { outcome = value; }, setOrder: (value: typeof order) => { order = value; }, order: () => order! };
}
const input = (patch: Partial<GuildNotificationInput> = {}): GuildNotificationInput => ({ dlmId: 'DLM1', event: 'BALANCE_ADJUSTED', title: '余额到账', body: '充值已经到账', dedupeKey: 'payment:first', ...patch });
const pending = (patch: Partial<GuildNotificationInput> = {}) => input({ event: 'ORDER_CREATED', title: '待接单', dedupeKey: 'order-created:order1:DLM1', details: { orderId: 'order1' }, ...patch });

test('only a Discord delivery row is created; optional past channels cannot enable external sends', async () => {
  const f = fixture(); await f.service.publishGuildNotification(input({ deliveredChannels: ['EMAIL', 'WEB_PUSH'] }));
  assert.deepEqual(f.deliveries.map(row => row.channel), ['DISCORD']); assert.equal(f.sends(), 1);
  assert.equal(f.deliveries[0].status, 'SENT');
});

test('already delivered Discord messages and duplicate events cannot resend', async () => {
  const f = fixture(); await f.service.publishGuildNotification(input({ deliveredChannels: ['DISCORD'] }));
  await f.service.publishGuildNotification(input());
  assert.equal(f.notes.length, 1); assert.equal(f.sends(), 0);
  assert.equal((await f.service.retryGuildNotificationDeliveries()).attempted, 0);
});

test('unknown messages retry only every five minutes, with three total attempts, independent of read state', async () => {
  const f = fixture(); f.setOutcome('throw'); await f.service.publishGuildNotification(input());
  assert.equal(f.sends(), 1); await f.service.markGuildNotificationsRead('DLM1');
  assert.ok(f.notes[0].readAt);
  assert.equal((await f.service.retryGuildNotificationDeliveries()).attempted, 0);
  for (let i = 1; i <= 4; i++) { f.setNow(TEST_NOW + i * DELIVERY_RETRY_DELAY_MS); await f.service.retryGuildNotificationDeliveries(); }
  assert.equal(f.sends(), 3); assert.equal(f.deliveries[0].attempts, 3);
  assert.equal((await f.service.listGuildNotifications('DLM1')).length, 1);
});

test('notification age gates both queued retries and duplicate publication of an old record', async () => {
  const f = fixture(); f.setOutcome('throw'); await f.service.publishGuildNotification(input());
  f.setNow(TEST_NOW + DELIVERY_MAX_AGE_MS);
  await f.service.retryGuildNotificationDeliveries(); await f.service.publishGuildNotification(input());
  assert.equal(f.sends(), 1); assert.equal(f.notes.length, 1);
});

test('pending reminders require current state and owner on the initial send', async () => {
  for (const change of ['RUNNING', 'CANCELED', 'ENDED', 'wrong-recipient', 'wrong-account', 'expired', 'missing']) {
    const f = fixture(); const order = f.order();
    if (change === 'wrong-recipient') order.workerId = 'another';
    else if (change === 'wrong-account') order.worker.dlmUser = { dlmId: 'DLM2' };
    else if (change === 'expired') order.createdAt = new Date(TEST_NOW - 600000);
    else if (change === 'missing') f.setOrder(null);
    else order.status = change;
    await f.service.publishGuildNotification(pending());
    assert.equal(f.sends(), 0, change); assert.equal(f.deliveries[0].status, 'SKIPPED', change);
    assert.equal(f.notes.length, 1, 'in-app history remains');
  }
});

test('a pending reminder is rechecked before each retry and stops after acceptance', async () => {
  const f = fixture(); f.setOutcome('throw'); await f.service.publishGuildNotification(pending());
  assert.equal(f.sends(), 1); f.order().status = 'RUNNING'; f.setNow(TEST_NOW + DELIVERY_RETRY_DELAY_MS);
  await f.service.retryGuildNotificationDeliveries();
  assert.equal(f.sends(), 1); assert.equal(f.reads(), 2); assert.equal(f.deliveries[0].status, 'SKIPPED');
});

test('a ten-minute invitation cannot receive its third reminder even if still marked PENDING', async () => {
  const f = fixture(); f.setOutcome('throw'); await f.service.publishGuildNotification(pending());
  f.setNow(TEST_NOW + DELIVERY_RETRY_DELAY_MS); await f.service.retryGuildNotificationDeliveries();
  assert.equal(f.sends(), 2);
  f.setNow(TEST_NOW + 2 * DELIVERY_RETRY_DELAY_MS); await f.service.retryGuildNotificationDeliveries();
  assert.equal(f.sends(), 2); assert.equal(f.deliveries[0].error, 'order_invitation_expired');
});

test('accepted/canceled outcome notices do not use the pending-order gate', async () => {
  for (const event of ['ORDER_ACCEPTED', 'ORDER_CANCELED'] as const) {
    const f = fixture(); f.order().status = 'ENDED'; await f.service.publishGuildNotification(input({ event }));
    assert.equal(f.sends(), 1); assert.equal(f.reads(), 0);
  }
});

test('legacy pending dedupe keys remain usable but missing/conflicting references never guess an order', async () => {
  const f = fixture(); await f.service.publishGuildNotification(pending({ details: undefined })); assert.equal(f.sends(), 1);
  for (const patch of [{ details: undefined, dedupeKey: 'unknown' }, { details: { orderId: 'another' } }]) {
    const f = fixture(); await f.service.publishGuildNotification(pending(patch));
    assert.equal(f.sends(), 0); assert.equal(f.deliveries[0].error, 'pending_order_reference_missing');
  }
  assert.equal(pendingOrderNotificationId({ details: null, dedupeKey: 'order-created:order1:DLM2', dlmId: 'DLM1' }), null);
});

test('legacy email and push rows remain in history and never become eligible for retry', async () => {
  const f = fixture(); await f.service.publishGuildNotification(input());
  f.deliveries.push(deliveryRow({ id: 'old-email', notificationId: f.notes[0].id, channel: 'EMAIL', notification: f.notes[0] }));
  f.deliveries.push(deliveryRow({ id: 'old-push', notificationId: f.notes[0].id, channel: 'WEB_PUSH', notification: f.notes[0] }));
  f.setNow(TEST_NOW + DELIVERY_RETRY_DELAY_MS); await f.service.retryGuildNotificationDeliveries();
  assert.equal(f.sends(), 1); assert.equal(f.deliveries.length, 3);
  assert.equal((await f.service.listGuildNotifications('DLM1'))[0].deliveries.length, 3);
});

test('mini subscription entry points never contact WeChat or require persisted settings', async () => {
  for (const kind of ['critical', 'message', 'dispatch'] as const) {
    assert.deepEqual(await notifyMiniProgramUser('DLM1', kind, '标题', '内容', 'pages/orders/index'), { sent: false, reason: 'channel_disabled' });
  }
  assert.deepEqual(await notifyDispatchSubscribers('派单', '内容'), { sent: false, reason: 'channel_disabled' });
});


test('ordinary Discord transport identifies the claimed notification and current DLM owner', async () => {
  const f = fixture(); await f.service.publishGuildNotification(input());
  const payload = f.payloads[0];
  assert.equal(payload.notificationId, f.notes[0].id);
  assert.equal(payload.recipientDlmId, 'DLM1');
  assert.equal(payload.discordUserId, 'discord-user');
  assert.match(payload.claimToken, /^delivery_hold:in_flight_or_uncertain:/);
});
