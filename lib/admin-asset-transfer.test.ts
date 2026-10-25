import assert from 'node:assert/strict';
import test from 'node:test';
import { MemberStatus, PeiwanStatus, Prisma } from '@prisma/client';
import { AssetTransferValidationError, executeAssetTransfer } from './admin-asset-transfer';
import { DlmWalletIdentityChangedError, lockDlmWalletsTx } from './dlm-wallet-lock';
import { applyDlmWalletDeltaTx } from './dlm-wallet';
import { createQuotaTestState, createQuotaTestTransaction } from './manual-quota.test-support';

const dec = (value: unknown) => new Prisma.Decimal(String(value ?? 0));
const deferred = () => { let resolve!: () => void; const promise = new Promise<void>((done) => { resolve = done; }); return { promise, resolve }; };
type Row = Record<string, unknown>;
type Model = 'member' | 'dlm' | 'loyalty' | 'vip' | 'peiwan';
const models: Model[] = ['member', 'dlm', 'loyalty', 'vip', 'peiwan'];
const fields = ['totalBalance', 'income', 'recharge', 'totalSpent', 'loyaltyPoints'];
const params = { operatorDiscordId: 'admin', sourceDiscordId: 'source', targetDiscordId: 'target', forceMerge: false };

// Persistence adapter only. The production executor, wallet arithmetic, summary
// rules and lock helper all run unchanged; no Prisma client or network is used.
function fixture(sourceBalance = 100, targetBalance = 0) {
  const quotas = createQuotaTestState();
  const rows = Object.fromEntries(models.map((name) => [name, new Map<string, Row>()])) as Record<Model, Map<string, Row>>;
  for (const [user, balance, dlmId] of [['source', sourceBalance, 'z-dlm'], ['target', targetBalance, 'a-dlm']] as const) {
    const wallet = { totalBalance: dec(balance), income: dec(0), recharge: dec(balance), totalSpent: dec(0), loyaltyPoints: dec(0) };
    rows.member.set(user, { ...wallet, discordUserId: user, serverDisplayName: user, status: MemberStatus.LAOBAN,
      commissionRate: dec('0.75'), baseCommissionRate: dec('0.75'), peiwan: null });
    rows.dlm.set(dlmId, { ...wallet, dlmId, discordUserId: user });
  }
  const ledger: Row[] = []; const audits: Row[] = []; const events: string[] = [];
  const owners = new Map<string, number>(); const waiters = new Map<string, Array<() => void>>();
  let serial = 0; let failAudit = false; let activeOrders = 0;
  const hooks: { beforeAcquire?: (key: string, txId: number) => void | Promise<void> } = {};
  const transact = async <T>(work: (tx: Prisma.TransactionClient) => Promise<T>) => {
    const quota = createQuotaTestTransaction(quotas);
    const id = ++serial; const held = new Set<string>(); const nextLedger: Row[] = []; const nextAudits: Row[] = [];
    const writes = Object.fromEntries(models.map((name) => [name, new Map<string, Row>()])) as Record<Model, Map<string, Row>>;
    const get = (model: Model, key: string) => writes[model].get(key) ?? rows[model].get(key);
    const all = (model: Model) => [...new Map([...rows[model], ...writes[model]]).values()];
    const mutate = (row: Row, data: Row) => {
      const result = { ...row };
      for (const [key, value] of Object.entries(data)) {
        result[key] = value && typeof value === 'object' && 'increment' in value ? dec(row[key]).add(dec(value.increment)) : value;
      }
      return result;
    };
    const acquire = async (key: string) => {
      events.push(`wait:${id}:${key}`); await hooks.beforeAcquire?.(key, id);
      while (owners.has(key) && owners.get(key) !== id) await new Promise<void>((resolve) => { waiters.set(key, [...(waiters.get(key) ?? []), resolve]); });
      owners.set(key, id); held.add(key); events.push(`lock:${id}:${key}`);
    };
    const walletLocked = (user: string) => {
      const dlm = all('dlm').find((row) => row.discordUserId === user);
      assert(dlm && held.has(`D:${dlm.dlmId}`) && held.has(`M:${user}`), 'wallet reads and writes require both locks');
    };
    const selected = (row: Row | undefined, select?: Row) => row ? Object.fromEntries(Object.entries(row).filter(([key]) => !select || select[key])) : null;
    const empty = { findUnique: async () => null };
    const tx = {
      $executeRaw: quota.tx.$executeRaw,
      async $queryRaw(parts: TemplateStringsArray | Prisma.Sql, key: string) {
        if (!Array.isArray(parts)) return quota.tx.$queryRaw(parts as Prisma.Sql);
        const sql = parts.join('?');
        if (sql.includes('"DlmUser"')) {
          await acquire(`D:${key}`); const row = get('dlm', key);
          return row ? [{ dlmId: row.dlmId, discordUserId: row.discordUserId }] : [];
        }
        assert(sql.includes('"Member"')); await acquire(`M:${key}`);
        return get('member', key) ? [{ discordUserId: key }] : [];
      },
      dlmUser: {
        async findUnique({ where, select }: { where: { dlmId?: string; discordUserId?: string }; select?: Row }) {
          const row = where.dlmId ? get('dlm', where.dlmId) : all('dlm').find((entry) => entry.discordUserId === where.discordUserId);
          if (row && (!select || fields.some((field) => select[field]))) { if (row.discordUserId) walletLocked(String(row.discordUserId)); else assert(held.has(`D:${row.dlmId}`)); events.push(`wallet:${id}:${row.dlmId}`); }
          return selected(row, select);
        },
        async update({ where, data, select }: { where: { dlmId: string }; data: Row; select?: Row }) {
          const row = get('dlm', where.dlmId)!; walletLocked(String(row.discordUserId));
          const next = mutate(row, data); writes.dlm.set(where.dlmId, next); return selected(next, select);
        },
      },
      member: {
        async findUnique({ where, select }: { where: { discordUserId: string }; select?: Row }) {
          if (get('member', where.discordUserId)) walletLocked(where.discordUserId);
          const row = get('member', where.discordUserId); return selected(row, select);
        },
        async update({ where, data, select }: { where: { discordUserId: string }; data: Row; select?: Row }) {
          walletLocked(where.discordUserId); const next = mutate(get('member', where.discordUserId)!, data);
          writes.member.set(where.discordUserId, next); return selected(next, select);
        },
      },
      loyaltyPoint: {
        async findUnique({ where }: { where: { discordUserId: string } }) { return get('loyalty', where.discordUserId) ?? null; },
        async upsert({ where, create, update }: { where: { discordUserId: string }; create: Row; update: Row }) {
          const current = get('loyalty', where.discordUserId); const next = current ? mutate(current, update) : create;
          writes.loyalty.set(where.discordUserId, next); return next;
        },
        async update({ where, data }: { where: { discordUserId: string }; data: Row }) { const next = mutate(get('loyalty', where.discordUserId)!, data); writes.loyalty.set(where.discordUserId, next); return next; },
      },
      vipBenefitProfile: {
        async findUnique({ where }: { where: { discordUserId: string } }) { return get('vip', where.discordUserId) ?? null; },
        async upsert({ where, create, update }: { where: { discordUserId: string }; create: Row; update: Row }) { const current = get('vip', where.discordUserId); const next = current ? mutate(current, update) : create; writes.vip.set(where.discordUserId, next); return next; },
        async update({ where, data }: { where: { discordUserId: string }; data: Row }) { const next = mutate(get('vip', where.discordUserId)!, data); writes.vip.set(where.discordUserId, next); return next; },
      },
      pEIWAN: {
        async findUnique({ where }: { where: { discordUserId: string } }) { return get('peiwan', where.discordUserId) ?? null; },
        async update({ where, data }: { where: { discordUserId: string }; data: Row }) {
          const current = get('peiwan', where.discordUserId); if (!current) throw new Error('missing optional PEIWAN mirror');
          const next = mutate(current, data); writes.peiwan.set(where.discordUserId, next); return next;
        },
      },
      commissionBuff: empty, flowBuff: quota.tx.flowBuff, spendBuff: quota.tx.spendBuff, autoCommissionBuff: empty,
      manualQuotaRestoration: quota.tx.manualQuotaRestoration, manualQuotaBatch: quota.tx.manualQuotaBatch,
      heartCounter: { count: async () => 0, aggregate: async () => ({ _max: { total: null } }), findMany: async () => [] },
      order: { count: async () => activeOrders }, workerLock: { count: async () => 0 },
      individualTransaction: { create: async ({ data }: { data: Row }) => { nextLedger.push(data); return data; } },
      assetTransferAudit: { create: async ({ data }: { data: Row }) => { if (failAudit) throw new Error('offline audit failure'); nextAudits.push(data); return { id: `audit-${id}` }; } },
    } as unknown as Prisma.TransactionClient;
    try {
      const result = await work(tx);
      quota.commit();
      for (const model of models) for (const [key, row] of writes[model]) rows[model].set(key, row);
      ledger.push(...nextLedger); audits.push(...nextAudits); events.push(`commit:${id}`); return result;
    } finally {
      for (const key of held) { owners.delete(key); const queued = waiters.get(key) ?? []; waiters.delete(key); for (const resume of queued) resume(); }
    }
  };
  return { rows, quotas, ledger, audits, events, hooks, transact, failAudit: () => { failAudit = true; }, activeOrders: (value: number) => { activeOrders = value; } };
}

test('transfer locks every DLM in ID order before sorted Members and records locked wallet snapshots', async () => {
  const f = fixture(); const result = await f.transact((tx) => executeAssetTransfer(tx, params));
  assert.deepEqual(f.events.filter((event) => event.startsWith('lock:')), ['lock:1:D:a-dlm', 'lock:1:D:z-dlm', 'lock:1:M:source', 'lock:1:M:target']);
  assert.equal(result.transferred.totalBalance, '100'); assert.equal(result.source.wallet.totalBalance, '0'); assert.equal(result.target.wallet.totalBalance, '100');
  assert.equal(f.ledger.length, 2); assert.equal(f.audits.length, 1);
  assert.equal(dec(f.ledger[0].balanceBefore).toString(), '100'); assert.equal(dec(f.ledger[1].balanceBefore).toString(), '0');
  assert.equal((f.audits[0].sourceSnapshot as { wallet: { totalBalance: string } }).wallet.totalBalance, '100');
});

test('opposite forced transfers use the same lock order and conserve all wallet components', { timeout: 3000 }, async () => {
  const f = fixture(100, 30);
  for (const [user, dlmId, income, recharge, totalSpent, points] of [
    ['source', 'z-dlm', 30, 70, 200, 5],
    ['target', 'a-dlm', 10, 20, 80, 2],
  ] as const) {
    const wallet = { income: dec(income), recharge: dec(recharge), totalSpent: dec(totalSpent) };
    Object.assign(f.rows.member.get(user)!, wallet);
    Object.assign(f.rows.dlm.get(dlmId)!, wallet, { loyaltyPoints: dec(points) });
    f.rows.loyalty.set(user, { discordUserId: user, dlmId, points: dec(points) });
  }
  await Promise.all([
    f.transact((tx) => executeAssetTransfer(tx, { ...params, forceMerge: true })),
    f.transact((tx) => executeAssetTransfer(tx, { ...params, sourceDiscordId: 'target', targetDiscordId: 'source', forceMerge: true })),
  ]);
  for (const [field, expected] of [['totalBalance', '130'], ['income', '40'], ['recharge', '90'], ['totalSpent', '280']]) {
    assert.equal(dec(f.rows.member.get('source')![field]).add(dec(f.rows.member.get('target')![field])).toString(), expected);
  }
  for (const [user, dlmId] of [['source', 'z-dlm'], ['target', 'a-dlm']]) {
    for (const field of ['totalBalance', 'income', 'recharge', 'totalSpent']) {
      assert.equal(dec(f.rows.member.get(user)![field]).toString(), dec(f.rows.dlm.get(dlmId)![field]).toString());
    }
    assert.equal(dec(f.rows.dlm.get(dlmId)!.loyaltyPoints).toString(), dec(f.rows.loyalty.get(user)!.points).toString());
  }
  assert.equal(dec(f.rows.dlm.get('z-dlm')!.loyaltyPoints).add(dec(f.rows.dlm.get('a-dlm')!.loyaltyPoints)).toString(), '7');
  assert.equal(f.audits.length, 2);
});

test('recharge committed while the transfer waits is included in its amount and ledger before-values', { timeout: 3000 }, async () => {
  const f = fixture(); const ready = deferred(); const release = deferred(); const waiting = deferred();
  const recharge = f.transact(async (tx) => {
    await lockDlmWalletsTx(tx, [{ dlmId: 'z-dlm', discordUserId: 'source' }]);
    await applyDlmWalletDeltaTx(tx, { dlmId: 'z-dlm', discordUserId: 'source', rechargeDelta: 25, totalBalanceDelta: 25 });
    ready.resolve(); await release.promise;
  });
  await ready.promise;
  f.hooks.beforeAcquire = (key, id) => { if (key === 'D:z-dlm' && id === 2) waiting.resolve(); };
  const transfer = f.transact((tx) => executeAssetTransfer(tx, params)); await waiting.promise; release.resolve();
  const [, result] = await Promise.all([recharge, transfer]);
  assert.equal(result.transferred.totalBalance, '125'); assert.equal(dec(f.ledger[0].balanceBefore).toString(), '125');
  assert.equal(dec(f.rows.member.get('target')!.totalBalance).toString(), '125');
});

test('target assets appearing after preflight require forceMerge again inside the transaction', async () => {
  const f = fixture();
  f.hooks.beforeAcquire = (key) => {
    if (key === 'D:a-dlm') { f.rows.member.get('target')!.totalBalance = dec(7); f.rows.member.get('target')!.recharge = dec(7); f.rows.dlm.get('a-dlm')!.totalBalance = dec(7); f.rows.dlm.get('a-dlm')!.recharge = dec(7); }
  };
  await assert.rejects(f.transact((tx) => executeAssetTransfer(tx, params)), (error) => error instanceof AssetTransferValidationError && error.status === 409 && error.forceMergeSummaries?.target.wallet.totalBalance === '7');
  assert.equal(dec(f.rows.member.get('source')!.totalBalance).toString(), '100'); assert.equal(f.ledger.length, 0); assert.equal(f.audits.length, 0);
});

test('a changed binding, deleted DLM or missing bound Member aborts before wallet snapshots or mutations', async () => {
  for (const change of ['binding', 'dlm', 'member']) {
    const f = fixture();
    f.hooks.beforeAcquire = (key) => { if (key !== 'D:a-dlm') return;
      if (change === 'binding') f.rows.dlm.get('a-dlm')!.discordUserId = 'other';
      if (change === 'dlm') f.rows.dlm.delete('a-dlm');
      if (change === 'member') f.rows.member.delete('target');
    };
    await assert.rejects(f.transact((tx) => executeAssetTransfer(tx, params)), (error) => error instanceof AssetTransferValidationError && error.status === 409);
    assert.equal(f.events.some((event) => event.startsWith('wallet:')), false); assert.equal(f.ledger.length, 0); assert.equal(f.audits.length, 0);
  }
});

test('shared lock helper supports DLM-only identities and rejects contradictory input mappings', async () => {
  const f = fixture(); f.rows.dlm.get('a-dlm')!.discordUserId = null; f.rows.member.delete('target');
  await f.transact((tx) => lockDlmWalletsTx(tx, [{ dlmId: 'a-dlm', discordUserId: null }]));
  assert.deepEqual(f.events.filter((event) => event.startsWith('lock:')), ['lock:1:D:a-dlm']);
  await assert.rejects(f.transact((tx) => lockDlmWalletsTx(tx, [{ dlmId: 'a-dlm', discordUserId: null }, { dlmId: 'a-dlm', discordUserId: 'target' }])), DlmWalletIdentityChangedError);
});

test('same-account and empty-source calls cannot bypass route restrictions', async () => {
  const f = fixture(0, 0);
  await assert.rejects(f.transact((tx) => executeAssetTransfer(tx, { ...params, targetDiscordId: 'source' })), /不能相同/);
  await assert.rejects(f.transact((tx) => executeAssetTransfer(tx, params)), /没有可转移的资产/);
  assert.equal(f.audits.length, 0); assert.equal(f.ledger.length, 0);
});

test('active source worker business rejects the whole transfer and rolls back prior wallet changes', async () => {
  const f = fixture(); f.rows.peiwan.set('source', { PEIWANID: 1, discordUserId: 'source', status: PeiwanStatus.free,
    totalEarn: dec(20), balance: dec(100), _count: { gameProfiles: 0 } }); f.activeOrders(1);
  await assert.rejects(f.transact((tx) => executeAssetTransfer(tx, params)), /进行中的陪玩订单/);
  assert.equal(dec(f.rows.member.get('source')!.totalBalance).toString(), '100'); assert.equal(dec(f.rows.member.get('target')!.totalBalance).toString(), '0');
  assert.equal(dec(f.rows.peiwan.get('source')!.balance).toString(), '100'); assert.equal(f.audits.length, 0);
});

test('audit failure rolls back both wallets, loyalty rows and financial ledgers', async () => {
  const f = fixture(); f.rows.dlm.get('z-dlm')!.loyaltyPoints = dec(5); f.failAudit();
  await assert.rejects(f.transact((tx) => executeAssetTransfer(tx, params)), /offline audit failure/);
  assert.equal(dec(f.rows.member.get('source')!.totalBalance).toString(), '100'); assert.equal(dec(f.rows.member.get('target')!.totalBalance).toString(), '0');
  assert.equal(dec(f.rows.dlm.get('z-dlm')!.loyaltyPoints).toString(), '5'); assert.equal(f.rows.loyalty.size, 0);
  assert.equal(f.audits.length, 0); assert.equal(f.ledger.length, 0);
});

test('restoration-only source is transferable and preserves separate expiries in the result and audit', async () => {
  const f = fixture(0, 0); const early = new Date('2090-01-01T00:00:00Z'); const later = new Date('2091-01-01T00:00:00Z');
  f.quotas.manualQuotaRestoration.set('first', { id: 'first', userId: 'source', kind: 'flow', remainingExtra: dec(20), expiresAt: early });
  f.quotas.manualQuotaRestoration.set('second', { id: 'second', userId: 'source', kind: 'flow', remainingExtra: dec(30), expiresAt: later });
  const result = await f.transact((tx) => executeAssetTransfer(tx, params));
  assert.equal(result.source.buffs.flowRemaining, '0'); assert.equal(result.target.buffs.flowRemaining, '50');
  assert.deepEqual(result.target.buffs.flowPeriods.map((row) => row.expiresAt), [early.toISOString(), later.toISOString()]);
  assert.equal(result.changed.flowRestorationsTransferred, 2);
  assert.equal(f.quotas.manualQuotaRestoration.get('first')!.userId, 'target');
  assert.equal((f.audits[0].sourceSnapshot as { buffs: { flowRemaining: string } }).buffs.flowRemaining, '50');
});

test('restoration-only target assets still require explicit forceMerge and remain untouched on rejection', async () => {
  const f = fixture();
  f.quotas.manualQuotaRestoration.set('r', { id: 'r', userId: 'target', kind: 'spend', remainingExtra: dec(20), expiresAt: new Date('2090-01-01T00:00:00Z') });
  await assert.rejects(f.transact((tx) => executeAssetTransfer(tx, params)), (error) => error instanceof AssetTransferValidationError && error.status === 409 && error.forceMergeSummaries?.target.buffs.spendRemaining === '20');
  assert.equal(f.quotas.manualQuotaRestoration.get('r')!.userId, 'target'); assert.equal(f.audits.length, 0);
});

test('asset transfer includes ordinary batches in preview/audit and preserves legacy and expired batch deadlines', async () => {
  const f = fixture();
  const early = new Date('2090-01-01T00:00:00Z'), later = new Date('2091-01-01T00:00:00Z'), expiredAt = new Date(0), createdAt = new Date('2026-01-01T00:00:00Z');
  f.quotas.flowBuff.set('source', { userId: 'source', remainingExtra: dec(100), expiresAt: early, createdAt });
  f.quotas.flowBuff.set('target', { userId: 'target', remainingExtra: dec(200), expiresAt: later, createdAt });
  f.quotas.manualQuotaBatch.set('ordinary', { id: 'ordinary', userId: 'source', kind: 'flow', remainingExtra: dec(5000), expiresAt: later, createdAt });
  f.quotas.manualQuotaBatch.set('expired', { id: 'expired', userId: 'source', kind: 'flow', remainingExtra: dec(80), expiresAt: expiredAt, createdAt });
  const result = await f.transact((tx) => executeAssetTransfer(tx, { ...params, forceMerge: true }));
  assert.equal(result.target.buffs.flowRemaining, '5300'); assert.equal(result.source.buffs.flowRemaining, '0');
  assert.equal(f.quotas.flowBuff.get('target')!.remainingExtra!.toString(), '200'); assert.equal(f.quotas.flowBuff.get('target')!.expiresAt, later);
  assert.equal(f.quotas.manualQuotaBatch.get('ordinary')!.userId, 'target'); assert.equal(f.quotas.manualQuotaBatch.get('expired')!.expiresAt, expiredAt);
  const movedLegacy = [...f.quotas.manualQuotaBatch.values()].find(row => row.id !== 'ordinary' && row.id !== 'expired')!;
  assert.equal(movedLegacy.remainingExtra!.toString(), '100'); assert.equal(movedLegacy.expiresAt, early);
  assert.equal((f.audits[0].sourceSnapshot as { buffs: { flowRemaining: string } }).buffs.flowRemaining, '5100');
  assert.equal(f.quotas.manualQuotaRestoration.size, 0);
});
