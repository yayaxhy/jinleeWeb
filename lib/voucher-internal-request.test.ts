import assert from 'node:assert/strict';
import test from 'node:test';
import { postVoucherUseRequest, VoucherInternalRequestError, VOUCHER_USE_UNCONFIRMED } from './voucher-internal-request';
const config = { endpoint: 'http://offline.invalid/internal/voucher/double-flow-5000', token: 'offline-test', payload: { userDlmId: 'fixed-owner', targetDlmId: 'fixed-target', voucherId: 'voucher' } };
const isUnconfirmed = (error: unknown) => error instanceof VoucherInternalRequestError && error.message === VOUCHER_USE_UNCONFIRMED;

test('sends fixed identity and voucher payload exactly once', async () => {
  let calls = 0;
  const result = await postVoucherUseRequest({ ...config, fetchImpl: async (_url, init) => {
    calls += 1; assert.deepEqual(JSON.parse(String(init?.body)), config.payload);
    return Response.json({ ok: true, voucherId: 'voucher' });
  } });
  assert.equal(result.ok, true); assert.equal(calls, 1);
});
test('timeout after potential commit reports unknown result without retry', async () => {
  let calls = 0;
  await assert.rejects(postVoucherUseRequest({ ...config, timeoutMs: 1, fetchImpl: async (_url, init) => {
    calls += 1;
    await new Promise<void>((_resolve, reject) => init?.signal?.addEventListener('abort', () => reject(new Error('offline timeout')), { once: true }));
    return Response.json({ ok: true });
  } }), isUnconfirmed);
  assert.equal(calls, 1);
});
test('connection failure, proxy failure and malformed success do not recommend another use', async () => {
  const responses: Array<() => Promise<Response>> = [
    async () => { throw new Error('connection lost after write'); },
    async () => new Response('gateway failure', { status: 502 }),
    async () => new Response('not json', { status: 200 }),
    async () => Response.json({}),
  ];
  for (const fetchImpl of responses) await assert.rejects(postVoucherUseRequest({ ...config, fetchImpl }), isUnconfirmed);
});
test('explicit identity conflict preserves actionable 409 without transport retry', async () => {
  await assert.rejects(postVoucherUseRequest({ ...config, fetchImpl: async () => Response.json({ error: '账号绑定状态已变化或缺少身份凭证，请刷新后重新确认用券对象。' }, { status: 409 }) }),
    (error: unknown) => error instanceof VoucherInternalRequestError && error.status === 409 && error.message === '账号状态已变化，请刷新后重新确认用券对象。');
});


test('gift callers receive the payment-specific unknown result instruction without retrying', async () => {
  const message = '打赏结果未确认，请核对余额，勿重复提交或新建请求。';
  let calls = 0;
  await assert.rejects(postVoucherUseRequest({ ...config, unconfirmedMessage: message, fetchImpl: async () => {
    calls += 1; throw new Error('offline commit connection lost');
  } }), (error: unknown) => error instanceof VoucherInternalRequestError && error.message === message);
  assert.equal(calls, 1);
});
