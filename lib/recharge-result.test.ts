import assert from 'node:assert/strict';
import test from 'node:test';
import {
  belongsToRechargeUser,
  getRechargeResultMessage,
  parseRechargeResultOrder,
  resolveRechargeResultOrderId,
  type RechargeResultState,
} from './recharge-result';

test('recharge result resolves ZPay and Stripe order IDs without trusting browser payment status', () => {
  assert.equal(resolveRechargeResultOrderId({ out_trade_no: '202609251234567890', trade_status: 'TRADE_SUCCESS' }), '202609251234567890');
  assert.equal(resolveRechargeResultOrderId({ order: 'STRIPE20260925ABC' }), 'STRIPE20260925ABC');
  assert.equal(resolveRechargeResultOrderId({ trade_status: 'TRADE_SUCCESS', status: 'PAID' }), null);
  assert.equal(resolveRechargeResultOrderId({ out_trade_no: ['first', 'second'] }), null);
  assert.equal(resolveRechargeResultOrderId({ order: '../other-user' }), null);
});

test('only an owned order can expose recharge status, including accounts without Discord', () => {
  const user = { jinleeId: 'USER1', discordUserId: null };
  assert.equal(belongsToRechargeUser({ jinleeId: 'USER1', discordUserId: null }, user), true);
  assert.equal(belongsToRechargeUser({ jinleeId: 'USER2', discordUserId: null }, user), false);
  assert.equal(belongsToRechargeUser({ jinleeId: null, discordUserId: null }, user), false);
  assert.equal(belongsToRechargeUser({ jinleeId: null, discordUserId: '123' }, { ...user, discordUserId: '123' }), true);
});

test('recharge success is displayed only for a valid local PAID order', () => {
  const pending = { id: '123', amount: '100', status: 'PENDING' };
  assert.equal(parseRechargeResultOrder(pending, '123')?.status, 'PENDING');
  assert.equal(parseRechargeResultOrder({ ...pending, status: 'PAID' }, '123')?.status, 'PAID');
  assert.equal(parseRechargeResultOrder({ ...pending, status: 'TRADE_SUCCESS' }, '123'), null);
  assert.equal(parseRechargeResultOrder({ ...pending, id: '456' }, '123'), null);
  assert.match(getRechargeResultMessage('PAID').title, /充值成功/);
  for (const state of ['CHECKING', 'PENDING', 'FAILED', 'NOT_FOUND', 'ERROR', 'UNAUTHORIZED'] as RechargeResultState[]) {
    assert.doesNotMatch(getRechargeResultMessage(state).title, /充值成功/);
  }
  assert.match(getRechargeResultMessage('PENDING', true).description, /联系客服/);
});
