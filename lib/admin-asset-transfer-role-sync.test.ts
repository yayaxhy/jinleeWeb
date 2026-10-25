import assert from 'node:assert/strict';
import test from 'node:test';
import { syncAssetTransferRolesAfterCommit } from './admin-asset-transfer-role-sync';

test('a failed post-commit sync preserves the successful transfer response and still syncs the other account', async () => {
  const calls: string[] = [];
  const logs: unknown[][] = [];
  const committed = { auditId: 'committed-audit', warnings: ['existing warning'] };
  const warnings = await syncAssetTransferRolesAfterCommit(['source', 'target'], {
    syncRole: async (discordId) => {
      calls.push(discordId);
      if (discordId === 'source') throw new Error('sensitive-provider-request');
      return null;
    },
    warn: (...args) => { logs.push(args); },
  });
  const response = { ...committed, warnings: [...committed.warnings, ...warnings] };
  assert.deepEqual(calls, ['source', 'target']);
  assert.equal(response.auditId, 'committed-audit');
  assert.equal(response.warnings.length, 2);
  assert.match(response.warnings[1], /资产转移已完成.*source.*无需再次转移资产/);
  assert.equal(logs.length, 1);
  assert.deepEqual(logs[0][1], { discordId: 'source' });
  assert.doesNotMatch(JSON.stringify({ logs, response }), /sensitive-provider-request/);
});

test('both rejected syncs return warnings even when the logger also throws; neither sync retries', async () => {
  let calls = 0;
  const warnings = await syncAssetTransferRolesAfterCommit(['source', 'target'], {
    syncRole: async () => { calls += 1; throw new Error('offline'); },
    warn: () => { throw new Error('logger unavailable'); },
  });
  assert.equal(calls, 2);
  assert.equal(warnings.length, 2);
  assert.match(warnings[0], /source/);
  assert.match(warnings[1], /target/);
});

test('successful and existing warning responses retain their prior semantics', async () => {
  const warnings = await syncAssetTransferRolesAfterCommit(['source', 'target'], {
    syncRole: async (discordId) => discordId === 'source' ? null : '内部 spent-role 同步未配置',
    warn: () => assert.fail('successful transport must not be logged as an exception'),
  });
  assert.deepEqual(warnings, ['内部 spent-role 同步未配置']);
});
