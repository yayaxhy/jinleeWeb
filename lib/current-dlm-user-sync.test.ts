import assert from 'node:assert/strict';
import test from 'node:test';
import { Prisma } from '@prisma/client';

import { syncDiscordCurrentUserTx } from './current-dlm-user-sync';
import { applyDlmWalletDeltaTx } from './dlm-wallet';

const walletKeys = ['totalBalance', 'income', 'recharge', 'totalSpent', 'loyaltyPoints'] as const;
type Wallet = Record<typeof walletKeys[number], Prisma.Decimal>;
type User = Wallet & { dlmId: string; discordUserId: string | null; discordDisplayName: string | null; discordAvatarUrl: string | null };
type Member = Wallet & { discordUserId: string; serverDisplayName: string | null };
type Session = Parameters<typeof syncDiscordCurrentUserTx>[1];
const dec = (value: number | string | Prisma.Decimal) => new Prisma.Decimal(value);
const wallet = (amount: number): Wallet => ({ totalBalance: dec(amount), income: dec(amount), recharge: dec(0), totalSpent: dec(0), loyaltyPoints: dec(17) });
const user = (amount = 500): User => ({ ...wallet(amount), dlmId: 'user-a', discordUserId: 'discord-a', discordDisplayName: '旧昵称', discordAvatarUrl: 'https://example.test/old.png' });
const member = (amount = 500): Member => ({ ...wallet(amount), discordUserId: 'discord-a', serverDisplayName: '服务器昵称' });
const session: Session = { dlmId: 'user-a', discordId: 'discord-a', username: '登录昵称', avatarUrl: 'https://example.test/new.png' };

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}

function applyWrite<T extends Wallet>(row: T, data: Record<string, unknown>): T {
  const next: Record<string, unknown> = { ...row };
  for (const [key, value] of Object.entries(data)) {
    if ((walletKeys as readonly string[]).includes(key)) {
      const current = row[key as keyof Wallet];
      next[key] = value && typeof value === 'object' && 'increment' in value
        ? current.plus(value.increment as Prisma.Decimal)
        : dec(value as Prisma.Decimal);
    } else {
      next[key] = value;
    }
  }
  return next as T;
}

/** Persistence-only adapter: raw SELECT locks and UPDATE locks last until commit/rollback. */
function fixture(initialUser: User | null = user(), initialMember: Member | null = member()) {
  const users = new Map(initialUser ? [[initialUser.dlmId, initialUser]] : []);
  const members = new Map(initialMember ? [[initialMember.discordUserId, initialMember]] : []);
  const tails = new Map<string, Promise<void>>();
  const trace: string[] = [];
  const upserts: Array<{ create: Record<string, unknown>; update: Record<string, unknown> }> = [];
  const profileWrites: Array<Record<string, unknown>> = [];

  const run = async <T>(name: string, work: (tx: Prisma.TransactionClient) => Promise<T>, options: {
    beforeCommit?: () => Promise<void>;
    afterQuery?: (table: string, found: boolean) => void;
  } = {}) => {
    const held = new Set<string>();
    const releases: Array<() => void> = [];
    const stagedUsers = new Map<string, User>();
    const stagedMembers = new Map<string, Member>();
    const getUser = (id: string) => stagedUsers.get(id) ?? users.get(id);
    const getMember = (id: string) => stagedMembers.get(id) ?? members.get(id);
    const acquire = async (table: string, id: string) => {
      const key = `${table}:${id}`;
      if (held.has(key)) return;
      trace.push(`${name}:request:${key}`);
      const previous = tails.get(key) ?? Promise.resolve();
      const released = deferred();
      tails.set(key, previous.then(() => released.promise));
      await previous;
      held.add(key);
      trace.push(`${name}:acquire:${key}`);
      releases.push(() => { held.delete(key); trace.push(`${name}:release:${key}`); released.resolve(); });
    };
    const tx = {
      $queryRaw: async (parts: TemplateStringsArray, id: string) => {
        const sql = parts.join('?').replace(/\s+/g, ' ').trim();
        const match = sql.match(/^SELECT ("dlmId", "discordUserId"|"discordUserId") FROM "(DlmUser|Member)" WHERE "(?:dlmId|discordUserId)" = \? FOR UPDATE$/);
        assert.ok(match, `unexpected statement: ${sql}`);
        const [, , table] = match;
        const exists = () => table === 'DlmUser' ? Boolean(getUser(id)) : Boolean(getMember(id));
        if (!exists()) {
          trace.push(`${name}:missing:${table}:${id}`);
          options.afterQuery?.(table, false);
          return [];
        }
        await acquire(table, id);
        options.afterQuery?.(table, true);
        return exists() ? [table === 'DlmUser' ? { dlmId: id, discordUserId: getUser(id)!.discordUserId } : { discordUserId: id }] : [];
      },
      dlmUser: {
        upsert: async ({ where, create, update }: { where: { discordUserId: string }; create: Record<string, unknown>; update: Record<string, unknown> }) => {
          trace.push(`${name}:upsert`);
          upserts.push({ create, update });
          assert.deepEqual(update, {}, 'legacy-session upsert must not overwrite unlocked wallet fields');
          assert.ok(walletKeys.every((key) => !(key in create)), 'initial identity creation must not carry an unlocked Member snapshot');
          const existing = [...users.values(), ...stagedUsers.values()].find((entry) => entry.discordUserId === where.discordUserId);
          if (existing) return { dlmId: existing.dlmId };
          const created = { ...wallet(0), ...create } as User;
          stagedUsers.set(created.dlmId, created);
          return { dlmId: created.dlmId };
        },
        update: async ({ where, data, include }: { where: { dlmId: string }; data: Record<string, unknown>; include?: { member?: boolean } }) => {
          // A real UPDATE obtains a row lock even without an explicit SELECT.
          await acquire('DlmUser', where.dlmId);
          const current = getUser(where.dlmId);
          assert.ok(current);
          const next = applyWrite(current, data);
          stagedUsers.set(next.dlmId, next);
          trace.push(`${name}:write:DlmUser:${next.dlmId}`);
          if (include?.member) profileWrites.push(data);
          return include?.member ? { ...next, member: next.discordUserId ? getMember(next.discordUserId) ?? null : null } : next;
        },
      },
      member: {
        findUnique: async ({ where }: { where: { discordUserId: string } }) => {
          assert.ok(held.has(`Member:${where.discordUserId}`), 'mirror reads require a successfully locked Member row');
          trace.push(`${name}:read:Member:${where.discordUserId}`);
          const result = getMember(where.discordUserId);
          return result ? { ...result } : null;
        },
        update: async ({ where, data }: { where: { discordUserId: string }; data: Record<string, unknown> }) => {
          await acquire('Member', where.discordUserId);
          const current = getMember(where.discordUserId);
          assert.ok(current);
          const next = applyWrite(current, data);
          stagedMembers.set(next.discordUserId, next);
          trace.push(`${name}:write:Member:${next.discordUserId}`);
          return next;
        },
      },
      pEIWAN: { update: async () => ({}) },
    } as unknown as Prisma.TransactionClient;
    try {
      const result = await work(tx);
      await options.beforeCommit?.();
      for (const [key, row] of stagedUsers) users.set(key, row);
      for (const [key, row] of stagedMembers) members.set(key, row);
      trace.push(`${name}:commit`);
      return result;
    } catch (error) {
      trace.push(`${name}:rollback`);
      throw error;
    } finally {
      for (const release of releases.reverse()) release();
    }
  };
  return { users, members, trace, upserts, profileWrites, run };
}

const sync = (tx: Prisma.TransactionClient, source = session) => syncDiscordCurrentUserTx(tx, source, () => 'created-user');
const recharge = (tx: Prisma.TransactionClient) => applyDlmWalletDeltaTx(tx, { dlmId: 'user-a', discordUserId: 'discord-a', totalBalanceDelta: 100, rechargeDelta: 100 });

function assertRecharged(f: ReturnType<typeof fixture>) {
  for (const row of [f.users.get('user-a')!, f.members.get('discord-a')!]) {
    assert.equal(row.totalBalance.toString(), '600');
    assert.equal(row.recharge.toString(), '100');
    assert.equal(row.income.toString(), '500');
  }
}

test('profile sync waits for an in-flight recharge commit, then mirrors fresh 600 instead of stale 500', async () => {
  const f = fixture();
  const pendingCommit = deferred();
  const release = deferred();
  const paying = f.run('recharge', recharge, { beforeCommit: async () => { pendingCommit.resolve(); await release.promise; } });
  await pendingCommit.promise;
  const syncing = f.run('profile', (tx) => sync(tx));
  assert.ok(f.trace.includes('profile:request:DlmUser:user-a'));
  assert.ok(!f.trace.includes('profile:read:Member:discord-a'));
  release.resolve();
  const [, result] = await Promise.all([paying, syncing]);
  assert.equal(result?.totalBalance.toString(), '600');
  assertRecharged(f);
  assert.ok(f.trace.indexOf('recharge:commit') < f.trace.indexOf('profile:read:Member:discord-a'));
});

test('recharge waits until profile sync commits and then increments both wallets without being overwritten', async () => {
  const f = fixture();
  const pendingCommit = deferred();
  const release = deferred();
  const syncing = f.run('profile', (tx) => sync(tx), { beforeCommit: async () => { pendingCommit.resolve(); await release.promise; } });
  await pendingCommit.promise;
  assert.ok(f.trace.includes('profile:read:Member:discord-a'));
  const paying = f.run('recharge', recharge);
  assert.ok(f.trace.includes('recharge:request:DlmUser:user-a'));
  assert.ok(!f.trace.includes('recharge:write:DlmUser:user-a'));
  release.resolve();
  await Promise.all([syncing, paying]);
  assertRecharged(f);
  assert.ok(f.trace.indexOf('profile:commit') < f.trace.indexOf('profile:release:DlmUser:user-a'));
  assert.ok(f.trace.indexOf('profile:commit') < f.trace.indexOf('recharge:write:DlmUser:user-a'));
});

test('an old Discord-only session reuses identity without pre-lock wallet writes and preserves a concurrent recharge', async () => {
  const f = fixture();
  const pendingCommit = deferred();
  const release = deferred();
  const paying = f.run('recharge', recharge, { beforeCommit: async () => { pendingCommit.resolve(); await release.promise; } });
  await pendingCommit.promise;
  const syncing = f.run('legacy', (tx) => sync(tx, { ...session, dlmId: null }));
  await Promise.resolve();
  assert.equal(f.upserts.length, 1);
  assert.deepEqual(f.upserts[0].update, {});
  assert.ok(walletKeys.every((key) => !(key in f.upserts[0].create)));
  assert.ok(!f.trace.includes('legacy:read:Member:discord-a'));
  release.resolve();
  const [, result] = await Promise.all([paying, syncing]);
  assert.equal(result?.dlmId, 'user-a');
  assertRecharged(f);
});

test('an old session creates only identity metadata before locking and copies Member values after locking', async () => {
  const f = fixture(null, member(600));
  const result = await f.run('create', (tx) => sync(tx, { ...session, dlmId: undefined }));
  assert.equal(result?.dlmId, 'created-user');
  assert.equal(result?.discordUserId, 'discord-a');
  assert.equal(result?.discordDisplayName, '服务器昵称');
  assert.equal(result?.discordAvatarUrl, session.avatarUrl);
  assert.equal(result?.totalBalance.toString(), '600');
  assert.deepEqual(f.upserts[0].create, {
    dlmId: 'created-user', discordUserId: 'discord-a', discordDisplayName: session.username, discordAvatarUrl: session.avatarUrl,
  });
  assert.deepEqual(f.trace.filter((entry) => entry.includes(':acquire:')), ['create:acquire:DlmUser:created-user', 'create:acquire:Member:discord-a']);
  assert.ok(f.trace.indexOf('create:acquire:Member:discord-a') < f.trace.indexOf('create:read:Member:discord-a'));
});

test('a Member created after the missing-row lock query cannot supply an unlocked mirror snapshot', async () => {
  const f = fixture(user(500), null);
  const result = await f.run('profile', (tx) => sync(tx), {
    afterQuery: (table, found) => { if (table === 'Member' && !found) f.members.set('discord-a', member(900)); },
  });
  assert.equal(result?.totalBalance.toString(), '500');
  assert.equal(result?.income.toString(), '500');
  assert.equal(result?.discordDisplayName, session.username);
  assert.equal(f.members.get('discord-a')?.totalBalance.toString(), '900');
  assert.ok(!f.trace.some((event) => event.includes(':read:Member:')));
  assert.ok(walletKeys.every((key) => !(key in f.profileWrites[0])));
});

test('a missing DLM identity in an existing session returns null without recreating or rebinding it', async () => {
  const f = fixture(null, member());
  const result = await f.run('missing', (tx) => syncDiscordCurrentUserTx(tx, session, () => { assert.fail('must not generate another identity'); }));
  assert.equal(result, null);
  assert.equal(f.upserts.length, 0);
  assert.equal(f.profileWrites.length, 0);
  assert.equal(f.users.size, 0);
  assert.ok(!f.trace.some((event) => event.includes(':Member:')));
});

test('profile fields follow Member display name or session fallback while DLM-only loyalty points stay intact', async () => {
  const sourceMember = { ...member(), serverDisplayName: null, loyaltyPoints: dec(999) };
  const f = fixture(user(), sourceMember);
  const result = await f.run('profile', (tx) => sync(tx, { ...session, avatarUrl: null }));
  assert.equal(result?.dlmId, session.dlmId);
  assert.equal(result?.discordUserId, session.discordId);
  assert.equal(result?.discordDisplayName, session.username);
  assert.equal(result?.discordAvatarUrl, null);
  assert.equal(result?.loyaltyPoints.toString(), '17');
  assert.equal(result?.member?.serverDisplayName, null);
});


test('a session cannot restore a Discord binding that has already been detached', async () => {
  const f = fixture({ ...user(), discordUserId: null }, member());
  const result = await f.run('profile', (tx) => sync(tx));
  assert.equal(result, null);
  assert.equal(f.users.get('user-a')?.discordUserId, null);
  assert.equal(f.profileWrites.length, 0);
  assert.ok(!f.trace.some((entry) => entry.includes(':Member:')));
});

test('a session for a previous Discord owner cannot replace the current binding', async () => {
  const f = fixture({ ...user(), discordUserId: 'discord-b' }, member());
  const result = await f.run('profile', (tx) => sync(tx));
  assert.equal(result, null);
  assert.equal(f.users.get('user-a')?.discordUserId, 'discord-b');
  assert.equal(f.profileWrites.length, 0);
});

test('a profile request waiting behind Discord unlink rereads ownership after commit and does not rebind', async () => {
  const f = fixture(user(0), member(0));
  const pending = deferred(); const release = deferred();
  const detaching = f.run('unlink', (tx) => tx.dlmUser.update({ where: { dlmId: 'user-a' }, data: { discordUserId: null, discordDisplayName: null, discordAvatarUrl: null } }), {
    beforeCommit: async () => { pending.resolve(); await release.promise; },
  });
  await pending.promise;
  const syncing = f.run('profile', (tx) => sync(tx));
  assert.ok(f.trace.includes('profile:request:DlmUser:user-a'));
  assert.ok(!f.trace.includes('profile:read:Member:discord-a'));
  release.resolve();
  const [, result] = await Promise.all([detaching, syncing]);
  assert.equal(result, null);
  assert.equal(f.users.get('user-a')?.discordUserId, null);
  assert.equal(f.profileWrites.length, 0);
  assert.ok(!f.trace.includes('profile:read:Member:discord-a'));
});
