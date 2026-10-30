import assert from 'node:assert/strict';
import test from 'node:test';
import { Prisma } from '@prisma/client';
import { normalizeWalletLedgerDatabaseUrl } from './wallet-ledger-tool-config';
import {
  classifyLegacyLedgerFacts,
  parseWalletLedgerToolOptions,
  validateWalletLedgerDatabaseTarget,
  verifyWalletLedgerBatch,
  walletLedgerBackfillInsert,
  walletLedgerToolErrorCode,
  type WalletLedgerSqlClient,
} from './wallet-ledger-backfill';

test('backfill defaults to dry-run and requires explicit bounded write arguments', () => {
  assert.equal(parseWalletLedgerToolOptions([], true).apply, false);
  assert.throws(() => parseWalletLedgerToolOptions(['--apply'], true), /confirmation/);
  assert.throws(() => parseWalletLedgerToolOptions(['--apply'], false), /read_only/);
  assert.throws(() => parseWalletLedgerToolOptions(['--batch-size', '0'], true), /invalid_limit/);
  assert.throws(() => parseWalletLedgerToolOptions(['--max-batches', '1001'], true), /invalid_limit/);
  assert.throws(() => parseWalletLedgerToolOptions(['--batch-size', '5001'], true), /invalid_limit/);
  assert.throws(() => parseWalletLedgerToolOptions(['--after-id', 'IT10'], true), /through_id/);
  const options = parseWalletLedgerToolOptions(['--apply', '--confirm-database', 'staging', '--after-id', 'IT10', '--through-id', 'IT99'], true);
  assert.equal(options.afterId, 'IT10');
  assert.equal(options.throughId, 'IT99');
  assert.equal(validateWalletLedgerDatabaseTarget('postgresql://user:secret@localhost/staging', options), 'staging');
  assert.throws(() => validateWalletLedgerDatabaseTarget('postgresql://user:secret@localhost/production', options), /confirmation_mismatch/);
  assert.equal(normalizeWalletLedgerDatabaseUrl(" psql 'postgresql://user:secret@localhost/staging' "), 'postgresql://user:secret@localhost/staging');
  assert.equal(validateWalletLedgerDatabaseTarget("psql 'postgresql://user:secret@localhost/staging'", options), 'staging');
  assert.throws(() => normalizeWalletLedgerDatabaseUrl('psql password=secret'), /^Error: ledger_database_url_invalid$/);
});

test('signed and absolute historical amounts produce the same explicit wallet debit', () => {
  const facts = { transactionId: 'IT1', dlmId: 'user1', discordId: null, balanceBefore: new Prisma.Decimal('100.0001'), balanceAfter: new Prisma.Decimal('50.0000') };
  for (const rawAmount of ['50.0001', '-50.0001']) {
    const record = classifyLegacyLedgerFacts({ ...facts, amountChange: new Prisma.Decimal(rawAmount) });
    assert.equal(record.walletDelta.toFixed(4), '-50.0001');
    assert.equal(record.businessAmount.toFixed(4), '50.0001');
    assert.equal(record.direction, 'DEBIT');
    assert.equal(record.integrityStatus, 'VERIFIED');
  }
});

test('historical discrepancy keeps both business magnitude and actual wallet movement', () => {
  const facts = { transactionId: 'IT-old-reversal', dlmId: 'user1', discordId: null, amountChange: new Prisma.Decimal('52'), balanceBefore: new Prisma.Decimal('0.02'), balanceAfter: new Prisma.Decimal('0') };
  const record = classifyLegacyLedgerFacts(facts);
  assert.equal(record.walletDelta.toString(), '-0.02');
  assert.equal(record.businessAmount.toString(), '52');
  assert.equal(record.integrityStatus, 'REQUIRES_REVIEW');
  assert.equal(classifyLegacyLedgerFacts({ ...facts, dlmId: null }).integrityStatus, 'UNVERIFIABLE');
  const zero = classifyLegacyLedgerFacts({ ...facts, amountChange: new Prisma.Decimal(0), balanceBefore: new Prisma.Decimal(0) });
  assert.equal(zero.direction, 'NONE');
  assert.equal(zero.integrityStatus, 'VERIFIED');
});

test('non-finite source money and an overflowing derived delta are rejected without guessing corrections', () => {
  const facts = { transactionId: 'invalid', dlmId: 'owner', discordId: null,
    amountChange: new Prisma.Decimal('1'), balanceBefore: new Prisma.Decimal(0), balanceAfter: new Prisma.Decimal(1) };
  for (const field of ['amountChange', 'balanceBefore', 'balanceAfter'] as const) {
    assert.throws(() => classifyLegacyLedgerFacts({ ...facts, [field]: new Prisma.Decimal('NaN') }), /invalid_source_money/);
  }
  assert.throws(() => classifyLegacyLedgerFacts({ ...facts,
    balanceBefore: new Prisma.Decimal('-999999999999999.9999'),
    balanceAfter: new Prisma.Decimal('999999999999999.9999'),
  }), /invalid_source_money/);
});

test('backfill is parameterized, idempotent, and does not fabricate component deltas', () => {
  const id = "IT'); DELETE FROM anything; --";
  const sql = walletLedgerBackfillInsert([id]);
  assert.equal(sql.text.includes(id), false);
  assert.deepEqual(sql.values, [id]);
  assert.match(sql.text, /ON CONFLICT \("sourceTransactionId"\) DO NOTHING/);
  assert.doesNotMatch(sql.text, /"incomeDelta"|"rechargeDelta"|"totalSpentDelta"|"loyaltyPointsDelta"/);
  assert.doesNotMatch(sql.text, /\bUPDATE\b|\bDELETE\b/);
  assert.throws(() => walletLedgerBackfillInsert([]), /empty_batch/);
});

test('existing mismatched ledger facts stop backfill rather than being overwritten', async () => {
  const tx = { $queryRaw: async () => [{ mismatchCount: '1', invalidSourceMoney: '0' }] } as unknown as WalletLedgerSqlClient;
  await assert.rejects(verifyWalletLedgerBatch(tx, ['IT1']), /existing_base_facts_mismatch/);
  await verifyWalletLedgerBatch({ $queryRaw: async () => [{ mismatchCount: '0', invalidSourceMoney: '0' }] } as unknown as WalletLedgerSqlClient, ['IT1']);
  await assert.rejects(verifyWalletLedgerBatch({ $queryRaw: async () => [{ mismatchCount: '0', invalidSourceMoney: '1' }] } as unknown as WalletLedgerSqlClient, ['IT1']), /invalid_source_money/);
});

test('tool failure output never prints arbitrary driver messages or connection strings', () => {
  assert.equal(walletLedgerToolErrorCode(new Error('password=secret postgres://private-db')), 'ledger_tool_failed');
  assert.equal(walletLedgerToolErrorCode({ code: 'P1001', message: 'private host' }), 'ledger_database_error_P1001');
});
