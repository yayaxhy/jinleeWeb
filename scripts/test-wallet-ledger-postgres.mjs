#!/usr/bin/env node
/**
 * Run only against a newly-created, network-isolated disposable PostgreSQL
 * container. No application environment or database URL is read. Docker access
 * is required; --image can select a locally cached postgres image.
 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { Prisma } from '@prisma/client';
import { tsImport } from 'tsx/esm/api';

const { walletLedgerEventType } = await tsImport('../lib/wallet-ledger.ts', import.meta.url);

const imageArg = process.argv.indexOf('--image');
const image = imageArg >= 0 ? process.argv[imageArg + 1] : 'postgres:16-alpine';
if (!image || !/^postgres:[a-zA-Z0-9_.-]+$/.test(image)) throw new Error('Use a tagged official postgres test image.');
const container = `dlm-wallet-ledger-test-${process.pid}-${randomUUID().slice(0, 8)}`;
const database = 'wallet_ledger_test';
const migration = await readFile(new URL('../prisma/migrations/20261030120000_add_wallet_ledger/migration.sql', import.meta.url), 'utf8');

function command(args, input = '') {
  return new Promise((resolve, reject) => {
    const child = spawn('docker', args, { stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve(stdout.trim());
      else reject(new Error(`docker ${args[0]} exited ${code}: ${stderr.trim()}`));
    });
    child.stdin.on('error', () => {});
    child.stdin.end(input);
  });
}

const sql = (text) => command(['exec', '-i', container, 'psql', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', database], text);
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const receipt = (id, before = '100', after = '50', amount = '50', owner = "'original-owner'", type = '点单') => `
  INSERT INTO "IndividualTransaction" ("transactionId", "dlmId", "discordId", "thirdPartydiscordId", "balanceBefore", "balanceAfter", "amountChange", "typeOfTransaction", "timeCreatedAt")
  VALUES ('${id}', ${owner}, NULL, 'counterparty', ${before}, ${after}, ${amount}, '${type}', TIMESTAMP '2026-10-30 12:00:00');
`;
const ledger = (id, source = 'LEGACY_BACKFILL', extraColumns = '', extraValues = '') => `
  INSERT INTO "WalletLedgerEntry" (
    "id", "sourceTransactionId", "dlmId", "discordId", "counterpartyId", "walletDelta", "businessAmount", "balanceBefore", "balanceAfter",
    "direction", "eventType", "legacyType", "source", "integrityStatus", "timeCreatedAt" ${extraColumns}
  ) SELECT 'WLE:' || "transactionId", "transactionId", "dlmId", "discordId", "thirdPartydiscordId", "balanceAfter" - "balanceBefore", ABS("amountChange"), "balanceBefore", "balanceAfter",
    CASE WHEN "balanceAfter" > "balanceBefore" THEN 'CREDIT' WHEN "balanceAfter" < "balanceBefore" THEN 'DEBIT' ELSE 'NONE' END,
    wallet_ledger_event_type("typeOfTransaction", "balanceAfter" - "balanceBefore"), "typeOfTransaction", '${source}',
    CASE WHEN "dlmId" IS NULL AND "discordId" IS NULL THEN 'UNVERIFIABLE' WHEN ABS("balanceAfter" - "balanceBefore") = ABS("amountChange") THEN 'VERIFIED' ELSE 'REQUIRES_REVIEW' END,
    "timeCreatedAt" ${extraValues}
    FROM "IndividualTransaction" WHERE "transactionId" = '${id}'
    ON CONFLICT ("sourceTransactionId") DO NOTHING;
`;
async function expectFailure(text, expectedMessage) {
  await assert.rejects(sql(text), expectedMessage);
}

let created = false;
try {
  await command(['run', '-d', '--name', container, '--network', 'none', '--tmpfs', '/var/lib/postgresql/data',
    '-e', 'POSTGRES_PASSWORD=isolated-ledger-test', '-e', `POSTGRES_DB=${database}`, image]);
  created = true;
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      await command(['exec', container, 'pg_isready', '-U', 'postgres', '-d', database]);
      ready = true;
      break;
    } catch {
      await pause(500);
    }
  }
  if (!ready) throw new Error('Disposable PostgreSQL did not become ready within 30 seconds.');

  await sql(`
    CREATE TABLE "DlmUser" ("dlmId" TEXT PRIMARY KEY);
    INSERT INTO "DlmUser" VALUES ('original-owner'), ('merged-owner');
    CREATE TABLE "IndividualTransaction" (
      "transactionId" TEXT PRIMARY KEY, "timeCreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "discordId" TEXT, "dlmId" TEXT REFERENCES "DlmUser"("dlmId") ON DELETE SET NULL,
      "thirdPartydiscordId" TEXT NOT NULL, "balanceBefore" DECIMAL(19,4) NOT NULL,
      "amountChange" DECIMAL(19,4) NOT NULL, "balanceAfter" DECIMAL(19,4) NOT NULL, "typeOfTransaction" TEXT NOT NULL
    );
    ${receipt('legacy')}
    ${receipt('concurrent-legacy')}
  `);
  await sql(migration);
  assert.equal(await sql('SELECT COUNT(*) FROM "WalletLedgerEntry";'), '0', 'DDL must not backfill historical entries');
  console.log('ok migration is additive and does not touch legacy receipts');

  const mappingCases = [
    '点单', '订单撤销', '打赏', '客服代打赏', '打赏撤销', '充值', '人工充值', '网站充值',
    '微信Native充值', '信用卡/银行卡充值', '提现', '优惠返利', '红包发出', '红包收入', '红包退回', '未知业务',
  ].flatMap((type) => [-1, 0, 1].map((delta) => ({ type, delta })));
  const sqlMappings = (await sql(`SELECT wallet_ledger_event_type(t, d) FROM (VALUES ${mappingCases.map(({ type, delta }, index) => `(${index}, '${type}', ${delta})`).join(',')}) AS inputs(i,t,d) ORDER BY i;`)).split('\n');
  assert.deepEqual(sqlMappings, mappingCases.map(({ type, delta }) => walletLedgerEventType(type, new Prisma.Decimal(delta))));
  console.log('ok SQL and application event classification agree for 48 cases');

  assert.equal(await sql(`BEGIN; ${receipt('compat')} SELECT COUNT(*) FROM "WalletLedgerEntry"; COMMIT;`), '0', 'bridge is deferred');
  assert.equal(await sql(`SELECT "source" || '|' || "walletDelta" || '|' || "direction" || '|' || "eventType" FROM "WalletLedgerEntry" WHERE "sourceTransactionId"='compat';`), 'COMPATIBILITY|-50.0000|DEBIT|ORDER_PAYMENT');
  assert.equal(await sql(`SELECT ("incomeDelta" IS NULL AND "rechargeDelta" IS NULL AND "totalSpentDelta" IS NULL AND "loyaltyPointsDelta" IS NULL)::text FROM "WalletLedgerEntry" WHERE "sourceTransactionId"='compat';`), 'true');
  console.log('ok old writer is captured atomically at commit, unknown components stay null');

  await sql(`BEGIN; ${receipt('live')}
    ${ledger('live', 'LIVE', ', "incomeDelta", "rechargeDelta", "correlationId", "idempotencyKey"', ", -20, -30, 'order:example', 'example:payment'")}
    COMMIT;`);
  assert.equal(await sql(`SELECT COUNT(*) || '|' || MIN("source") || '|' || MIN("incomeDelta") || '|' || MIN("rechargeDelta") FROM "WalletLedgerEntry" WHERE "sourceTransactionId"='live';`), '1|LIVE|-20.0000|-30.0000');
  console.log('ok explicit live entry survives deferred bridge without duplicate');

  await sql(`BEGIN; ${receipt('batch-one')} ${receipt('batch-two', '50', '20', '30')} COMMIT;`);
  assert.equal(await sql(`SELECT COUNT(*) FROM "WalletLedgerEntry" WHERE "sourceTransactionId" IN ('batch-one', 'batch-two');`), '2');
  console.log('ok multiple compatibility receipts in one transaction are all captured');

  await expectFailure(`BEGIN; ${receipt('invalid-components')}
    ${ledger('invalid-components', 'LIVE', ', "incomeDelta", "rechargeDelta"', ', -20, -20')}
    COMMIT;`, /known_component_equation/);
  assert.equal(await sql(`SELECT COUNT(*) FROM "IndividualTransaction" WHERE "transactionId"='invalid-components';`), '0');
  await expectFailure(`BEGIN; ${receipt('invalid-source')}
    INSERT INTO "WalletLedgerEntry" ("id", "sourceTransactionId", "walletDelta", "businessAmount", "balanceBefore", "balanceAfter", "direction", "eventType", "legacyType", "source", "integrityStatus", "timeCreatedAt")
    VALUES ('WLE:invalid-source', 'invalid-source', -40, 40, 100, 60, 'DEBIT', 'ORDER_PAYMENT', '点单', 'LIVE', 'UNVERIFIABLE', TIMESTAMP '2026-10-30 12:00:00');
    COMMIT;`, /wallet_ledger_source_mismatch/);
  assert.equal(await sql(`SELECT COUNT(*) FROM "IndividualTransaction" WHERE "transactionId"='invalid-source';`), '0');
  console.log('ok invalid component and source facts roll back compatibility receipt too');

  await sql(`${ledger('legacy')} ${ledger('legacy')}`);
  assert.equal(await sql(`SELECT COUNT(*) || '|' || MIN("source") FROM "WalletLedgerEntry" WHERE "sourceTransactionId"='legacy';`), '1|LEGACY_BACKFILL');
  const firstBackfill = sql(`BEGIN; ${ledger('concurrent-legacy')} SELECT pg_sleep(1); COMMIT;`);
  await pause(100);
  const secondBackfill = sql(`BEGIN; ${ledger('concurrent-legacy')} COMMIT;`);
  await Promise.all([firstBackfill, secondBackfill]);
  assert.equal(await sql(`SELECT COUNT(*) FROM "WalletLedgerEntry" WHERE "sourceTransactionId"='concurrent-legacy';`), '1');
  const liveWrite = sql(`BEGIN; ${receipt('concurrent-live')} SELECT pg_sleep(1); COMMIT;`);
  await pause(100);
  await Promise.all([liveWrite, sql(`BEGIN; ${ledger('concurrent-live')} COMMIT;`)]);
  assert.equal(await sql(`SELECT COUNT(*) FROM "WalletLedgerEntry" WHERE "sourceTransactionId"='concurrent-live';`), '1');
  console.log('ok repeated/concurrent backfills and live writes produce exactly one entry per receipt');

  await sql(`${receipt('mismatch', '0.02', '0', '52', "'original-owner'", '订单撤销')}
    ${receipt('missing-owner', '0', '10', '10', 'NULL', '充值')}
    ${receipt('signed', '50', '0', '-50', "'original-owner'", '提现')}
    ${receipt('zero', '50', '50', '0')}
    ${receipt('precision', '100.0001', '99.9999', '0.0002')}`);
  assert.equal(await sql(`SELECT "walletDelta" || '|' || "businessAmount" || '|' || "integrityStatus" FROM "WalletLedgerEntry" WHERE "sourceTransactionId"='mismatch';`), '-0.0200|52.0000|REQUIRES_REVIEW');
  assert.equal(await sql(`SELECT "integrityStatus" FROM "WalletLedgerEntry" WHERE "sourceTransactionId"='missing-owner';`), 'UNVERIFIABLE');
  assert.equal(await sql(`SELECT "walletDelta" || '|' || "businessAmount" FROM "WalletLedgerEntry" WHERE "sourceTransactionId"='signed';`), '-50.0000|50.0000');
  assert.equal(await sql(`SELECT "direction" FROM "WalletLedgerEntry" WHERE "sourceTransactionId"='zero';`), 'NONE');
  assert.equal(await sql(`SELECT "walletDelta" FROM "WalletLedgerEntry" WHERE "sourceTransactionId"='precision';`), '-0.0002');
  console.log('ok anomalies preserve both facts; zero, signed legacy amounts and 4-decimal precision are supported');

  await expectFailure(receipt('invalid-nan', '100', '50', "'NaN'::NUMERIC"), /finite_money/);
  assert.equal(await sql(`SELECT COUNT(*) FROM "IndividualTransaction" WHERE "transactionId"='invalid-nan';`), '0');
  await expectFailure(receipt('invalid-overflow', '999999999999999.9999', '-999999999999999.9999', '1'), /numeric field overflow/);
  assert.equal(await sql(`SELECT COUNT(*) FROM "IndividualTransaction" WHERE "transactionId"='invalid-overflow';`), '0');
  console.log('ok nonfinite and overflowing derived amounts roll back the source insert');

  await expectFailure(`UPDATE "WalletLedgerEntry" SET "walletDelta"=0 WHERE "sourceTransactionId"='live';`, /wallet_ledger_is_append_only/);
  await expectFailure(`DELETE FROM "WalletLedgerEntry" WHERE "sourceTransactionId"='live';`, /wallet_ledger_is_append_only/);
  await expectFailure('TRUNCATE "WalletLedgerEntry";', /wallet_ledger_is_append_only/);
  await expectFailure(`DELETE FROM "IndividualTransaction" WHERE "transactionId"='live';`, /foreign key constraint/);
  await expectFailure(`BEGIN; ${receipt('same-idempotency')}
    ${ledger('same-idempotency', 'LIVE', ', "idempotencyKey"', ", 'example:payment'")}
    COMMIT;`, /idempotencyKey_key/);
  assert.equal(await sql(`SELECT COUNT(*) FROM "IndividualTransaction" WHERE "transactionId"='same-idempotency';`), '0');
  console.log('ok append-only, source retention and duplicate operation-key constraints');

  await sql(`BEGIN; UPDATE "IndividualTransaction" SET "dlmId"='merged-owner' WHERE "dlmId"='original-owner'; DELETE FROM "DlmUser" WHERE "dlmId"='original-owner'; COMMIT;`);
  assert.equal(await sql(`SELECT l."dlmId" || '|' || t."dlmId" FROM "WalletLedgerEntry" l JOIN "IndividualTransaction" t ON t."transactionId"=l."sourceTransactionId" WHERE l."sourceTransactionId"='live';`), 'original-owner|merged-owner');
  console.log('ok account merge updates current ownership while preserving immutable owner snapshots');
  console.log('All wallet ledger PostgreSQL integration checks passed.');
} finally {
  if (created) await command(['rm', '-f', container]);
}
