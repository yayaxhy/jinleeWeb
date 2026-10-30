#!/usr/bin/env node
/** CLI integration against an explicitly identified disposable localhost Docker
 * database. Never reads application env files; creates and removes its own schema. */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
const cwd = fileURLToPath(new URL('../', import.meta.url));
const container = process.env.WALLET_LEDGER_TEST_CONTAINER;
const target = process.env.WALLET_LEDGER_TEST_DATABASE_URL;
if (!container || !/^codex-wallet-ledger-test-[a-z0-9-]+$/.test(container) || !target) {
  throw new Error('Explicit WALLET_LEDGER_TEST_CONTAINER and WALLET_LEDGER_TEST_DATABASE_URL are required.');
}
let url;
try { url = new URL(target); } catch { throw new Error('Invalid explicit test database URL.'); }
if (!['postgresql:', 'postgres:'].includes(url.protocol) || url.hostname !== '127.0.0.1' ||
    url.username !== 'ledger_test' || url.pathname !== '/ledger_test' || !url.port || url.port === '5432' || url.search || url.hash) {
  throw new Error('Only a disposable ledger_test database on a nondefault localhost Docker port is accepted, without URL query options.');
}
const inspected = spawnSync('docker', ['inspect', container], { encoding: 'utf8' });
if (inspected.status !== 0) throw new Error('Disposable Docker container could not be inspected.');
const ports = JSON.parse(inspected.stdout)[0]?.NetworkSettings?.Ports?.['5432/tcp'] ?? [];
if (!ports.some((port) => port.HostIp === '127.0.0.1' && port.HostPort === url.port)) {
  throw new Error('Test URL does not match the disposable Docker container published port.');
}
const schema = `wallet_ledger_cli_test_${process.pid}_${randomUUID().slice(0, 8)}`;
url.searchParams.set('schema', schema);
const sql = (input) => {
  const result = spawnSync('docker', ['exec', '-i', container, 'psql', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-U', 'ledger_test', '-d', 'ledger_test'], { input: `SET search_path TO "${schema}";\n${input}`, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stderr);
  return result.stdout.trim();
};
const cli = (file, args = [], status = 0, configuration = {}) => {
  const env = { ...process.env };
  if (configuration.externalUrl === null) delete env.DATABASE_URL;
  else env.DATABASE_URL = configuration.externalUrl ?? url.toString();
  const result = spawnSync(process.execPath, ['--import', 'tsx', file, '--env-file', configuration.envFile ?? '/dev/null', ...args], {
    cwd, encoding: 'utf8', env,
  });
  assert.equal(result.status, status, `${file}: ${result.stderr}`);
  const out = file.endsWith('audit.ts') ? [JSON.parse(result.stdout)] : result.stdout.trim().split('\n').filter(Boolean).map(JSON.parse);
  const errors = result.stderr.trim().split('\n').filter(Boolean).map(JSON.parse);
  return { out, errors };
};
const backfill = (args, status) => cli('scripts/wallet-ledger-backfill.ts', args, status);
const applyArgs = ['--apply', '--confirm-database', 'ledger_test', '--batch-size', '2', '--through-id', 'A005'];
let created = false;
const envDirectory = mkdtempSync(join(tmpdir(), 'wallet-ledger-cli-env-'));
try {
  assert.equal(sql('SELECT current_database()'), 'ledger_test');
  sql(`CREATE SCHEMA "${schema}";`);
  created = true;
  sql(`CREATE TABLE "DlmUser" ("dlmId" TEXT PRIMARY KEY, "discordUserId" TEXT, "wallet" DECIMAL(19,4));
    INSERT INTO "DlmUser" VALUES ('owner','discord',123.4567);
    CREATE TABLE "IndividualTransaction" (
      "transactionId" TEXT PRIMARY KEY, "timeCreatedAt" TIMESTAMP(3) NOT NULL,
      "discordId" TEXT, "dlmId" TEXT, "thirdPartydiscordId" TEXT NOT NULL,
      "balanceBefore" DECIMAL(19,4) NOT NULL, "amountChange" DECIMAL(19,4) NOT NULL,
      "balanceAfter" DECIMAL(19,4) NOT NULL, "typeOfTransaction" TEXT NOT NULL
    );
    INSERT INTO "IndividualTransaction" VALUES
      ('A001','2026-10-30 12:00:00','discord','owner','counter',100,50,50,'点单'),
      ('A002','2026-10-30 12:00:01','discord','owner','counter',50,-20,30,'提现'),
      ('A003','2026-10-30 12:00:02','discord','owner','counter',0.02,52,0,'订单撤销'),
      ('A004','2026-10-30 12:00:03',NULL,NULL,'counter',0,0.0001,0.0001,'充值'),
      ('A005','2026-10-30 12:00:04','discord','owner','counter',30,1,30,'点单');`);
  const snapshot = () => sql(`SELECT md5(string_agg((to_jsonb(t) - 'deltaAmount')::text, '' ORDER BY "transactionId")) FROM "IndividualTransaction" t;
    SELECT row_to_json(u)::text FROM "DlmUser" u;`);
  const original = snapshot();
  const pre = cli('scripts/wallet-ledger-audit.ts').out[0];
  assert.equal(pre.deltaColumnPresent, false);
  assert.equal(pre.totals.sourceCount, '5');
  assert.equal(pre.totals.derivedDeltaAmount, '-70.0199');
  assert.equal(pre.totals.magnitudeMismatch, '2');
  assert.equal(backfill([]).out[0].mode, 'dry-run');
  assert.equal(backfill(['--apply'], 1).errors[0].error, 'ledger_apply_requires_database_confirmation');
  assert.equal(backfill(['--apply','--confirm-database','wrong'], 1).errors[0].error, 'ledger_database_confirmation_mismatch');
  assert.equal(snapshot(), original);
  console.log('ok pre-migration audit and dry-run read-only; database confirmation prevents apply');

  const wrappedEnv = join(envDirectory, 'wrapped.env');
  writeFileSync(wrappedEnv, `DATABASE_URL="psql '${url.toString()}'"\n`, { mode: 0o600 });
  const explicitFile = cli('scripts/wallet-ledger-audit.ts', [], 0, { envFile: wrappedEnv, externalUrl: null }).out[0];
  assert.equal(explicitFile.target.configurationSource, 'env-file');
  assert.equal(explicitFile.target.schema, schema);
  assert.equal(explicitFile.totals.sourceCount, '5');
  assert.equal(JSON.stringify(explicitFile.target).includes('ledger_test_only'), false);
  const wrongEnv = join(envDirectory, 'wrong.env');
  writeFileSync(wrongEnv, 'DATABASE_URL="psql \'postgresql://unused:unused@127.0.0.1:9/wrong\'"\n', { mode: 0o600 });
  const externalWins = cli('scripts/wallet-ledger-audit.ts', [], 0, { envFile: wrongEnv }).out[0];
  assert.equal(externalWins.target.configurationSource, 'environment');
  assert.equal(externalWins.target.database, 'ledger_test');
  const wrappedExternal = cli('scripts/wallet-ledger-backfill.ts', [], 0, { envFile: wrongEnv, externalUrl: `psql '${url.toString()}'` }).out[0];
  assert.equal(wrappedExternal.target.schema, schema);
  assert.equal(wrappedExternal.mode, 'dry-run');
  console.log('ok explicit env file wins before Prisma implicit loading; external URL wins over file; wrappers normalize without credentials in target output');

  sql(`INSERT INTO "IndividualTransaction" VALUES
    ('A003x','2026-10-30 12:00:05','discord','owner','counter',0,'NaN',1,'点单'),
    ('A003y','2026-10-30 12:00:06','discord','owner','counter',-999999999999999.9999,1,999999999999999.9999,'点单');`);
  const invalid = cli('scripts/wallet-ledger-audit.ts', [], 2).out[0];
  assert.equal(invalid.totals.nonFiniteSourceMoney, '1');
  assert.equal(invalid.totals.deltaOutOfRange, '1');
  assert.equal(invalid.totals.invalidSourceMoney, '2');
  assert.equal(invalid.anomalies.filter((row) => row.category === 'INVALID_SOURCE_MONEY').length, 2);
  sql(readFileSync(`${cwd}/prisma/migrations/20261030130000_add_transaction_delta_amount/migration.sql`, 'utf8'));
  assert.equal(sql('SELECT COUNT(*) FROM "IndividualTransaction" WHERE "deltaAmount" IS NOT NULL'), '0');
  const invalidApply = backfill(applyArgs, 1);
  assert.equal(invalidApply.errors[0].error, 'ledger_invalid_source_money');
  assert.equal(invalidApply.errors[0].committedBatches, 0);
  assert.equal(sql('SELECT COUNT(*) FROM "IndividualTransaction" WHERE "deltaAmount" IS NOT NULL'), '0');
  sql(`DELETE FROM "IndividualTransaction" WHERE "transactionId" IN ('A003x','A003y');`);
  assert.equal(snapshot(), original);
  console.log('ok non-finite money and derived overflow are reported; apply stops before any batch');

  sql(`CREATE FUNCTION test_deferred_failure() RETURNS TRIGGER LANGUAGE plpgsql AS $$ BEGIN
    IF NEW."transactionId" = 'A003' THEN RAISE EXCEPTION 'test_commit_failure'; END IF; RETURN NEW; END $$;
    CREATE CONSTRAINT TRIGGER test_deferred_failure AFTER UPDATE ON "IndividualTransaction"
      DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION test_deferred_failure();`);
  const failed = backfill([...applyArgs, '--max-batches', '5'], 1);
  assert.equal(failed.out.filter((x) => x.mode === 'batch-committed').length, 1);
  assert.equal(failed.errors[0].committedBatches, 1);
  assert.equal(failed.errors[0].afterId, 'A002');
  assert.equal(sql('SELECT COUNT(*) FROM "IndividualTransaction" WHERE "deltaAmount" IS NOT NULL'), '2');
  sql('DROP TRIGGER test_deferred_failure ON "IndividualTransaction"; DROP FUNCTION test_deferred_failure();');
  console.log('ok deferred COMMIT failure preserves only prior committed cursor and rolls back failed batch');

  const resumed = backfill([...applyArgs, '--after-id', 'A002', '--max-batches', '1']).out.at(-1);
  assert.equal(resumed.complete, false);
  assert.equal(resumed.afterId, 'A004');
  assert.equal(resumed.filled, 2);
  const finished = backfill([...applyArgs, '--after-id', 'A004', '--max-batches', '1']).out.at(-1);
  assert.equal(finished.complete, true);
  assert.equal(finished.filled, 1);
  const repeated = backfill([...applyArgs, '--max-batches', '5']).out.at(-1);
  assert.equal(repeated.complete, true);
  assert.equal(repeated.filled, 0);
  assert.equal(snapshot(), original);
  assert.equal(sql('SELECT COUNT(*) FROM "IndividualTransaction" WHERE "deltaAmount" IS NOT NULL'), '5');
  const post = cli('scripts/wallet-ledger-audit.ts').out[0];
  assert.equal(post.protections.requiredProtectionEnabled, true);
  assert.equal(post.coverage.deltaMismatch, '0');
  assert.equal(post.coverage.missingCount, '0');
  assert.equal(post.totals.magnitudeMismatch, '2');
  assert.equal(post.totals.missingIdentity, '1');
  assert.equal(post.coverage.storedDeltaAmount, pre.totals.derivedDeltaAmount);
  console.log('ok bounded resume and repeated fill are idempotent; only deltaAmount changes, original amounts and wallets remain identical');

  sql(`ALTER TABLE "IndividualTransaction" DISABLE TRIGGER "IndividualTransaction_set_deltaAmount";
    ALTER TABLE "IndividualTransaction" DROP CONSTRAINT "IndividualTransaction_deltaAmount_consistent";
    UPDATE "IndividualTransaction" SET "deltaAmount"=-49 WHERE "transactionId"='A001';
    ALTER TABLE "IndividualTransaction" ADD CONSTRAINT "IndividualTransaction_deltaAmount_consistent"
      CHECK ("deltaAmount" IS NULL OR ("deltaAmount"::text <> 'NaN' AND "deltaAmount"="balanceAfter"-"balanceBefore")) NOT VALID;
    ALTER TABLE "IndividualTransaction" ENABLE TRIGGER "IndividualTransaction_set_deltaAmount";`);
  const mismatchAudit = cli('scripts/wallet-ledger-audit.ts', [], 2).out[0];
  assert.equal(mismatchAudit.coverage.deltaMismatch, '1');
  assert.deepEqual(mismatchAudit.deltaMismatches, [{ sourceTransactionId: 'A001' }]);
  assert.equal(backfill([...applyArgs, '--max-batches', '1'], 1).errors[0].error, 'ledger_existing_delta_mismatch');
  assert.equal(sql(`SELECT "deltaAmount" FROM "IndividualTransaction" WHERE "transactionId"='A001'`), '-49.0000');
  sql(`UPDATE "IndividualTransaction" SET "deltaAmount"=-50 WHERE "transactionId"='A001'`);
  assert.equal(snapshot(), original);
  assert.equal(sql(`SELECT "amountChange" || '|' || "deltaAmount" FROM "IndividualTransaction" WHERE "transactionId"='A003'`), '52.0000|-0.0200');
  console.log('ok incorrect nonnull delta is never overwritten; original anomalous amount 52 remains with actual delta -0.02');

} finally {
  try { if (created) sql(`DROP SCHEMA "${schema}" CASCADE;`); }
  finally { rmSync(envDirectory, { recursive: true, force: true }); }
}
