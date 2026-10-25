import assert from 'node:assert/strict';
import test from 'node:test';
import { createTargetConfirmationController, parseTargetConfirmation, targetScopeKey, type TargetConfirmationScope } from './target-confirmation-client';

const NOW = Date.parse('2026-10-22T12:00:00Z');
const gift: TargetConfirmationScope = { purpose: 'gift', target: '51111', prizeName: '冰淇淋代金券', couponId: 'COUPON_A' };
const voucher: TargetConfirmationScope = { ...gift, purpose: 'voucher', prizeName: '自定义评语券' };
const delegated: TargetConfirmationScope = { purpose: 'delegated-gift', target: '51111', payerDlmId: 'DLM_BOSS', giftName: '冰淇淋', quantity: 1.5 };
const confirmed = (token = 'signed_A') => ({ confirmationToken: token, expiresAt: new Date(NOW + 60_000).toISOString(),
  target: { dlmId: 'DLM_TARGET', discordUserId: '525770714574225408', peiwanId: 51111, displayName: '测试陪玩' },
  payer: { dlmId: 'DLM_BOSS', discordUserId: null, displayName: '微信老板' },
  selectedVoucher: { source: 'coupon', voucherId: 'COUPON_A', prizeName: '冰淇淋代金券' },
});
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const bodyFor = (scope: TargetConfirmationScope): Record<string, unknown> => scope.purpose === 'delegated-gift'
  ? { dlmId: scope.payerDlmId, peiwanId: scope.target.trim(), giftName: scope.giftName, quantity: scope.quantity, requestId: 'REQUEST_1' }
  : { prizeName: scope.prizeName, couponId: scope.couponId, lotteryId: scope.lotteryId, target: scope.target.trim(), ...(scope.purpose === 'gift' ? { mode: 'gift' } : {}) };
const pathFor = (scope: TargetConfirmationScope) => scope.purpose === 'gift' ? '/api/lottery/use' : scope.purpose === 'voucher' ? '/api/voucher/use' : '/api/admin/wechat-bosses/delegated-gift';
function fixture(run?: (index: number, path: string, body: Record<string, unknown>) => Promise<Response> | Response) {
  const calls: { path: string; body: Record<string, unknown> }[] = [];
  let now = NOW;
  const controller = createTargetConfirmationController({ now: () => now, fetch: (async (path, init) => {
    const body = JSON.parse(String(init?.body)); calls.push({ path: String(path), body });
    return run ? run(calls.length, String(path), body) : response(calls.length === 1 ? confirmed() : { ok: true });
  }) as typeof fetch });
  return { controller, calls, advance: () => { now += 60_001; } };
}
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(res => { resolve = res; }); return { resolve, promise }; }

test('query only resolves a card; final gift sends fixed original target, exact coupon and token once', async () => {
  const f = fixture();
  await f.controller.lookup(gift);
  assert.equal(f.calls.length, 1); assert.equal(f.controller.ready(gift), true);
  const result = await f.controller.submit(gift, pathFor(gift), { ...bodyFor(gift), confirmationToken: 'forged' });
  assert.equal(result.status, 'success');
  assert.equal(f.calls[1].body.target, '51111'); assert.equal(f.calls[1].body.couponId, 'COUPON_A');
  assert.equal(f.calls[1].body.confirmationToken, 'signed_A');
  assert.equal((await f.controller.submit(gift, pathFor(gift), bodyFor(gift))).status, 'blocked');
  assert.equal(f.calls.length, 2);
});

test('lookup trims input but does not substitute resolved Discord into original short ID scope', async () => {
  const f = fixture(); const spaced = { ...gift, target: ' 51111 ' };
  await f.controller.lookup(spaced); assert.equal(f.calls[0].body.target, '51111');
  assert.equal(f.controller.ready(gift), true);
  assert.equal((await f.controller.submit(gift, pathFor(gift), { ...bodyFor(gift), target: confirmed().target.discordUserId })).status, 'blocked');
  assert.equal(f.calls.length, 1);
});

for (const [name, next] of Object.entries({ target: { ...gift, target: '52222' }, coupon: { ...gift, couponId: 'COUPON_B' },
  source: { ...gift, couponId: undefined, lotteryId: 'LOTTERY_A' }, prize: { ...gift, prizeName: '玫瑰代金券' }, purpose: voucher })) {
  test(`changed ${name} cannot use previous confirmation`, async () => {
    const f = fixture(); await f.controller.lookup(gift);
    assert.equal(f.controller.ready(next), false);
    assert.equal((await f.controller.submit(next, pathFor(next), bodyFor(next))).status, 'blocked'); assert.equal(f.calls.length, 1);
  });
}
for (const [name, next] of Object.entries({ payer: { ...delegated, payerDlmId: 'DLM_OTHER' }, gift: { ...delegated, giftName: '玫瑰' }, quantity: { ...delegated, quantity: 2 } })) {
  test(`delegated changed ${name} requires new card`, async () => {
    const f = fixture(); await f.controller.lookup(delegated);
    assert.equal(f.controller.ready(next), false);
    assert.equal((await f.controller.submit(next, pathFor(next), bodyFor(next))).status, 'blocked');
    assert.equal(f.calls.length, 1);
  });
}

test('consumer body and endpoint must match even if caller passes the old ready scope', async () => {
  const f = fixture(); await f.controller.lookup(gift);
  for (const body of [{ ...bodyFor(gift), couponId: 'B' }, { ...bodyFor(gift), target: 'B' }, { ...bodyFor(gift), mode: 'selfuse' }]) {
    assert.equal((await f.controller.submit(gift, pathFor(gift), body)).status, 'blocked');
  }
  assert.equal((await f.controller.submit(gift, '/api/voucher/use', bodyFor(gift))).status, 'blocked');
  assert.equal(f.calls.length, 1);
});

test('delegated decimal quantity remains a number in query and commit; payload mismatch blocked', async () => {
  const f = fixture(); await f.controller.lookup(delegated);
  assert.equal(f.calls[0].body.quantity, 1.5);
  assert.equal((await f.controller.submit(delegated, pathFor(delegated), { ...bodyFor(delegated), quantity: '1.5' })).status, 'blocked');
  assert.equal((await f.controller.submit(delegated, pathFor(delegated), bodyFor(delegated))).status, 'success');
  assert.equal(f.calls[1].body.quantity, 1.5);
});

test('old lookup completion cannot overwrite new input or newer query', async () => {
  const old = deferred<Response>();
  const f = fixture(index => index === 1 ? old.promise : response(confirmed('signed_B')));
  const pending = f.controller.lookup(gift); f.controller.invalidate();
  const next = { ...gift, target: '52222' }; await f.controller.lookup(next);
  old.resolve(response(confirmed('signed_A'))); assert.equal(await pending, null);
  assert.equal(f.controller.getSnapshot().confirmation?.confirmationToken, 'signed_B');
  assert.equal(f.controller.ready(next), true);
});

test('closing or editing during a lookup clears pending result without a new query', async () => {
  const old = deferred<Response>(); const f = fixture(() => old.promise);
  const pending = f.controller.lookup(gift); f.controller.invalidate(); old.resolve(response(confirmed()));
  assert.equal(await pending, null); assert.equal(f.controller.getSnapshot().phase, 'idle');
  assert.equal(f.controller.ready(gift), false);
});

test('double click while transport pending sends only one mutation', async () => {
  const commit = deferred<Response>(); const f = fixture(index => index === 1 ? response(confirmed()) : commit.promise);
  await f.controller.lookup(gift); const pending = f.controller.submit(gift, pathFor(gift), bodyFor(gift));
  assert.equal((await f.controller.submit(gift, pathFor(gift), bodyFor(gift))).status, 'blocked');
  assert.equal(f.calls.length, 2); commit.resolve(response({ ok: true })); assert.equal((await pending).status, 'success');
});

test('expiry disables submit before timer callback and expiry clears token with message', async () => {
  const f = fixture(); await f.controller.lookup(gift); f.advance();
  assert.equal((await f.controller.submit(gift, pathFor(gift), bodyFor(gift))).status, 'blocked');
  f.controller.expire(); assert.equal(f.controller.getSnapshot().confirmation, null);
  assert.match(f.controller.getSnapshot().message!, /过期/); assert.equal(f.calls.length, 1);
});

for (const [name, commit] of Object.entries({
  lost: () => Promise.reject(new Error('offline')),
  server: () => response({ error: 'internal' }, 503),
  malformed: () => new Response('not json', { status: 200 }),
  missingSuccess: () => response({}),
  unreadableRejection: () => new Response('proxy unavailable', { status: 409 }),
})) {
  test(`unknown ${name} result preserves original card and blocks query/reset/submit`, async () => {
    const f = fixture(index => index === 1 ? response(confirmed()) : commit());
    await f.controller.lookup(delegated);
    assert.equal((await f.controller.submit(delegated, pathFor(delegated), bodyFor(delegated))).status, 'unknown');
    f.controller.invalidate(); assert.equal(await f.controller.lookup(delegated), null);
    assert.equal((await f.controller.submit(delegated, pathFor(delegated), bodyFor(delegated))).status, 'blocked');
    assert.equal(f.controller.getSnapshot().phase, 'unknown');
    assert.equal(f.controller.getSnapshot().confirmation?.payer?.dlmId, 'DLM_BOSS');
    assert.match(f.controller.getSnapshot().message!, /勿重复提交/); assert.match(f.controller.getSnapshot().message!, /REQUEST_1/);
    assert.equal(f.calls.length, 2);
  });
}

test('explicit identity 409 clears confirmation; only a new lookup permits another mutation', async () => {
  const f = fixture(index => index % 2 === 1 ? response(confirmed(`signed_${index}`)) : response({ error: 'expired', code: 'TARGET_CONFIRMATION_REQUIRED' }, 409));
  await f.controller.lookup(gift);
  assert.equal((await f.controller.submit(gift, pathFor(gift), bodyFor(gift))).status, 'rejected');
  assert.equal(f.controller.getSnapshot().confirmation, null); assert.match(f.controller.getSnapshot().message!, /重新查询并确认/);
  assert.equal((await f.controller.submit(gift, pathFor(gift), bodyFor(gift))).status, 'blocked');
  await f.controller.lookup(gift); assert.equal(f.controller.ready(gift), true);
});

test('explicit validation rejection does not keep an actionable token', async () => {
  const f = fixture(index => index === 1 ? response(confirmed()) : response({ error: '券已使用' }, 400));
  await f.controller.lookup(voucher);
  assert.equal((await f.controller.submit(voucher, pathFor(voucher), bodyFor(voucher))).status, 'rejected');
  assert.equal(f.controller.getSnapshot().confirmation, null); assert.equal(f.controller.getSnapshot().message, '券已使用');
});

test('review content is attached only at final submit without resolving identity again', async () => {
  const f = fixture(); await f.controller.lookup(voucher);
  assert.equal((await f.controller.submit(voucher, pathFor(voucher), { ...bodyFor(voucher), reviewText: '细心耐心' })).status, 'success');
  assert.equal(f.calls.length, 2); assert.equal(f.calls[1].body.reviewText, '细心耐心'); assert.equal(f.calls[1].body.confirmationToken, 'signed_A');
});

test('legacy prize-only query accepts selected actual voucher and submits the fixed token', async () => {
  const f = fixture(); const scope = { ...voucher, couponId: undefined }; await f.controller.lookup(scope);
  assert.equal(f.controller.getSnapshot().confirmation?.selectedVoucher?.voucherId, 'COUPON_A');
  assert.equal((await f.controller.submit(scope, pathFor(scope), bodyFor(scope))).status, 'success');
  assert.equal(f.calls[1].body.confirmationToken, 'signed_A');
});

test('incomplete scope, ambiguous coupon source, invalid quantity never sends lookup', async () => {
  const f = fixture();
  for (const scope of [{ ...gift, target: ' ' }, { ...gift, lotteryId: 'L' }, { ...delegated, quantity: NaN }, { ...delegated, quantity: 0 }, { ...delegated, quantity: Infinity }]) {
    assert.equal(await f.controller.lookup(scope), null);
  }
  assert.equal(f.calls.length, 0);
});

test('malformed identity, expiry, token, selected voucher and missing delegated payer fail closed', async () => {
  for (const payload of [{ ...confirmed(), target: {} }, { ...confirmed(), expiresAt: 'bad' }, { ...confirmed(), confirmationToken: '' }, { ...confirmed(), selectedVoucher: { source: 'invented' } }]) {
    assert.equal(parseTargetConfirmation(payload, NOW), null);
  }
  const f = fixture(() => response({ ...confirmed(), payer: undefined }));
  assert.equal(await f.controller.lookup(delegated), null); assert.equal(f.controller.ready(delegated), false);
});

test('read-only lookup failure is recoverable and does not create unknown mutation state', async () => {
  const f = fixture(index => index === 1 ? Promise.reject(new Error('offline')) : response(confirmed()));
  assert.equal(await f.controller.lookup(gift), null); assert.equal(f.controller.getSnapshot().phase, 'error');
  await f.controller.lookup(gift); assert.equal(f.controller.ready(gift), true);
  assert.notEqual(targetScopeKey(gift), targetScopeKey(voucher));
});

test('ambiguous voucher 409 preserves administrator-review message instead of generic identity retry', async () => {
  const message = '券编号存在冲突，请管理员核实后重新查询并确认。';
  const f = fixture(index => index === 1 ? response(confirmed()) : response({ error: message, code: 'TARGET_CONFIRMATION_REVIEW_REQUIRED' }, 409));
  await f.controller.lookup(voucher);
  assert.equal((await f.controller.submit(voucher, pathFor(voucher), bodyFor(voucher))).status, 'rejected');
  assert.equal(f.controller.getSnapshot().message, message);
  assert.equal(f.controller.getSnapshot().confirmation, null);
  assert.equal(f.calls.length, 2);
});
