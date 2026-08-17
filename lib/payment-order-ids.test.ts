import assert from 'node:assert/strict';
import test from 'node:test';
import { buildStripeOutTradeNo } from '@/lib/stripe-recharge';
import { buildWechatNativeOutTradeNo } from '@/lib/wechat-pay';
import { buildOutTradeNo } from '@/lib/zpay';

test('payment order identifiers use separate provider namespaces', () => {
  const userId = 'JINLEE1234';
  const zpayOrderId = buildOutTradeNo(userId);
  const wechatOrderId = buildWechatNativeOutTradeNo(userId);
  const stripeOrderId = buildStripeOutTradeNo(userId);

  assert.match(zpayOrderId, /^\d+$/);
  assert.match(wechatOrderId, /^WN[A-Z0-9]+$/);
  assert.match(stripeOrderId, /^STRIPE[A-Z0-9]+$/);
  assert.ok(wechatOrderId.length <= 32);
  assert.notEqual(zpayOrderId, wechatOrderId);
  assert.notEqual(zpayOrderId, stripeOrderId);
  assert.notEqual(wechatOrderId, stripeOrderId);
});
