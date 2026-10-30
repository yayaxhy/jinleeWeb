#!/usr/bin/env node
/** Actual application-wrapper integration in a new disposable Docker database.
 * Publishes one random localhost port, without app env, data or mounted files. */
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
const { resolveWalletDelta, transactionDeltaSelection } = require('../lib/wallet-ledger.ts');
const { lockDlmWalletForUpdateTx, getDlmWalletSnapshotTx, applyDlmWalletDeltaTx } = require('../lib/dlm-wallet.ts');
const container = `codex-transaction-delta-prisma-${process.pid}-${randomUUID().slice(0, 8)}`;
const schema = 'delta_prisma_test';
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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
const sql = (text) => docker(['exec', '-i', '-e', `PGOPTIONS=-c search_path=${schema}`, container,
  'psql', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-U', 'ledger_test', '-d', 'ledger_test'], text);
let db;
let created = false;
try {
  await docker(['run', '-d', '--name', container, '--tmpfs', '/var/lib/postgresql/data', '-p', '127.0.0.1::5432',
    '-e', 'POSTGRES_USER=ledger_test', '-e', 'POSTGRES_PASSWORD=isolated_delta_test', '-e', 'POSTGRES_DB=ledger_test', 'postgres:16-alpine']);
  created = true;
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try { await docker(['exec', container, 'pg_isready', '-U', 'ledger_test', '-d', 'ledger_test']); ready = true; break; }
    catch { await pause(500); }
  }
  if (!ready) throw new Error('Disposable PostgreSQL did not become ready within 30 seconds.');
  const published = await docker(['port', container, '5432/tcp']);
  const port = published.match(/^127\.0\.0\.1:(\d+)$/)?.[1];
  if (!port) throw new Error('Unexpected disposable database port binding.');
  const url = new URL(`postgresql://ledger_test:isolated_delta_test@127.0.0.1:${port}/ledger_test`);
  url.searchParams.set('schema', schema);
  url.searchParams.set('connection_limit', '10');
  db = new PrismaClient({ datasources: { db: { url: url.toString() } } });
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
  const simpleReceipt = (id) => ({
    transactionId: id, dlmId: 'owner', discordId: null, thirdPartydiscordId: 'counterparty',
    balanceBefore: new Prisma.Decimal(100), balanceAfter: new Prisma.Decimal(50), amountChange: new Prisma.Decimal(50), typeOfTransaction: '点单',
  });
  await sql(`INSERT INTO "IndividualTransaction" ("transactionId","dlmId","thirdPartydiscordId","balanceBefore","balanceAfter","amountChange","typeOfTransaction")
    VALUES ('pre-migration','owner','fixture',100,50,50,'点单');`);
  await assert.rejects(db.individualTransaction.findMany(), /deltaAmount/);
  assert.deepEqual(transactionDeltaSelection(), { deltaAmount: true });
  console.log('ok new generated Prisma client requires the additive column migration before deployment');

  const migration = await readFile(new URL('../prisma/migrations/20261030130000_add_transaction_delta_amount/migration.sql', import.meta.url), 'utf8');
  await sql(migration);
  await sql(`INSERT INTO "IndividualTransaction" ("transactionId","dlmId","thirdPartydiscordId","balanceBefore","balanceAfter","amountChange","typeOfTransaction")
    VALUES ('compatibility','owner','fixture',100,50,50,'点单');`);
  assert.equal((await db.individualTransaction.findUniqueOrThrow({ where: { transactionId: 'compatibility' } })).deltaAmount.toString(), '-50');
  const oldRead = await db.individualTransaction.findUniqueOrThrow({ where: { transactionId: 'pre-migration' },
    select: { balanceBefore: true, balanceAfter: true, ...transactionDeltaSelection() } });
  assert.equal(oldRead.deltaAmount, null);
  assert.equal(resolveWalletDelta(oldRead).toString(), '-50');
  console.log('ok old raw INSERT is filled automatically, and unfilled history uses the balance-difference fallback');
  const postDebit = (id, options = {}) => db.$transaction(async (tx) => {
    const [before] = await tx.$queryRaw`SELECT "totalBalance", "income", "recharge" FROM "DlmUser" WHERE "dlmId" = 'owner' FOR UPDATE`;
    const [after] = await tx.$queryRaw`UPDATE "DlmUser" SET "totalBalance"="totalBalance"-50, "income"="income"-50 WHERE "dlmId"='owner' RETURNING "totalBalance", "income", "recharge"`;
    await recordWalletTransaction(tx, {
      ...simpleReceipt(id), balanceBefore: before.totalBalance, balanceAfter: after.totalBalance,
      amountChange: new Prisma.Decimal(options.badAmount ? 40 : 50),
    }, { walletBefore: before, walletAfter: after });
    if (options.throwAfterWrite) throw new Error('fixture_abort');
  });
  await postDebit('live');
  const live = await db.individualTransaction.findUniqueOrThrow({ where: { transactionId: 'live' } });
  assert.equal(live.amountChange.toString(), '50', 'legacy receipt keeps its preexisting magnitude convention');
  assert.equal(live.deltaAmount.toString(), '-50');
  assert.equal(resolveWalletDelta(live).toString(), '-50');
  console.log('ok actual wrapper validates the trigger-returned signed delta and preserves legacy magnitude');

  const balance = async () => (await db.$queryRaw`SELECT "totalBalance"::text AS amount FROM "DlmUser" WHERE "dlmId"='owner'`)[0].amount;
  assert.equal(await balance(), '950.0000');
  await assert.rejects(postDebit('failed-after-write', { throwAfterWrite: true }), /fixture_abort/);
  await assert.rejects(postDebit('failed-amount', { badAmount: true }), /wallet_ledger_amount_mismatch/);
  await assert.rejects(postDebit('live'), /Unique constraint failed/);
  assert.equal(await balance(), '950.0000');
  assert.equal(await db.individualTransaction.count({ where: { transactionId: { in: ['failed-after-write', 'failed-amount'] } } }), 0);
  await assert.rejects(recordWalletTransaction(db, simpleReceipt('outside-transaction')), /wallet_ledger_transaction_required/);
  await sql('ALTER TABLE "IndividualTransaction" DISABLE TRIGGER "IndividualTransaction_set_deltaAmount";');
  await assert.rejects(postDebit('missing-trigger'), /wallet_ledger_delta_mismatch/);
  await sql('ALTER TABLE "IndividualTransaction" ENABLE TRIGGER "IndividualTransaction_set_deltaAmount";');
  assert.equal(await balance(), '950.0000');
  assert.equal(await db.individualTransaction.count({ where: { transactionId: 'missing-trigger' } }), 0);
  console.log('ok callback failure, invalid amount, duplicate receipt ID and missing trigger roll back the wallet and receipt');

  await db.$transaction((tx) => recordWalletTransaction(tx, {
    ...simpleReceipt('signed-withdrawal'), amountChange: new Prisma.Decimal(-50), typeOfTransaction: '提现',
  }));
  const signed = await db.individualTransaction.findUniqueOrThrow({ where: { transactionId: 'signed-withdrawal' } });
  assert.equal(signed.amountChange.toString(), '-50');
  assert.equal(resolveWalletDelta(signed).toString(), '-50');
  assert.equal(resolveWalletDelta(await db.individualTransaction.findUniqueOrThrow({ where: { transactionId: 'pre-migration' } })).toString(), '-50', 'missing backfill falls back to original balances');

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
    }, { walletBefore: before, walletAfter: after });
  }, { maxWait: 10000, timeout: 20000 });
  const creditResults = await Promise.allSettled(Array.from({ length: 6 }, (_, index) => credit(index)));
  for (const result of creditResults) if (result.status === 'rejected') throw result.reason;
  const credits = await db.individualTransaction.findMany({ where: { dlmId: concurrentIdentity.dlmId }, orderBy: { balanceBefore: 'asc' } });
  assert.equal(credits.length, 6);
  credits.forEach((row, index) => {
    assert.equal(row.balanceBefore.toString(), String(100 + index * 10));
    assert.equal(row.balanceAfter.toString(), String(110 + index * 10));
    assert.equal(row.deltaAmount.toString(), '10');
  });
  console.log('ok six shared-client concurrent credits commit continuous snapshots and accurate signed deltas');

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
  assert.equal(await db.individualTransaction.count({ where: { dlmId: concurrentIdentity.dlmId, deltaAmount: { lt: 0 } } }), 1);
  console.log('ok concurrent guarded debits observe the committed balance and cannot both spend the same funds');

  await sql(`BEGIN; UPDATE "IndividualTransaction" SET "dlmId"='merged-owner' WHERE "dlmId"='owner'; DELETE FROM "DlmUser" WHERE "dlmId"='owner'; COMMIT;`);
  const merged = await db.individualTransaction.findMany({ where: { dlmId: 'merged-owner' } });
  assert.equal(merged.length, 4);
  assert.equal(merged.find((row) => row.transactionId === 'pre-migration').deltaAmount, null);
  assert.equal(merged.reduce((sum, row) => sum.add(resolveWalletDelta(row)), new Prisma.Decimal(0)).toString(), '-200');
  console.log('ok signed legacy withdrawals, missing backfill and merged ownership use consistent signed reads');
  console.log('All original transaction signed-delta Prisma integration checks passed.');
} finally {
  if (db) await db.$disconnect();
  if (created) await docker(['rm', '-f', container]);
  unregister();
}
