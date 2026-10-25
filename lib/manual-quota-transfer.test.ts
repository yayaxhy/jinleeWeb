import assert from 'node:assert/strict';
import test from 'node:test';
import { Prisma } from '@prisma/client';
import { hasManualQuotaForUnbindTx, lockManualQuotaOwnersTx, moveManualQuotaBatchesTx, moveManualQuotaRestorationsTx, remapManualQuotaOwnersTx } from './manual-quota-transfer';
import { createQuotaTestState, createQuotaTestTransaction } from './manual-quota.test-support';

const D = (amount: number) => new Prisma.Decimal(amount);
const now = new Date('2026-10-22T00:00:00Z');
const expiresAt = new Date('2026-11-22T00:00:00Z');
const later = new Date('2026-12-22T00:00:00Z');
const base = (userId: string, amount: number, expiry = expiresAt) => ({ userId, remainingExtra: D(amount), expiresAt: expiry, createdAt: now, updatedAt: now });
const restored = (id: string, userId: string, amount: number, kind = 'flow', expiry = expiresAt) => ({ id, kind, ...base(userId, amount, expiry) });
const txOf = (f: ReturnType<typeof createQuotaTestTransaction>) => f.tx as unknown as Prisma.TransactionClient;

test('all base anchors lock flow then spend in stable user order before batch changes', async () => {
  const f = createQuotaTestTransaction();
  await lockManualQuotaOwnersTx(txOf(f), ['z', 'a', 'z']);
  assert.deepEqual(f.events.filter((event) => event.startsWith('lock:')), ['lock:flowBuff:a', 'lock:flowBuff:z', 'lock:spendBuff:a', 'lock:spendBuff:z']);
});

test('asset transfer preserves each restoration ID, amount and expiry, including expired and consumed history', async () => {
  const state = createQuotaTestState();
  state.manualQuotaRestoration.set('active', restored('active', 'source', 20));
  state.manualQuotaRestoration.set('expired', restored('expired', 'source', 9, 'spend', new Date(0)));
  state.manualQuotaRestoration.set('consumed', restored('consumed', 'source', 0));
  state.manualQuotaRestoration.set('target', restored('target', 'target', 50, 'flow', later));
  const originals = [...state.manualQuotaRestoration.values()].map((row) => ({ ...row }));
  const f = createQuotaTestTransaction(state); const locks = await lockManualQuotaOwnersTx(txOf(f), ['source', 'target']);
  const result = await moveManualQuotaRestorationsTx(txOf(f), 'source', 'target', locks); f.commit();
  assert.deepEqual(result, { flowRestorationsTransferred: 2, spendRestorationsTransferred: 1 });
  for (const before of originals) assert.deepEqual(state.manualQuotaRestoration.get(String(before.id)), { ...before, userId: 'target' });
});

test('a concurrently consumed or renewed restoration fails its CAS and the move is not committed', async () => {
  for (const field of ['remainingExtra', 'expiresAt']) {
    const state = createQuotaTestState(); state.manualQuotaRestoration.set('r', restored('r', 'source', 20));
    const f = createQuotaTestTransaction(state, { beforeWrite: (model) => { if (model === 'manualQuotaRestoration') state.manualQuotaRestoration.get('r')![field] = field === 'expiresAt' ? later : D(5); } });
    const locks = await lockManualQuotaOwnersTx(txOf(f), ['source', 'target']);
    await assert.rejects(moveManualQuotaRestorationsTx(txOf(f), 'source', 'target', locks), /核实/);
    assert.equal(state.manualQuotaRestoration.get('r')!.userId, 'source');
  }
});

test('ordinary Discord rename preserves base and restored quota, removing only newly-created empty placeholders', async () => {
  const state = createQuotaTestState(); state.flowBuff.set('old', base('old', 5000, later));
  state.manualQuotaRestoration.set('r', restored('r', 'old', 20));
  const f = createQuotaTestTransaction(state); const locks = await lockManualQuotaOwnersTx(txOf(f), ['old', 'new']);
  await remapManualQuotaOwnersTx(txOf(f), [{ from: 'old', to: 'new' }], locks); f.commit();
  assert.equal(state.flowBuff.has('old'), false); assert.equal(state.flowBuff.get('new')!.expiresAt, later);
  assert.equal(state.manualQuotaRestoration.get('r')!.userId, 'new'); assert.equal(state.manualQuotaRestoration.get('r')!.expiresAt, expiresAt);
});

test('force takeover archives the target batches before moving source batches; neither set is merged or deleted', async () => {
  const state = createQuotaTestState(); state.flowBuff.set('old', base('old', 100)); state.flowBuff.set('new', base('new', 500, later));
  state.manualQuotaRestoration.set('source', restored('source', 'old', 20)); state.manualQuotaRestoration.set('target', restored('target', 'new', 50, 'flow', later));
  const f = createQuotaTestTransaction(state); const locks = await lockManualQuotaOwnersTx(txOf(f), ['old', 'new', 'archive']);
  await remapManualQuotaOwnersTx(txOf(f), [{ from: 'new', to: 'archive' }, { from: 'old', to: 'new' }], locks); f.commit();
  assert.equal(state.flowBuff.get('archive')!.remainingExtra!.toString(), '500'); assert.equal(state.flowBuff.get('new')!.remainingExtra!.toString(), '100');
  assert.equal(state.manualQuotaRestoration.get('source')!.userId, 'new'); assert.equal(state.manualQuotaRestoration.get('target')!.userId, 'archive');
  assert.equal(state.manualQuotaRestoration.size, 2);
});

test('an existing zero destination row cannot be discarded as if it were a newly-created placeholder', async () => {
  const state = createQuotaTestState(); state.flowBuff.set('new', base('new', 0, later));
  const f = createQuotaTestTransaction(state); const locks = await lockManualQuotaOwnersTx(txOf(f), ['old', 'new']);
  await assert.rejects(remapManualQuotaOwnersTx(txOf(f), [{ from: 'old', to: 'new' }], locks), /核实/);
  assert.equal(state.flowBuff.get('new')!.expiresAt, later); assert.equal(state.flowBuff.has('old'), false);
});

test('an orphan destination restoration prevents placeholder deletion and requires ownership review', async () => {
  const state = createQuotaTestState(); state.manualQuotaRestoration.set('orphan', restored('orphan', 'new', 10));
  const f = createQuotaTestTransaction(state); const locks = await lockManualQuotaOwnersTx(txOf(f), ['old', 'new']);
  await assert.rejects(remapManualQuotaOwnersTx(txOf(f), [{ from: 'old', to: 'new' }], locks), /核实/);
  assert.equal(state.manualQuotaRestoration.get('orphan')!.userId, 'new');
});

test('placeholder deletion failure aborts before any base rename or batch move', async () => {
  const state = createQuotaTestState(); state.flowBuff.set('old', base('old', 50)); state.manualQuotaRestoration.set('r', restored('r', 'old', 10));
  const f = createQuotaTestTransaction(state, { beforeWrite: (_model, operation) => { if (operation === 'deleteMany') throw new Error('offline_delete_failure'); } });
  const locks = await lockManualQuotaOwnersTx(txOf(f), ['old', 'new']);
  await assert.rejects(remapManualQuotaOwnersTx(txOf(f), [{ from: 'old', to: 'new' }], locks), /offline_delete_failure/);
  assert.equal(state.flowBuff.get('old')!.remainingExtra!.toString(), '50'); assert.equal(state.manualQuotaRestoration.get('r')!.userId, 'old');
});

test('unbinding checks only usable legacy, ordinary and restored balances; expired history never revives', async () => {
  for (const scenario of ['active-restored', 'active-ordinary', 'active-base', 'expired-base', 'expired-restored', 'expired-ordinary']) {
    const state = createQuotaTestState();
    if (scenario.endsWith('-base')) state.flowBuff.set('user', base('user', 5, scenario.startsWith('active') ? expiresAt : new Date(0)));
    else state[scenario.endsWith('-ordinary') ? 'manualQuotaBatch' : 'manualQuotaRestoration'].set('r', restored('r', 'user', 5, 'flow', scenario.startsWith('active') ? expiresAt : new Date(0)));
    const f = createQuotaTestTransaction(state); const locks = await lockManualQuotaOwnersTx(txOf(f), ['user']);
    assert.equal(await hasManualQuotaForUnbindTx(txOf(f), 'user', locks, now), scenario.startsWith('active'));
  }
});

test('a batch cannot be moved without locking both owners, and unknown kinds fail closed', async () => {
  const state = createQuotaTestState(); state.manualQuotaRestoration.set('r', restored('r', 'source', 5, 'unknown'));
  const f = createQuotaTestTransaction(state); const locks = await lockManualQuotaOwnersTx(txOf(f), ['source']);
  await assert.rejects(moveManualQuotaRestorationsTx(txOf(f), 'source', 'target', locks), /核实/);
  const allLocks = await lockManualQuotaOwnersTx(txOf(f), ['source', 'target']);
  await assert.rejects(moveManualQuotaRestorationsTx(txOf(f), 'source', 'target', allLocks), /核实/);
});


test('ordinary batches move independently, retaining IDs, original expiries and expired history without becoming restorations', async () => {
  const state = createQuotaTestState();
  state.manualQuotaBatch.set('active', restored('active', 'source', 100));
  state.manualQuotaBatch.set('expired', restored('expired', 'source', 20, 'spend', new Date(0)));
  state.manualQuotaBatch.set('used', restored('used', 'source', 0));
  state.manualQuotaBatch.set('target', restored('target', 'target', 200, 'flow', later));
  const original = [...state.manualQuotaBatch.values()].map(row => ({ ...row }));
  const f = createQuotaTestTransaction(state); const locks = await lockManualQuotaOwnersTx(txOf(f), ['source', 'target']);
  assert.deepEqual(await moveManualQuotaBatchesTx(txOf(f), 'source', 'target', locks), { flowBatchesTransferred: 2, spendBatchesTransferred: 1 }); f.commit();
  for (const before of original) assert.deepEqual(state.manualQuotaBatch.get(String(before.id)), { ...before, userId: 'target' });
  assert.equal(state.manualQuotaRestoration.size, 0);
});

test('ordinary batch CAS failure keeps its old ownership and cannot partially commit a transfer', async () => {
  const state = createQuotaTestState(); state.manualQuotaBatch.set('r', restored('r', 'source', 20));
  const f = createQuotaTestTransaction(state, { beforeWrite: (model) => { if (model === 'manualQuotaBatch') state.manualQuotaBatch.get('r')!.remainingExtra = D(5); } });
  const locks = await lockManualQuotaOwnersTx(txOf(f), ['source', 'target']);
  await assert.rejects(moveManualQuotaBatchesTx(txOf(f), 'source', 'target', locks), /核实/);
  assert.equal(state.manualQuotaBatch.get('r')!.userId, 'source');
});

test('Discord rename takes ordinary batches too and refuses a destination with orphan ordinary history', async () => {
  const state = createQuotaTestState(); state.manualQuotaBatch.set('r', restored('r', 'old', 20));
  const f = createQuotaTestTransaction(state); const locks = await lockManualQuotaOwnersTx(txOf(f), ['old', 'new']);
  await remapManualQuotaOwnersTx(txOf(f), [{ from: 'old', to: 'new' }], locks); f.commit();
  assert.equal(state.manualQuotaBatch.get('r')!.userId, 'new'); assert.equal(state.manualQuotaBatch.get('r')!.expiresAt, expiresAt);
  const occupied = createQuotaTestState(); occupied.manualQuotaBatch.set('r', restored('r', 'new', 0, 'flow', new Date(0)));
  const other = createQuotaTestTransaction(occupied); const otherLocks = await lockManualQuotaOwnersTx(txOf(other), ['old', 'new']);
  await assert.rejects(remapManualQuotaOwnersTx(txOf(other), [{ from: 'old', to: 'new' }], otherLocks), /核实/);
});
