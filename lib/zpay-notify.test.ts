import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { Prisma } from '@prisma/client';
import { GET, POST } from '@/app/api/payment/zpay/notify/route';
import { prisma } from './prisma';
import { buildZPaySignature } from './zpay';

const MERCHANT_ID = 'fixture-merchant';
const SECRET = 'fixture-secret-not-a-real-payment-key';
const OUT_TRADE_NO = '202609251234567890123456789';
const GATEWAY_TRADE_NO = 'gateway-fixture-trade';

const signedParams = (changes: Record<string, string> = {}) => {
  const params = {
    pid: MERCHANT_ID,
    out_trade_no: OUT_TRADE_NO,
    trade_no: GATEWAY_TRADE_NO,
    type: 'alipay',
    money: '100.00',
    trade_status: 'TRADE_SUCCESS',
    buyer: 'private-buyer-fixture',
    name: 'private-name-fixture',
    ...changes,
  };
  return { ...params, sign: buildZPaySignature(params, SECRET), sign_type: 'MD5' };
};

const callbackRequest = (params: Record<string, string>, method: 'GET' | 'POST' = 'GET') => {
  const url = new URL('https://example.test/api/payment/zpay/notify');
  const encoded = new URLSearchParams(params);
  if (method === 'GET') {
    url.search = encoded.toString();
    return new Request(url);
  }
  return new Request(url, {
    method,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: encoded,
  });
};

// Replace every database boundary; keep the real route, copy renderer, wallet
// helpers and settlement transaction. Each fixture transaction stages its writes
// and holds the wallet lock until commit, like the production lock protocol.
const setup = (t: TestContext) => {
  const env = { ZPAY_MERCHANT_ID: MERCHANT_ID, ZPAY_SECRET_KEY: SECRET, EDITABLE_COPY_ENABLED: 'true' };
  for (const [key, value] of Object.entries(env)) {
    const previous = process.env[key];
    process.env[key] = value;
    t.after(() => { if (previous === undefined) delete process.env[key]; else process.env[key] = previous; });
  }
  const replace = (target: object, key: string, value: unknown) => {
    const descriptor = Object.getOwnPropertyDescriptor(target, key);
    Object.defineProperty(target, key, { value, configurable: true, writable: true });
    t.after(() => { if (descriptor) Object.defineProperty(target, key, descriptor); else Reflect.deleteProperty(target, key); });
  };
  const logs = t.mock.method(console, 'log', () => {});
  const errors = t.mock.method(console, 'error', () => {});
  const order = {
    id: 'fixture-payment', outTradeNo: OUT_TRADE_NO,
    amount: new Prisma.Decimal(100), status: 'PENDING' as 'PENDING' | 'PAID',
    channel: 'alipay', dlmId: 'FIXTUREUSER', discordUserId: null,
    gatewayTradeNo: null as string | null, notifyPayload: undefined as unknown,
  };
  const identity = { dlmId: order.dlmId, discordUserId: null };
  const wallet = {
    totalBalance: new Prisma.Decimal(0), recharge: new Prisma.Decimal(0), income: new Prisma.Decimal(0),
    totalSpent: new Prisma.Decimal(0), loyaltyPoints: new Prisma.Decimal(0),
  };
  type Row = Record<string, unknown>;
  const rechargeRows: Row[] = [];
  const transactionRows: Row[] = [];
  const notificationRows: Row[] = [];
  const locks: string[][] = [];
  let walletLockTail = Promise.resolve();
  const lookup = t.mock.fn(async () => ({ ...order }));
  const copyLookup = t.mock.fn(async () => ({ scope: 'site', revision: 1, activeVersion: 1 }));
  replace(prisma.editableCopyConfig, 'findUnique', copyLookup);
  replace(prisma.editableCopyVersion, 'findUnique', async () => ({
    scope: 'site', version: 1, overrides: { 'site.lib.recharge.order.transaction.133a41b10227': '公会到账提醒' },
  }));
  const transaction = t.mock.fn(async (input: unknown) => {
    assert.equal(typeof input, 'function');
    const held: string[] = [];
    locks.push(held);
    let stagedOrder: typeof order | undefined;
    let stagedWallet: typeof wallet | undefined;
    const stagedRecharge: Row[] = [], stagedTransactions: Row[] = [], stagedNotifications: Row[] = [];
    let release: (() => void) | undefined;
    let suppressed = false;
    const assertLocked = () => assert.deepEqual(held, ['DlmUser', 'ZPayRechargeOrder']);
    const tx = {
      $queryRaw: async (parts: TemplateStringsArray, id: string) => {
        const sql = parts.join('?').replace(/\s+/g, ' ').trim();
        if (sql.includes('FROM "DlmUser"')) {
          assert.equal(sql, 'SELECT "dlmId", "discordUserId" FROM "DlmUser" WHERE "dlmId" = ? FOR UPDATE');
          assert.equal(id, identity.dlmId);
          assert.equal(held.length, 0);
          const previous = walletLockTail;
          walletLockTail = new Promise<void>((resolve) => { release = resolve; });
          await previous;
          held.push('DlmUser');
          stagedOrder = { ...order }; stagedWallet = { ...wallet };
          return [{ ...identity }];
        }
        assert.equal(sql, 'SELECT "id" FROM "ZPayRechargeOrder" WHERE "outTradeNo" = ? FOR UPDATE');
        assert.equal(id, OUT_TRADE_NO);
        assert.deepEqual(held, ['DlmUser']);
        held.push('ZPayRechargeOrder');
        return [{ id: order.id }];
      },
      $executeRaw: async (parts: TemplateStringsArray) => {
        assertLocked();
        assert.match(parts.join(''), /set_config\('bot.skip_recharge_notify', 'true', true\)/);
        suppressed = true;
        return 1;
      },
      zPayRechargeOrder: {
        findUnique: async ({ where }: { where: { outTradeNo: string } }) => {
          assert.equal(where.outTradeNo, OUT_TRADE_NO);
          return { ...(stagedOrder ?? order) };
        },
        updateMany: async ({ where, data }: {
          where: { outTradeNo: string; status: string };
          data: { status: 'PAID'; gatewayTradeNo?: string; notifyPayload?: unknown };
        }) => {
          assertLocked();
          if (where.outTradeNo !== stagedOrder!.outTradeNo || where.status !== stagedOrder!.status) return { count: 0 };
          Object.assign(stagedOrder!, data);
          return { count: 1 };
        },
      },
      dlmUser: {
        findUnique: async ({ where, select }: { where: { dlmId: string }; select: Record<string, boolean> }) => {
          assert.equal(where.dlmId, identity.dlmId);
          if (select.totalBalance) assertLocked();
          return { ...identity, ...(stagedWallet ?? wallet) };
        },
        update: async ({ where, data }: { where: { dlmId: string }; data: Record<keyof typeof wallet, { increment: Prisma.Decimal }> }) => {
          assertLocked(); assert.equal(where.dlmId, identity.dlmId); assert.equal(suppressed, true);
          for (const key of Object.keys(wallet) as (keyof typeof wallet)[]) {
            stagedWallet![key] = stagedWallet![key].plus(data[key].increment);
          }
          return { ...stagedWallet };
        },
      },
      recharge: { create: async ({ data }: { data: Row }) => { assertLocked(); stagedRecharge.push(data); return data; } },
      individualTransaction: { create: async ({ data }: { data: Row }) => { assertLocked(); stagedTransactions.push(data); return data; } },
      guildNotificationOutbox: { upsert: async ({ where, create }: { where: { dedupeKey: string }; create: Row }) => {
        assertLocked(); assert.equal(suppressed, true);
        const prior = [...notificationRows, ...stagedNotifications].find(row => row.dedupeKey === where.dedupeKey);
        if (prior) return prior;
        stagedNotifications.push(create);
        return create;
      } },
    };
    try {
      const result = await (input as (tx: Prisma.TransactionClient) => Promise<unknown>)(tx as unknown as Prisma.TransactionClient);
      if (stagedOrder) Object.assign(order, stagedOrder);
      if (stagedWallet) Object.assign(wallet, stagedWallet);
      rechargeRows.push(...stagedRecharge); transactionRows.push(...stagedTransactions); notificationRows.push(...stagedNotifications);
      return result;
    } finally { release?.(); }
  });
  replace(prisma.zPayRechargeOrder, 'findUnique', lookup);
  replace(prisma, '$transaction', transaction);
  return { order, wallet, rechargeRows, transactionRows, notificationRows, lookup, copyLookup, transaction, locks, logs, errors };
};

test('ZPay refuses invalid signatures and signed notifications for another merchant before accessing orders', async (t) => {
  const fixture = setup(t);
  const valid = signedParams();
  const badSignature = await GET(callbackRequest({ ...valid, sign: '0'.repeat(32) }));
  assert.equal(badSignature.status, 400);
  assert.equal(await badSignature.text(), 'sign_error');
  const otherMerchant = await GET(callbackRequest(signedParams({ pid: 'another-merchant' })));
  assert.equal(otherMerchant.status, 400);
  assert.equal(await otherMerchant.text(), 'merchant_identity_mismatch');
  assert.equal(fixture.lookup.mock.calls.length, 0);
  assert.equal(fixture.transaction.mock.calls.length, 0);
});

test('ZPay only accepts exact TRADE_SUCCESS and valid positive amounts with at most two decimals', async (t) => {
  const fixture = setup(t);
  for (const status of ['SUCCESS', 'PAID', 'trade_success', 'TRADE_CLOSED']) {
    const response = await GET(callbackRequest(signedParams({ trade_status: status })));
    assert.equal(await response.text(), 'invalid_status');
  }
  for (const money of ['0', '-1', '100.004', 'NaN', 'Infinity', '1e2']) {
    const response = await GET(callbackRequest(signedParams({ money })));
    assert.equal(await response.text(), 'invalid_amount');
  }
  assert.equal(fixture.lookup.mock.calls.length, 0);
  assert.equal(fixture.transaction.mock.calls.length, 0);
});

test('ZPay refuses channel and order amount mismatches without modifying balances', async (t) => {
  const fixture = setup(t);
  const channelMismatch = await GET(callbackRequest(signedParams({ type: 'wxpay' })));
  assert.equal(await channelMismatch.text(), 'channel_mismatch');
  const amountMismatch = await GET(callbackRequest(signedParams({ money: '99.99' })));
  assert.equal(await amountMismatch.text(), 'amount_mismatch');
  // Channel is rejected at the route; amount is rechecked under wallet/payment locks.
  assert.equal(fixture.transaction.mock.calls.length, 1);
  assert.deepEqual(fixture.locks, [['DlmUser', 'ZPayRechargeOrder']]);
  assert.equal(fixture.order.status, 'PENDING');
  assert.equal(fixture.rechargeRows.length, 0);
  assert.equal(fixture.transactionRows.length, 0);
  assert.equal(fixture.notificationRows.length, 0);
  assert.equal(fixture.wallet.totalBalance.toString(), '0');
});

test('ZPay GET and POST duplicates credit the wallet and create financial records exactly once', async (t) => {
  const fixture = setup(t);
  const params = signedParams();
  const response = await GET(callbackRequest(params));
  const repeated = await POST(callbackRequest(params, 'POST'));
  assert.equal(response.status, 200);
  assert.equal(await response.text(), 'success');
  assert.equal(await repeated.text(), 'success');
  assert.equal(fixture.wallet.totalBalance.toString(), '100');
  assert.equal(fixture.wallet.recharge.toString(), '100');
  assert.equal(fixture.rechargeRows.length, 1);
  assert.equal(fixture.transactionRows.length, 1);
  // Every delivery checks persisted state again; only the first claims/credits.
  assert.equal(fixture.transaction.mock.calls.length, 2);
  assert.equal(fixture.copyLookup.mock.calls.length, 2);
  assert.equal(fixture.notificationRows.length, 1);
  assert.equal(fixture.notificationRows[0].title, '公会到账提醒');
  assert.equal(fixture.notificationRows[0].recipientDlmId, fixture.order.dlmId);
  assert.equal(fixture.notificationRows[0].dedupeKey, `recharge:zpay:${OUT_TRADE_NO}`);
  assert.equal(String(fixture.transactionRows[0].balanceBefore), '0');
  assert.equal(String(fixture.transactionRows[0].balanceAfter), '100');
  assert.equal(fixture.order.gatewayTradeNo, GATEWAY_TRADE_NO);
  assert.deepEqual(fixture.order.notifyPayload, {
    pid: MERCHANT_ID,
    out_trade_no: OUT_TRADE_NO,
    trade_no: GATEWAY_TRADE_NO,
    type: 'alipay',
    money: '100.00',
    trade_status: 'TRADE_SUCCESS',
  });
  const logged = JSON.stringify([...fixture.logs.mock.calls, ...fixture.errors.mock.calls].map((call) => call.arguments));
  for (const privateValue of [params.sign, params.buyer, params.name, SECRET]) {
    assert.equal(logged.includes(privateValue), false);
  }
});

test('ZPay simultaneous duplicates only allow one order claim to apply wallet credit', async (t) => {
  const fixture = setup(t);
  const params = signedParams();
  const responses = await Promise.all([
    GET(callbackRequest(params)),
    POST(callbackRequest(params, 'POST')),
  ]);
  for (const response of responses) assert.equal(await response.text(), 'success');
  assert.equal(fixture.wallet.totalBalance.toString(), '100');
  assert.equal(fixture.rechargeRows.length, 1);
  assert.equal(fixture.transactionRows.length, 1);
  assert.equal(fixture.notificationRows.length, 1);
  assert.deepEqual(fixture.locks, [['DlmUser', 'ZPayRechargeOrder'], ['DlmUser', 'ZPayRechargeOrder']]);
});

test('ZPay error logs omit exception contents, signatures, and personal data', async (t) => {
  const fixture = setup(t);
  fixture.lookup.mock.mockImplementation(async () => { throw new Error(`${SECRET}: private-buyer-fixture`); });
  const params = signedParams();
  const response = await GET(callbackRequest(params));
  assert.equal(await response.text(), 'internal_error');
  const logged = JSON.stringify(fixture.errors.mock.calls.map((call) => call.arguments));
  assert.equal(logged.includes(SECRET), false);
  assert.equal(logged.includes(params.buyer), false);
  assert.equal(logged.includes(params.sign), false);
  assert.equal(fixture.transaction.mock.calls.length, 0);
});
