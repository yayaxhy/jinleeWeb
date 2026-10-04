import assert from 'node:assert/strict';
import test from 'node:test';
import { SettlementReconciliationStatus } from '@prisma/client';
import {
  isReconciliationCounted,
  isRmbCurrency,
  parsePositiveDecimal,
  resolveWithdrawalSettlementOwner,
  SETTLEMENT_ALIPAY_OWNER_ID,
  SETTLEMENT_WECHAT_OWNER_ID,
} from './settlement-reconciliation';

test('manual settlement amounts accept positive values with up to four decimal places', () => {
  assert.equal(parsePositiveDecimal('100.1250')?.toString(), '100.125');
  assert.equal(parsePositiveDecimal('0'), null);
  assert.equal(parsePositiveDecimal('-1'), null);
  assert.equal(parsePositiveDecimal('1.12345'), null);
});

test('only invalidated reconciliation entries leave settlement totals', () => {
  assert.equal(isReconciliationCounted(SettlementReconciliationStatus.PENDING_FINANCE), true);
  assert.equal(isReconciliationCounted(SettlementReconciliationStatus.OWNER_DISPUTED), true);
  assert.equal(isReconciliationCounted(SettlementReconciliationStatus.INVALIDATED), false);
});

test('withdrawal responsibility follows the requested payout method', () => {
  assert.equal(resolveWithdrawalSettlementOwner('微信:https://cdn.discordapp.com/receipt.png'), SETTLEMENT_WECHAT_OWNER_ID);
  assert.equal(resolveWithdrawalSettlementOwner('支付宝:alice@example.com'), SETTLEMENT_ALIPAY_OWNER_ID);
  assert.equal(resolveWithdrawalSettlementOwner('Paypal:alice@example.com'), null);
  assert.equal(isRmbCurrency('cny'), true);
  assert.equal(isRmbCurrency('EUR'), false);
});
