import assert from 'node:assert/strict';
import test from 'node:test';
import { Prisma } from '@prisma/client';
import { prepareDiscordQuotaMigrationTx } from './discord-migration-quota';
import { createQuotaTestTransaction } from './manual-quota.test-support';

function fixture() {
  const quota = createQuotaTestTransaction(); const trace: string[] = [];
  const identities = new Map([['z', { dlmId: 'z', discordUserId: 'old' }], ['a', { dlmId: 'a', discordUserId: 'new' }]]);
  const members = new Set(['old', 'new']);
  const bindings: Array<{ dlmId: string; providerUserId: string }> = [{ dlmId: 'z', providerUserId: 'old' }, { dlmId: 'a', providerUserId: 'new' }];
  const tx = {
    ...quota.tx,
    $executeRaw: async (query: Prisma.Sql) => { trace.push('quota:ensure'); return quota.tx.$executeRaw(query); },
    $queryRaw: async (query: TemplateStringsArray | Prisma.Sql, id: string) => {
      if (!Array.isArray(query)) return quota.tx.$queryRaw(query as Prisma.Sql);
      if (query.join('').includes('DlmUser')) { trace.push(`D:${id}`); const row = identities.get(id); return row ? [{ ...row }] : []; }
      trace.push(`M:${id}`); return members.has(id) ? [{ discordUserId: id }] : [];
    },
    dlmUser: { findMany: async () => [...identities.values()] },
    accountBinding: { findMany: async () => bindings },
  } as unknown as Prisma.TransactionClient;
  const input = { oldId: 'old', newId: 'new', archiveId: 'archive', sourceDlmId: 'z', targetDlmIds: ['a'] };
  return { quota, tx, input, trace, identities, members, bindings };
}

test('Discord migration locks all DLM identities then sorted Members before any involved quota anchor', async () => {
  const f = fixture(); const locks = await prepareDiscordQuotaMigrationTx(f.tx, f.input);
  assert.deepEqual(f.trace.slice(0, 5), ['D:a', 'D:z', 'M:new', 'M:old', 'quota:ensure']);
  assert.deepEqual([...locks.users].sort(), ['archive', 'new', 'old']);
});

test('changed or deleted identity and absent bound Member abort before quota placeholders are created', async () => {
  for (const scenario of ['changed', 'deleted', 'member-missing']) {
    const f = fixture();
    if (scenario === 'changed') f.identities.get('a')!.discordUserId = 'other';
    if (scenario === 'deleted') f.identities.delete('a');
    if (scenario === 'member-missing') f.members.delete('new');
    await assert.rejects(prepareDiscordQuotaMigrationTx(f.tx, f.input), /核实/);
    assert.equal(f.trace.includes('quota:ensure'), false);
  }
});

test('inconsistent AccountBinding ownership cannot rename quota into another DLM identity', async () => {
  const f = fixture(); f.bindings[1].dlmId = 'z';
  await assert.rejects(prepareDiscordQuotaMigrationTx(f.tx, f.input), /核实/);
  assert.equal(f.trace.includes('quota:ensure'), false);
});

test('an archive key that already owns restoration evidence is rejected instead of overwriting it', async () => {
  const f = fixture(); f.quota.state.manualQuotaRestoration.set('r', { id: 'r', userId: 'archive', kind: 'flow', remainingExtra: new Prisma.Decimal(0), expiresAt: new Date(0) });
  await assert.rejects(prepareDiscordQuotaMigrationTx(f.tx, f.input), /核实/);
  assert.equal(f.trace.includes('quota:ensure'), false);
});

test('a legacy source Member without DLM remains migratable after explicit membership locking', async () => {
  const f = fixture(); f.identities.clear(); f.bindings.length = 0; f.members.delete('new');
  const locks = await prepareDiscordQuotaMigrationTx(f.tx, { ...f.input, archiveId: null, sourceDlmId: null, targetDlmIds: [] });
  assert.deepEqual(f.trace.slice(0, 3), ['M:new', 'M:old', 'quota:ensure']); assert.equal(locks.users.size, 2);
});


test('an archive key with expired ordinary quota history is not overwritten', async () => {
  const f = fixture(); f.quota.state.manualQuotaBatch.set('b', { id: 'b', userId: 'archive', kind: 'flow', remainingExtra: new Prisma.Decimal(50), expiresAt: new Date(0) });
  await assert.rejects(prepareDiscordQuotaMigrationTx(f.tx, f.input), /核实/);
  assert.equal(f.trace.includes('quota:ensure'), false);
});
