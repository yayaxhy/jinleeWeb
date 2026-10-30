#!/usr/bin/env node
/** Actual application-wrapper integration against an explicitly named, disposable
 * localhost Docker database. A random schema isolates this suite from other tests.
 * Does not load .env or use DATABASE_URL. */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { Prisma, PrismaClient } from '@prisma/client';
import { register } from 'tsx/cjs/api';

const unregister = register();
const require = createRequire(import.meta.url);
const { recordWalletTransaction } = require('../lib/wallet-ledger-write.ts');
const { resolveWalletDelta, walletLedgerRelationSelection } = require('../lib/wallet-ledger.ts');
const { lockDlmWalletForUpdateTx, getDlmWalletSnapshotTx, applyDlmWalletDeltaTx } = require('../lib/dlm-wallet.ts');
const container = process.env.WALLET_LEDGER_TEST_CONTAINER;
const target = process.env.WALLET_LEDGER_TEST_DATABASE_URL;
if (!container || !/^codex-wallet-ledger-test-[a-z0-9-]+$/.test(container) || !target) {
  throw new Error('Explicit WALLET_LEDGER_TEST_CONTAINER and WALLET_LEDGER_TEST_DATABASE_URL are required.');
}
const url = new URL(target);
if (!['postgresql:', 'postgres:'].includes(url.protocol) || url.hostname !== '127.0.0.1' ||
    url.username !== 'ledger_test' || url.pathname !== '/ledger_test' || !url.port || url.port === '5432') {
  throw new Error('Only a disposable ledger_test database on a nondefault localhost Docker port is accepted.');
}
const schema = `wallet_ledger_prisma_test_${process.pid}_${randomUUID().slice(0, 8)}`;
url.searchParams.set('schema', schema);
url.searchParams.set('connection_limit', '10');
const savedWriteFlag = process.env.WALLET_LEDGER_WRITE_ENABLED;
const savedReadFlag = process.env.WALLET_LEDGER_READ_ENABLED;

function docker(args, input = '') {
  return new Promise((resolve, reject) => {
    const child = spawn('docker', args, { stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', (code) => code === 0 ? resolve(stdout.trim()) : reject(new Error(`Docker test command failed: ${stderr.trim()}`)));
    child.stdin.on('error', () => {});
    child.stdin.end(input);
  });
}
const inspected = JSON.parse(await docker(['inspect', container]));
const ports = inspected[0]?.NetworkSettings?.Ports?.['5432/tcp'] ?? [];
if (!ports.some((port) => port.HostIp === '127.0.0.1' && port.HostPort === url.port)) {
  throw new Error('Test URL does not match the disposable Docker container published port.');
}
const sql = (text) => docker(['exec', '-i', '-e', `PGOPTIONS=-c search_path=${schema}`, container,
  'psql', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-U', 'ledger_test', '-d', 'ledger_test'], text);
const db = new PrismaClient({ datasources: { db: { url: url.toString() } } });
let created = false;
try {
  await sql(`CREATE SCHEMA "${schema}";
    CREATE TABLE "DlmUser" ("dlmId" TEXT PRIMARY KEY, "totalBalance" DECIMAL(19,4) NOT NULL, "income" DECIMAL(19,4) NOT NULL, "recharge" DECIMAL(19,4) NOT NULL,
      "discordUserId" TEXT, "totalSpent" DECIMAL(19,4) NOT NULL DEFAULT 0, "loyaltyPoints" DECIMAL(19,4) NOT NULL DEFAULT 0,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE "DetachedDiscordAccount" ("ownerDlmId" TEXT PRIMARY KEY, "memberKey" TEXT NOT NULL);
    INSERT INTO "DlmUser" ("dlmId", "totalBalance", "income", "recharge") VALUES ('owner', 1000, 200, 800), ('merged-owner', 0, 0, 0), ('concurrent-owner', 100, 0, 100);
    CREATE TABLE "IndividualTransaction" (
      "transactionId" TEXT PRIMARY KEY, "timeCreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "discordId" TEXT, "dlmId" TEXT REFERENCES "DlmUser"("dlmId") ON DELETE SET NULL,
      "thirdPartydiscordId" TEXT NOT NULL, "balanceBefore" DECIMAL(19,4) NOT NULL,
      "amountChange" DECIMAL(19,4) NOT NULL, "balanceAfter" DECIMAL(19,4) NOT NULL, "typeOfTransaction" TEXT NOT NULL
    );`);
  created = true;
  const simpleReceipt = (id) => ({
    transactionId: id, dlmId: 'owner', discordId: null, thirdPartydiscordId: 'counterparty',
    balanceBefore: new Prisma.Decimal(100), balanceAfter: new Prisma.Decimal(50), amountChange: new Prisma.Decimal(50), typeOfTransaction: '点单',
  });
  process.env.WALLET_LEDGER_WRITE_ENABLED = '0';
  process.env.WALLET_LEDGER_READ_ENABLED = '0';
  await db.$transaction((tx) => recordWalletTransaction(tx, simpleReceipt('pre-migration')));
  assert.deepEqual(walletLedgerRelationSelection(), {});
  const oldRead = await db.individualTransaction.findUniqueOrThrow({ where: { transactionId: 'pre-migration' },
    select: { balanceBefore: true, balanceAfter: true, ...walletLedgerRelationSelection() } });
  assert.equal(resolveWalletDelta(oldRead).toString(), '-50');
  console.log('ok flags off: application writer and signed reader work before migration');

  const migration = await readFile(new URL('../prisma/migrations/20261030120000_add_wallet_ledger/migration.sql', import.meta.url), 'utf8');
  await sql(migration);
  await db.$transaction((tx) => recordWalletTransaction(tx, simpleReceipt('compatibility')));
  assert.equal((await db.walletLedgerEntry.findUniqueOrThrow({ where: { sourceTransactionId: 'compatibility' } })).source, 'COMPATIBILITY');
  console.log('ok write flag off after migration: database bridge captures application receipt');

  process.env.WALLET_LEDGER_WRITE_ENABLED = '1';
  process.env.WALLET_LEDGER_READ_ENABLED = '1';
  const postDebit = (id, options = {}) => db.$transaction(async (tx) => {
    const [before] = await tx.$queryRaw`SELECT "totalBalance", "income", "recharge" FROM "DlmUser" WHERE "dlmId" = 'owner' FOR UPDATE`;
    const [after] = await tx.$queryRaw`UPDATE "DlmUser" SET "totalBalance"="totalBalance"-50, "income"="income"-50 WHERE "dlmId"='owner' RETURNING "totalBalance", "income", "recharge"`;
    await recordWalletTransaction(tx, {
      ...simpleReceipt(id), balanceBefore: before.totalBalance, balanceAfter: after.totalBalance,
      amountChange: new Prisma.Decimal(options.badAmount ? 40 : 50),
    }, { walletBefore: before, walletAfter: after, correlationId: 'order:fixture', idempotencyKey: options.key });
    if (options.throwAfterWrite) throw new Error('fixture_abort');
  });
  await postDebit('live', { key: 'operation:one' });
  const live = await db.individualTransaction.findUniqueOrThrow({ where: { transactionId: 'live' },
    include: walletLedgerRelationSelection() });
  assert.equal(live.amountChange.toString(), '50', 'legacy receipt keeps its preexisting magnitude convention');
  assert.equal(live.walletLedgerEntry.walletDelta.toString(), '-50');
  assert.equal(resolveWalletDelta(live).toString(), '-50');
  const fullLedger = await db.walletLedgerEntry.findUniqueOrThrow({ where: { sourceTransactionId: 'live' } });
  assert.equal(fullLedger.source, 'LIVE');
  assert.equal(fullLedger.incomeDelta.toString(), '-50');
  assert.equal(fullLedger.rechargeDelta.toString(), '0');
  assert.equal(fullLedger.totalSpentDelta, null, 'omitted component remains unknown');
  console.log('ok live wrapper stores signed delta, factual components and legacy magnitude atomically');

  const balance = async () => (await db.$queryRaw`SELECT "totalBalance"::text AS amount FROM "DlmUser" WHERE "dlmId"='owner'`)[0].amount;
  assert.equal(await balance(), '950.0000');
  await assert.rejects(postDebit('failed-after-write', { throwAfterWrite: true }), /fixture_abort/);
  await assert.rejects(postDebit('failed-amount', { badAmount: true }), /wallet_ledger_amount_mismatch/);
  await assert.rejects(postDebit('duplicate-operation', { key: 'operation:one' }), /Unique constraint failed/);
  assert.equal(await balance(), '950.0000');
  assert.equal(await db.individualTransaction.count({ where: { transactionId: { in: ['failed-after-write', 'failed-amount', 'duplicate-operation'] } } }), 0);
  assert.equal(await db.walletLedgerEntry.count({ where: { sourceTransactionId: { in: ['failed-after-write', 'failed-amount', 'duplicate-operation'] } } }), 0);
  await assert.rejects(recordWalletTransaction(db, simpleReceipt('outside-transaction')), /wallet_ledger_transaction_required/);
  console.log('ok callback error, amount mismatch and duplicate operation key roll back wallet, receipt and ledger');

  await db.$transaction((tx) => recordWalletTransaction(tx, {
    ...simpleReceipt('signed-withdrawal'), amountChange: new Prisma.Decimal(-50), typeOfTransaction: '提现',
  }));
  const signed = await db.individualTransaction.findUniqueOrThrow({ where: { transactionId: 'signed-withdrawal' }, include: walletLedgerRelationSelection() });
  assert.equal(signed.amountChange.toString(), '-50');
  assert.equal(resolveWalletDelta(signed).toString(), '-50');
  assert.equal(resolveWalletDelta(await db.individualTransaction.findUniqueOrThrow({ where: { transactionId: 'pre-migration' }, include: walletLedgerRelationSelection() })).toString(), '-50', 'missing backfill falls back to original balances');

  const concurrentIdentity = { dlmId: 'concurrent-owner', discordUserId: null };
  const credit = (index) => db.$transaction(async (tx) => {
    await tx.$executeRaw`SET LOCAL lock_timeout = '5s'`;
    await lockDlmWalletForUpdateTx(tx, concurrentIdentity);
    const before = await getDlmWalletSnapshotTx(tx, concurrentIdentity);
    // Force overlapping calls to expose any unlocked read-before-update window.
    await tx.$executeRaw`SELECT pg_sleep(0.05)`;
    const after = await applyDlmWalletDeltaTx(tx, { ...concurrentIdentity, totalBalanceDelta: 10, rechargeDelta: 10 });
    await recordWalletTransaction(tx, {
      transactionId: `concurrent-credit-${index}`, dlmId: concurrentIdentity.dlmId, thirdPartydiscordId: 'fixture',
      balanceBefore: before.totalBalance, balanceAfter: after.totalBalance, amountChange: new Prisma.Decimal(10), typeOfTransaction: '网站充值',
    }, { walletBefore: before, walletAfter: after, idempotencyKey: `concurrent-credit:${index}` });
  }, { maxWait: 10000, timeout: 20000 });
  const creditResults = await Promise.allSettled(Array.from({ length: 6 }, (_, index) => credit(index)));
  for (const result of creditResults) if (result.status === 'rejected') throw result.reason;
  const credits = await db.walletLedgerEntry.findMany({ where: { dlmId: concurrentIdentity.dlmId }, orderBy: { balanceBefore: 'asc' } });
  assert.equal(credits.length, 6);
  credits.forEach((row, index) => {
    assert.equal(row.balanceBefore.toString(), String(100 + index * 10));
    assert.equal(row.balanceAfter.toString(), String(110 + index * 10));
    assert.equal(row.walletDelta.toString(), '10');
    assert.equal(row.rechargeDelta.toString(), '10');
    assert.equal(row.source, 'LIVE');
  });
  console.log('ok six concurrent credits serialize actual wallet snapshots and all commit accurate LIVE receipts');

  const guardedDebit = (index) => db.$transaction(async (tx) => {
    await tx.$executeRaw`SET LOCAL lock_timeout = '5s'`;
    await lockDlmWalletForUpdateTx(tx, concurrentIdentity);
    const before = await getDlmWalletSnapshotTx(tx, concurrentIdentity);
    if (before.totalBalance.lt(100) || before.recharge.lt(100)) return false;
    await tx.$executeRaw`SELECT pg_sleep(0.05)`;
    const after = await applyDlmWalletDeltaTx(tx, { ...concurrentIdentity, totalBalanceDelta: -100, rechargeDelta: -100 });
    await recordWalletTransaction(tx, {
      transactionId: `guarded-debit-${index}`, dlmId: concurrentIdentity.dlmId, thirdPartydiscordId: 'fixture',
      balanceBefore: before.totalBalance, balanceAfter: after.totalBalance, amountChange: new Prisma.Decimal(100), typeOfTransaction: '点单',
    }, { walletBefore: before, walletAfter: after });
    return true;
  }, { maxWait: 10000, timeout: 20000 });
  const debitResults = await Promise.allSettled([guardedDebit(1), guardedDebit(2)]);
  for (const result of debitResults) if (result.status === 'rejected') throw result.reason;
  assert.deepEqual(debitResults.map((result) => result.value).sort(), [false, true]);
  assert.equal((await db.dlmUser.findUniqueOrThrow({ where: { dlmId: concurrentIdentity.dlmId }, select: { totalBalance: true } })).totalBalance.toString(), '60');
  assert.equal(await db.walletLedgerEntry.count({ where: { dlmId: concurrentIdentity.dlmId, direction: 'DEBIT' } }), 1);
  console.log('ok concurrent guarded debits observe the committed balance and cannot both spend the same funds');

  await sql(`BEGIN; UPDATE "IndividualTransaction" SET "dlmId"='merged-owner' WHERE "dlmId"='owner'; DELETE FROM "DlmUser" WHERE "dlmId"='owner'; COMMIT;`);
  const merged = await db.individualTransaction.findMany({ where: { dlmId: 'merged-owner' }, include: walletLedgerRelationSelection() });
  assert.equal(merged.length, 4);
  assert.equal((await db.walletLedgerEntry.findUniqueOrThrow({ where: { sourceTransactionId: 'live' } })).dlmId, 'owner');
  assert.equal(merged.reduce((sum, row) => sum.add(resolveWalletDelta(row)), new Prisma.Decimal(0)).toString(), '-200');
  console.log('ok signed legacy withdrawals, missing backfill and merged ownership use consistent signed reads');
  console.log('All wallet ledger application Prisma integration checks passed.');
} finally {
  await db.$disconnect();
  if (created) await sql(`DROP SCHEMA "${schema}" CASCADE;`);
  if (savedWriteFlag === undefined) delete process.env.WALLET_LEDGER_WRITE_ENABLED;
  else process.env.WALLET_LEDGER_WRITE_ENABLED = savedWriteFlag;
  if (savedReadFlag === undefined) delete process.env.WALLET_LEDGER_READ_ENABLED;
  else process.env.WALLET_LEDGER_READ_ENABLED = savedReadFlag;
  unregister();
}
