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

// Every DB operation in these tests is replaced before a callback is invoked.
const setup = (t: TestContext) => {
  const previousMerchant = process.env.ZPAY_MERCHANT_ID;
  const previousSecret = process.env.ZPAY_SECRET_KEY;
  process.env.ZPAY_MERCHANT_ID = MERCHANT_ID;
  process.env.ZPAY_SECRET_KEY = SECRET;
  t.after(() => {
    if (previousMerchant === undefined) delete process.env.ZPAY_MERCHANT_ID;
    else process.env.ZPAY_MERCHANT_ID = previousMerchant;
    if (previousSecret === undefined) delete process.env.ZPAY_SECRET_KEY;
    else process.env.ZPAY_SECRET_KEY = previousSecret;
  });

  const logs = t.mock.method(console, 'log', () => {});
  const errors = t.mock.method(console, 'error', () => {});
  const order = {
    outTradeNo: OUT_TRADE_NO,
    amount: new Prisma.Decimal(100),
    status: 'PENDING' as 'PENDING' | 'PAID',
    channel: 'alipay',
    jinleeId: 'FIXTUREUSER',
    discordUserId: null,
    gatewayTradeNo: null as string | null,
    notifyPayload: undefined as unknown,
  };
  const wallet = {
    totalBalance: new Prisma.Decimal(0),
    recharge: new Prisma.Decimal(0),
    income: new Prisma.Decimal(0),
    totalSpent: new Prisma.Decimal(0),
    loyaltyPoints: new Prisma.Decimal(0),
  };
  const rechargeRows: unknown[] = [];
  const transactionRows: unknown[] = [];
  const tx = {
    zPayRechargeOrder: {
      updateMany: async ({ where, data }: {
        where: { outTradeNo: string; status: string };
        data: { status: 'PAID'; gatewayTradeNo?: string; notifyPayload?: unknown };
      }) => {
        if (where.outTradeNo !== order.outTradeNo || where.status !== order.status) return { count: 0 };
        order.status = data.status;
        order.gatewayTradeNo = data.gatewayTradeNo ?? null;
        order.notifyPayload = data.notifyPayload;
        return { count: 1 };
      },
    },
    jinleeUser: {
      findUnique: async () => ({ ...wallet }),
      update: async ({ data }: { data: Record<keyof typeof wallet, { increment: Prisma.Decimal }> }) => {
        for (const key of Object.keys(wallet) as (keyof typeof wallet)[]) {
          wallet[key] = wallet[key].plus(data[key].increment);
        }
        return { ...wallet };
      },
    },
    recharge: { create: async ({ data }: { data: unknown }) => { rechargeRows.push(data); } },
    individualTransaction: { create: async ({ data }: { data: unknown }) => { transactionRows.push(data); } },
  };
  const delegate = prisma.zPayRechargeOrder;
  const originalLookup = delegate.findUnique;
  const originalTransaction = prisma.$transaction;
  const lookup = t.mock.fn(async () => ({ ...order }));
  const transaction = t.mock.fn(async (input: unknown) => {
    assert.equal(typeof input, 'function');
    return (input as (tx: Prisma.TransactionClient) => Promise<unknown>)(tx as unknown as Prisma.TransactionClient);
  });
  Object.defineProperty(delegate, 'findUnique', { value: lookup, configurable: true, writable: true });
  Object.defineProperty(prisma, '$transaction', { value: transaction, configurable: true, writable: true });
  t.after(() => {
    Object.defineProperty(delegate, 'findUnique', { value: originalLookup, configurable: true, writable: true });
    Object.defineProperty(prisma, '$transaction', { value: originalTransaction, configurable: true, writable: true });
  });
  return { order, wallet, rechargeRows, transactionRows, lookup, transaction, logs, errors };
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
  assert.equal(fixture.transaction.mock.calls.length, 0);
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
  assert.equal(fixture.transaction.mock.calls.length, 1);
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
