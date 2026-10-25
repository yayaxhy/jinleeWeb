import assert from 'node:assert/strict';
import test from 'node:test';
import { AccountProvider, MemberStatus, Prisma } from '@prisma/client';
import {
  ChannelBindingError,
  mergeWechatProgramDlmUserIntoDlmUserTx,
  unbindDlmUserChannelTx,
} from './discord-binding-transaction';
import { applyDlmWalletDeltaTx } from './dlm-wallet';
import { createWithdrawalTx } from './withdrawal-transaction';
import { createQuotaTestState, createQuotaTestTransaction } from './manual-quota.test-support';

const walletKeys = ['totalBalance', 'income', 'recharge', 'totalSpent', 'loyaltyPoints'] as const;
type Wallet = Record<typeof walletKeys[number], Prisma.Decimal>;
type User = Wallet & { sessionVersion: number; dlmId: string; discordUserId: string | null; discordDisplayName: string | null; discordAvatarUrl: string | null; wechatDisplayName: string | null; wechatAvatarUrl: string | null; withdrawAccount1: string | null; withdrawAccount2: string | null; withdrawAccount3: string | null };
type Member = Wallet & { discordUserId: string; serverDisplayName: string; status: MemberStatus };
type Row = Record<string, unknown>;
const dec = (value: number | string | Prisma.Decimal) => new Prisma.Decimal(value);
const wallet = (amount: number): Wallet => ({ totalBalance: dec(amount), income: dec(amount), recharge: dec(0), totalSpent: dec(0), loyaltyPoints: dec(0) });
const user = (dlmId: string, amount: number, discordUserId: string | null = null): User => ({ ...wallet(amount), sessionVersion: 1, dlmId, discordUserId, discordDisplayName: discordUserId ? 'Discord 昵称' : null, discordAvatarUrl: null, wechatDisplayName: discordUserId ? null : '微信昵称', wechatAvatarUrl: null, withdrawAccount1: null, withdrawAccount2: null, withdrawAccount3: null });
const member = (discordUserId: string, amount: number, status: MemberStatus = MemberStatus.LAOBAN): Member => ({ ...wallet(amount), discordUserId, serverDisplayName: '公会昵称', status });
const binding = (dlmId: string, provider: AccountProvider, providerUserId: string): Row => ({ id: `${provider}:${providerUserId}`, dlmId, provider, providerUserId });
const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
};
const clone = <T>(row: T): T => row && typeof row === 'object' ? { ...row } : row;
const matches = (row: Row, where: Row): boolean => Object.entries(where).every(([key, expected]) => {
  if (key === 'OR') return (expected as Row[]).some((candidate) => matches(row, candidate));
  if (expected && typeof expected === 'object') {
    if ('not' in expected) return row[key] !== expected.not;
    if ('in' in expected) return (expected.in as unknown[]).includes(row[key]);
  }
  return row[key] === expected;
});
const write = <T extends Row>(row: T, data: Row): T => {
  const next: Row = { ...row };
  for (const [key, value] of Object.entries(data)) {
    next[key] = value && typeof value === 'object' && 'increment' in value
      ? key === 'sessionVersion' ? Number(row[key]) + Number(value.increment) : dec(row[key] as Prisma.Decimal).add(value.increment as Prisma.Decimal)
      : value;
  }
  return next as T;
};

/** Only persistence is simulated: row locks, writes, commit and rollback; actual service code runs above. */
function fixture(options: { users?: User[]; members?: Member[]; bindings?: Row[] } = {}) {
  const quotas = createQuotaTestState();
  const users = new Map((options.users ?? [user('canonical', 500, 'discord-a'), user('incoming', 50)]).map((row) => [row.dlmId, row]));
  const members = new Map((options.members ?? [member('discord-a', 500)]).map((row) => [row.discordUserId, row]));
  const tables = new Map<string, Row[]>([
    ['accountBinding', options.bindings ?? [binding('canonical', AccountProvider.DISCORD, 'discord-a'), binding('incoming', AccountProvider.WECHAT_MINIPROGRAM, 'wechat-a')]],
    ['wechatProgramSession', [{ id: 'session', dlmId: 'incoming' }]],
    ['individualTransaction', [{ id: 'original-gift', dlmId: 'incoming' }]],
    ['transaction', [{ id: 'original-transfer', fromDlmId: 'incoming', toDlmId: 'canonical' }]],
  ]);
  const tails = new Map<string, Promise<void>>();
  const trace: string[] = [];
  let failDelete = false;
  const run = async <T>(name: string, work: (tx: Prisma.TransactionClient) => Promise<T>, hooks: { beforeCommit?: () => Promise<void>; afterLock?: (table: string, id: string, found: boolean) => void } = {}) => {
    const quota = createQuotaTestTransaction(quotas);
    const held = new Set<string>();
    const releases: Array<() => void> = [];
    const stagedUsers = new Map<string, User | null>();
    const stagedMembers = new Map<string, Member>();
    const stagedTables = new Map<string, Row[]>();
    const getUser = (id: string) => stagedUsers.has(id) ? stagedUsers.get(id) : users.get(id);
    const getMember = (id: string) => stagedMembers.get(id) ?? members.get(id);
    const getRows = (table: string) => stagedTables.get(table) ?? tables.get(table) ?? [];
    const acquire = async (table: string, id: string) => {
      const key = `${table}:${id}`;
      if (held.has(key)) return;
      trace.push(`${name}:request:${key}`);
      const previous = tails.get(key) ?? Promise.resolve();
      const done = deferred();
      tails.set(key, previous.then(() => done.promise));
      await previous;
      held.add(key);
      trace.push(`${name}:lock:${key}`);
      releases.push(() => { trace.push(`${name}:unlock:${key}`); done.resolve(); });
    };
    const query = async (parts: TemplateStringsArray | Prisma.Sql, ...values: string[]) => {
      if (!Array.isArray(parts)) return quota.tx.$queryRaw(parts as Prisma.Sql);
      const [id] = values;
      const sql = parts.join('?').replace(/\s+/g, ' ').trim();
      if (sql.includes('pg_advisory_xact_lock')) { await acquire('Identity', id); return []; }
      if (sql === 'SELECT "id" FROM "MiniConversation" WHERE "userAId" = ? OR "userBId" = ? ORDER BY "id" FOR UPDATE') {
        const affected = getRows('miniConversation').filter((row) => row.userAId === values[0] || row.userBId === values[1]).sort((a, b) => String(a.id).localeCompare(String(b.id)));
        for (const row of affected) await acquire('MiniConversation', String(row.id));
        return affected.map((row) => ({ id: row.id }));
      }
      const match = sql.match(/^SELECT (.+) FROM "(DlmUser|Member)" WHERE "(?:dlmId|discordUserId)" = \? FOR UPDATE$/);
      assert.ok(match, `unexpected SQL: ${sql}`);
      const table = match[2];
      const getRow = () => table === 'DlmUser' ? getUser(id) : getMember(id);
      if (getRow()) await acquire(table, id);
      const row = getRow();
      hooks.afterLock?.(table, id, !!row);
      return row ? [clone(row)] : [];
    };
    const readUser = async ({ where, include }: { where: { dlmId: string }; include?: Record<string, boolean> }) => {
      const row = getUser(where.dlmId);
      if (!row) return null;
      assert.ok(held.has(`DlmUser:${where.dlmId}`), 'wallet reads require the DLM row lock');
      trace.push(`${name}:read:${where.dlmId}`);
      if (!include) return clone(row);
      const linkedMember = row.discordUserId ? getMember(row.discordUserId) : null;
      const counts = Object.fromEntries([...new Set([...tables.keys(), ...stagedTables.keys()])]
        .filter((table) => !['giftAudit', 'loyaltyPoint', 'withdrawalAccount', 'lotteryPity', 'manualWechatBoss'].includes(table))
        .map((table) => [table, getRows(table).filter((entry) => ['dlmId', 'fromDlmId', 'toDlmId', 'hostDlmId', 'workerDlmId', 'ownerDlmId', 'consumeTargetDlmId', 'senderDlmId', 'userAId', 'userBId'].some((field) => entry[field] === row.dlmId)).length]));
      return { ...row, member: clone(linkedMember ?? null), accountBindings: getRows('accountBinding').filter((entry) => entry.dlmId === row.dlmId).map(clone),
        ...(include._count ? {
          _count: counts,
          loyaltyPoint: getRows('loyaltyPoint').find((entry) => entry.dlmId === row.dlmId) ?? null,
          withdrawalAccount: getRows('withdrawalAccount').find((entry) => entry.dlmId === row.dlmId) ?? null,
          lotteryPity: getRows('lotteryPity').find((entry) => entry.dlmId === row.dlmId) ?? null,
          manualWechatBoss: getRows('manualWechatBoss').find((entry) => entry.dlmId === row.dlmId) ?? null,
        } : {}),
      };
    };
    const generic = (table: string) => ({
      findFirst: async ({ where }: { where: Row }) => clone(getRows(table).find((row) => matches(row, where)) ?? null),
      findUnique: async ({ where }: { where: Row }) => clone(getRows(table).find((row) => matches(row, (where.type_peerKey ?? where) as Row)) ?? null),
      findMany: async ({ where }: { where: Row }) => getRows(table).filter((row) => matches(row, where)).map(clone),
      update: async ({ where, data }: { where: Row; data: Row }) => {
        const current = getRows(table).find((row) => matches(row, where)); assert.ok(current);
        if (table === 'miniConversation') assert.ok(held.has(`MiniConversation:${current.id}`));
        const updated = write(current, data);
        stagedTables.set(table, getRows(table).map((row) => row === current ? updated : row));
        return updated;
      },
      updateMany: async ({ where, data }: { where: Row; data: Row }) => {
        const rows = getRows(table);
        stagedTables.set(table, rows.map((row) => matches(row, where) ? write(row, data) : row));
        return { count: rows.filter((row) => matches(row, where)).length };
      },
      deleteMany: async ({ where }: { where: Row }) => {
        const rows = getRows(table);
        stagedTables.set(table, rows.filter((row) => !matches(row, where)));
        return { count: rows.filter((row) => matches(row, where)).length };
      },
      count: async ({ where }: { where: Row }) => getRows(table).filter((row) => matches(row, where)).length,
      upsert: async ({ where, create, update }: { where: Row; create: Row; update: Row }) => {
        const predicate = (where.provider_providerUserId ?? where) as Row;
        const rows = getRows(table);
        const previous = rows.find((row) => matches(row, predicate));
        const next = previous ? write(previous, update) : clone(create);
        stagedTables.set(table, previous ? rows.map((row) => row === previous ? next : row) : [...rows, next]);
        return next;
      },
      create: async ({ data }: { data: Row }) => {
        const next = { id: `${table}:${getRows(table).length}`, createdAt: new Date(0), ...data };
        stagedTables.set(table, [...getRows(table), next]);
        return next;
      },
    });
    const tx = {
      $queryRaw: query,
      $executeRaw: (parts: TemplateStringsArray | Prisma.Sql, ...values: string[]) => Array.isArray(parts) ? query(parts, ...values) : quota.tx.$executeRaw(parts as Prisma.Sql),
      flowBuff: quota.tx.flowBuff, spendBuff: quota.tx.spendBuff, manualQuotaRestoration: quota.tx.manualQuotaRestoration, manualQuotaBatch: quota.tx.manualQuotaBatch,
      dlmUser: {
        findMany: async ({ where }: { where: Row }) => [...users.values()].filter(row => matches(row, where)).map(clone),
        findUnique: readUser,
        findUniqueOrThrow: async (args: Parameters<typeof readUser>[0]) => { const result = await readUser(args); assert.ok(result); return result; },
        update: async ({ where, data }: { where: { dlmId: string }; data: Row }) => {
          await acquire('DlmUser', where.dlmId);
          const current = getUser(where.dlmId); assert.ok(current);
          const next = write(current, data); stagedUsers.set(where.dlmId, next);
          trace.push(`${name}:write:${where.dlmId}`);
          return clone(next);
        },
        delete: async ({ where }: { where: { dlmId: string } }) => {
          if (failDelete) throw new Error('simulated delete failure');
          assert.ok(held.has(`DlmUser:${where.dlmId}`));
          stagedUsers.set(where.dlmId, null);
          stagedTables.set('accountBinding', getRows('accountBinding').filter((row) => row.dlmId !== where.dlmId));
        },
      },
      member: {
        findUnique: async ({ where }: { where: { discordUserId: string } }) => { assert.ok(held.has(`Member:${where.discordUserId}`)); return clone(getMember(where.discordUserId)); },
        update: async ({ where, data }: { where: { discordUserId: string }; data: Row }) => {
          await acquire('Member', where.discordUserId);
          const current = getMember(where.discordUserId); assert.ok(current);
          const next = write(current, data); stagedMembers.set(where.discordUserId, next); return clone(next);
        },
      },
      pEIWAN: { update: async () => ({}) },
      ...Object.fromEntries(['pointShopCart', 'pointShopCartItem', 'lotteryPity', 'wechatProgramSession', 'accountBinding', 'order', 'dispatchRequest', 'orderAudit', 'zPayRechargeOrder', 'stripePayment', 'wechatNativePayment', 'recharge', 'withdraw', 'individualTransaction', 'coupon', 'transaction', 'commission', 'lotteryDraw', 'pointShopOrder', 'pointShopGrant', 'pointShopPointLedger', 'loyaltyPoint', 'withdrawalAccount', 'openingBenefitClaim', 'manualWechatBoss', 'dlmAdminOperation', 'guildNotification', 'webPushSubscription', 'authLoginEvent', 'dispatchCandidate', 'miniConversation', 'miniMessage'].map((table) => [table, generic(table)])),
    } as unknown as Prisma.TransactionClient;
    try {
      const result = await work(tx);
      await hooks.beforeCommit?.();
      quota.commit();
      for (const [id, row] of stagedUsers) { if (row) users.set(id, row); else users.delete(id); }
      for (const [id, row] of stagedMembers) members.set(id, row);
      for (const [table, rows] of stagedTables) tables.set(table, rows);
      trace.push(`${name}:commit`);
      return result;
    } catch (error) {
      trace.push(`${name}:rollback`);
      throw error;
    } finally {
      for (const release of releases.reverse()) release();
    }
  };
  return { users, members, tables, quotas, trace, run, failDelete: () => { failDelete = true; } };
}

const merge = (tx: Prisma.TransactionClient) => mergeWechatProgramDlmUserIntoDlmUserTx(tx, { canonicalDlmId: 'canonical', incomingWechatDlmId: 'incoming', discordUserId: 'discord-a' });
const recharge = (tx: Prisma.TransactionClient, target: 'canonical' | 'incoming' = 'canonical') => applyDlmWalletDeltaTx(tx, { dlmId: target, discordUserId: target === 'canonical' ? 'discord-a' : null, totalBalanceDelta: 100, rechargeDelta: 100 });
const withdraw = (tx: Prisma.TransactionClient) => createWithdrawalTx(tx, { dlmId: 'canonical', discordUserId: 'discord-a', amount: dec(150), method: 'test-account', cooldownMs: 0 }, () => 0);
const isCode = (code: string) => (error: unknown) => error instanceof ChannelBindingError && error.code === code;
const bothChannels = (amount = 0, status: MemberStatus = MemberStatus.LAOBAN) => fixture({ users: [user('canonical', amount, 'discord-a')], members: [member('discord-a', amount, status)], bindings: [binding('canonical', AccountProvider.DISCORD, 'discord-a'), binding('canonical', AccountProvider.WECHAT_MINIPROGRAM, 'wechat-a')] });
const unbind = (tx: Prisma.TransactionClient, provider: AccountProvider = AccountProvider.DISCORD) => unbindDlmUserChannelTx(tx, { dlmId: 'canonical', provider });

test('live restored quota blocks Discord unbinding without moving or deleting the entitlement', async () => {
  const f = bothChannels(); f.quotas.manualQuotaRestoration.set('r', { id: 'r', userId: 'discord-a', kind: 'flow', remainingExtra: dec(20), expiresAt: new Date('2090-01-01T00:00:00Z') });
  await assert.rejects(f.run('unbind', (tx) => unbind(tx)), isCode('discord_unbind_requires_asset_review'));
  assert.equal(f.users.get('canonical')!.discordUserId, 'discord-a'); assert.equal(f.quotas.manualQuotaRestoration.get('r')!.userId, 'discord-a');
});

test('expired restored quota remains historical evidence and does not prevent an otherwise empty unbind', async () => {
  const f = bothChannels(); f.quotas.manualQuotaRestoration.set('r', { id: 'r', userId: 'discord-a', kind: 'spend', remainingExtra: dec(20), expiresAt: new Date(0) });
  await f.run('unbind', (tx) => unbind(tx));
  assert.equal(f.users.get('canonical')!.discordUserId, null);
  assert.equal((f.quotas.manualQuotaRestoration.get('r')!.expiresAt as Date).getTime(), 0);
  assert.equal(f.quotas.manualQuotaRestoration.get('r')!.remainingExtra!.toString(), '20');
});

for (const target of ['canonical', 'incoming'] as const) {
  test(`merge waits for an in-flight ${target} recharge before adding wallets and transferring history`, async () => {
    const f = fixture(); const pending = deferred(); const release = deferred();
    const payment = f.run('credit', (tx) => recharge(tx, target), { beforeCommit: async () => { pending.resolve(); await release.promise; } });
    await pending.promise;
    const merging = f.run('merge', merge);
    await Promise.resolve();
    assert.ok(!f.trace.some((entry) => entry.startsWith('merge:read:')));
    release.resolve(); await Promise.all([payment, merging]);
    assert.equal(f.users.get('canonical')?.totalBalance.toString(), '650');
    assert.equal(f.members.get('discord-a')?.totalBalance.toString(), '650');
    assert.equal(f.users.get('canonical')?.recharge.toString(), '100');
    assert.equal(f.users.has('incoming'), false);
    assert.equal(f.tables.get('individualTransaction')?.[0].dlmId, 'canonical');
    assert.equal(f.tables.get('transaction')?.[0].fromDlmId, 'canonical');
    assert.ok(f.trace.indexOf('credit:commit') < f.trace.indexOf('merge:read:canonical'));
  });
}

test('a recharge waiting behind a merge increments the merged balance after commit', async () => {
  const f = fixture(); const pending = deferred(); const release = deferred();
  const merging = f.run('merge', merge, { beforeCommit: async () => { pending.resolve(); await release.promise; } });
  await pending.promise;
  const payment = f.run('credit', (tx) => recharge(tx));
  assert.ok(!f.trace.includes('credit:write:canonical'));
  release.resolve(); await Promise.all([merging, payment]);
  assert.equal(f.users.get('canonical')?.totalBalance.toString(), '650');
  assert.equal(f.members.get('discord-a')?.totalBalance.toString(), '650');
});

test('a merge reads the committed withdrawal debit instead of overwriting it with the old balance', async () => {
  const f = fixture(); const pending = deferred(); const release = deferred();
  const withdrawing = f.run('withdraw', withdraw, { beforeCommit: async () => { pending.resolve(); await release.promise; } });
  await pending.promise;
  const merging = f.run('merge', merge);
  release.resolve(); await Promise.all([withdrawing, merging]);
  assert.equal(f.users.get('canonical')?.totalBalance.toString(), '400');
  assert.equal(f.members.get('discord-a')?.income.toString(), '400');
  assert.equal(f.tables.get('withdraw')?.length, 1);
});

test('two requests for the same merge cannot add the incoming wallet twice', async () => {
  const f = fixture(); const pending = deferred(); const release = deferred();
  const first = f.run('first', merge, { beforeCommit: async () => { pending.resolve(); await release.promise; } });
  await pending.promise;
  const second = f.run('second', merge);
  const rejected = assert.rejects(second, isCode('wechat_user_not_found'));
  release.resolve(); await Promise.all([first, rejected]);
  assert.equal(f.users.get('canonical')?.totalBalance.toString(), '550');
  assert.equal(f.members.get('discord-a')?.totalBalance.toString(), '550');
});

test('both DLM identities are locked in stable order before any Member or wallet read', async () => {
  const f = fixture({ users: [user('z-canonical', 500, 'z-discord'), user('a-incoming', 50)], members: [member('z-discord', 500)], bindings: [binding('z-canonical', AccountProvider.DISCORD, 'z-discord'), binding('a-incoming', AccountProvider.WECHAT_MINIPROGRAM, 'wechat-a')] });
  await f.run('merge', (tx) => mergeWechatProgramDlmUserIntoDlmUserTx(tx, { canonicalDlmId: 'z-canonical', incomingWechatDlmId: 'a-incoming' }));
  assert.deepEqual(f.trace.filter((entry) => entry.includes(':lock:') && !entry.includes(':lock:Identity:')), ['merge:lock:DlmUser:a-incoming', 'merge:lock:DlmUser:z-canonical', 'merge:lock:Member:z-discord']);
  assert.ok(f.trace.indexOf('merge:lock:Member:z-discord') < f.trace.indexOf('merge:read:a-incoming'));
});

test('concurrent removal of two login channels leaves one login method usable', async () => {
  const f = bothChannels(); const pending = deferred(); const release = deferred();
  const first = f.run('discord', (tx) => unbind(tx), { beforeCommit: async () => { pending.resolve(); await release.promise; } });
  await pending.promise;
  const second = f.run('wechat', (tx) => unbind(tx, AccountProvider.WECHAT_MINIPROGRAM));
  const rejected = assert.rejects(second, isCode('last_login_method_forbidden'));
  release.resolve(); await Promise.all([first, rejected]);
  assert.deepEqual(f.tables.get('accountBinding')?.map((row) => row.provider), [AccountProvider.WECHAT_MINIPROGRAM]);
  assert.equal(f.users.get('canonical')?.discordUserId, null);
});

test('Wechat unbinding removes its sessions and retains Discord and wallet values', async () => {
  const f = bothChannels(300);
  f.tables.set('wechatProgramSession', [{ id: 'current-session', dlmId: 'canonical' }]);
  const result = await f.run('unbind', (tx) => unbind(tx, AccountProvider.WECHAT_MINIPROGRAM));
  assert.equal(result.loggedOut, true);
  assert.equal(f.users.get('canonical')?.sessionVersion, 2);
  assert.deepEqual(f.tables.get('wechatProgramSession'), []);
  assert.deepEqual(f.tables.get('accountBinding')?.map((row) => row.provider), [AccountProvider.DISCORD]);
  assert.equal(f.users.get('canonical')?.totalBalance.toString(), '300');
});

test('a worker cannot unbind the required Discord channel', async () => {
  const f = bothChannels(0, MemberStatus.PEIWAN);
  await assert.rejects(f.run('unbind', (tx) => unbind(tx)), isCode('peiwan_requires_discord'));
  assert.equal(f.users.get('canonical')?.discordUserId, 'discord-a');
  assert.equal(f.tables.get('accountBinding')?.length, 2);
});

test('a stale pre-transaction Discord identity cannot restore a removed binding', async () => {
  const f = fixture({ users: [user('canonical', 0), user('incoming', 50)], members: [], bindings: [binding('canonical', AccountProvider.WECHAT_WEB, 'wechat-web'), binding('incoming', AccountProvider.WECHAT_MINIPROGRAM, 'wechat-a')] });
  await assert.rejects(f.run('merge', merge), isCode('discord_binding_changed'));
  assert.equal(f.users.get('canonical')?.discordUserId, null);
  assert.equal(f.users.has('incoming'), true);
  assert.ok(!f.trace.some((entry) => entry.includes(':write:')));
});

test('a failure after wallet writes rolls back merged balances and transferred history', async () => {
  const f = fixture(); f.failDelete();
  await assert.rejects(f.run('merge', merge), /simulated delete failure/);
  assert.equal(f.users.get('canonical')?.totalBalance.toString(), '500');
  assert.equal(f.members.get('discord-a')?.totalBalance.toString(), '500');
  assert.equal(f.users.get('incoming')?.totalBalance.toString(), '50');
  assert.equal(f.tables.get('individualTransaction')?.[0].dlmId, 'incoming');
  assert.equal(f.tables.get('transaction')?.[0].fromDlmId, 'incoming');
  assert.equal(f.tables.get('accountBinding')?.find((row) => row.provider === AccountProvider.WECHAT_MINIPROGRAM)?.dlmId, 'incoming');
});

test('a Member appearing after an unsuccessful lock cannot supply an unlocked wallet snapshot', async () => {
  const f = fixture({ members: [] });
  await assert.rejects(f.run('merge', merge, { afterLock: (table, id, found) => { if (table === 'Member' && !found) f.members.set(id, member(id, 900)); } }), isCode('binding_state_changed'));
  assert.equal(f.users.get('canonical')?.totalBalance.toString(), '500');
  assert.equal(f.members.get('discord-a')?.totalBalance.toString(), '900');
});


test('merging an already Discord-linked incoming account is rejected before balances or history move', async () => {
  const f = fixture({ users: [user('canonical', 500, 'discord-a'), user('incoming', 50, 'discord-b')], members: [member('discord-a', 500), member('discord-b', 50)], bindings: [binding('canonical', AccountProvider.DISCORD, 'discord-a'), binding('incoming', AccountProvider.DISCORD, 'discord-b'), binding('incoming', AccountProvider.WECHAT_MINIPROGRAM, 'wechat-a')] });
  await assert.rejects(f.run('merge', merge), isCode('incoming_discord_already_bound'));
  assert.equal(f.users.get('incoming')?.totalBalance.toString(), '50');
  assert.equal(f.members.get('discord-b')?.totalBalance.toString(), '50');
  assert.equal(f.tables.get('individualTransaction')?.[0].dlmId, 'incoming');
  assert.deepEqual(f.trace.filter((entry) => entry.includes(':lock:') && !entry.includes(':lock:Identity:')), ['merge:lock:DlmUser:canonical', 'merge:lock:DlmUser:incoming', 'merge:lock:Member:discord-a', 'merge:lock:Member:discord-b']);
});

test('Discord unbind rejects any nonzero wallet component, spending history or points without moving assets', async () => {
  for (const source of ['DlmUser', 'Member', 'LoyaltyPoint'] as const) {
    for (const key of source === 'LoyaltyPoint' ? ['points'] : source === 'Member' ? ['totalBalance', 'income', 'recharge', 'totalSpent'] : walletKeys) {
      const f = bothChannels();
      if (source === 'LoyaltyPoint') f.tables.set('loyaltyPoint', [{ discordUserId: 'discord-a', points: dec(1) }]);
      else Object.assign(source === 'DlmUser' ? f.users.get('canonical')! : f.members.get('discord-a')!, { [key]: dec(key === 'income' ? -1 : 1) });
      await assert.rejects(f.run('unbind', (tx) => unbind(tx)), isCode('discord_unbind_requires_asset_review'));
      assert.equal(f.users.get('canonical')?.discordUserId, 'discord-a', `${source}.${key}`);
      assert.equal(f.tables.get('accountBinding')?.length, 2);
    }
  }
});

test('Discord unbind checks active orders for both host identities and worker identity, plus open dispatches', async () => {
  for (const entry of [
    { table: 'order', row: { id: 'pending', status: 'PENDING', hostDlmId: 'canonical' } },
    { table: 'order', row: { id: 'running', status: 'RUNNING', hostId: 'discord-a' } },
    { table: 'order', row: { id: 'worker', status: 'RUNNING', workerId: 'discord-a' } },
    { table: 'dispatchRequest', row: { id: 'dispatch', status: 'OPEN', ownerDlmId: 'canonical' } },
    { table: 'dispatchRequest', row: { id: 'discord-dispatch', status: 'OPEN', ownerDiscordUserId: 'discord-a' } },
  ]) {
    const f = bothChannels(); f.tables.set(entry.table, [entry.row]);
    await assert.rejects(f.run('unbind', (tx) => unbind(tx)), isCode('discord_unbind_requires_asset_review'));
    assert.equal(f.users.get('canonical')?.discordUserId, 'discord-a');
    assert.equal(f.tables.get('accountBinding')?.length, 2);
  }
});

test('Discord unbind waits for a pending recharge, then rejects the newly nonempty wallet', async () => {
  const f = bothChannels(); const pending = deferred(); const release = deferred();
  const payment = f.run('credit', (tx) => recharge(tx), { beforeCommit: async () => { pending.resolve(); await release.promise; } });
  await pending.promise;
  const unbinding = f.run('unbind', (tx) => unbind(tx));
  const rejected = assert.rejects(unbinding, isCode('discord_unbind_requires_asset_review'));
  assert.ok(!f.trace.includes('unbind:read:canonical'));
  release.resolve(); await Promise.all([payment, rejected]);
  assert.equal(f.users.get('canonical')?.totalBalance.toString(), '100');
  assert.equal(f.members.get('discord-a')?.totalBalance.toString(), '100');
  assert.equal(f.users.get('canonical')?.discordUserId, 'discord-a');
  assert.equal(f.tables.get('accountBinding')?.length, 2);
});

function seedAdditionalRelations(f: ReturnType<typeof fixture>) {
  const createdAt = new Date('2026-10-01T00:00:00.000Z');
  const readA = new Date('2026-10-02T00:00:00.000Z');
  const readB = new Date('2026-10-03T00:00:00.000Z');
  f.users.set('g-peer', user('g-peer', 0));
  const seed: Record<string, Row[]> = {
    openingBenefitClaim: [{ id: 'claim', dlmId: 'incoming', benefit: 'DAILY', periodKey: '2026-10-01', couponId: 'coupon-a', claimedAt: createdAt }],
    manualWechatBoss: [{ dlmId: 'incoming', wechatContact: 'fixture-contact', displayName: '客户备注', createdByDiscordId: 'staff', createdAt }],
    dlmAdminOperation: [{ id: 'admin-action', dlmId: 'incoming', requestId: 'recharge-request', sourceOperationId: 'source-action', status: 'COMPLETED', details: { originalDlmId: 'incoming', amount: '10.00' }, result: { dlmId: 'incoming', transactionId: 'original-gift' }, createdAt }],
    guildNotification: [{ id: 'notification', dlmId: 'incoming', dedupeKey: 'original-action', href: '/messages/direct-chat', details: { originalDlmId: 'incoming' }, createdAt }],
    guildNotificationDelivery: [{ id: 'delivery', notificationId: 'notification', status: 'FAILED', attempts: 2, error: 'fixture error' }],
    webPushSubscription: [{ id: 'push', dlmId: 'incoming', endpoint: 'https://example.test/push/fixture', p256dh: 'fixture-key', auth: 'fixture-auth' }],
    authLoginEvent: [{ id: 'login', dlmId: 'incoming', discordUserId: null, provider: 'WECHAT_MINIPROGRAM', createdAt }],
    dispatchRequest: [{ id: 'dispatch', ownerDlmId: 'incoming', ownerWechatOpenId: 'wechat-a', status: 'OPEN', requirement: '原始需求' }],
    dispatchCandidate: [{ id: 'candidate', workerDlmId: 'incoming', dispatchRequestId: 'dispatch', peiwanId: 1, status: 'ACTIVE' }],
    miniConversation: [
      { id: 'direct-chat', type: 'DIRECT', peerKey: 'g-peer:incoming', userAId: 'g-peer', userBId: 'incoming', userALastReadAt: readA, userBLastReadAt: readB, linkedOrderId: 'order-a', adminWatched: true },
      { id: 'system-chat', type: 'SYSTEM', peerKey: 'system:incoming', userAId: 'incoming', userBId: null, userALastReadAt: readB, userBLastReadAt: null },
      { id: 'support-chat', type: 'SUPPORT', peerKey: 'support:incoming', userAId: 'incoming', userBId: null, userALastReadAt: readB, userBLastReadAt: null, adminWatched: true },
    ],
    miniMessage: [{ id: 'message', conversationId: 'direct-chat', senderDlmId: 'incoming', body: '历史消息', status: 'NORMAL', createdAt }],
    miniMessageModerationEvent: [{ id: 'review', messageId: 'message', conversationId: 'direct-chat', rawText: '历史消息', action: 'ALLOW' }],
    giftAudit: [{ id: 'gift-audit', giverDlmId: 'incoming', receiverDlmId: 'g-peer', payerType: 'DLM', transactionId: 'original-transfer' }],
  };
  for (const [table, rows] of Object.entries(seed)) f.tables.set(table, rows.map(clone));
  return seed;
}

test('merge preserves claims, finance audit, notifications and deliveries, push, login, dispatch and chat history', async () => {
  const f = fixture(); const original = seedAdditionalRelations(f);
  await f.run('merge', merge);
  for (const table of ['openingBenefitClaim', 'manualWechatBoss', 'dlmAdminOperation', 'guildNotification', 'webPushSubscription', 'authLoginEvent']) {
    assert.deepEqual(f.tables.get(table), original[table].map((row) => ({ ...row, dlmId: 'canonical' })), table);
  }
  assert.deepEqual(f.tables.get('dispatchRequest'), original.dispatchRequest.map((row) => ({ ...row, ownerDlmId: 'canonical' })));
  assert.deepEqual(f.tables.get('dispatchCandidate'), original.dispatchCandidate.map((row) => ({ ...row, workerDlmId: 'canonical' })));
  assert.deepEqual(f.tables.get('miniMessage'), original.miniMessage.map((row) => ({ ...row, senderDlmId: 'canonical' })));
  for (const table of ['guildNotificationDelivery', 'miniMessageModerationEvent', 'giftAudit']) assert.deepEqual(f.tables.get(table), original[table], table);
  assert.equal(f.users.has('incoming'), false);
  assert.equal(f.users.get('canonical')?.totalBalance.toString(), '550');
  assert.equal((f.tables.get('dlmAdminOperation')?.[0].result as Row).dlmId, 'incoming', 'historical JSON stays unchanged');
});

test('chat migration preserves IDs and A/B read cursors while recomputing peer keys for all supported types', async () => {
  const f = fixture(); const original = seedAdditionalRelations(f);
  await f.run('merge', merge);
  const chats = f.tables.get('miniConversation')!;
  assert.deepEqual(chats[0], { ...original.miniConversation[0], userBId: 'canonical', peerKey: 'canonical:g-peer' });
  assert.deepEqual(chats[1], { ...original.miniConversation[1], userAId: 'canonical', peerKey: 'system:canonical' });
  assert.deepEqual(chats[2], { ...original.miniConversation[2], userAId: 'canonical', peerKey: 'support:canonical' });
  assert.deepEqual(f.tables.get('miniMessage')?.map((row) => [row.id, row.conversationId]), [['message', 'direct-chat']]);
  assert.ok(f.trace.includes('merge:lock:MiniConversation:direct-chat'));
});

test('duplicate promotional claim keys reject the entire merge without dropping either claim or coupon evidence', async () => {
  const f = fixture();
  const claims = [
    { id: 'first-claim', dlmId: 'canonical', benefit: 'DAILY', periodKey: 'same-day', couponId: 'first-coupon', claimedAt: new Date(1) },
    { id: 'second-claim', dlmId: 'incoming', benefit: 'DAILY', periodKey: 'same-day', couponId: 'second-coupon', claimedAt: new Date(2) },
  ];
  f.tables.set('openingBenefitClaim', claims);
  await assert.rejects(f.run('merge', merge), isCode('account_merge_claim_conflict'));
  assert.deepEqual(f.tables.get('openingBenefitClaim'), claims);
  assert.equal(f.users.get('canonical')?.totalBalance.toString(), '500');
  assert.equal(f.users.has('incoming'), true);
});

test('manual customer records on both sides cannot silently overwrite either contact', async () => {
  const f = fixture();
  const customers = [{ dlmId: 'canonical', wechatContact: 'first' }, { dlmId: 'incoming', wechatContact: 'second' }];
  f.tables.set('manualWechatBoss', customers);
  await assert.rejects(f.run('merge', merge), isCode('account_merge_manual_boss_conflict'));
  assert.deepEqual(f.tables.get('manualWechatBoss'), customers);
  assert.equal(f.users.has('incoming'), true);
});

test('an unfinished administrator operation on either account blocks identity deletion', async () => {
  for (const dlmId of ['canonical', 'incoming']) {
    const f = fixture(); const operation = { id: 'pending-operation', dlmId, status: 'PENDING', requestId: 'pending-request' };
    f.tables.set('dlmAdminOperation', [operation]);
    await assert.rejects(f.run('merge', merge), isCode('account_merge_pending_operation'));
    assert.deepEqual(f.tables.get('dlmAdminOperation'), [operation]);
    assert.equal(f.users.has('incoming'), true);
  }
});

test('point-shop request-key collisions preserve both orders rather than renaming idempotency keys', async () => {
  const f = fixture();
  const orders = [{ id: 'first', dlmId: 'canonical', requestKey: 'shared-request' }, { id: 'second', dlmId: 'incoming', requestKey: 'shared-request' }];
  f.tables.set('pointShopOrder', orders);
  await assert.rejects(f.run('merge', merge), isCode('account_merge_point_shop_conflict'));
  assert.deepEqual(f.tables.get('pointShopOrder'), orders);
});

test('colliding direct, system and support conversations remain intact with their messages and links', async () => {
  for (const type of ['DIRECT', 'SYSTEM', 'SUPPORT']) {
    const f = fixture(); const prefix = type.toLowerCase();
    const chats = [
      { id: 'original-canonical', type, peerKey: type === 'DIRECT' ? 'canonical:peer' : `${prefix}:canonical`, userAId: 'canonical', userBId: type === 'DIRECT' ? 'peer' : null },
      { id: 'original-incoming', type, peerKey: type === 'DIRECT' ? 'incoming:peer' : `${prefix}:incoming`, userAId: 'incoming', userBId: type === 'DIRECT' ? 'peer' : null },
    ];
    f.tables.set('miniConversation', chats);
    f.tables.set('miniMessage', [{ id: 'original-message', conversationId: 'original-incoming', senderDlmId: 'incoming', body: '保留历史' }]);
    await assert.rejects(f.run('merge', merge), isCode('account_merge_conversation_conflict'));
    assert.deepEqual(f.tables.get('miniConversation'), chats);
    assert.equal(f.tables.get('miniMessage')?.[0].conversationId, 'original-incoming');
    assert.equal(f.tables.get('miniMessage')?.[0].senderDlmId, 'incoming');
    assert.equal(f.users.has('incoming'), true);
  }
});

test('a chat that would become self-directed or has a missing peer requires explicit history handling', async () => {
  for (const peer of ['canonical', null]) {
    const f = fixture();
    const chat = { id: 'history-chat', type: 'DIRECT', peerKey: 'original-key', userAId: 'incoming', userBId: peer };
    f.tables.set('miniConversation', [chat]);
    await assert.rejects(f.run('merge', merge), isCode('account_merge_conversation_conflict'));
    assert.deepEqual(f.tables.get('miniConversation'), [chat]);
  }
});

test('legacy Member-owned one-to-one mirrors on a Discord-detached incoming account are not discarded', async () => {
  for (const table of ['loyaltyPoint', 'withdrawalAccount']) {
    const f = fixture(); const legacy = { discordUserId: 'old-discord', dlmId: 'incoming', points: dec(4), account1: 'old-account' };
    f.tables.set(table, [legacy]);
    await assert.rejects(f.run('merge', merge), isCode('account_merge_legacy_mirror_conflict'));
    assert.deepEqual(f.tables.get(table), [legacy]);
    assert.equal(f.users.has('incoming'), true);
  }
});

test('a failure after relationship transfers rolls back every migrated record and both wallets', async () => {
  const f = fixture(); const original = seedAdditionalRelations(f); f.failDelete();
  await assert.rejects(f.run('merge', merge), /simulated delete failure/);
  for (const [table, rows] of Object.entries(original)) assert.deepEqual(f.tables.get(table), rows, table);
  assert.equal(f.users.get('canonical')?.totalBalance.toString(), '500');
  assert.equal(f.members.get('discord-a')?.totalBalance.toString(), '500');
  assert.equal(f.users.get('incoming')?.totalBalance.toString(), '50');
});

test('delete preflight rejects any remaining collection reference instead of letting Cascade erase an omission', async () => {
  const f = fixture(); seedAdditionalRelations(f);
  const unknown = { id: 'future-related-record', dlmId: 'incoming', evidence: 'must survive' };
  f.tables.set('unhandledFutureRelation', [unknown]);
  await assert.rejects(f.run('merge', merge), isCode('account_merge_relations_remaining'));
  assert.deepEqual(f.tables.get('unhandledFutureRelation'), [unknown]);
  assert.equal(f.tables.get('openingBenefitClaim')?.[0].dlmId, 'incoming');
  assert.equal(f.users.get('canonical')?.totalBalance.toString(), '500');
  assert.equal(f.users.has('incoming'), true);
});


test('Wechat unlink removes web and mini-program bindings together and invalidates every old session', async () => {
  const f = bothChannels(300);
  f.tables.get('accountBinding')!.push(binding('canonical', AccountProvider.WECHAT_WEB, 'web-open-id'));
  f.tables.set('wechatProgramSession', [{ id: 'mini-1', dlmId: 'canonical' }, { id: 'mini-2', dlmId: 'canonical' }, { id: 'unrelated', dlmId: 'other' }]);
  const result = await f.run('unbind', tx => unbindDlmUserChannelTx(tx, { dlmId: 'canonical', provider: AccountProvider.WECHAT_MINIPROGRAM, expectedSessionVersion: 1 }));
  assert.equal(result.loggedOut, true);
  assert.equal(f.users.get('canonical')?.sessionVersion, 2);
  assert.equal(f.users.get('canonical')?.wechatDisplayName, null);
  assert.equal(f.users.get('canonical')?.totalBalance.toString(), '300');
  assert.equal(f.members.get('discord-a')?.totalBalance.toString(), '300');
  assert.deepEqual(f.tables.get('accountBinding')?.map(row => row.provider), [AccountProvider.DISCORD]);
  assert.deepEqual(f.tables.get('wechatProgramSession'), [{ id: 'unrelated', dlmId: 'other' }]);
});

test('a web-only Wechat binding can be unlinked through the grouped channel', async () => {
  const f = bothChannels();
  f.tables.set('accountBinding', [binding('canonical', AccountProvider.DISCORD, 'discord-a'), binding('canonical', AccountProvider.WECHAT_WEB, 'web-open-id')]);
  await f.run('unbind', tx => unbind(tx, AccountProvider.WECHAT_MINIPROGRAM));
  assert.deepEqual(f.tables.get('accountBinding')?.map(row => row.provider), [AccountProvider.DISCORD]);
});

test('two Wechat application bindings cannot count as each other remaining login', async () => {
  const f = fixture({ users: [user('canonical', 300)], members: [], bindings: [binding('canonical', AccountProvider.WECHAT_WEB, 'web'), binding('canonical', AccountProvider.WECHAT_MINIPROGRAM, 'mini')] });
  await assert.rejects(f.run('unbind', tx => unbind(tx, AccountProvider.WECHAT_MINIPROGRAM)), isCode('last_login_method_forbidden'));
  assert.equal(f.tables.get('accountBinding')?.length, 2);
  assert.equal(f.users.get('canonical')?.sessionVersion, 1);
});

test('an obsolete Discord binding is not accepted as a remaining login', async () => {
  const f = fixture({ users: [user('canonical', 300)], members: [], bindings: [binding('canonical', AccountProvider.WECHAT_WEB, 'web'), binding('canonical', AccountProvider.DISCORD, 'stale-discord')] });
  await assert.rejects(f.run('unbind', tx => unbind(tx, AccountProvider.WECHAT_WEB)), isCode('last_login_method_forbidden'));
});

test('merging revokes both accounts bearer tokens instead of moving them to the combined wallet', async () => {
  const f = fixture();
  f.tables.set('wechatProgramSession', [{ id: 'old', dlmId: 'incoming' }, { id: 'target', dlmId: 'canonical' }, { id: 'other', dlmId: 'unrelated' }]);
  const merged = await f.run('merge', merge);
  assert.equal(merged.sessionVersion, 2);
  assert.deepEqual(f.tables.get('wechatProgramSession'), [{ id: 'other', dlmId: 'unrelated' }]);
  assert.ok(f.tables.get('accountBinding')?.some(row => row.providerUserId === 'wechat-a' && row.dlmId === 'canonical'));
  assert.equal(f.users.has('incoming'), false);
});

test('failed merge rolls back session revocation and the target version together with the wallet', async () => {
  const f = fixture(); f.failDelete();
  await assert.rejects(f.run('merge', merge), /simulated delete failure/);
  assert.equal(f.users.get('canonical')?.sessionVersion, 1);
  assert.equal(f.users.get('canonical')?.totalBalance.toString(), '500');
  assert.deepEqual(f.tables.get('wechatProgramSession'), [{ id: 'session', dlmId: 'incoming' }]);
});

test('an authenticated mutation waiting behind a binding change cannot use its stale session version', async () => {
  const f = bothChannels(); f.users.get('canonical')!.sessionVersion = 2;
  await assert.rejects(f.run('unbind', tx => unbindDlmUserChannelTx(tx, { dlmId: 'canonical', provider: AccountProvider.WECHAT_WEB, expectedSessionVersion: 1 })), isCode('binding_state_changed'));
  assert.equal(f.tables.get('accountBinding')?.length, 2);
  const merging = fixture(); merging.users.get('incoming')!.sessionVersion = 2;
  await assert.rejects(merging.run('merge', tx => mergeWechatProgramDlmUserIntoDlmUserTx(tx, { canonicalDlmId: 'canonical', incomingWechatDlmId: 'incoming', incomingSessionVersion: 1 })), isCode('binding_state_changed'));
  assert.equal(merging.users.get('canonical')?.totalBalance.toString(), '500');
});

test('existing empty Discord unlink revokes sessions without relaxing the financial restrictions', async () => {
  const f = bothChannels();
  f.tables.set('wechatProgramSession', [{ id: 'old-mini', dlmId: 'canonical' }]);
  const result = await f.run('unbind', tx => unbind(tx));
  assert.equal(result.loggedOut, true);
  assert.equal(f.users.get('canonical')?.sessionVersion, 2);
  assert.deepEqual(f.tables.get('wechatProgramSession'), []);
  assert.equal(f.users.get('canonical')?.discordUserId, null);
});
