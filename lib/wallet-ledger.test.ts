import assert from 'node:assert/strict';
import test from 'node:test';
import { Prisma } from '@prisma/client';
import { createWalletLedgerEntryData, resolveWalletDelta, type LedgerReceipt } from './wallet-ledger';
import { recordWalletTransaction } from './wallet-ledger-write';

const receipt = (overrides: Partial<LedgerReceipt> = {}): LedgerReceipt => ({
  transactionId: 'IT-ledger-test', dlmId: 'original-owner', discordId: null,
  thirdPartydiscordId: 'worker', balanceBefore: '1035', balanceAfter: '541.5',
  amountChange: '493.5', typeOfTransaction: '点单', timeCreatedAt: new Date('2026-10-30T12:00:00Z'),
  ...overrides,
});

test('unsigned Bot debit and signed website debit have the same exact ledger direction', () => {
  for (const amountChange of ['493.5', '-493.5']) {
    const row = createWalletLedgerEntryData(receipt({ amountChange }));
    assert.equal(row.walletDelta.toFixed(4), '-493.5000');
    assert.equal(row.businessAmount.toFixed(4), '493.5000');
    assert.equal(row.direction, 'DEBIT');
    assert.equal(row.eventType, 'ORDER_PAYMENT');
    assert.equal(row.integrityStatus, 'VERIFIED');
    assert.equal(row.incomeDelta, null);
    assert.equal(row.rechargeDelta, null);
  }
});

test('credit and zero movements are explicit, including four-decimal precision', () => {
  const credit = createWalletLedgerEntryData(receipt({ balanceBefore: '100', balanceAfter: '100.0001', amountChange: '0.0001' }));
  assert.equal(credit.walletDelta.toString(), '0.0001');
  assert.equal(credit.eventType, 'ORDER_INCOME');
  const zero = createWalletLedgerEntryData(receipt({ balanceBefore: '0', balanceAfter: '0', amountChange: '0' }));
  assert.equal(zero.direction, 'NONE');
  assert.equal(zero.walletDelta.toString(), '0');
});

test('live amounts must reconcile; a deliberate face-value difference requires an expected delta', () => {
  const input = receipt({ typeOfTransaction: '订单撤销', amountChange: '52', balanceBefore: '0.02', balanceAfter: '0' });
  assert.throws(() => createWalletLedgerEntryData(input), /amount_mismatch/);
  assert.throws(() => createWalletLedgerEntryData(input, { expectedWalletDelta: '-52' }), /amount_mismatch/);
  const row = createWalletLedgerEntryData(input, { expectedWalletDelta: '-0.02' });
  assert.equal(row.businessAmount.toString(), '52');
  assert.equal(row.walletDelta.toString(), '-0.02');
  assert.equal(row.integrityStatus, 'REQUIRES_REVIEW');
  assert.equal(createWalletLedgerEntryData(receipt({ dlmId: null, discordId: null })).integrityStatus, 'UNVERIFIABLE');
});

test('component deltas are derived only from supplied snapshots and must reconcile', () => {
  const walletBefore = { totalBalance: '1035', income: '10', recharge: '1025', totalSpent: '100' };
  const walletAfter = { totalBalance: '541.5', income: '0', recharge: '541.5', totalSpent: '593.5' };
  const row = createWalletLedgerEntryData(receipt(), { walletBefore, walletAfter });
  assert.equal(row.incomeDelta?.toString(), '-10');
  assert.equal(row.rechargeDelta?.toString(), '-483.5');
  assert.equal(row.totalSpentDelta?.toString(), '493.5');
  assert.equal(row.loyaltyPointsDelta, null);
  assert.throws(() => createWalletLedgerEntryData(receipt(), { walletBefore }), /incomplete_snapshots/);
  assert.throws(() => createWalletLedgerEntryData(receipt(), { walletBefore, walletAfter: { ...walletAfter, totalBalance: '540' } }), /snapshot_mismatch/);
  assert.throws(() => createWalletLedgerEntryData(receipt(), { walletBefore, walletAfter: { ...walletAfter, recharge: '540' } }), /components_mismatch/);
});

test('rejects non-finite and out-of-precision values rather than silently rounding', () => {
  for (const balanceBefore of ['NaN', 'Infinity', '1.12345', '1000000000000000']) {
    assert.throws(() => createWalletLedgerEntryData(receipt({ balanceBefore })), /invalid_money/);
  }
  assert.throws(() => createWalletLedgerEntryData(receipt({
    balanceBefore: '-999999999999999', balanceAfter: '999999999999999', amountChange: '0',
  })), /invalid_money/);
  assert.throws(() => createWalletLedgerEntryData(receipt(), {
    walletBefore: { totalBalance: '1035', loyaltyPoints: '-999999999999999' },
    walletAfter: { totalBalance: '541.5', loyaltyPoints: '999999999999999' },
  }), /invalid_money/);
});

test('new ledger reads and historical fallback share the same signed convention', () => {
  assert.equal(resolveWalletDelta({ balanceBefore: '10.0001', balanceAfter: '0' })?.toString(), '-10.0001');
  assert.equal(resolveWalletDelta({ balanceBefore: null, balanceAfter: '0' }), null);
  assert.equal(resolveWalletDelta({ balanceBefore: '10', balanceAfter: '0', walletLedgerEntry: { walletDelta: '-10' } })?.toString(), '-10');
});

test('live dual write preserves the compatibility payload and never swallows ledger failure', async () => {
  const original = process.env.WALLET_LEDGER_WRITE_ENABLED;
  process.env.WALLET_LEDGER_WRITE_ENABLED = '1';
  try {
    const saved = receipt({ amountChange: '-493.5' });
    const fake = {
      individualTransaction: { create: async ({ data }: { data: unknown }) => { assert.equal(data, saved); return saved; } },
      walletLedgerEntry: { create: async ({ data }: { data: ReturnType<typeof createWalletLedgerEntryData> }) => {
        assert.equal(data.walletDelta.toString(), '-493.5');
        throw new Error('synthetic-ledger-failure');
      } },
    };
    await assert.rejects(recordWalletTransaction(fake as unknown as Prisma.TransactionClient, saved as Prisma.IndividualTransactionUncheckedCreateInput), /synthetic-ledger-failure/);
  } finally {
    if (original === undefined) delete process.env.WALLET_LEDGER_WRITE_ENABLED;
    else process.env.WALLET_LEDGER_WRITE_ENABLED = original;
  }
});

test('pre-migration writer never queries a missing ledger table', async () => {
  const original = process.env.WALLET_LEDGER_WRITE_ENABLED;
  delete process.env.WALLET_LEDGER_WRITE_ENABLED;
  try {
    const saved = receipt();
    const fake = { individualTransaction: { create: async () => saved } };
    assert.equal(await recordWalletTransaction(fake as unknown as Prisma.TransactionClient, saved as Prisma.IndividualTransactionUncheckedCreateInput), saved);
  } finally {
    if (original !== undefined) process.env.WALLET_LEDGER_WRITE_ENABLED = original;
  }
});

test('writer rejects a root Prisma client before writing either record', async () => {
  let called = false;
  const fake = { $transaction: () => {}, individualTransaction: { create: () => { called = true; } } };
  await assert.rejects(recordWalletTransaction(fake as unknown as Prisma.TransactionClient, receipt() as Prisma.IndividualTransactionUncheckedCreateInput), /transaction_required/);
  assert.equal(called, false);
});
