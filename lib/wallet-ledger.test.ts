import assert from 'node:assert/strict';
import test from 'node:test';
import { Prisma } from '@prisma/client';
import { validateWalletTransaction, resolveWalletDelta, type LedgerReceipt } from './wallet-ledger';
import { recordWalletTransaction } from './wallet-ledger-write';

const receipt = (overrides: Partial<LedgerReceipt> = {}): LedgerReceipt => ({
  transactionId: 'IT-ledger-test', dlmId: 'original-owner', discordId: null,
  thirdPartydiscordId: 'worker', balanceBefore: '1035', balanceAfter: '541.5',
  amountChange: '493.5', deltaAmount: '-493.5',
  typeOfTransaction: '点单', timeCreatedAt: new Date('2026-10-30T12:00:00Z'),
  ...overrides,
});

test('unsigned Bot debit and signed website debit have the same exact delta without rewriting legacy amount', () => {
  for (const amountChange of ['493.5', '-493.5']) {
    const input = receipt({ amountChange });
    assert.equal(validateWalletTransaction(input).toFixed(4), '-493.5000');
    assert.equal(input.amountChange, amountChange);
  }
});

test('credit and zero movements are explicit, including four-decimal precision', () => {
  const credit = receipt({ balanceBefore: '100', balanceAfter: '100.0001', amountChange: '0.0001', deltaAmount: '0.0001' });
  assert.equal(validateWalletTransaction(credit).toString(), '0.0001');
  const zero = receipt({ balanceBefore: '0', balanceAfter: '0', amountChange: '0', deltaAmount: '0' });
  assert.equal(validateWalletTransaction(zero).toString(), '0');
});

test('live amounts must reconcile; a deliberate face-value difference requires an expected delta', () => {
  const input = receipt({ typeOfTransaction: '订单撤销', amountChange: '52', balanceBefore: '0.02', balanceAfter: '0', deltaAmount: '-0.02' });
  assert.throws(() => validateWalletTransaction(input), /amount_mismatch/);
  assert.throws(() => validateWalletTransaction(input, { expectedWalletDelta: '-52' }), /amount_mismatch/);
  assert.equal(validateWalletTransaction(input, { expectedWalletDelta: '-0.02' }).toString(), '-0.02');
  assert.equal(input.amountChange, '52');
});

test('persisted delta is mandatory and must match actual balances on new writes', () => {
  for (const deltaAmount of [undefined, null, '493.5', '-493.4']) {
    assert.throws(() => validateWalletTransaction(receipt({ deltaAmount })), /delta_mismatch/);
  }
});

test('component deltas are validated only from complete supplied snapshots', () => {
  const walletBefore = { totalBalance: '1035', income: '10', recharge: '1025', totalSpent: '100' };
  const walletAfter = { totalBalance: '541.5', income: '0', recharge: '541.5', totalSpent: '593.5' };
  assert.equal(validateWalletTransaction(receipt(), { walletBefore, walletAfter }).toString(), '-493.5');
  assert.throws(() => validateWalletTransaction(receipt(), { walletBefore }), /incomplete_snapshots/);
  assert.throws(() => validateWalletTransaction(receipt(), { walletBefore, walletAfter: { ...walletAfter, totalBalance: '540' } }), /snapshot_mismatch/);
  assert.throws(() => validateWalletTransaction(receipt(), { walletBefore, walletAfter: { ...walletAfter, recharge: '540' } }), /components_mismatch/);
  assert.throws(() => validateWalletTransaction(receipt(), { walletBefore, walletAfter: { totalBalance: '541.5', income: '0', recharge: '541.5' } }), /incomplete_snapshots/);
});

test('rejects non-finite, overflowing and out-of-precision money rather than rounding', () => {
  for (const value of ['NaN', 'Infinity', '1.12345', '1000000000000000']) {
    assert.throws(() => validateWalletTransaction(receipt({ balanceBefore: value })), /invalid_money/);
    assert.throws(() => validateWalletTransaction(receipt({ deltaAmount: value })), /invalid_money/);
    assert.throws(() => resolveWalletDelta({ balanceBefore: null, balanceAfter: null, deltaAmount: value }), /invalid_money/);
  }
  assert.throws(() => validateWalletTransaction(receipt({
    balanceBefore: '-999999999999999', balanceAfter: '999999999999999', amountChange: '0',
  })), /invalid_money/);
  assert.throws(() => validateWalletTransaction(receipt(), {
    walletBefore: { totalBalance: '1035', loyaltyPoints: '-999999999999999' },
    walletAfter: { totalBalance: '541.5', loyaltyPoints: '999999999999999' },
  }), /invalid_money/);
});

test('reads signed delta, falls back only to historical balances, and never treats missing facts as zero', () => {
  assert.equal(resolveWalletDelta({ balanceBefore: '10.0001', balanceAfter: '0' })?.toString(), '-10.0001');
  assert.equal(resolveWalletDelta({ balanceBefore: '10.0001', balanceAfter: '0', deltaAmount: null })?.toString(), '-10.0001');
  assert.equal(resolveWalletDelta({ balanceBefore: null, balanceAfter: '0' }), null);
  assert.equal(resolveWalletDelta({ balanceBefore: '10', balanceAfter: null }), null);
  assert.equal(resolveWalletDelta({ balanceBefore: null, balanceAfter: null, deltaAmount: '-10' })?.toString(), '-10');
});

test('writer preserves the compatibility payload and returns the DB-generated signed delta', async () => {
  const data = { ...receipt({ amountChange: '-493.5' }), deltaAmount: undefined };
  const saved = receipt({ amountChange: '-493.5' });
  const fake = {
    individualTransaction: { create: async (args: { data: unknown }) => { assert.equal(args.data, data); return saved; } },
  };
  assert.equal(await recordWalletTransaction(fake as unknown as Prisma.TransactionClient, data as Prisma.IndividualTransactionUncheckedCreateInput), saved);
  assert.equal(data.amountChange, '-493.5');
  assert.equal(data.deltaAmount, undefined);
});

test('writer fails the containing transaction when the DB trigger is absent or inconsistent', async () => {
  for (const deltaAmount of [undefined, null, '493.5']) {
    const fake = { individualTransaction: { create: async () => receipt({ deltaAmount }) } };
    await assert.rejects(recordWalletTransaction(fake as unknown as Prisma.TransactionClient, receipt() as Prisma.IndividualTransactionUncheckedCreateInput), /delta_mismatch/);
  }
  const failing = { individualTransaction: { create: async () => { throw new Error('synthetic-write-failure'); } } };
  await assert.rejects(recordWalletTransaction(failing as unknown as Prisma.TransactionClient, receipt() as Prisma.IndividualTransactionUncheckedCreateInput), /synthetic-write-failure/);
});

test('writer rejects a root Prisma client before writing a record', async () => {
  let called = false;
  const fake = { $transaction: () => {}, individualTransaction: { create: () => { called = true; } } };
  await assert.rejects(recordWalletTransaction(fake as unknown as Prisma.TransactionClient, receipt() as Prisma.IndividualTransactionUncheckedCreateInput), /transaction_required/);
  assert.equal(called, false);
});
