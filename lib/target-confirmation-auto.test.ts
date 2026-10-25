import assert from 'node:assert/strict';
import test from 'node:test';
import { createTargetConfirmationController, type TargetConfirmationScope } from './target-confirmation-client';
import { canAutoLookupTarget, createTargetConfirmationAutoLookup } from './target-confirmation-auto';

const NOW = Date.parse('2026-10-22T12:00:00Z');
const gift: TargetConfirmationScope = { purpose: 'gift', target: '51111', prizeName: '冰淇淋代金券', couponId: 'COUPON_A' };
const delegated: TargetConfirmationScope = { purpose: 'delegated-gift', target: '51111', payerDlmId: 'DLM_BOSS', giftName: '冰淇淋', quantity: 1 };
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const confirmed = (token = 'signed_A', expiry = NOW + 60_000) => ({ confirmationToken: token, expiresAt: new Date(expiry).toISOString(),
  target: { dlmId: 'DLM_TARGET', discordUserId: '525770714574225408', peiwanId: 51111, displayName: '测试陪玩' },
  payer: { dlmId: 'DLM_BOSS', discordUserId: null, displayName: '微信老板' },
  selectedVoucher: { source: 'coupon', voucherId: 'COUPON_A', prizeName: '冰淇淋代金券' },
});
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { resolve, promise }; }
const settle = () => new Promise<void>(done => setImmediate(done));
function fixture(run?: (index: number, body: Record<string, unknown>) => Promise<Response> | Response) {
  let now = NOW;
  let nextTimer = 0;
  const timers = new Map<number, { due: number; callback: () => void }>();
  const calls: { path: string; body: Record<string, unknown> }[] = [];
  const controller = createTargetConfirmationController({ now: () => now, fetch: (async (path, init) => {
    const body = JSON.parse(String(init?.body));
    calls.push({ path: String(path), body });
    return run ? run(calls.length, body) : response(confirmed(`signed_${calls.length}`, now + 60_000));
  }) as typeof fetch });
  const automatic = createTargetConfirmationAutoLookup(controller, {
    setTimeout(callback, milliseconds) {
      const id = ++nextTimer; timers.set(id, { due: now + milliseconds, callback });
      return id as unknown as ReturnType<typeof setTimeout>;
    },
    clearTimeout(timer) { timers.delete(timer as unknown as number); },
  });
  const advance = async (milliseconds: number) => {
    now += milliseconds;
    for (const [id, timer] of [...timers]) if (timer.due <= now) { timers.delete(id); timer.callback(); }
    await settle();
  };
  return { controller, automatic, calls, advance, timers };
}

test('automatic mode debounces typing and exposes waiting state without any gift mutation', async () => {
  const f = fixture(); f.automatic.update({ ...gift, target: '51' }, true);
  assert.equal(f.automatic.getSnapshot().debouncing, true);
  await f.advance(349); assert.equal(f.calls.length, 0);
  f.automatic.update(gift, true); await f.advance(349); assert.equal(f.calls.length, 0);
  await f.advance(1);
  assert.equal(f.calls.length, 1); assert.equal(f.calls[0].body.target, '51111');
  assert.equal(f.calls[0].path, '/api/profile/target-confirmation');
  assert.equal(f.controller.ready(gift), true); assert.equal(f.automatic.getSnapshot().debouncing, false);
});

test('manual default does not auto query; explicit lookup retains existing voucher behavior', async () => {
  const f = fixture(); const voucher = { ...gift, purpose: 'voucher' as const };
  f.automatic.update(voucher, false); await f.advance(1000); assert.equal(f.calls.length, 0);
  await f.automatic.lookup(voucher); assert.equal(f.controller.ready(voucher), true);
  f.automatic.update({ ...voucher }, false); await f.advance(1000); assert.equal(f.calls.length, 1);
});

test('new object identity and whitespace-equivalent input do not restart debounce or loop after success', async () => {
  const f = fixture(); f.automatic.update(gift, true); await f.advance(200);
  f.automatic.update({ ...gift, target: ' 51111 ' }, true); await f.advance(150);
  assert.equal(f.controller.ready(gift), true);
  for (let index = 0; index < 20; index++) f.automatic.update({ ...gift }, true);
  await f.advance(1000); assert.equal(f.calls.length, 1); assert.equal(f.timers.size, 0);
});

test('invalid and incomplete inputs do not send background lookups', async () => {
  const f = fixture();
  for (const scope of [{ ...gift, target: '' }, { ...gift, target: 'name' }, { ...gift, target: '1'.repeat(21) },
    { ...gift, couponId: undefined }, { ...gift, lotteryId: 'L' }, { ...gift, prizeName: '' },
    { ...delegated, quantity: 0 }, { ...delegated, quantity: NaN }, { ...delegated, quantity: Infinity },
    { ...delegated, quantity: Number.MAX_SAFE_INTEGER + 1 }, { ...delegated, payerDlmId: '' }, { ...delegated, giftName: '' }]) {
    assert.equal(canAutoLookupTarget(scope), false); f.automatic.update(scope, true); await f.advance(400);
  }
  assert.equal(f.calls.length, 0); assert.equal(f.automatic.getSnapshot().debouncing, false);
});

for (const [name, original, next] of [
  ['target', gift, { ...gift, target: '52222' }],
  ['coupon', gift, { ...gift, couponId: 'COUPON_B' }],
  ['source', gift, { ...gift, couponId: undefined, lotteryId: 'LOTTERY_A' }],
  ['payer', delegated, { ...delegated, payerDlmId: 'DLM_OTHER' }],
  ['gift', delegated, { ...delegated, giftName: '玫瑰' }],
  ['quantity', delegated, { ...delegated, quantity: 1.5 }],
] as const) {
  test(`changed ${name} immediately invalidates previous confirmation and resolves new scope once`, async () => {
    const f = fixture(); f.automatic.update(original, true); await f.advance(350);
    assert.equal(f.controller.ready(original), true);
    f.automatic.update(next, true);
    assert.equal(f.controller.ready(original), false); assert.equal(f.controller.ready(next), false);
    assert.equal(f.controller.getSnapshot().confirmation, null);
    await f.advance(350); assert.equal(f.controller.ready(next), true); assert.equal(f.calls.length, 2);
    assert.deepEqual(f.calls[1].body, JSON.parse(JSON.stringify(next)));
  });
}

test('an old response cannot replace newer input confirmation', async () => {
  const old = deferred<Response>(); const f = fixture(index => index === 1 ? old.promise : response(confirmed('new')));
  f.automatic.update(gift, true); await f.advance(350);
  const next = { ...gift, target: '52222' }; f.automatic.update(next, true); await f.advance(350);
  old.resolve(response(confirmed('old'))); await settle();
  assert.equal(f.controller.ready(next), true); assert.equal(f.controller.getSnapshot().confirmation?.confirmationToken, 'new');
});

test('closing cancels debounce and ignores an in-flight read result', async () => {
  const pending = deferred<Response>(); const f = fixture(() => pending.promise);
  f.automatic.update(gift, true); f.automatic.update(gift, false); await f.advance(1000);
  assert.equal(f.calls.length, 0);
  f.automatic.update(gift, true); await f.advance(350); assert.equal(f.calls.length, 1);
  f.automatic.update(gift, false); pending.resolve(response(confirmed())); await settle();
  assert.equal(f.controller.getSnapshot().phase, 'idle'); assert.equal(f.controller.ready(gift), false);
});

test('unmount discards pending reads and strict mode setup can schedule fresh lookup', async () => {
  const old = deferred<Response>(); const f = fixture(index => index === 1 ? old.promise : response(confirmed('remount')));
  f.automatic.update(gift, true); await f.advance(350); f.automatic.dispose();
  f.automatic.update({ ...gift }, true); await f.advance(350);
  old.resolve(response(confirmed('old'))); await settle();
  assert.equal(f.calls.length, 2); assert.equal(f.controller.getSnapshot().confirmation?.confirmationToken, 'remount');
  f.automatic.dispose(); assert.equal(f.timers.size, 0); assert.equal(f.controller.ready(gift), false);
});

for (const mode of ['network', 'server'] as const) {
  test(`${mode} failure stops automatic lookup until an explicit retry`, async () => {
    const f = fixture(index => index > 1 ? response(confirmed('retry', NOW + 600_000)) : mode === 'network'
      ? Promise.reject(new Error('offline')) : response({ error: '未找到目标' }, 404));
    f.automatic.update(gift, true); await f.advance(350); assert.equal(f.controller.getSnapshot().phase, 'error');
    for (let index = 0; index < 10; index++) { f.automatic.update({ ...gift }, true); f.automatic.expire(); }
    await f.advance(120_000); assert.equal(f.calls.length, 1);
    const retry = f.automatic.lookup(gift); await retry; assert.equal(f.calls.length, 2);
    assert.equal(f.controller.ready(gift), true);
    assert.equal(f.calls[1].path, '/api/profile/target-confirmation');
    await f.advance(1000); assert.equal(f.calls.length, 2);
  });
}

test('explicit lookup during debounce cancels its timer instead of querying twice', async () => {
  const f = fixture(); f.automatic.update(gift, true); await f.advance(100);
  await f.automatic.lookup(gift); await f.advance(1000);
  assert.equal(f.calls.length, 1); assert.equal(f.controller.ready(gift), true);
});

test('reconfirming an identical scope after explicit invalidation schedules a new read', async () => {
  const f = fixture(); f.automatic.update(gift, true); await f.advance(350);
  f.controller.invalidate(); f.automatic.update({ ...gift, target: ' 51111 ' }, true); await f.advance(350);
  assert.equal(f.calls.length, 2); assert.equal(f.controller.ready(gift), true);
});

test('expiry refreshes once, then requires explicit retry instead of an automatic token loop', async () => {
  const f = fixture(); f.automatic.update(gift, true); await f.advance(350);
  await f.advance(60_001); f.automatic.expire();
  assert.equal(f.controller.ready(gift), false); assert.equal(f.automatic.getSnapshot().debouncing, true);
  await f.advance(350); assert.equal(f.controller.ready(gift), true); assert.equal(f.calls.length, 2);
  await f.advance(60_001); f.automatic.expire(); await f.advance(350);
  assert.equal(f.controller.getSnapshot().phase, 'error'); assert.equal(f.calls.length, 2);
  await f.automatic.lookup(gift); assert.equal(f.controller.ready(gift), true); assert.equal(f.calls.length, 3);
});

test('failed expiry refresh stays failed without repeating requests', async () => {
  const f = fixture(index => index === 1 ? response(confirmed()) : Promise.reject(new Error('offline')));
  f.automatic.update(gift, true); await f.advance(350);
  await f.advance(60_001); f.automatic.expire(); await f.advance(350);
  assert.equal(f.calls.length, 2); assert.equal(f.controller.getSnapshot().phase, 'error');
  f.automatic.update({ ...gift }, true); f.automatic.expire(); await f.advance(120_000);
  assert.equal(f.calls.length, 2); assert.equal(f.controller.ready(gift), false);
});
