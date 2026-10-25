import assert from 'node:assert/strict';
import test from 'node:test';
import { createGiftExecutionController, newGiftRequestId, isGiftRequestId, giftIntentForConfirmation, giftQuantityText, giftRecoveryKey, type GiftActor, type GiftExecutionReview, type GiftRecoveryRecord } from './gift-execution-client';
import type { TargetConfirmation, TargetConfirmationScope } from './target-confirmation-client';

const ID = 'e4322167-9ef8-4e04-abf3-7a904d059849';
const NEXT_ID = 'fc3c5101-8c83-4b75-a8db-42d9b5b7c018';
const NOW = Date.parse('2026-10-22T12:00:00Z');
const actor: GiftActor = { dlmId: 'DLM_PAYER', discordId: '123456789012345678' };
const scope: TargetConfirmationScope = { purpose: 'gift', target: '51111', prizeName: '冰淇淋代金券', couponId: 'COUPON_A' };
const confirmation: TargetConfirmation = { confirmationToken: 'EPHEMERAL_SECRET', expiresAt: new Date(NOW + 60_000).toISOString(),
  target: { dlmId: 'DLM_TARGET', discordUserId: '223456789012345678', peiwanId: 51111, displayName: '目标陪玩' },
  selectedVoucher: { source: 'coupon', voucherId: 'COUPON_A', prizeName: '冰淇淋代金券' } };
const intent = giftIntentForConfirmation(actor, scope, confirmation, '冰淇淋');
const input = { scope, confirmation, intent, path: '/api/lottery/use', body: { mode: 'gift', target: scope.target, prizeName: scope.prizeName, couponId: scope.couponId } };
const response = (value: unknown, status = 200) => Response.json(value, { status });
const review = (status: GiftExecutionReview['status'] = 'COMPLETED', verified = true): GiftExecutionReview => ({ requestId: ID, status, verified,
  intent, giftName: '冰淇淋', quantity: '1', giftAuditId: status === 'COMPLETED' ? 'GA_1' : null,
  transactionId: status === 'COMPLETED' ? 'TX_1' : null, individualTransactionId: status === 'COMPLETED' ? 'IT_1' : null,
  gross: status === 'COMPLETED' ? '10' : null, payable: status === 'COMPLETED' ? '0' : null,
  reverted: false, reverts: [], message: status === 'COMPLETED' ? '原赠礼完成凭证已核实' : status === 'ABANDONED' ? '原请求已终止，不执行退款' : '等待核实，勿重复付款' });
function storage() {
  const rows = new Map<string, string>();
  return { rows, getItem: (key: string) => rows.get(key) ?? null, setItem: (key: string, value: string) => { rows.set(key, value); }, removeItem: (key: string) => { rows.delete(key); } };
}
function mutex() {
  const locks = new Map<string, Promise<unknown>>();
  return async <T>(key: string, work: () => Promise<T>): Promise<T> => {
    const old = locks.get(key) ?? Promise.resolve(); const next = old.then(work, work); locks.set(key, next.catch(() => undefined)); return next;
  };
}
function fixture(options: { run?: (path: string, body: Record<string, unknown> | null) => Promise<Response> | Response; store?: ReturnType<typeof storage>; locks?: ReturnType<typeof mutex>; identity?: GiftActor; newId?: () => string; notify?: () => void; register?: (body: Record<string, unknown>, record: GiftRecoveryRecord) => Promise<Response> | Response } = {}) {
  const store = options.store ?? storage(); const calls: { path: string; body: Record<string, unknown> | null }[] = []; const registrations: Record<string, unknown>[] = []; const steps: string[] = []; let ids = 0;
  const controller = createGiftExecutionController({ actor: options.identity ?? actor, kind: 'VOUCHER_GIFT', storage: store,
    exclusive: options.locks ?? mutex(), now: () => NOW, newId: () => { ids++; return options.newId?.() ?? ID; }, notify: options.notify,
    fetch: (async (url, init) => { const path = String(url), body = init?.body ? JSON.parse(String(init.body)) : null; steps.push(path);
      if (path === '/api/profile/gift-executions/prepare') {
        registrations.push(body);
        return options.register ? options.register(body, controller.getSnapshot().record!) : response({ ok: true, created: true, record: controller.getSnapshot().record! });
      }
      calls.push({ path, body });
      return options.run ? options.run(path, body) : response({ error: 'offline' }, 503); }) as typeof fetch });
  controller.refresh(); return { controller, store, calls, registrations, steps, ids: () => ids };
}

test('identity is registered before the single financial POST; cached intent excludes the confirmation token', async () => {
  const store = storage(); const f = fixture({ store, run: (path, body) => {
    if (path === input.path) { const saved = JSON.parse(store.getItem(giftRecoveryKey(actor, 'VOUCHER_GIFT'))!).records[0];
      assert.equal(saved.requestId, ID); assert.deepEqual(saved.intent, intent); assert.equal(JSON.stringify(saved).includes('EPHEMERAL_SECRET'), false);
      assert.equal(body!.confirmationToken, 'EPHEMERAL_SECRET'); return response({ ok: true }); }
    return response({ ok: true, review: review() });
  } });
  await f.controller.submit(input); assert.equal(f.calls.length, 2); assert.equal(f.calls[1].body, null);
  assert.equal(f.controller.getSnapshot().completed?.review.verified, true); assert.equal(f.ids(), 1);
  assert.equal(f.controller.getSnapshot().completed?.record.requestId, ID);
  assert.equal(f.controller.getSnapshot().record, null); assert.equal(f.controller.getSnapshot().review, null);
  assert.equal(await f.controller.clearConfirmed(), false); assert.equal(f.store.rows.size, 0);
});

test('lost response survives reload and a separate gift gets a new ID without replacing the old request', async () => {
  const store = storage(); const f = fixture({ store, run: () => { throw new Error('offline'); } });
  await f.controller.submit(input); assert.equal(f.calls.length, 1); assert.equal(await f.controller.clearConfirmed(), false);
  const refreshed = fixture({ store, newId: () => NEXT_ID });
  assert.equal(refreshed.calls.length, 0); assert.equal(refreshed.controller.getSnapshot().record?.requestId, ID);
  await refreshed.controller.query(); assert.equal(refreshed.calls.length, 1); assert.equal(refreshed.calls[0].body, null);
  await refreshed.controller.submit(structuredClone(input));
  assert.deepEqual(refreshed.controller.getSnapshot().records.map(row => row.requestId), [ID, NEXT_ID]);
  assert.equal(refreshed.calls[1].body?.requestId, NEXT_ID);
  assert.equal(refreshed.controller.getSnapshot().records[0].phase, 'UNCONFIRMED');
});

test('two browser controllers preserve both independent gifts under the shared storage lock', async () => {
  const store = storage(), locks = mutex();
  const a = fixture({ store, locks }), b = fixture({ store, locks, newId: () => NEXT_ID });
  await Promise.all([a.controller.submit(input), b.controller.submit(structuredClone(input))]);
  a.controller.refresh(); b.controller.refresh();
  assert.equal(a.calls.length + b.calls.length, 2); assert.equal(a.ids() + b.ids(), 2);
  assert.deepEqual(a.controller.getSnapshot().records.map(row => row.requestId), [ID, NEXT_ID]);
  assert.deepEqual(b.controller.getSnapshot().records, a.controller.getSnapshot().records);
});

for (const failure of ['read', 'write', 'readback', 'lock'] as const) test(`${failure} unavailable still registers server identity before the financial POST`, async () => {
  const store = storage();
  if (failure === 'read') store.getItem = () => { throw new Error('blocked'); };
  if (failure === 'write') store.setItem = () => { throw new Error('quota'); };
  if (failure === 'readback') store.setItem = () => undefined;
  const f = fixture({ store, ...(failure === 'lock' ? { locks: async () => { throw new Error('unsupported'); } } : {}) });
  await f.controller.submit(input);
  assert.equal(f.calls.length, 1); assert.equal(f.registrations.length, 1);
  assert.deepEqual(f.steps, ['/api/profile/gift-executions/prepare', input.path]);
  assert.equal(f.controller.getSnapshot().storageError, failure !== 'lock');
  assert.equal(f.controller.getSnapshot().record?.requestId, ID);
});

test('storage corruption is preserved while a new request uses authoritative server registration', async () => {
  const store = storage(); store.setItem(giftRecoveryKey(actor, 'VOUCHER_GIFT'), '{broken');
  const f = fixture({ store }); await f.controller.submit(input);
  assert.equal(f.calls.length, 1); assert.equal(f.registrations.length, 1); assert.equal(f.controller.getSnapshot().storageError, true);
  assert.equal(store.getItem(giftRecoveryKey(actor, 'VOUCHER_GIFT')), '{broken');
});

test('identity namespace isolates the prior user request and does not expose its summary', async () => {
  const store = storage(); const old = fixture({ store }); await old.controller.submit(input);
  const other = fixture({ store, identity: { dlmId: 'DLM_OTHER', discordId: '323456789012345678' } });
  assert.equal(other.controller.getSnapshot().record, null); assert.notEqual(other.controller.key, old.controller.key);
  await other.controller.submit(input); assert.equal(other.calls.length, 0); assert.equal(store.rows.size, 1);
});

test('same DLM with a changed Discord login has an isolated namespace', () => {
  assert.notEqual(giftRecoveryKey(actor, 'VOUCHER_GIFT'), giftRecoveryKey({ ...actor, discordId: 'other' }, 'VOUCHER_GIFT'));
});

for (const changed of ['target', 'voucher', 'path', 'intent', 'expired', 'invalidExpiry'] as const) test(`changed ${changed} cannot submit the confirmed financial request`, async () => {
  const f = fixture(); const next = structuredClone(input);
  if (changed === 'target') next.body.target = '52222';
  if (changed === 'voucher') next.body.couponId = 'COUPON_B';
  if (changed === 'path') next.path = '/api/voucher/use';
  if (changed === 'intent') next.intent.receiverDiscordId = '323456789012345678';
  if (changed === 'expired') next.confirmation.expiresAt = new Date(NOW - 1).toISOString();
  if (changed === 'invalidExpiry') next.confirmation.expiresAt = 'invalid';
  await f.controller.submit(next); assert.equal(f.calls.length, 0); assert.equal(f.ids(), 0);
});

test('only a matching explicit pre-forward rejection allows cancellation and reconfirmation', async () => {
  const f = fixture({ run: () => response({ not_forwarded: true, requestId: ID, error: '目标确认已失效，请重新查询' }, 409) });
  await f.controller.submit(input); assert.equal(f.controller.getSnapshot().record?.phase, 'NOT_SENT');
  assert.equal(f.calls.length, 1); assert.equal(await f.controller.clearConfirmed(), true);
});
for (const result of [response({ error: 'rejected' }, 400), response({ error: 'changed', code: 'TARGET_CONFIRMATION_REQUIRED' }, 409),
  response({ not_forwarded: true, requestId: 'wrong' }, 409)]) test(`forwarded or mismatched rejection ${result.status} never discards an unconfirmed request`, async () => {
  const f = fixture({ run: () => result }); await f.controller.submit(input);
  assert.equal(f.controller.getSnapshot().record?.phase, 'UNCONFIRMED'); assert.equal(await f.controller.clearConfirmed(), false);
});

test('404 is not absence-of-charge proof; explicit abandon sends persisted intent then verifies terminal GET', async () => {
  let abandoned = false; const f = fixture({ run: (path, body) => {
    if (path === input.path) return response({}, 503);
    if (path.endsWith('/abandon')) { assert.deepEqual(body, { requestId: ID, intent }); abandoned = true; return response({ ok: true }); }
    return abandoned ? response({ ok: true, review: review('ABANDONED') }) : response({ message: '未找到不代表未扣费' }, 404);
  } });
  await f.controller.submit(input); await f.controller.query(); assert.equal(f.controller.getSnapshot().missing, true);
  assert.equal(await f.controller.clearConfirmed(), false); await f.controller.abandon();
  assert.equal(f.controller.getSnapshot().review?.status, 'ABANDONED'); assert.equal(f.calls.filter(c => c.path === input.path).length, 1);
  assert.equal(await f.controller.clearConfirmed(), true);
});

test('abandon racing a committed gift shows original completion and does not refund or repeat it', async () => {
  let complete = false; const f = fixture({ run: path => {
    if (path === input.path) return response({}, 503);
    if (path.endsWith('/abandon')) { complete = true; return response({ status: 'COMPLETED' }); }
    return response({ ok: true, review: review(complete ? 'COMPLETED' : 'PENDING', complete) });
  } });
  await f.controller.submit(input); await f.controller.query(); await f.controller.abandon();
  assert.equal(f.controller.getSnapshot().completed?.review.transactionId, 'TX_1'); assert.equal(f.calls.filter(c => c.path === input.path).length, 1);
  assert.equal(f.controller.getSnapshot().record, null); assert.equal(f.store.rows.size, 0);
});

test('unknown abandonment response preserves the original request until a verified terminal GET', async () => {
  const f = fixture({ run: path => path.includes('?') ? response({ ok: true, review: review('PENDING', false) }) : response({}, 503) });
  await f.controller.submit(input); await f.controller.query(); await f.controller.abandon();
  assert.equal(f.controller.getSnapshot().review?.status, 'PENDING'); assert.equal(await f.controller.clearConfirmed(), false);
});

for (const invalid of ['request', 'intent', 'unverified'] as const) test(`query ${invalid} mismatch never confirms or clears the original financial operation`, async () => {
  const data = review(); if (invalid === 'request') data.requestId = 'wrong'; if (invalid === 'intent') data.intent = { ...intent, couponVoucherId: 'OTHER' }; if (invalid === 'unverified') data.verified = false;
  const f = fixture({ run: path => path.includes('?') ? response({ ok: true, review: data }) : response({ ok: true }) });
  await f.controller.submit(input); assert.equal(await f.controller.clearConfirmed(), false);
});

test('uppercase generated UUID canonicalizes once and quantity preserves the existing decimal policy', async () => {
  const f = fixture({ newId: () => ID.toUpperCase() }); await f.controller.submit(input); assert.equal(f.calls[0].body?.requestId, ID);
  assert.equal(giftQuantityText(0.00000125), '0.00000125'); assert.equal(giftQuantityText(1e21), '1000000000000000000000');
  assert.equal(giftQuantityText(1.234567), '1.234567');
});

test('malformed cached intent is not rendered or overwritten; server registration allows a separate request', async () => {
  const store = storage(); const f = fixture({ store }); await f.controller.submit(input);
  const raw = JSON.parse(store.getItem(f.controller.key)!); raw.records[0].intent.giftName = { arbitrary: true }; store.setItem(f.controller.key, JSON.stringify(raw));
  const refreshed = fixture({ store, newId: () => NEXT_ID }); assert.equal(refreshed.controller.getSnapshot().storageError, true);
  assert.equal(refreshed.controller.getSnapshot().record, null);
  await refreshed.controller.submit(input); assert.equal(refreshed.calls.length, 1); assert.equal(refreshed.registrations.length, 1);
});

test('malformed COMPLETED JSON without the mandatory receipt identifiers cannot unlock', async () => {
  const data = { ...review(), giftAuditId: null, transactionId: null, individualTransactionId: null };
  const f = fixture({ run: path => path.includes('?') ? response({ ok: true, review: data }) : response({ ok: true }) });
  await f.controller.submit(input); assert.equal(f.controller.getSnapshot().review, null); assert.equal(await f.controller.clearConfirmed(), false);
});

test('delegated gift fixes payer, operator and decimal quantity in the durable record', async () => {
  const delegatedScope: TargetConfirmationScope = { purpose: 'delegated-gift', target: '51111', payerDlmId: 'DLM_BOSS', giftName: '冰淇淋', quantity: 1.234567 };
  const card: TargetConfirmation = { ...confirmation, payer: { dlmId: 'DLM_BOSS', discordUserId: null, displayName: '微信老板' }, selectedVoucher: undefined };
  const store = storage(); const bodies: unknown[] = [];
  const controller = createGiftExecutionController({ actor, kind: 'DELEGATED_GIFT', storage: store, exclusive: mutex(), now: () => NOW, newId: () => ID,
    fetch: (async (url, init) => { if (String(url).endsWith('/prepare')) return response({ ok: true, created: true, record: controller.getSnapshot().record! });
      bodies.push(JSON.parse(String(init?.body))); return response({}, 503); }) as typeof fetch });
  controller.refresh(); await controller.submit({ scope: delegatedScope, confirmation: card, intent: giftIntentForConfirmation(actor, delegatedScope, card, '冰淇淋'),
    path: '/api/admin/wechat-bosses/delegated-gift', body: { dlmId: 'DLM_BOSS', peiwanId: '51111', giftName: '冰淇淋', quantity: 1.234567 } });
  assert.equal(bodies.length, 1); const saved = controller.getSnapshot().record!;
  assert.equal(saved.intent.payerDlmId, 'DLM_BOSS'); assert.equal(saved.intent.payerDiscordId, null);
  assert.equal(saved.intent.operatorDiscordId, actor.discordId); assert.equal(saved.intent.quantity, '1.234567'); assert.equal(saved.intent.feedAnonymous, true);
  assert.equal(saved.intent.couponVoucherId, null); assert.equal(saved.intent.notifyGiverPointsDm, false);
});

test('verified completion readies the next gift with a fresh UUID and preserves the receipt until the next save', async () => {
  let next = false;
  const f = fixture({ newId: () => next ? NEXT_ID : ID, run: (path, body) => {
    if (path === input.path) {
      assert.equal(f.controller.getSnapshot().completed, null);
      assert.equal(body?.requestId, next ? NEXT_ID : ID);
      return next ? response({}, 503) : response({ ok: true });
    }
    return response({ ok: true, review: review() });
  } });
  await f.controller.submit(input);
  assert.equal(f.controller.getSnapshot().completed?.record.requestId, ID);
  f.controller.refresh(); await f.controller.query();
  assert.equal(f.controller.getSnapshot().completed?.review.transactionId, 'TX_1');
  assert.equal(f.calls.length, 2); // Refresh/query do not create another gift.
  next = true;
  await f.controller.submit(input); // Same still-rendered confirmation cannot become a second gift.
  assert.equal(f.calls.length, 2); assert.equal(f.ids(), 1);
  assert.equal(f.controller.getSnapshot().completed?.record.requestId, ID);
  await f.controller.submit(structuredClone(input)); // A new lookup may legitimately return the same token text.
  assert.equal(f.controller.getSnapshot().record?.requestId, NEXT_ID);
  assert.equal(f.controller.getSnapshot().completed, null); assert.equal(f.ids(), 2);
  assert.equal(f.calls.filter(call => call.body).length, 2);
});

test('a lost POST followed by verified read-only completion auto-clears without any resend', async () => {
  const f = fixture({ run: path => {
    if (path === input.path) throw new Error('response_lost_after_commit');
    return response({ ok: true, review: review() });
  } });
  await f.controller.submit(input);
  assert.equal(f.controller.getSnapshot().completed, null); assert.equal(f.store.rows.size, 1);
  await f.controller.query();
  assert.equal(f.controller.getSnapshot().completed?.review.giftAuditId, 'GA_1');
  assert.equal(f.controller.getSnapshot().record, null); assert.equal(f.store.rows.size, 0);
  assert.deepEqual(f.calls.map(call => call.body?.requestId ?? null), [ID, null]);
});

for (const state of ['PENDING', 'REQUIRES_REVIEW', 'unverified', 'missing', 'unknown'] as const) test(`raw POST success followed by ${state} retains the original while allowing a distinct gift`, async () => {
  let ids = 0;
  const f = fixture({ newId: () => ids++ ? NEXT_ID : ID, run: path => {
    if (path === input.path) return response({ ok: true });
    if (state === 'missing') return response({ message: '未找到不代表未扣款' }, 404);
    if (state === 'unknown') throw new Error('network');
    return response({ ok: true, review: review(state === 'unverified' ? 'COMPLETED' : state, false) });
  } });
  await f.controller.submit(input);
  assert.equal(f.controller.getSnapshot().completed, null); assert.equal(f.controller.getSnapshot().record?.requestId, ID);
  assert.equal(f.store.rows.size, 1); assert.equal(await f.controller.clearConfirmed(), false);
  await f.controller.submit(structuredClone(input));
  assert.equal(f.calls.filter(call => call.path === input.path).length, 2); assert.equal(f.ids(), 2);
  assert.deepEqual(f.controller.getSnapshot().records.map(row => row.requestId), [ID, NEXT_ID]);
});

for (const failure of ['remove-throws', 'remove-ignored', 'readback-throws'] as const) test(`completion cache cleanup ${failure} does not block verified success or a new registered gift`, async () => {
  const store = storage(); const getItem = store.getItem; let removed = false; let ids = 0;
  if (failure === 'remove-throws') store.removeItem = () => { throw new Error('blocked'); };
  if (failure === 'remove-ignored') store.removeItem = () => undefined;
  if (failure === 'readback-throws') {
    const remove = store.removeItem;
    store.removeItem = key => { remove(key); removed = true; };
    store.getItem = key => { if (removed) throw new Error('read_failed'); return getItem(key); };
  }
  const f = fixture({ store, newId: () => ids++ ? NEXT_ID : ID,
    run: path => path === input.path ? response({ ok: true }) : response({ ok: true, review: review() }) });
  await f.controller.submit(input);
  assert.equal(f.controller.getSnapshot().storageError, true);
  assert.equal(f.controller.getSnapshot().completed?.record.requestId, ID);
  assert.equal(f.controller.getSnapshot().record, null);
  await f.controller.submit(structuredClone(input));
  assert.equal(f.calls.filter(call => call.path === input.path).length, 2); assert.equal(f.registrations.length, 2);
});

for (const change of ['same-id-changed-record'] as const) test(`completion lock preserves ${change} written while waiting to clear`, async () => {
  const store = storage(); const lock = mutex(); let locks = 0;
  const f = fixture({ store, locks: (key, work) => lock(key, async () => {
    if (++locks === 3) {
      const replacement = JSON.parse(store.getItem(key)!);
      replacement.records[0].phase = 'NOT_SENT';
      store.setItem(key, JSON.stringify(replacement));
    }
    return work();
  }), run: path => path === input.path ? response({ ok: true }) : response({ ok: true, review: review() }) });
  await f.controller.submit(input);
  assert.equal(locks, 3); assert.equal(f.store.rows.size, 1);
  assert.equal(f.controller.getSnapshot().record?.requestId, ID);
  assert.equal(f.controller.getSnapshot().record?.phase, 'NOT_SENT');
  assert.equal(f.controller.getSnapshot().completed, null);
});

test('late verified GET cannot clear a same-ID record whose content changed during the request', async () => {
  let resolve!: (response: Response) => void;
  const pending = new Promise<Response>(done => { resolve = done; });
  const f = fixture({ run: path => path === input.path ? response({}, 503) : pending });
  await f.controller.submit(input);
  const query = f.controller.query();
  const replacement = { ...f.controller.getSnapshot().record!, phase: 'NOT_SENT' };
  f.store.setItem(f.controller.key, JSON.stringify({ version: 2, records: [replacement] }));
  resolve(response({ ok: true, review: review() })); await query;
  assert.equal(f.controller.getSnapshot().completed, null); assert.deepEqual(f.controller.getSnapshot().record, replacement);
  assert.equal(f.store.rows.size, 1);
});

test('completion publishes the receipt before notifying other listeners and rejects synchronous duplicate submission', async () => {
  const observed: Array<{ completed: string | undefined; record: string | undefined; busy: boolean }> = [];
  const f = fixture({ notify: () => {
    const state = controller.getSnapshot();
    observed.push({ completed: state.completed?.record.requestId, record: state.record?.requestId, busy: state.busy });
    if (state.completed) { controller.refresh(); void controller.submit(input); }
  }, run: path => path === input.path ? response({ ok: true }) : response({ ok: true, review: review() }) });
  const controller = f.controller;
  await Promise.all([controller.submit(input), controller.submit(input)]);
  assert.deepEqual(observed, [
    { completed: undefined, record: ID, busy: true },
    { completed: undefined, record: ID, busy: true },
    { completed: ID, record: undefined, busy: true },
  ]);
  assert.equal(controller.getSnapshot().completed?.review.transactionId, 'TX_1');
  assert.equal(controller.getSnapshot().busy, false);
  assert.equal(f.calls.filter(call => call.path === input.path).length, 1);
});

test('legacy single-request storage upgrades only when a new gift is durably added', async () => {
  const f = fixture(); await f.controller.submit(input);
  const original = f.controller.getSnapshot().record!;
  f.store.setItem(f.controller.key, JSON.stringify(original));
  const next = fixture({ store: f.store, newId: () => NEXT_ID });
  assert.deepEqual(next.controller.getSnapshot().records, [JSON.parse(JSON.stringify(original))]);
  assert.equal(JSON.parse(f.store.getItem(f.controller.key)!).version, 1);
  await next.controller.submit(structuredClone(input));
  assert.equal(JSON.parse(f.store.getItem(f.controller.key)!).version, 2);
  assert.deepEqual(next.controller.getSnapshot().records.map(row => row.requestId), [ID, NEXT_ID]);
});

test('a slow POST does not hold the browser lock or prevent an independent gift in another tab', async () => {
  let resolve!: (value: Response) => void;
  const pending = new Promise<Response>(done => { resolve = done; });
  const store = storage(), locks = mutex();
  const a = fixture({ store, locks, run: () => pending });
  const b = fixture({ store, locks, newId: () => NEXT_ID });
  const first = a.controller.submit(input);
  while (!a.calls.length) await new Promise(done => setImmediate(done));
  await b.controller.submit(structuredClone(input));
  assert.equal(b.calls[0].body?.requestId, NEXT_ID);
  assert.deepEqual(b.controller.getSnapshot().records.map(row => row.requestId), [ID, NEXT_ID]);
  resolve(response({ not_forwarded: true, requestId: ID }, 409)); await first;
  assert.deepEqual(a.controller.getSnapshot().records.map(row => [row.requestId, row.phase]), [[ID, 'NOT_SENT'], [NEXT_ID, 'UNCONFIRMED']]);
});

test('selecting and confirming an older request clears only that ID and leaves the other request recoverable', async () => {
  let ids = 0;
  const f = fixture({ newId: () => ids++ ? NEXT_ID : ID, run: path => path.includes('?') ? response({ ok: true, review: review() }) : response({}, 503) });
  await f.controller.submit(input); await f.controller.submit(structuredClone(input));
  const version = f.controller.getSnapshot().draftVersion;
  f.controller.select(ID);
  assert.equal(f.controller.getSnapshot().record?.requestId, ID);
  assert.equal(f.controller.getSnapshot().draftVersion, version);
  await f.controller.query();
  assert.deepEqual(f.controller.getSnapshot().records.map(row => row.requestId), [NEXT_ID]);
  assert.equal(f.controller.getSnapshot().completed?.record.requestId, ID);
  assert.equal(f.controller.getSnapshot().record?.requestId, NEXT_ID);
  const fresh = fixture({ store: f.store });
  assert.equal(fresh.controller.getSnapshot().record?.requestId, NEXT_ID);
  assert.equal(f.calls.filter(call => call.path === input.path).length, 2);
});

test('startNew retains all unknown records and never resends or abandons them', async () => {
  const f = fixture(); await f.controller.submit(input);
  const persisted = f.store.getItem(f.controller.key);
  assert.equal(f.controller.startNew(), true);
  assert.equal(f.controller.getSnapshot().draftVersion, 1);
  assert.equal(f.store.getItem(f.controller.key), persisted);
  await f.controller.submit(input); // A repeated click on the same confirmation is still not a new intent.
  assert.equal(f.calls.length, 1); assert.equal(f.ids(), 1);
});

test('clearing a known not-forwarded request preserves a different unknown gift', async () => {
  let ids = 0;
  const f = fixture({ newId: () => ids++ ? NEXT_ID : ID, run: (_, body) => body?.requestId === ID
    ? response({ not_forwarded: true, requestId: ID }, 409) : response({}, 503) });
  await f.controller.submit(input); await f.controller.submit(structuredClone(input));
  f.controller.select(ID); assert.equal(await f.controller.clearConfirmed(), true);
  assert.deepEqual(f.controller.getSnapshot().records.map(row => row.requestId), [NEXT_ID]);
  assert.equal(f.controller.getSnapshot().record?.phase, 'UNCONFIRMED');
});

test('a colliding UUID never overwrites or resends an unresolved request', async () => {
  const f = fixture(); await f.controller.submit(input); const before = f.store.getItem(f.controller.key);
  await f.controller.submit(structuredClone(input));
  assert.equal(f.calls.length, 1); assert.equal(f.store.getItem(f.controller.key), before);
  assert.equal(f.registrations.length, 1);
});

test('delegated gifts can continue after an unknown result with separate payer and recipient facts', async () => {
  let ids = 0;
  const calls: Record<string, unknown>[] = [];
  const controller = createGiftExecutionController({ actor, kind: 'DELEGATED_GIFT', storage: storage(), exclusive: mutex(),
    now: () => NOW, newId: () => ids++ ? NEXT_ID : ID,
    fetch: (async (url, init) => { if (String(url).endsWith('/prepare')) return response({ ok: true, created: true, record: controller.getSnapshot().record! });
      calls.push(JSON.parse(String(init?.body))); throw new Error('network'); }) as typeof fetch });
  controller.refresh();
  for (const [payer, target] of [['BOSS_A', '51111'], ['BOSS_B', '52222']]) {
    const scope: TargetConfirmationScope = { purpose: 'delegated-gift', target, payerDlmId: payer, giftName: '冰淇淋', quantity: 2 };
    const card: TargetConfirmation = { ...confirmation, target: { ...confirmation.target, dlmId: `TARGET_${target}`, peiwanId: Number(target) },
      payer: { dlmId: payer, discordUserId: null, displayName: payer }, selectedVoucher: undefined };
    await controller.submit({ scope, confirmation: card, intent: giftIntentForConfirmation(actor, scope, card, '冰淇淋'),
      path: '/api/admin/wechat-bosses/delegated-gift', body: { dlmId: payer, peiwanId: target, giftName: '冰淇淋', quantity: 2 } });
  }
  assert.deepEqual(calls.map(row => [row.requestId, row.dlmId, row.peiwanId]), [[ID, 'BOSS_A', '51111'], [NEXT_ID, 'BOSS_B', '52222']]);
  assert.deepEqual(controller.getSnapshot().records.map(row => row.intent.payerDlmId), ['BOSS_A', 'BOSS_B']);
});

function serverRecord(requestId = ID): GiftRecoveryRecord {
  return { version: 1, actor, requestId, kind: 'VOUCHER_GIFT', createdAt: new Date(NOW).toISOString(), phase: 'UNCONFIRMED', intent,
    target: { ...confirmation.target, discordUserId: confirmation.target.discordUserId!, peiwanId: confirmation.target.peiwanId! },
    payerDisplayName: actor.dlmId, scope };
}

test('prepare receives only the original ID, kind, scope and ephemeral confirmation before financial submission', async () => {
  const f = fixture({ register: (body, record) => {
    assert.deepEqual(body, { requestId: ID, kind: 'VOUCHER_GIFT', scope: JSON.parse(JSON.stringify(scope)), confirmationToken: 'EPHEMERAL_SECRET' });
    assert.equal(f.calls.length, 0);
    return response({ ok: true, created: true, record: { ...record, createdAt: new Date(NOW + 1000).toISOString(), payerDisplayName: '服务器付款人' } });
  } });
  await f.controller.submit(input);
  assert.deepEqual(f.steps, ['/api/profile/gift-executions/prepare', input.path]);
  assert.equal(f.controller.getSnapshot().record?.payerDisplayName, '服务器付款人');
  assert.equal(f.controller.getSnapshot().record?.createdAt, new Date(NOW + 1000).toISOString());
  assert.equal(f.calls[0].body?.requestId, ID);
  assert.equal(f.store.getItem(f.controller.key)?.includes('EPHEMERAL_SECRET'), false);
});

for (const failure of ['network', 'http-error', 'malformed', 'no-created', 'created-string', 'wrong-id', 'wrong-actor', 'wrong-intent', 'wrong-target', 'wrong-kind'] as const) {
  test(`unconfirmed preparation ${failure} sends no financial request and preserves the original ID`, async () => {
    const f = fixture({ register: (_, record) => {
      if (failure === 'network') throw new Error('lost_registration_response');
      if (failure === 'http-error') return response({ message: 'unknown' }, 503);
      if (failure === 'malformed') return new Response('bad-json');
      if (failure === 'no-created') return response({ ok: true, record });
      if (failure === 'created-string') return response({ ok: true, created: 'true', record });
      const altered = structuredClone(record);
      if (failure === 'wrong-id') altered.requestId = NEXT_ID;
      if (failure === 'wrong-actor') altered.actor.dlmId = 'OTHER';
      if (failure === 'wrong-intent') altered.intent.giftName = 'OTHER';
      if (failure === 'wrong-target') altered.target.dlmId = 'OTHER';
      if (failure === 'wrong-kind') altered.kind = 'DELEGATED_GIFT';
      return response({ ok: true, created: true, record: altered });
    } });
    await f.controller.submit(input);
    assert.equal(f.calls.length, 0); assert.equal(f.registrations.length, 1);
    assert.equal(f.controller.getSnapshot().record?.requestId, ID);
    assert.equal(f.controller.getSnapshot().busy, false);
    f.controller.refresh(); assert.equal(f.registrations.length, 1);
    await f.controller.submit(input); assert.equal(f.registrations.length, 1);
  });
}

test('matching existing registration is queried without re-executing even if already completed', async () => {
  const f = fixture({ register: (_, record) => response({ ok: true, created: false, record }),
    run: () => response({ ok: true, review: review() }) });
  await f.controller.submit(input);
  assert.equal(f.calls.length, 0); assert.equal(f.registrations.length, 1);
  await f.controller.query();
  assert.equal(f.calls.length, 1); assert.equal(f.calls[0].body, null);
  assert.equal(f.controller.getSnapshot().completed?.prepareNext, false);
});

test('server registration is recoverable on another device after the prepare response is lost, without executing the gift', async () => {
  const registered: GiftRecoveryRecord[] = [];
  const first = fixture({ register: (_, record) => { registered.push(JSON.parse(JSON.stringify(record))); throw new Error('response_lost'); } });
  await first.controller.submit(input); assert.equal(first.calls.length, 0);
  const another = fixture({ run: path => path.includes('/recovery?')
    ? response({ ok: true, records: registered, nextCursor: null }) : response({ ok: true, review: review('PENDING', false) }) });
  await another.controller.refreshHistory();
  assert.equal(another.controller.getSnapshot().record?.requestId, ID);
  await another.controller.query();
  assert.equal(another.controller.getSnapshot().review?.status, 'PENDING');
  assert.equal(another.registrations.length, 0);
  assert.equal(another.calls.every(call => call.body === null), true);
});

test('a device with no browser storage or locks can prepare, submit once, and verify through the server', async () => {
  const paths: string[] = [];
  const controller = createGiftExecutionController({ actor, kind: 'VOUCHER_GIFT', newId: () => ID, now: () => NOW,
    fetch: (async url => {
      const path = String(url); paths.push(path);
      if (path.endsWith('/prepare')) return response({ ok: true, created: true, record: serverRecord() });
      if (path === input.path) return response({ ok: true });
      return response({ ok: true, review: review() });
    }) as typeof fetch });
  controller.refresh(); await controller.submit(input);
  assert.equal(controller.getSnapshot().storageError, true);
  assert.equal(controller.getSnapshot().completed?.review.transactionId, 'TX_1');
  assert.deepEqual(paths, ['/api/profile/gift-executions/prepare', input.path, `/api/profile/gift-executions?requestId=${ID}`]);
});

test('recovery includes a recent completed gift on a fresh device and only read-only verification reveals its outcome', async () => {
  const f = fixture({ run: path => path.includes('/recovery?')
    ? response({ ok: true, records: [serverRecord()], nextCursor: null }) : response({ ok: true, review: review() }) });
  await f.controller.refreshHistory();
  assert.equal(f.controller.getSnapshot().completed, null);
  assert.equal(f.controller.getSnapshot().record?.requestId, ID);
  assert.equal(f.controller.getSnapshot().draftVersion, 0);
  await f.controller.query();
  assert.equal(f.controller.getSnapshot().completed?.prepareNext, false);
  assert.equal(f.controller.getSnapshot().draftVersion, 0);
  assert.equal(f.registrations.length, 0); assert.equal(f.calls.every(call => call.body === null), true);
});

test('history pagination merges records and preserves the selected request and current draft', async () => {
  const f = fixture({ run: path => response({ ok: true, records: [serverRecord(path.includes('cursor=') ? NEXT_ID : ID)], nextCursor: path.includes('cursor=') ? null : 'page2' }) });
  await f.controller.refreshHistory(); const selected = f.controller.getSnapshot().record?.requestId;
  await f.controller.loadMoreHistory();
  assert.equal(f.controller.getSnapshot().record?.requestId, selected);
  assert.deepEqual(f.controller.getSnapshot().records.map(row => row.requestId), [ID, NEXT_ID]);
  assert.equal(f.controller.getSnapshot().draftVersion, 0);
  assert.equal(f.controller.getSnapshot().nextCursor, null);
  assert.equal(f.calls[1].path, '/api/profile/gift-executions/recovery?kind=VOUCHER_GIFT&cursor=page2');
});

for (const problem of ['foreign-actor', 'foreign-kind', 'intent-conflict', 'duplicate', 'bad-cursor', 'network'] as const) test(`invalid history ${problem} never replaces an existing unknown record`, async () => {
  const f = fixture({ run: path => {
    if (!path.includes('/recovery?')) return response({}, 503);
    if (problem === 'network') throw new Error('offline');
    const row = serverRecord();
    if (problem === 'foreign-actor') row.actor = { ...actor, dlmId: 'OTHER' };
    if (problem === 'foreign-kind') row.kind = 'DELEGATED_GIFT';
    if (problem === 'intent-conflict') row.intent = { ...intent, giftName: 'different' };
    return response({ ok: true, records: problem === 'duplicate' ? [row, row] : [row], nextCursor: problem === 'bad-cursor' ? {} : null });
  } });
  await f.controller.submit(input); const before = JSON.stringify(f.controller.getSnapshot().record);
  await f.controller.refreshHistory();
  assert.ok(f.controller.getSnapshot().historyError);
  assert.equal(JSON.stringify(f.controller.getSnapshot().record), before);
  assert.equal(f.calls.filter(call => call.path === input.path).length, 1);
});

test('a late history response cannot remove a newly submitted gift or select an older request over it', async () => {
  let finish!: (value: Response) => void;
  const waiting = new Promise<Response>(resolve => { finish = resolve; });
  const f = fixture({ newId: () => NEXT_ID, run: path => path.includes('/recovery?') ? waiting : response({}, 503) });
  const history = f.controller.refreshHistory();
  await f.controller.submit(input);
  finish(response({ ok: true, records: [serverRecord()], nextCursor: null })); await history;
  assert.deepEqual(f.controller.getSnapshot().records.map(row => row.requestId), [NEXT_ID, ID]);
  assert.equal(f.controller.getSnapshot().record?.requestId, NEXT_ID);
  assert.equal(f.controller.getSnapshot().draftVersion, 0);
});

test('legacy cache requests are queryable but history hydration never registers or resends them', async () => {
  const store = storage(); store.setItem(giftRecoveryKey(actor, 'VOUCHER_GIFT'), JSON.stringify(serverRecord()));
  const f = fixture({ store, run: () => response({ ok: true, records: [serverRecord(NEXT_ID)], nextCursor: null }) });
  await f.controller.refreshHistory();
  assert.deepEqual(f.controller.getSnapshot().records.map(row => row.requestId), [ID, NEXT_ID]);
  assert.equal(f.registrations.length, 0); assert.equal(f.calls.length, 1); assert.equal(f.calls[0].body, null);
});

test('cryptographic UUID fallback supports browsers without randomUUID', () => {
  const fallback = { getRandomValues: (array: Uint8Array) => { array.fill(255); return array; } } as unknown as Pick<Crypto, 'getRandomValues'>;
  const id = newGiftRequestId(fallback);
  assert.equal(id, 'ffffffff-ffff-4fff-bfff-ffffffffffff'); assert.equal(isGiftRequestId(id), true);
});
