import { createSiteCopy } from './site-copy';
import assert from 'node:assert/strict';
import test from 'node:test';
import { Prisma } from '@prisma/client';
import { settleRechargeOrderPaymentTx, type RechargeOrderProvider, type SettleRechargeOrderInput } from './recharge-order-transaction';
import { DlmWalletIdentityChangedError, lockDlmWalletsTx } from './dlm-wallet-lock';

type Row = Record<string, unknown>;
type Table = 'DlmUser' | 'Member' | 'StripePayment' | 'ZPayRechargeOrder' | 'WechatNativePayment' | 'PEIWAN';
const providers = ['stripe', 'zpay', 'wechat_native'] as const;
const paymentTables = { stripe: 'StripePayment', zpay: 'ZPayRechargeOrder', wechat_native: 'WechatNativePayment' } as const;
const decimal = (value: Prisma.Decimal | string | number) => new Prisma.Decimal(value);
const wallet = (balance: number) => ({ totalBalance: decimal(balance), recharge: decimal(0), income: decimal(0), totalSpent: decimal(0), loyaltyPoints: decimal(0) });
const user = (dlmId = 'owner', discordUserId: string | null = 'discord-current', balance = 10) => ({ dlmId, discordUserId, ...wallet(balance) });
const payment = (provider: RechargeOrderProvider, outTradeNo = 'order-1', overrides: Row = {}): Row => ({
  id: `${provider}:${outTradeNo}`, outTradeNo, dlmId: 'owner', discordUserId: 'discord-current',
  amount: decimal(25), rechargeAmount: decimal(25), status: 'PENDING', paymentStatus: 'SUCCEEDED', ...overrides,
});
const input = (provider: RechargeOrderProvider, overrides: Partial<SettleRechargeOrderInput> = {}): SettleRechargeOrderInput => ({
  outTradeNo: 'order-1', amount: 25, orderProvider: provider, payerReference: 'provider-transaction', ...overrides,
});
const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
};
const matches = (row: Row, where: Row) => Object.entries(where).every(([key, value]) => row[key] === value);
const selected = (row: Row, select?: Row) => select ? Object.fromEntries(Object.keys(select).map((key) => [key, row[key]])) : { ...row };
const write = (row: Row, data: Row) => {
  const next = { ...row };
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined) continue;
    next[key] = value && typeof value === 'object' && 'increment' in value
      ? decimal(row[key] as Prisma.Decimal).add(value.increment as Prisma.Decimal) : value;
  }
  return next;
};

/** Persistence adapter only: row locks, statement-current reads, staged writes,
 * rollback and unknown commit outcomes. The production helpers make all credit
 * and ownership decisions; no database or provider is loaded by these tests.
 */
function fixture(options: { users?: Row[]; members?: Row[]; payments?: Partial<Record<RechargeOrderProvider, Row[]>> } = {}) {
  const users = options.users ?? [user()];
  const members = options.members ?? users.flatMap((row) => row.discordUserId ? [{ ...wallet(Number(row.totalBalance)), discordUserId: row.discordUserId }] : []);
  const tables = new Map<Table, Map<string, Row>>();
  tables.set('DlmUser', new Map(users.map((row) => [String(row.dlmId), row])));
  tables.set('Member', new Map(members.map((row) => [String(row.discordUserId), row])));
  tables.set('PEIWAN', new Map(members.map((row) => [String(row.discordUserId), { discordUserId: row.discordUserId, balance: row.totalBalance }])));
  for (const provider of providers) tables.set(paymentTables[provider], new Map((options.payments?.[provider] ?? [payment(provider)]).map((row) => [String(row.outTradeNo), row])));
  const recharge: Row[] = [];
  const ledger: Row[] = [];
  const notices: Row[] = [];
  const trace: string[] = [];
  const tails = new Map<string, Promise<void>>();
  let attempts = 0;

  async function run<T>(name: string, work: (tx: Prisma.TransactionClient) => Promise<T>, hooks: {
    beforeCommit?: () => Promise<void>;
    afterLock?: (table: Table, id: string) => Promise<void>;
    afterRead?: (table: Table, id: string, held: boolean) => Promise<void>;
    beforeLock?: (table: Table, id: string) => void;
    failLedger?: boolean; unknownCommit?: boolean; failNotification?: boolean;
  } = {}) {
    attempts += 1;
    const pending = new Map<Table, Map<string, Row | null>>();
    const pendingRecharge: Row[] = [];
    const pendingLedger: Row[] = [];
    const pendingNotices: Row[] = [];
    let suppressed = false;
    const held = new Set<string>();
    const release: Array<() => void> = [];
    const read = (table: Table, id: string): Row | null => pending.get(table)?.has(id)
      ? pending.get(table)!.get(id) ?? null : tables.get(table)!.get(id) ?? null;
    const rows = (table: Table) => [...new Set([...tables.get(table)!.keys(), ...(pending.get(table)?.keys() ?? [])])]
      .map((id) => ({ id, row: read(table, id) })).filter((entry): entry is { id: string; row: Row } => !!entry.row);
    const stage = (table: Table, id: string, row: Row | null) => {
      if (!pending.has(table)) pending.set(table, new Map());
      pending.get(table)!.set(id, row);
    };
    const acquire = async (table: Table, id: string) => {
      const key = `${table}:${id}`;
      if (held.has(key)) return;
      hooks.beforeLock?.(table, id);
      trace.push(`${name}:wait:${key}`);
      const previous = tails.get(key) ?? Promise.resolve();
      const done = deferred();
      tails.set(key, previous.then(() => done.promise));
      await previous;
      held.add(key);
      release.push(done.resolve);
      trace.push(`${name}:lock:${key}`);
      await hooks.afterLock?.(table, id);
    };
    const delegate = (table: Table) => ({
      findUnique: async ({ where, select }: { where: Row; select?: Row }) => {
        const found = rows(table).find(({ row }) => matches(row, where));
        if (!found) return null;
        const locked = held.has(`${table}:${found.id}`);
        if (['DlmUser', 'Member'].includes(table) && (!select || ['totalBalance', 'income', 'recharge', 'totalSpent'].some((key) => select[key]))) {
          assert.ok(locked, `unlocked wallet read: ${table}:${found.id}`);
          trace.push(`${name}:wallet-read:${table}:${found.id}`);
        }
        const result = selected(found.row, select);
        await hooks.afterRead?.(table, found.id, locked);
        return result;
      },
      update: async ({ where, data, select }: { where: Row; data: Row; select?: Row }) => {
        const found = rows(table).find(({ row }) => matches(row, where));
        if (!found) throw new Error('row_not_found');
        await acquire(table, found.id);
        const next = write(read(table, found.id)!, data);
        stage(table, found.id, next);
        return selected(next, select);
      },
      updateMany: async ({ where, data }: { where: Row; data: Row }) => {
        let count = 0;
        for (const found of rows(table).filter(({ row }) => matches(row, where))) {
          await acquire(table, found.id);
          const current = read(table, found.id);
          if (!current || !matches(current, where)) continue;
          stage(table, found.id, write(current, data));
          trace.push(`${name}:claim:${table}:${found.id}`);
          count += 1;
        }
        return { count };
      },
      delete: async ({ where }: { where: Row }) => {
        const found = rows(table).find(({ row }) => matches(row, where));
        if (!found) throw new Error('row_not_found');
        await acquire(table, found.id);
        stage(table, found.id, null);
        return found.row;
      },
    });
    const tx = {
      $executeRaw: async (parts: TemplateStringsArray) => { assert.match(parts.join(''), /set_config\('bot.skip_recharge_notify', 'true', true\)/); suppressed = true; return 1; },
      guildNotificationOutbox: { upsert: async ({ where, create }: any) => {
        assert(suppressed); if (hooks.failNotification) throw new Error('offline_notification_failure');
        const prior = [...notices, ...pendingNotices].find(row => row.dedupeKey === where.dedupeKey);
        if (prior) return prior; pendingNotices.push(create); return create;
      } },
      $queryRaw: async (parts: TemplateStringsArray, id: string) => {
        const sql = parts.join('?').replace(/\s+/g, ' ').trim();
        const match = sql.match(/^SELECT (.+) FROM "(DlmUser|Member|StripePayment|ZPayRechargeOrder|WechatNativePayment)" WHERE "(?:dlmId|discordUserId|outTradeNo)" = \? FOR UPDATE$/);
        assert.ok(match, `unexpected SQL: ${sql}`);
        const table = match[2] as Table;
        if (read(table, id)) await acquire(table, id);
        return read(table, id) ? [{ ...read(table, id) }] : [];
      },
      dlmUser: delegate('DlmUser'), member: delegate('Member'), pEIWAN: delegate('PEIWAN'),
      stripePayment: delegate('StripePayment'), zPayRechargeOrder: delegate('ZPayRechargeOrder'), wechatNativePayment: delegate('WechatNativePayment'),
      recharge: { create: async ({ data }: { data: Row }) => { pendingRecharge.push(data); return data; } },
      individualTransaction: { create: async ({ data }: { data: Row }) => {
        if (hooks.failLedger) throw new Error('offline_ledger_failure');
        pendingLedger.push(data); return data;
      } },
    } as unknown as Prisma.TransactionClient;
    try {
      const result = await work(tx);
      await hooks.beforeCommit?.();
      for (const [table, mutations] of pending) for (const [id, row] of mutations) {
        if (row) tables.get(table)!.set(id, row); else tables.get(table)!.delete(id);
      }
      recharge.push(...pendingRecharge);
      ledger.push(...pendingLedger);
      notices.push(...pendingNotices);
      if (hooks.unknownCommit) throw new Error('unknown_commit_outcome');
      return result;
    } finally { release.reverse().forEach((done) => done()); }
  }
  return {
    run, trace, recharge, ledger, notices, attempts: () => attempts,
    get: (table: Table, id: string) => tables.get(table)!.get(id),
  };
}

for (const provider of providers) {
  test(`${provider}: locks DLM then Member then payment and credits both wallets once`, async () => {
    const f = fixture();
    assert.deepEqual(await f.run('first', (tx) => settleRechargeOrderPaymentTx(tx, input(provider))), { kind: 'paid', dlmId: 'owner' });
    assert.deepEqual(await f.run('duplicate', (tx) => settleRechargeOrderPaymentTx(tx, input(provider))), { kind: 'already_paid' });
    assert.deepEqual(f.trace.filter((line) => line.startsWith('first:lock:')).slice(0, 3), [
      'first:lock:DlmUser:owner', 'first:lock:Member:discord-current', `first:lock:${paymentTables[provider]}:order-1`,
    ]);
    assert.equal(String(f.get('DlmUser', 'owner')?.totalBalance), '35');
    assert.equal(String(f.get('Member', 'discord-current')?.totalBalance), '35');
    assert.equal(String(f.get('PEIWAN', 'discord-current')?.balance), '35');
    assert.equal(f.recharge.length, 1);
    assert.equal(f.notices.length, 1);
    assert.equal(f.notices[0].recipientDlmId, 'owner');
    assert.equal(f.notices[0].recipientDiscordId, 'discord-current');
    assert.equal(f.notices[0].dedupeKey, `recharge:${provider}:order-1`);
    assert.equal(f.ledger.length, 1);
    assert.equal(String(f.ledger[0].balanceBefore), '10');
    assert.equal(String(f.ledger[0].balanceAfter), '35');
    assert.equal(f.ledger[0].thirdPartydiscordId, 'provider-transaction');
  });

  test(`${provider}: two distinct concurrent recharges see the preceding committed balance`, async () => {
    const f = fixture({ payments: { [provider]: [payment(provider), payment(provider, 'order-2')] } });
    const held = deferred();
    const release = deferred();
    const waiting = deferred();
    const first = f.run('first', (tx) => settleRechargeOrderPaymentTx(tx, input(provider)), {
      beforeCommit: async () => { held.resolve(); await release.promise; },
    });
    await held.promise;
    const second = f.run('second', (tx) => settleRechargeOrderPaymentTx(tx, input(provider, { outTradeNo: 'order-2' })), {
      beforeLock: (table) => { if (table === 'DlmUser') waiting.resolve(); },
    });
    await waiting.promise;
    assert.equal(f.ledger.length, 0);
    release.resolve();
    assert.deepEqual(await Promise.all([first, second]), [{ kind: 'paid', dlmId: 'owner' }, { kind: 'paid', dlmId: 'owner' }]);
    assert.equal(String(f.get('Member', 'discord-current')?.totalBalance), '60');
    assert.deepEqual(f.ledger.map((row) => [String(row.balanceBefore), String(row.balanceAfter)]), [['10', '35'], ['35', '60']]);
  });

  test(`${provider}: overlapping deliveries of one payment create one credit`, async () => {
    const f = fixture();
    const result = await Promise.all([
      f.run('first', (tx) => settleRechargeOrderPaymentTx(tx, input(provider))),
      f.run('second', (tx) => settleRechargeOrderPaymentTx(tx, input(provider))),
    ]);
    assert.deepEqual(result.map((entry) => entry.kind).sort(), ['already_paid', 'paid']);
    assert.equal(f.ledger.length, 1);
    assert.equal(String(f.get('DlmUser', 'owner')?.totalBalance), '35');
  });

  test(`${provider}: ledger failure rolls back claim, both wallets and recharge record`, async () => {
    const f = fixture();
    await assert.rejects(f.run('failed', (tx) => settleRechargeOrderPaymentTx(tx, input(provider)), { failLedger: true }), /offline_ledger_failure/);
    assert.equal(f.get(paymentTables[provider], 'order-1')?.status, 'PENDING');
    assert.equal(String(f.get('DlmUser', 'owner')?.totalBalance), '10');
    assert.equal(String(f.get('Member', 'discord-current')?.totalBalance), '10');
    assert.equal(f.recharge.length, 0);
    assert.equal(f.ledger.length, 0);
  });

  test(`${provider}: unknown commit is not retried and a later delivery sees paid`, async () => {
    const f = fixture();
    await assert.rejects(f.run('uncertain', (tx) => settleRechargeOrderPaymentTx(tx, input(provider)), { unknownCommit: true }), /unknown_commit_outcome/);
    assert.equal(f.attempts(), 1);
    assert.equal(f.ledger.length, 1);
    assert.deepEqual(await f.run('redelivery', (tx) => settleRechargeOrderPaymentTx(tx, input(provider))), { kind: 'already_paid' });
    assert.equal(f.ledger.length, 1);
  });
}

test('merged payment uses its current DLM binding, preserving historical payment Discord snapshot', async () => {
  for (const historical of [null, 'discord-old']) {
    const f = fixture({
      members: [{ discordUserId: 'discord-current', ...wallet(10) }, { discordUserId: 'discord-old', ...wallet(99) }],
      payments: { stripe: [payment('stripe', 'order-1', { discordUserId: historical })] },
    });
    await f.run('credit', (tx) => settleRechargeOrderPaymentTx(tx, input('stripe')));
    assert.equal(String(f.get('Member', 'discord-old')?.totalBalance), '99');
    assert.equal(String(f.get('Member', 'discord-current')?.totalBalance), '35');
    assert.equal(f.get('StripePayment', 'order-1')?.discordUserId, historical);
    assert.equal(f.recharge[0].toWhom, 'discord-current');
    assert.equal(f.ledger[0].discordId, 'discord-current');
  }
});

test('DLM-only current owner never credits a historical Member', async () => {
  const f = fixture({ users: [user('owner', null)], members: [{ discordUserId: 'discord-old', ...wallet(99) }], payments: { zpay: [payment('zpay', 'order-1', { discordUserId: 'discord-old' })] } });
  await f.run('credit', (tx) => settleRechargeOrderPaymentTx(tx, input('zpay')));
  assert.equal(String(f.get('DlmUser', 'owner')?.totalBalance), '35');
  assert.equal(String(f.get('Member', 'discord-old')?.totalBalance), '99');
  assert.equal(f.ledger[0].discordId, null);
  assert.equal(f.recharge[0].toWhom, null);
  assert.ok(!f.trace.some((entry) => entry.includes(':lock:Member:')));
});

test('Stripe paid result names the final recipient; duplicate deliveries carry no notification recipient', async () => {
  // A lifecycle handler may have read the old owner before a completed merge.
  // It must use the settlement result, never that earlier provider snapshot.
  const f = fixture({
    users: [user('canonical', 'discord-current')],
    payments: { stripe: [payment('stripe', 'order-1', { dlmId: 'canonical', discordUserId: null })] },
  });
  const paid = await f.run('paid', (tx) => settleRechargeOrderPaymentTx(tx, input('stripe')));
  assert.deepEqual(paid, { kind: 'paid', dlmId: 'canonical' });
  const duplicate = await f.run('duplicate', (tx) => settleRechargeOrderPaymentTx(tx, input('stripe')));
  assert.deepEqual(duplicate, { kind: 'already_paid' });
  assert.equal('dlmId' in duplicate, false);
  assert.equal(f.ledger.length, 1);
});

test('missing bound Member aborts instead of creating a zero wallet', async () => {
  const f = fixture({ members: [] });
  await assert.rejects(f.run('credit', (tx) => settleRechargeOrderPaymentTx(tx, input('zpay'))), DlmWalletIdentityChangedError);
  assert.equal(f.get('ZPayRechargeOrder', 'order-1')?.status, 'PENDING');
  assert.equal(f.ledger.length, 0);
});

test('binding changed while waiting for DLM lock aborts before any payment claim', async () => {
  const f = fixture({ members: [{ discordUserId: 'discord-current', ...wallet(10) }, { discordUserId: 'discord-new', ...wallet(90) }] });
  const held = deferred();
  const release = deferred();
  const waiting = deferred();
  const binding = f.run('bind', async (tx) => {
    await lockDlmWalletsTx(tx, [{ dlmId: 'owner', discordUserId: 'discord-current' }]);
    await tx.dlmUser.update({ where: { dlmId: 'owner' }, data: { discordUserId: 'discord-new' } });
  }, { beforeCommit: async () => { held.resolve(); await release.promise; } });
  await held.promise;
  const credit = f.run('credit', (tx) => settleRechargeOrderPaymentTx(tx, input('zpay')), { beforeLock: () => waiting.resolve() });
  const rejected = assert.rejects(credit, DlmWalletIdentityChangedError);
  await waiting.promise;
  release.resolve();
  await Promise.all([binding, rejected]);
  assert.ok(!f.trace.some((entry) => entry.startsWith('credit:claim:')));
  assert.equal(f.ledger.length, 0);
  assert.equal(String(f.get('Member', 'discord-current')?.totalBalance), '10');
  assert.equal(String(f.get('Member', 'discord-new')?.totalBalance), '90');
});

test('merge winning the DLM lock aborts stale route; redelivery credits the canonical current owner', async () => {
  const f = fixture({ users: [user('owner', null, 10), user('canonical', 'discord-current', 100)] });
  const held = deferred();
  const release = deferred();
  const waiting = deferred();
  // Only the merge's resource-lock/ownership operations are modeled here;
  // full account migration behavior has its own independent test suite.
  const merge = f.run('merge', async (tx) => {
    await lockDlmWalletsTx(tx, [{ dlmId: 'owner', discordUserId: null }, { dlmId: 'canonical', discordUserId: 'discord-current' }]);
    await tx.dlmUser.update({ where: { dlmId: 'canonical' }, data: { totalBalance: { increment: 10 } } });
    await tx.member.update({ where: { discordUserId: 'discord-current' }, data: { totalBalance: { increment: 10 } } });
    await tx.zPayRechargeOrder.updateMany({ where: { dlmId: 'owner' }, data: { dlmId: 'canonical' } });
    await tx.dlmUser.delete({ where: { dlmId: 'owner' } });
  }, { beforeCommit: async () => { held.resolve(); await release.promise; } });
  await held.promise;
  const credit = f.run('credit', (tx) => settleRechargeOrderPaymentTx(tx, input('zpay')), { beforeLock: () => waiting.resolve() });
  const rejected = assert.rejects(credit, DlmWalletIdentityChangedError);
  await waiting.promise;
  release.resolve();
  await Promise.all([merge, rejected]);
  assert.equal(f.ledger.length, 0);
  assert.deepEqual(await f.run('redelivery', (tx) => settleRechargeOrderPaymentTx(tx, input('zpay'))), { kind: 'paid', dlmId: 'canonical' });
  assert.equal(f.ledger[0].dlmId, 'canonical');
  assert.equal(f.ledger[0].discordId, 'discord-current');
  assert.equal(String(f.ledger[0].balanceBefore), '110');
  assert.equal(String(f.ledger[0].balanceAfter), '135');
});

test('payment owner changing while waiting for the payment lock aborts the entire transaction', async () => {
  const f = fixture({ users: [user(), user('canonical', null, 100)] });
  const held = deferred();
  const release = deferred();
  const waiting = deferred();
  const reassign = f.run('reassign', async (tx) => {
    await tx.zPayRechargeOrder.updateMany({ where: { outTradeNo: 'order-1' }, data: { dlmId: 'canonical' } });
  }, { beforeCommit: async () => { held.resolve(); await release.promise; } });
  await held.promise;
  const credit = f.run('credit', (tx) => settleRechargeOrderPaymentTx(tx, input('zpay')), { beforeLock: (table) => { if (table === 'ZPayRechargeOrder') waiting.resolve(); } });
  const rejected = assert.rejects(credit, DlmWalletIdentityChangedError);
  await waiting.promise;
  release.resolve();
  await Promise.all([reassign, rejected]);
  assert.equal(f.get('ZPayRechargeOrder', 'order-1')?.status, 'PENDING');
  assert.equal(String(f.get('Member', 'discord-current')?.totalBalance), '10');
  assert.equal(f.ledger.length, 0);
});

test('recharge winning the wallet lock completes before a waiting merge reads its final balance', async () => {
  const f = fixture({ users: [user('owner', null, 10), user('canonical', 'discord-current', 100)] });
  const held = deferred();
  const release = deferred();
  const waiting = deferred();
  const credit = f.run('credit', (tx) => settleRechargeOrderPaymentTx(tx, input('zpay')), {
    afterLock: async (table) => { if (table === 'DlmUser') { held.resolve(); await release.promise; } },
  });
  await held.promise;
  const merge = f.run('merge', async (tx) => {
    await lockDlmWalletsTx(tx, [{ dlmId: 'owner', discordUserId: null }, { dlmId: 'canonical', discordUserId: 'discord-current' }]);
    const incoming = await tx.dlmUser.findUnique({ where: { dlmId: 'owner' }, select: { totalBalance: true } });
    assert.ok(incoming);
    await tx.dlmUser.update({ where: { dlmId: 'canonical' }, data: { totalBalance: { increment: incoming.totalBalance } } });
    await tx.member.update({ where: { discordUserId: 'discord-current' }, data: { totalBalance: { increment: incoming.totalBalance } } });
    await tx.zPayRechargeOrder.updateMany({ where: { dlmId: 'owner' }, data: { dlmId: 'canonical' } });
    await tx.dlmUser.delete({ where: { dlmId: 'owner' } });
  }, { beforeLock: (table, id) => { if (table === 'DlmUser' && id === 'owner') waiting.resolve(); } });
  await waiting.promise;
  assert.ok(!f.trace.some((entry) => entry.startsWith('merge:lock:ZPayRechargeOrder')));
  release.resolve();
  assert.deepEqual(await credit, { kind: 'paid', dlmId: 'owner' });
  await merge;
  assert.equal(String(f.get('Member', 'discord-current')?.totalBalance), '135');
  assert.equal(f.get('ZPayRechargeOrder', 'order-1')?.status, 'PAID');
  assert.equal(f.get('ZPayRechargeOrder', 'order-1')?.dlmId, 'canonical');
  assert.equal(f.ledger.length, 1);
});

test('original Stripe policy checks lifecycle at the webhook entry and retains only the payment-status claim inside credit', async () => {
  for (const paymentStatus of ['REFUNDED', 'DISPUTED', 'DISPUTE_CLOSED', 'PARTIALLY_REFUNDED']) {
    const f = fixture();
    const held = deferred();
    const release = deferred();
    const waiting = deferred();
    const risk = f.run('risk', async (tx) => {
      await tx.stripePayment.updateMany({ where: { outTradeNo: 'order-1' }, data: { paymentStatus: paymentStatus as 'REFUNDED' } });
    }, { beforeCommit: async () => { held.resolve(); await release.promise; } });
    await held.promise;
    const credit = f.run('credit', (tx) => settleRechargeOrderPaymentTx(tx, input('stripe')), { beforeLock: (table) => { if (table === 'StripePayment') waiting.resolve(); } });
    await waiting.promise;
    release.resolve();
    await risk;
    // The success webhook passed its lifecycle check before this delayed
    // risk update. Decision 19 restores that original timing boundary.
    assert.deepEqual(await credit, { kind: 'paid', dlmId: 'owner' });
    assert.equal(f.ledger.length, 1);
    assert.equal(f.get('StripePayment', 'order-1')?.status, 'PAID');
    assert.equal(f.get('StripePayment', 'order-1')?.paymentStatus, paymentStatus);
    assert.deepEqual(await f.run('duplicate', (tx) => settleRechargeOrderPaymentTx(tx, input('stripe'))), { kind: 'already_paid' });
    assert.equal(f.ledger.length, 1);
  }
});

test('amount and terminal status are evaluated after the payment lock', async () => {
  for (const change of [{ amount: decimal(30) }, { status: 'FAILED' as const }]) {
    const f = fixture();
    const held = deferred();
    const release = deferred();
    const waiting = deferred();
    const modify = f.run('modify', async (tx) => {
      await tx.zPayRechargeOrder.updateMany({ where: { outTradeNo: 'order-1' }, data: change });
    }, { beforeCommit: async () => { held.resolve(); await release.promise; } });
    await held.promise;
    const credit = f.run('credit', (tx) => settleRechargeOrderPaymentTx(tx, input('zpay')), { beforeLock: (table) => { if (table === 'ZPayRechargeOrder') waiting.resolve(); } });
    await waiting.promise;
    release.resolve();
    await modify;
    assert.deepEqual(await credit, 'amount' in change
      ? { kind: 'amount_mismatch', expected: '30.00', received: '25.00' }
      : { kind: 'invalid_order', reason: 'unexpected_status:FAILED' });
    assert.equal(f.ledger.length, 0);
  }
});

test('Wechat and ZPay retain their original status-only claim eligibility', async () => {
  for (const provider of ['wechat_native', 'zpay'] as const) {
    const f = fixture({ payments: { [provider]: [payment(provider, 'order-1', { paymentStatus: 'PENDING' })] } });
    assert.deepEqual(await f.run('credit', (tx) => settleRechargeOrderPaymentTx(tx, input(provider))), { kind: 'paid', dlmId: 'owner' });
  }
});

test('missing order and missing DLM FK return existing business results without creating identities', async () => {
  const absent = fixture({ payments: { zpay: [] } });
  assert.deepEqual(await absent.run('credit', (tx) => settleRechargeOrderPaymentTx(tx, input('zpay'))), { kind: 'not_found' });
  const unowned = fixture({ payments: { zpay: [payment('zpay', 'order-1', { dlmId: null })] } });
  assert.deepEqual(await unowned.run('credit', (tx) => settleRechargeOrderPaymentTx(tx, input('zpay'))), { kind: 'invalid_order', reason: 'missing_dlm_id' });
  assert.equal(absent.ledger.length + unowned.ledger.length, 0);
});

for (const provider of providers) {
  test(`${provider}: notification enqueue failure rolls back wallet, payment claim and accounting`, async () => {
    const f = fixture();
    await assert.rejects(f.run('failed', tx => settleRechargeOrderPaymentTx(tx, input(provider)), { failNotification: true }), /offline_notification_failure/);
    assert.equal(String(f.get('Member', 'discord-current')?.totalBalance), '10');
    assert.equal(f.get(paymentTables[provider], 'order-1')?.status, 'PENDING');
    assert.equal(f.recharge.length, 0); assert.equal(f.ledger.length, 0); assert.equal(f.notices.length, 0);
  });
  test(`${provider}: DLM-only credit queues a skipped Discord task without creating an identity`, async () => {
    const f = fixture({ users: [user('owner', null)] });
    await f.run('only-dlm', tx => settleRechargeOrderPaymentTx(tx, input(provider)));
    assert.equal(f.notices.length, 1); assert.equal(f.notices[0].status, 'SKIPPED'); assert.equal(f.notices[0].recipientDiscordId, null);
  });
}

for (const provider of providers) test(`${provider}: published wording changes only the queued notice, not its credit or dedupe identity`, async () => {
  const original = fixture();
  const customized = fixture();
  const titleKeys = { stripe: 'site.lib.recharge.order.transaction.62a89cc85f1f', zpay: 'site.lib.recharge.order.transaction.133a41b10227', wechat_native: 'site.lib.recharge.order.transaction.00a17e777b24' };
  const copy = createSiteCopy({ [titleKeys[provider]]: '公会到账提醒', 'site.lib.recharge.order.transaction.eb6422730363': '到账 {value1}，余额 {value2}。' });
  await original.run('baseline', tx => settleRechargeOrderPaymentTx(tx, input(provider)));
  await customized.run('custom', tx => settleRechargeOrderPaymentTx(tx, input(provider), copy));
  assert.equal(customized.notices[0].title, '公会到账提醒');
  assert.equal(customized.notices[0].body, '到账 25.00，余额 35。');
  for (const field of ['dedupeKey', 'recipientDlmId', 'recipientDiscordId', 'event', 'href']) assert.equal(customized.notices[0][field], original.notices[0][field]);
  assert.deepEqual(customized.ledger, original.ledger);
  assert.equal(String(customized.get('DlmUser', 'owner')?.totalBalance), '35');
  assert.deepEqual(await customized.run('replay', tx => settleRechargeOrderPaymentTx(tx, input(provider), createSiteCopy())), { kind: 'already_paid' });
  assert.equal(customized.notices.length, 1);
});
