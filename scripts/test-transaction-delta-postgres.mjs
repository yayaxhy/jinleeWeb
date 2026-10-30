#!/usr/bin/env node
/** Signed-delta SQL integration. Only a new network-isolated Docker database is
 * used. No application environment or database URL is read. */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const imageArg = process.argv.indexOf('--image');
const image = imageArg >= 0 ? process.argv[imageArg + 1] : 'postgres:16-alpine';
if (!image || !/^postgres:[a-zA-Z0-9_.-]+$/.test(image)) throw new Error('Use a tagged official postgres test image.');
const container = `dlm-transaction-delta-test-${process.pid}-${randomUUID().slice(0, 8)}`;
const database = 'transaction_delta_test';
const migration = await readFile(new URL('../prisma/migrations/20261030130000_add_transaction_delta_amount/migration.sql', import.meta.url), 'utf8');
function command(args, input = '') {
  return new Promise((resolve, reject) => {
    const child = spawn('docker', args, { stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = ''; let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', (code) => code === 0 ? resolve(stdout.trim()) : reject(new Error(`docker ${args[0]} exited ${code}: ${stderr.trim()}`)));
    child.stdin.on('error', () => {}); child.stdin.end(input);
  });
}
const sql = (text) => command(['exec', '-i', container, 'psql', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', database], text);
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const receipt = (id, before = '100', after = '50', amount = '50', extraColumn = '', extraValue = '') => `
  INSERT INTO "IndividualTransaction" ("transactionId", "dlmId", "thirdPartydiscordId", "balanceBefore", "balanceAfter", "amountChange", "typeOfTransaction"${extraColumn})
  VALUES ('${id}', 'original-owner', 'counterparty', ${before}, ${after}, ${amount}, '点单'${extraValue});`;
const fail = (statement, reason) => assert.rejects(sql(statement), reason);
let created = false;
try {
  await command(['run', '-d', '--name', container, '--network', 'none', '--tmpfs', '/var/lib/postgresql/data',
    '-e', 'POSTGRES_PASSWORD=isolated-delta-test', '-e', `POSTGRES_DB=${database}`, image]);
  created = true;
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try { await command(['exec', container, 'pg_isready', '-U', 'postgres', '-d', database]); ready = true; break; }
    catch { await pause(500); }
  }
  if (!ready) throw new Error('Disposable PostgreSQL did not become ready within 30 seconds.');
  await sql(`
    CREATE TABLE "DlmUser" ("dlmId" TEXT PRIMARY KEY, "totalBalance" DECIMAL(19,4) NOT NULL DEFAULT 100);
    INSERT INTO "DlmUser" ("dlmId") VALUES ('original-owner'), ('merged-owner');
    CREATE TABLE "IndividualTransaction" (
      "transactionId" TEXT PRIMARY KEY, "timeCreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "discordId" TEXT, "dlmId" TEXT REFERENCES "DlmUser"("dlmId") ON DELETE SET NULL,
      "thirdPartydiscordId" TEXT NOT NULL, "balanceBefore" DECIMAL(19,4) NOT NULL,
      "amountChange" DECIMAL(19,4) NOT NULL, "balanceAfter" DECIMAL(19,4) NOT NULL, "typeOfTransaction" TEXT NOT NULL
    );
    ${receipt('legacy')}${receipt('legacy-anomaly', '100', '99.98', '52')}
    ${receipt('legacy-race')}${receipt('legacy-nan', "'NaN'", '0', '0')}`);
  const legacyBefore = await sql('SELECT jsonb_agg(to_jsonb(t) ORDER BY "transactionId") FROM "IndividualTransaction" t;');
  await sql(migration);
  assert.equal(await sql('SELECT jsonb_agg(to_jsonb(t)-\'deltaAmount\' ORDER BY "transactionId") FROM "IndividualTransaction" t;'), legacyBefore);
  assert.equal(await sql('SELECT count(*) FROM "IndividualTransaction" WHERE "deltaAmount" IS NOT NULL;'), '0');
  assert.equal(await sql('SELECT to_regclass(\'"WalletLedgerEntry"\') IS NULL;'), 't');
  console.log('ok migration adds only nullable deltaAmount and preserves all historical facts');

  await sql(`${receipt('old-debit')}${receipt('old-credit', '50', '100', '50')}${receipt('old-signed', '100', '50', '-50')}
    ${receipt('zero', '10', '10', '52')}${receipt('magnitude-anomaly', '100', '99.98', '52')}
    ${receipt('explicit', '10', '9.9999', '0.0001', ', "deltaAmount"', ', -0.0001')}`);
  assert.equal(await sql(`SELECT "transactionId" || ':' || "deltaAmount"::TEXT FROM "IndividualTransaction"
    WHERE "transactionId" IN ('old-debit','old-credit','old-signed','zero','magnitude-anomaly','explicit') ORDER BY "transactionId";`),
  'explicit:-0.0001\nmagnitude-anomaly:-0.0200\nold-credit:50.0000\nold-debit:-50.0000\nold-signed:-50.0000\nzero:0.0000');
  console.log('ok old/explicit writers, signed/magnitude amounts, zero and four-decimal values');

  await fail(`BEGIN; UPDATE "DlmUser" SET "totalBalance"=50 WHERE "dlmId"='original-owner';
    ${receipt('invalid-explicit', '100', '50', '50', ', "deltaAmount"', ', 50')} COMMIT;`, /transaction_delta_amount_mismatch/);
  assert.equal(await sql(`SELECT "totalBalance" FROM "DlmUser" WHERE "dlmId"='original-owner';`), '100.0000');
  assert.equal(await sql(`SELECT count(*) FROM "IndividualTransaction" WHERE "transactionId"='invalid-explicit';`), '0');
  await fail(receipt('nan-before', "'NaN'", '0'), /transaction_delta_non_finite_balance/);
  await fail(receipt('nan-after', '0', "'NaN'"), /transaction_delta_non_finite_balance/);
  await fail(receipt('nan-delta', '100', '50', '50', ', "deltaAmount"', ", 'NaN'"), /transaction_delta_amount_mismatch/);
  await fail(receipt('overflow', '-999999999999999.9999', '999999999999999.9999', '1'), /numeric field overflow/);
  console.log('ok explicit mismatch, NaN and overflow fail atomically with the wallet change');

  await sql(`UPDATE "IndividualTransaction" SET "balanceAfter"=40 WHERE "transactionId"='old-debit';`);
  assert.equal(await sql(`SELECT "deltaAmount" FROM "IndividualTransaction" WHERE "transactionId"='old-debit';`), '-60.0000');
  await sql(`UPDATE "IndividualTransaction" SET "balanceAfter"=30,"deltaAmount"=-70 WHERE "transactionId"='old-debit';`);
  await fail(`UPDATE "IndividualTransaction" SET "balanceAfter"=20,"deltaAmount"=10 WHERE "transactionId"='old-debit';`, /transaction_delta_amount_mismatch/);
  await fail(`UPDATE "IndividualTransaction" SET "deltaAmount"=99 WHERE "transactionId"='old-debit';`, /transaction_delta_amount_mismatch/);
  await sql(`UPDATE "IndividualTransaction" SET "deltaAmount"=NULL WHERE "transactionId"='old-debit';
    UPDATE "IndividualTransaction" SET "amountChange"=999 WHERE "transactionId"='old-debit';`);
  assert.equal(await sql(`SELECT "deltaAmount" FROM "IndividualTransaction" WHERE "transactionId"='old-debit';`), '-70.0000');
  console.log('ok old corrections recompute delta, explicit incorrect updates reject, legacy amount remains independent');

  await sql(`UPDATE "IndividualTransaction" SET "dlmId"='merged-owner',"discordId"='merged-discord' WHERE "transactionId" IN ('legacy','old-credit');`);
  assert.equal(await sql(`SELECT "deltaAmount" IS NULL FROM "IndividualTransaction" WHERE "transactionId"='legacy';`), 't');
  assert.equal(await sql(`SELECT "deltaAmount" FROM "IndividualTransaction" WHERE "transactionId"='old-credit';`), '50.0000');
  await sql(`UPDATE "IndividualTransaction" SET "deltaAmount"="balanceAfter"-"balanceBefore" WHERE "deltaAmount" IS NULL AND "transactionId" IN ('legacy','legacy-anomaly');`);
  assert.equal(await sql(`SELECT "amountChange"::TEXT || ':' || "deltaAmount"::TEXT FROM "IndividualTransaction" WHERE "transactionId"='legacy-anomaly';`), '52.0000:-0.0200');
  await fail(`UPDATE "IndividualTransaction" SET "deltaAmount"="balanceAfter"-"balanceBefore" WHERE "transactionId"='legacy-nan';`, /transaction_delta_non_finite_balance/);
  assert.equal(await sql(`SELECT "deltaAmount" IS NULL FROM "IndividualTransaction" WHERE "transactionId"='legacy-nan';`), 't');
  console.log('ok identity edits preserve unfilled history; null-only backfill preserves legacy monetary facts');

  const backfill = `WITH filled AS (UPDATE "IndividualTransaction" SET "deltaAmount"="balanceAfter"-"balanceBefore"
    WHERE "deltaAmount" IS NULL AND "transactionId"='legacy-race' RETURNING 1) SELECT count(*) FROM filled;`;
  const first = sql(`BEGIN; ${backfill} SELECT pg_sleep(0.2); COMMIT;`);
  await pause(50);
  const concurrent = await Promise.allSettled([first, sql(backfill)]);
  for (const result of concurrent) if (result.status === 'rejected') throw result.reason;
  assert.deepEqual(concurrent.map((result) => result.value.trim()).sort(), ['0', '1']);
  assert.equal(await sql(backfill), '0');
  console.log('ok concurrent and repeated backfills fill each historical row once');

  await sql('ALTER TABLE "IndividualTransaction" DISABLE TRIGGER "IndividualTransaction_set_deltaAmount";');
  await fail(receipt('bypass-mismatch', '100', '50', '50', ', "deltaAmount"', ', 50'), /IndividualTransaction_deltaAmount_consistent/);
  await fail(receipt('bypass-nan', '100', '50', '50', ', "deltaAmount"', ", 'NaN'"), /IndividualTransaction_deltaAmount_consistent/);
  await sql('ALTER TABLE "IndividualTransaction" ENABLE TRIGGER "IndividualTransaction_set_deltaAmount";');
  console.log('ok CHECK enforces finite arithmetic independently of the fill trigger');

  await sql('CREATE SCHEMA prior_ledger; CREATE TABLE prior_ledger."WalletLedgerEntry" (id TEXT);');
  await fail(`SET search_path=prior_ledger; ${migration}`, /transaction_delta_prior_ledger_requires_review/);
  assert.equal(await sql(`SELECT count(*) FROM information_schema.columns WHERE table_schema='prior_ledger' AND column_name='deltaAmount';`), '0');
  console.log('ok prior independent-ledger deployments are refused without altering their data');
  console.log('All original transaction delta PostgreSQL integration checks passed.');
} finally {
  if (created) await command(['rm', '-f', container]);
}
