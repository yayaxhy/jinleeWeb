// Offline persistence adapter only. Never imported by application entry points.
import assert from 'node:assert/strict';
import { Prisma } from '@prisma/client';

type Row = Record<string, unknown>;
type Model = 'flowBuff' | 'spendBuff' | 'manualQuotaRestoration' | 'manualQuotaBatch';
const models: Model[] = ['flowBuff', 'spendBuff', 'manualQuotaRestoration', 'manualQuotaBatch'];
const dec = (value: unknown) => new Prisma.Decimal(String(value));
const matches = (row: Row, where: Row): boolean => Object.entries(where).every(([field, expected]) => {
  const value = row[field];
  if (expected && typeof expected === 'object' && Object.hasOwn(expected, 'gt') && 'gt' in expected) {
    return value instanceof Date ? value > (expected.gt as Date) : dec(value).gt(dec(expected.gt));
  }
  if (value instanceof Date) return expected instanceof Date && value.getTime() === expected.getTime();
  if (value instanceof Prisma.Decimal) return value.eq(dec(expected));
  return value === expected;
});

export function createQuotaTestState() {
  return Object.fromEntries(models.map((model) => [model, new Map<string, Row>()])) as Record<Model, Map<string, Row>>;
}

export function createQuotaTestTransaction(state = createQuotaTestState(), hooks: {
  beforeWrite?: (model: Model, operation: string, key: string) => void;
  afterLock?: (model: Model, userId: string) => void | Promise<void>;
} = {}) {
  const pending = Object.fromEntries(models.map((model) => [model, new Map<string, Row | null>()])) as Record<Model, Map<string, Row | null>>;
  const keyFor = (model: Model, row: Row) => String(model === 'manualQuotaRestoration' || model === 'manualQuotaBatch' ? row.id : row.userId);
  const get = (model: Model, key: string) => pending[model].has(key) ? pending[model].get(key) : state[model].get(key);
  const all = (model: Model) => [...new Map([...state[model], ...pending[model]]).values()].filter((row): row is Row => !!row);
  const events: string[] = [];
  const delegates = Object.fromEntries(models.map((model) => [model, {
    findUnique: async ({ where }: { where: Row }) => { const row = all(model).find((row) => matches(row, where)); return row ? { ...row } : null; },
    findFirst: async ({ where }: { where: Row }) => { const row = all(model).find((row) => matches(row, where)); return row ? { ...row } : null; },
    findMany: async ({ where }: { where: Row }) => all(model).filter((row) => matches(row, where)).map((row) => ({ ...row })),
    create: async ({ data }: { data: Row }) => {
      const key = keyFor(model, data); hooks.beforeWrite?.(model, 'create', key);
      if (get(model, key)) throw new Error('offline_unique_conflict');
      pending[model].set(key, { ...data }); return data;
    },
    count: async ({ where }: { where: Row }) => all(model).filter((row) => matches(row, where)).length,
    updateMany: async ({ where, data }: { where: Row; data: Row }) => {
      hooks.beforeWrite?.(model, 'updateMany', String(where.id ?? where.userId));
      const rows = all(model).filter((row) => matches(row, where));
      for (const row of rows) pending[model].set(keyFor(model, row), { ...row, ...data });
      return { count: rows.length };
    },
    update: async ({ where, data }: { where: Row; data: Row }) => {
      hooks.beforeWrite?.(model, 'update', String(where.id ?? where.userId));
      const row = all(model).find((row) => matches(row, where)); assert(row);
      const next = { ...row, ...data }; const key = keyFor(model, row); const nextKey = keyFor(model, next);
      if (key !== nextKey && get(model, nextKey)) throw new Error('offline_unique_conflict');
      pending[model].set(key, null); pending[model].set(nextKey, next); return next;
    },
    deleteMany: async ({ where }: { where: Row }) => {
      hooks.beforeWrite?.(model, 'deleteMany', String(where.id ?? where.userId));
      const rows = all(model).filter((row) => matches(row, where));
      for (const row of rows) pending[model].set(keyFor(model, row), null);
      return { count: rows.length };
    },
  }])) as unknown as Pick<Prisma.TransactionClient, Model>;
  const modelFromSql = (query: Prisma.Sql): Model => {
    assert(/flow_buff|spend_buff/.test(query.sql));
    return query.sql.includes('flow_buff') ? 'flowBuff' : 'spendBuff';
  };
  const tx = {
    ...delegates,
    async $executeRaw(query: Prisma.Sql) {
      assert.match(query.sql, /INSERT INTO [\s\S]* ON CONFLICT \(user_id\) DO NOTHING/);
      const model = modelFromSql(query); const userId = String(query.values[0]);
      events.push(`ensure:${model}:${userId}`);
      if (get(model, userId)) return 0;
      pending[model].set(userId, { userId, remainingExtra: dec(0), expiresAt: query.values[1], createdAt: new Date(1), updatedAt: new Date(1) });
      return 1;
    },
    async $queryRaw(query: Prisma.Sql) {
      assert.match(query.sql, /FOR UPDATE/);
      const model = modelFromSql(query); const userId = String(query.values[0]);
      events.push(`lock:${model}:${userId}`); await hooks.afterLock?.(model, userId);
      const row = get(model, userId); return row ? [{ ...row }] : [];
    },
  };
  const commit = () => {
    for (const model of models) for (const [key, row] of pending[model]) {
      if (row) state[model].set(key, row); else state[model].delete(key);
    }
  };
  return { tx, state, events, commit };
}
