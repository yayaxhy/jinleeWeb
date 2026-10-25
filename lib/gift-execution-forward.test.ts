import assert from 'node:assert/strict';
import test from 'node:test';
import { GiftForwardRejected, handleGiftExecutionForward } from './gift-execution-forward';
const ID = 'e4322167-9ef8-4e04-abf3-7a904d059849';
const req = (body: unknown = { requestId: ID }, origin = 'https://dlmclub.com') => new Request('https://dlmclub.com/api/lottery/use', {
  method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify(body),
});

for (const status of [400, 401, 403, 409, 503]) test(`known prepare rejection ${status} certifies no Bot call for the matching UUID`, async () => {
  let sends = 0; const res = await handleGiftExecutionForward(req(), { prepare: async () => { throw new GiftForwardRejected('重新确认', status, 'TARGET_CONFIRMATION_REQUIRED'); }, send: async () => { sends++; return { ok: true }; } });
  assert.equal(res.status, status); assert.deepEqual(await res.json(), { ok: false, requestId: ID, not_forwarded: true, error: '重新确认', code: 'TARGET_CONFIRMATION_REQUIRED' }); assert.equal(sends, 0);
});
test('unknown pre-forward exception redacts details but safely marks not forwarded', async () => {
  const res = await handleGiftExecutionForward(req(), { prepare: async () => { throw new Error('SECRET database credentials'); }, send: async () => { throw new Error('must not run'); } });
  const body = await res.json(); assert.equal(body.not_forwarded, true); assert.equal(JSON.stringify(body).includes('SECRET'), false); assert.equal(res.headers.get('cache-control'), 'no-store');
});
for (const result of ['throw', 'rejected', 'malformed']) test(`${result} after send boundary never claims not_forwarded`, async () => {
  let calls = 0; const res = await handleGiftExecutionForward(req(), { prepare: async () => ({ fixed: true }), send: async () => {
    calls++; if (result === 'throw') throw new GiftForwardRejected('Bot or network failure', 400); return result === 'rejected' ? { ok: false } : {}; } });
  const body = await res.json(); assert.equal(res.status, 503); assert.equal(calls, 1); assert.equal(body.requestId, ID); assert.equal('not_forwarded' in body, false);
});
test('successful fixed payload is forwarded once with lowercase stable UUID and receipt preserved', async () => {
  const res = await handleGiftExecutionForward(req({ requestId: ID.toUpperCase(), target: '51111' }), {
    prepare: async body => ({ target: body.target, operator: 'FROM_SESSION' }), send: async (payload, requestId) => {
      assert.deepEqual(payload, { target: '51111', operator: 'FROM_SESSION' }); assert.equal(requestId, ID); return { ok: true, status: 'COMPLETED', giftAuditId: 'GA' }; } });
  assert.deepEqual(await res.json(), { ok: true, status: 'COMPLETED', giftAuditId: 'GA', requestId: ID });
});
for (const [name, request] of [ ['cross-origin', req(undefined, 'https://evil.example')], ['invalid UUID', req({ requestId: 'GIFT:51111' })],
  ['invalid JSON', new Request('https://dlmclub.com/api/lottery/use', { method: 'POST', headers: { origin: 'https://dlmclub.com', 'content-type': 'application/json' }, body: '{' })],
  ['oversize', req({ requestId: ID, text: 'a'.repeat(17000) })] ] as const) test(`${name} fails before prepare/send`, async () => {
    let calls = 0; const res = await handleGiftExecutionForward(request, { prepare: async () => { calls++; }, send: async () => { calls++; return { ok: true }; } });
    assert.ok(res.status >= 400); assert.equal(calls, 0);
  });
