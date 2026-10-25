import assert from 'node:assert/strict';
import test from 'node:test';
import { Prisma } from '@prisma/client';
import { syncAssetTransferBuffsTx } from './admin-asset-transfer-buffs';

const dec = (value: unknown) => new Prisma.Decimal(String(value ?? 0));
const now = new Date('2026-10-21T00:00:00Z');
const expires = new Date('2026-11-21T00:00:00Z');
const later = new Date('2026-12-21T00:00:00Z');
const expired = new Date('2026-09-21T00:00:00Z');
type Buff = 'commissionBuff' | 'flowBuff' | 'spendBuff';
type Row = { userId: string; expiresAt: Date; createdAt: Date; boost?: Prisma.Decimal; remainingExtra?: Prisma.Decimal };
const models: Buff[] = ['commissionBuff', 'flowBuff', 'spendBuff'];
const benefit = (model: Buff, userId: string, amount = 10, expiresAt = expires): Row => ({
  userId, expiresAt, createdAt: now, ...(model === 'commissionBuff' ? { boost: dec(amount) } : { remainingExtra: dec(amount) }),
});
const amount = (model: Buff, row: Row) => dec(model === 'commissionBuff' ? row.boost : row.remainingExtra).toString();

// Only staged persistence is simulated. Hooks represent independently committed
// grants/consumption during a transfer; its rollback must retain those changes.
function fixture() {
  const rows = Object.fromEntries(models.map((name) => [name, new Map<string, Row>()])) as Record<Buff, Map<string, Row>>;
  const hooks: { beforeWrite?: (model: Buff | 'manualQuotaBatch', operation: 'create' | 'update' | 'delete', user: string) => void } = {};
  const warnings: string[] = [];
  const batches: Array<Record<string, any>> = [];
  let autoActive = false;
  const run = async () => {
    const pendingBatches: Array<Record<string, any>> = [];
    const pending = Object.fromEntries(models.map((name) => [name, new Map<string, Row | null>()])) as Record<Buff, Map<string, Row | null>>;
    const get = (model: Buff, user: string) => pending[model].has(user) ? pending[model].get(user) : rows[model].get(user);
    const matches = (row: Row | null | undefined, where: Record<string, unknown>) => Boolean(row && Object.entries(where).every(([key, value]) => {
      const old = row[key as keyof Row];
      if (old instanceof Prisma.Decimal) return old.eq(dec(value));
      if (old instanceof Date) return value instanceof Date && old.getTime() === value.getTime();
      return old === value;
    }));
    const tx = Object.fromEntries(models.map((model) => [model, {
      findUnique: async ({ where }: { where: { userId: string } }) => { const row = get(model, where.userId); return row ? { ...row } : null; },
      create: async ({ data }: { data: Row }) => {
        hooks.beforeWrite?.(model, 'create', data.userId);
        if (get(model, data.userId)) throw new Prisma.PrismaClientKnownRequestError('offline duplicate', { code: 'P2002', clientVersion: 'offline' });
        pending[model].set(data.userId, { ...data }); return data;
      },
      updateMany: async ({ where, data }: { where: Row; data: Partial<Row> }) => {
        hooks.beforeWrite?.(model, 'update', where.userId);
        const row = get(model, where.userId);
        if (!matches(row, where)) return { count: 0 };
        pending[model].set(where.userId, { ...row!, ...data }); return { count: 1 };
      },
      deleteMany: async ({ where }: { where: Row }) => {
        hooks.beforeWrite?.(model, 'delete', where.userId);
        if (!matches(get(model, where.userId), where)) return { count: 0 };
        pending[model].set(where.userId, null); return { count: 1 };
      },
    }])) as Record<string, unknown>;
    tx.manualQuotaBatch = { create: async ({ data }: { data: Record<string, any> }) => { hooks.beforeWrite?.('manualQuotaBatch', 'create', data.userId); pendingBatches.push({ ...data }); return data; } };
    tx.autoCommissionBuff = { findUnique: async () => autoActive ? { activeUntil: later } : null };
    const result = await syncAssetTransferBuffsTx(tx as unknown as Prisma.TransactionClient, 'source', 'target', warnings, now);
    for (const model of models) for (const [user, row] of pending[model]) { if (row) rows[model].set(user, row); else rows[model].delete(user); }
    batches.push(...pendingBatches);
    return result;
  };
  return { rows, batches, hooks, warnings, run, autoActive: () => { autoActive = true; } };
}

test('legacy quota moves as separate ordinary batches with original expiry; target balance is unchanged', async () => {
  const f = fixture();
  f.rows.commissionBuff.set('source', benefit('commissionBuff', 'source', 0.02));
  f.rows.commissionBuff.set('target', benefit('commissionBuff', 'target', 0.01, later));
  f.rows.flowBuff.set('source', benefit('flowBuff', 'source', 10));
  f.rows.flowBuff.set('target', benefit('flowBuff', 'target', 20, later));
  f.rows.spendBuff.set('source', benefit('spendBuff', 'source', 15));
  f.autoActive(); const changed = await f.run();
  assert.equal(amount('commissionBuff', f.rows.commissionBuff.get('target')!), '0.02');
  assert.equal(f.rows.commissionBuff.get('target')!.expiresAt, later);
  assert.equal(amount('flowBuff', f.rows.flowBuff.get('target')!), '20'); assert.equal(f.rows.flowBuff.get('target')!.expiresAt, later);
  assert.deepEqual(f.batches.map(row => [row.kind, row.remainingExtra.toString(), row.expiresAt, row.createdAt]), [['flow', '10', expires, now], ['spend', '15', expires, now]]);
  assert.equal(amount('flowBuff', f.rows.flowBuff.get('source')!), '0'); assert.equal(amount('spendBuff', f.rows.spendBuff.get('source')!), '0');
  assert.equal(changed.flowBuffTransferred, 1); assert.equal(changed.spendBuffTransferred, 1); assert.equal(f.warnings.length, 1);
});

test('expired legacy residuals remain expired history at the target, and target legacy is not revived', async () => {
  const f = fixture();
  f.rows.flowBuff.set('source', benefit('flowBuff', 'source', 100, expired));
  f.rows.flowBuff.set('target', benefit('flowBuff', 'target', 200, later));
  f.rows.spendBuff.set('source', benefit('spendBuff', 'source', 10));
  f.rows.spendBuff.set('target', benefit('spendBuff', 'target', 90, expired));
  await f.run();
  assert.equal(f.batches[0].remainingExtra.toString(), '100'); assert.equal(f.batches[0].expiresAt, expired);
  assert.equal(f.rows.flowBuff.get('target')!.expiresAt, later);
  assert.equal(amount('spendBuff', f.rows.spendBuff.get('target')!), '90'); assert.equal(f.rows.spendBuff.get('target')!.expiresAt, expired);
  assert.equal(f.batches[1].expiresAt, expires);
});

test('commission target creation still fails rather than overwriting a concurrent grant', async () => {
  const f = fixture(); f.rows.commissionBuff.set('source', benefit('commissionBuff', 'source', 10));
  f.hooks.beforeWrite = (model, operation, user) => { if (model === 'commissionBuff' && operation === 'create' && user === 'target') f.rows.commissionBuff.set('target', benefit('commissionBuff', 'target', 0.01, later)); };
  await assert.rejects(f.run(), (error) => error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002');
  assert.equal(amount('commissionBuff', f.rows.commissionBuff.get('source')!), '10'); assert.equal(amount('commissionBuff', f.rows.commissionBuff.get('target')!), '0.01');
});

test('source consumption before clearing invalidates the transfer and discards its new batch', async () => {
  for (const model of ['flowBuff', 'spendBuff'] as const) {
    const f = fixture(); f.rows[model].set('source', benefit(model, 'source', 10)); f.rows[model].set('target', benefit(model, 'target', 20));
    f.hooks.beforeWrite = (kind, operation, user) => { if (kind === model && operation === 'update' && user === 'source') f.rows[model].set('source', benefit(model, 'source', 6)); };
    await assert.rejects(f.run(), /资产权益在转移期间发生变化/);
    assert.equal(amount(model, f.rows[model].get('source')!), '6'); assert.equal(amount(model, f.rows[model].get('target')!), '20'); assert.equal(f.batches.length, 0);
  }
});

test('target quota is never overwritten when independent consumption occurs during batch creation', async () => {
  const f = fixture(); f.rows.flowBuff.set('source', benefit('flowBuff', 'source', 10)); f.rows.flowBuff.set('target', benefit('flowBuff', 'target', 20));
  f.hooks.beforeWrite = (model) => { if (model === 'manualQuotaBatch') f.rows.flowBuff.set('target', benefit('flowBuff', 'target', 16)); };
  await f.run(); assert.equal(amount('flowBuff', f.rows.flowBuff.get('target')!), '16'); assert.equal(f.batches[0].remainingExtra.toString(), '10');
});

test('source expiry changing during transfer aborts without moving an outdated entitlement', async () => {
  for (const model of ['flowBuff', 'spendBuff'] as const) {
    const f = fixture(); f.rows[model].set('source', benefit(model, 'source', 10));
    f.hooks.beforeWrite = (kind, operation, user) => { if (kind === model && operation === 'update' && user === 'source') f.rows[model].set('source', benefit(model, 'source', 10, later)); };
    await assert.rejects(f.run(), /资产权益在转移期间发生变化/);
    assert.equal(f.rows[model].get('source')!.expiresAt, later); assert.equal(f.batches.length, 0);
  }
});

test('commission boost changes on either account are detected independently of expiry', async () => {
  for (const changedUser of ['source', 'target']) {
    const f = fixture(); f.rows.commissionBuff.set('source', benefit('commissionBuff', 'source', 0.01)); f.rows.commissionBuff.set('target', benefit('commissionBuff', 'target', 0.02));
    f.hooks.beforeWrite = (model, operation, user) => {
      if (model === 'commissionBuff' && user === changedUser && operation === (changedUser === 'source' ? 'delete' : 'update')) f.rows.commissionBuff.set(user, benefit('commissionBuff', user, 0.03));
    };
    await assert.rejects(f.run(), /资产权益在转移期间发生变化/);
    assert.equal(amount('commissionBuff', f.rows.commissionBuff.get(changedUser)!), '0.03');
    assert.equal(amount('commissionBuff', f.rows.commissionBuff.get(changedUser === 'source' ? 'target' : 'source')!), changedUser === 'source' ? '0.02' : '0.01');
  }
});

test('source changed during expired-history transfer is retained and forces rollback', async () => {
  for (const model of models) {
    const f = fixture(); f.rows[model].set('source', benefit(model, 'source', 10, expired));
    f.hooks.beforeWrite = (kind, operation) => { if (kind === model && operation === (model === 'commissionBuff' ? 'delete' : 'update')) f.rows[model].set('source', benefit(model, 'source', 5010, later)); };
    await assert.rejects(f.run(), /资产权益在转移期间发生变化/);
    assert.equal(amount(model, f.rows[model].get('source')!), '5010'); assert.equal(f.batches.length, 0);
  }
});

test('source clearing errors never commit an already-created target batch or commission benefit', async () => {
  for (const model of models) {
    const f = fixture(); f.rows[model].set('source', benefit(model, 'source', 10));
    f.hooks.beforeWrite = (kind, operation) => { if (kind === model && operation === (model === 'commissionBuff' ? 'delete' : 'update')) throw new Error('offline clear failure'); };
    await assert.rejects(f.run(), /offline clear failure/);
    assert.equal(amount(model, f.rows[model].get('source')!), '10'); assert.equal(f.rows[model].has('target'), false); assert.equal(f.batches.length, 0);
  }
});

test('ordinary batch creation failure leaves the legacy source untouched', async () => {
  const f = fixture(); f.rows.flowBuff.set('source', benefit('flowBuff', 'source', 10));
  f.hooks.beforeWrite = model => { if (model === 'manualQuotaBatch') throw new Error('batch write failed'); };
  await assert.rejects(f.run(), /batch write failed/); assert.equal(amount('flowBuff', f.rows.flowBuff.get('source')!), '10');
});

test('negative legacy residual is rejected rather than discarded or transferred', async () => {
  const f = fixture(); f.rows.flowBuff.set('source', benefit('flowBuff', 'source', -1));
  await assert.rejects(f.run(), /额度异常/); assert.equal(amount('flowBuff', f.rows.flowBuff.get('source')!), '-1'); assert.equal(f.batches.length, 0);
});
