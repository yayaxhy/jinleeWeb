import assert from 'node:assert/strict';
import test from 'node:test';
import { manualOperationResultForCurrentAccount, replayManualWechatRechargeResult } from './manual-wechat-operation-replay';

test('merged-account replay routes to the current owner and preserves the immutable financial snapshot', () => {
  const storedResult = Object.freeze({
    dlmId: 'original-boss', amount: '123.45', balanceAfter: '500.00',
    transactionId: 'transaction-1', rechargeId: 17,
  });
  const result = manualOperationResultForCurrentAccount({ dlmId: 'merged-account', result: storedResult });

  assert.deepEqual(result, { ...storedResult, dlmId: 'merged-account' });
  assert.equal(storedResult.dlmId, 'original-boss');
  assert.notEqual(result, storedResult);
});

test('legacy results without an account ID still resolve from the durable operation FK', () => {
  const storedResult: { dlmId?: string; amount: string } = { amount: '12.00' };
  assert.deepEqual(manualOperationResultForCurrentAccount({ dlmId: 'current-account', result: storedResult }), {
    dlmId: 'current-account', amount: '12.00',
  });
  assert.deepEqual(storedResult, { amount: '12.00' });
});

test('recharge retry queries only the current owner while retaining the original idempotency key and money', async () => {
  const storedResult = Object.freeze({
    dlmId: 'deleted-account', amount: '90.00', balanceAfter: '135.00',
    transactionId: 'original-ledger', rechargeRequestId: 'old-payload-value',
  });
  const queried: string[] = [];
  const result = await replayManualWechatRechargeResult({
    dlmId: 'current-account', requestId: 'durable-request', result: storedResult,
  }, async (dlmId) => { queried.push(dlmId); return '240.00'; });

  assert.deepEqual(queried, ['current-account']);
  assert.deepEqual(result, {
    ...storedResult, dlmId: 'current-account', rechargeRequestId: 'durable-request', currentBalance: '240.00',
  });
  assert.equal(storedResult.dlmId, 'deleted-account');
  assert.equal(storedResult.rechargeRequestId, 'old-payload-value');
});

test('missing current balance does not fall back to the old account or invent a new financial result', async () => {
  const queried: string[] = [];
  const result = await replayManualWechatRechargeResult({
    dlmId: 'current-account', requestId: 'request-1',
    result: { dlmId: 'deleted-account', amount: '10.00', balanceAfter: '15.00' },
  }, async (dlmId) => { queried.push(dlmId); return null; });

  assert.deepEqual(queried, ['current-account']);
  assert.equal(result.currentBalance, null);
  assert.equal(result.dlmId, 'current-account');
  assert.equal(result.amount, '10.00');
  assert.equal(result.balanceAfter, '15.00');
});
