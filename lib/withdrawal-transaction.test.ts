import assert from 'node:assert/strict';
import test from 'node:test';
import { Prisma } from '@prisma/client';

import { createWithdrawalTx, WithdrawError } from './withdrawal-transaction';

const NOW = Date.parse('2026-10-21T12:00:00Z');
const COOLDOWN = 60_000;
const decimal = (value: Prisma.Decimal | string | number) => new Prisma.Decimal(value);
type Wallet = Record<'totalBalance' | 'income' | 'recharge' | 'totalSpent' | 'loyaltyPoints', Prisma.Decimal>;
type Withdrawal = { id: string; dlmId: string; amount: Prisma.Decimal; method: string; createdAt: Date };
type Ledger = { dlmId: string; balanceBefore: Prisma.Decimal; amountChange: Prisma.Decimal; balanceAfter: Prisma.Decimal };
type Input = Parameters<typeof createWithdrawalTx>[1];

const wallet = (amount: number): Wallet => ({ totalBalance: decimal(amount), income: decimal(amount), recharge: decimal(0), totalSpent: decimal(0), loyaltyPoints: decimal(0) });
const input = (dlmId = 'user-a', overrides: Partial<Input> = {}): Input => ({ dlmId, discordUserId: null, amount: decimal(100), method: 'test-method', cooldownMs: COOLDOWN, ...overrides });

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}

/** Transaction adapter only: it supplies row locks and staged persistence, not withdrawal rules. */
function fixture(users: Record<string, number>, members: Record<string, number> = {}) {
  const dlmUsers = new Map(Object.entries(users).map(([key, amount]) => [key, wallet(amount)]));
  const memberRows = new Map(Object.entries(members).map(([key, amount]) => [key, wallet(amount)]));
  const peiwanBalances = new Map<string, Prisma.Decimal>();
  const withdrawals: Withdrawal[] = [];
  const ledger: Ledger[] = [];
  const trace: string[] = [];
  const tails = new Map<string, Promise<void>>();
  let transactionId = 0;

  const run = async (params: Input, beforeCommit?: () => Promise<void>) => {
    const id = `tx${++transactionId}`;
    const held = new Set<string>();
    const releases: Array<() => void> = [];
    const stagedDlm = new Map<string, Wallet>();
    const stagedMembers = new Map<string, Wallet>();
    const stagedPeiwan = new Map<string, Prisma.Decimal>();
    const stagedWithdrawals: Withdrawal[] = [];
    const stagedLedger: Ledger[] = [];

    const requireLock = (table: 'DlmUser' | 'Member', key: string) => {
      assert.ok(held.has(`${table}:${key}`), `${id} accessed ${table}:${key} before locking it`);
    };
    const readWallet = (table: 'DlmUser' | 'Member', key: string) => {
      requireLock(table, key);
      trace.push(`${id}:read:${table}:${key}`);
      const value = table === 'DlmUser' ? stagedDlm.get(key) ?? dlmUsers.get(key) : stagedMembers.get(key) ?? memberRows.get(key);
      return value ? { ...value } : null;
    };
    const updateWallet = (table: 'DlmUser' | 'Member', key: string, data: Record<string, { increment: Prisma.Decimal }>) => {
      const current = readWallet(table, key);
      assert.ok(current, `missing fixture ${table}:${key}`);
      for (const [field, operation] of Object.entries(data)) {
        assert.ok(operation && 'increment' in operation, 'wallet writes must remain increments');
        const name = field as keyof Wallet;
        current[name] = current[name].plus(operation.increment);
      }
      (table === 'DlmUser' ? stagedDlm : stagedMembers).set(key, current);
      return { ...current };
    };

    const tx = {
      $executeRaw: async (parts: TemplateStringsArray, key: string) => {
        const sql = parts.join('?').replace(/\s+/g, ' ').trim();
        const match = sql.match(/^SELECT 1 FROM "(DlmUser|Member)" WHERE "(?:dlmId|discordUserId)" = \? FOR UPDATE$/);
        assert.ok(match, `unexpected raw statement: ${sql}`);
        const lockKey = `${match[1]}:${key}`;
        trace.push(`${id}:request:${lockKey}`);
        if (held.has(lockKey)) return 1;
        const previous = tails.get(lockKey) ?? Promise.resolve();
        const released = deferred();
        tails.set(lockKey, previous.then(() => released.promise));
        await previous;
        held.add(lockKey);
        trace.push(`${id}:acquire:${lockKey}`);
        releases.push(() => { held.delete(lockKey); trace.push(`${id}:release:${lockKey}`); released.resolve(); });
        return 1;
      },
      dlmUser: {
        findUnique: async ({ where }: { where: { dlmId: string } }) => readWallet('DlmUser', where.dlmId),
        update: async ({ where, data }: { where: { dlmId: string }; data: Record<string, { increment: Prisma.Decimal }> }) => updateWallet('DlmUser', where.dlmId, data),
      },
      member: {
        findUnique: async ({ where }: { where: { discordUserId: string } }) => readWallet('Member', where.discordUserId),
        update: async ({ where, data }: { where: { discordUserId: string }; data: Record<string, { increment: Prisma.Decimal }> }) => updateWallet('Member', where.discordUserId, data),
      },
      pEIWAN: {
        update: async ({ where, data }: { where: { discordUserId: string }; data: { balance: Prisma.Decimal } }) => {
          requireLock('Member', where.discordUserId);
          stagedPeiwan.set(where.discordUserId, data.balance);
          return data;
        },
      },
      withdraw: {
        findFirst: async ({ where }: { where: { dlmId: string } }) => {
          requireLock('DlmUser', where.dlmId);
          if (params.discordUserId) requireLock('Member', params.discordUserId);
          trace.push(`${id}:read:withdraw:${where.dlmId}`);
          return [...withdrawals, ...stagedWithdrawals].filter((entry) => entry.dlmId === where.dlmId).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0] ?? null;
        },
        create: async ({ data }: { data: Omit<Withdrawal, 'id' | 'createdAt'> }) => {
          requireLock('DlmUser', data.dlmId);
          const created = { ...data, id: `${id}-withdrawal`, createdAt: new Date(NOW) };
          stagedWithdrawals.push(created);
          return created;
        },
      },
      individualTransaction: {
        create: async ({ data }: { data: Ledger }) => {
          requireLock('DlmUser', data.dlmId);
          stagedLedger.push(data);
          return data;
        },
      },
    } as unknown as Prisma.TransactionClient;

    try {
      const result = await createWithdrawalTx(tx, params, () => NOW);
      await beforeCommit?.();
      for (const [key, value] of stagedDlm) dlmUsers.set(key, value);
      for (const [key, value] of stagedMembers) memberRows.set(key, value);
      for (const [key, value] of stagedPeiwan) peiwanBalances.set(key, value);
      withdrawals.push(...stagedWithdrawals);
      ledger.push(...stagedLedger);
      trace.push(`${id}:commit`);
      return result;
    } catch (error) {
      trace.push(`${id}:rollback`);
      throw error;
    } finally {
      for (const release of releases.reverse()) release();
    }
  };

  return { run, dlmUsers, memberRows, peiwanBalances, withdrawals, ledger, trace };
}

function assertWithdrawalError(result: PromiseSettledResult<unknown>, code: string) {
  assert.equal(result.status, 'rejected');
  if (result.status !== 'rejected') return;
  assert.ok(result.reason instanceof WithdrawError);
  assert.equal(result.reason.code, code);
}

test('concurrent withdrawals of 100 from 150 serialize through commit and cannot overdraw', async () => {
  const f = fixture({ 'user-a': 150 });
  const beforeCommit = deferred();
  const release = deferred();
  const first = f.run(input('user-a', { cooldownMs: 0 }), async () => { beforeCommit.resolve(); await release.promise; });
  await beforeCommit.promise;
  const second = f.run(input('user-a', { cooldownMs: 0 }));
  assert.equal(f.withdrawals.length, 0, 'uncommitted withdrawal must not be visible');
  assert.equal(f.dlmUsers.get('user-a')!.totalBalance.toString(), '150');
  assert.ok(f.trace.includes('tx2:request:DlmUser:user-a'));
  assert.ok(!f.trace.includes('tx2:read:withdraw:user-a'), 'second eligibility read must wait for the first commit');
  release.resolve();
  const results = await Promise.allSettled([first, second]);
  assert.equal(results[0].status, 'fulfilled');
  assertWithdrawalError(results[1], 'insufficient_balance');
  assert.equal(f.dlmUsers.get('user-a')!.totalBalance.toString(), '50');
  assert.equal(f.dlmUsers.get('user-a')!.income.toString(), '50');
  assert.equal(f.withdrawals.length, 1);
  assert.equal(f.ledger.length, 1);
  assert.ok(f.trace.indexOf('tx1:commit') < f.trace.indexOf('tx1:release:DlmUser:user-a'));
  assert.ok(f.trace.indexOf('tx1:commit') < f.trace.indexOf('tx2:acquire:DlmUser:user-a'));
});

test('cooldown serializes same-user requests even when both withdrawals are affordable', async () => {
  const f = fixture({ 'user-a': 500 });
  const results = await Promise.allSettled([f.run(input()), f.run(input())]);
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
  const rejected = results.find((result) => result.status === 'rejected')!;
  assertWithdrawalError(rejected, 'withdraw_cooldown');
  if (rejected.status === 'rejected') {
    assert.equal((rejected.reason as WithdrawError).status, 429);
    assert.deepEqual((rejected.reason as WithdrawError).meta, { nextAvailableAt: new Date(NOW + COOLDOWN).toISOString() });
  }
  assert.equal(f.dlmUsers.get('user-a')!.totalBalance.toString(), '400');
  assert.equal(f.withdrawals.length, 1);
  assert.equal(f.ledger.length, 1);
});

test('a different user can commit while the first user still holds its row lock', async () => {
  const f = fixture({ 'user-a': 150, 'user-b': 150 });
  const beforeCommit = deferred();
  const release = deferred();
  const first = f.run(input(), async () => { beforeCommit.resolve(); await release.promise; });
  await beforeCommit.promise;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    const second = await Promise.race([
      f.run(input('user-b')),
      new Promise<never>((_, reject) => { timeout = setTimeout(() => reject(new Error('different users were globally serialized')), 1000); }),
    ]);
    assert.equal(second.remainingBalance, '50');
    assert.ok(f.trace.includes('tx2:commit'));
    assert.ok(!f.trace.includes('tx1:commit'));
    assert.ok(!f.trace.includes('tx1:release:DlmUser:user-a'));
  } finally {
    if (timeout) clearTimeout(timeout);
    release.resolve();
    await first;
  }
  assert.equal(f.withdrawals.length, 2);
});

test('Discord wallets lock DlmUser before Member and keep both balances and the ledger aligned', async () => {
  const f = fixture({ 'user-a': 150 }, { 'discord-a': 150 });
  const result = await f.run(input('user-a', { discordUserId: 'discord-a' }));
  assert.deepEqual(f.trace.filter((entry) => entry.includes(':acquire:')), ['tx1:acquire:DlmUser:user-a', 'tx1:acquire:Member:discord-a']);
  assert.ok(f.trace.indexOf('tx1:acquire:Member:discord-a') < f.trace.indexOf('tx1:read:withdraw:user-a'));
  for (const entry of [f.dlmUsers.get('user-a')!, f.memberRows.get('discord-a')!]) {
    assert.equal(entry.totalBalance.toString(), '50');
    assert.equal(entry.income.toString(), '50');
  }
  assert.equal(f.peiwanBalances.get('discord-a')?.toString(), '50');
  assert.equal(result.remainingBalance, '50');
  assert.equal(result.remainingIncome, '50');
  assert.equal(result.withdrawalId, f.withdrawals[0].id);
  assert.deepEqual(result.notificationPayload, {
    userDiscordId: 'discord-a',
    amount: '100.00',
    requestedAt: new Date(NOW).toISOString(),
    withdrawalId: f.withdrawals[0].id,
    note: 'test-method',
    remainingIncome: '50',
  });
  assert.equal(f.ledger[0].balanceBefore.toString(), '150');
  assert.equal(f.ledger[0].amountChange.toString(), '-100');
  assert.equal(f.ledger[0].balanceAfter.toString(), '50');
});

test('Member is authoritative for Discord-linked balances and insufficient funds produce no records or deductions', async () => {
  const f = fixture({ 'user-a': 500 }, { 'discord-a': 90 });
  const result = await Promise.allSettled([f.run(input('user-a', { discordUserId: 'discord-a' }))]);
  assertWithdrawalError(result[0], 'insufficient_balance');
  assert.equal(f.dlmUsers.get('user-a')!.totalBalance.toString(), '500');
  assert.equal(f.memberRows.get('discord-a')!.totalBalance.toString(), '90');
  assert.equal(f.withdrawals.length, 0);
  assert.equal(f.ledger.length, 0);
  assert.equal(f.peiwanBalances.size, 0);
});

test('the cooldown permits an exact boundary and rejects a request one millisecond early', async () => {
  for (const offset of [0, 1]) {
    const f = fixture({ 'user-a': 500 });
    f.withdrawals.push({ id: 'prior', dlmId: 'user-a', amount: decimal(100), method: 'test-method', createdAt: new Date(NOW - COOLDOWN + offset) });
    const result = await Promise.allSettled([f.run(input())]);
    if (offset === 0) {
      assert.equal(result[0].status, 'fulfilled');
      assert.equal(f.withdrawals.length, 2);
      assert.equal(f.dlmUsers.get('user-a')!.totalBalance.toString(), '400');
    } else {
      assertWithdrawalError(result[0], 'withdraw_cooldown');
      assert.equal(f.withdrawals.length, 1);
      assert.equal(f.ledger.length, 0);
      assert.equal(f.dlmUsers.get('user-a')!.totalBalance.toString(), '500');
    }
  }
});
