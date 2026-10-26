import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { Prisma } from '@prisma/client';
import { POST } from '@/app/api/stripe/recharge/order/route';
import { prisma } from './prisma';
import {
  fetchStripeRechargePresetPrices,
  fetchStripeRechargePriceId,
  findStripeRechargePrice,
} from './stripe-recharge';

const SECRET = 'fixture-stripe-key';
const AMOUNTS = [500, 1000, 2000, 5000];

const stripePrice = (amount: number) => ({
  id: `price_fixture_${amount}`,
  lookup_key: `recharge_${amount}`,
  active: true,
  type: 'one_time',
  currency: 'cny',
  unit_amount: amount * 100,
  currency_options: {
    gbp: { unit_amount: amount * 12 },
    eur: { unit_amount: amount * 14 },
    usd: { unit_amount: amount * 16 },
    cad: { unit_amount: amount * 22 },
  } as Record<string, { unit_amount: number | null; unit_amount_decimal?: string }>,
});

const setupOrder = (t: TestContext) => {
  const replace = (target: object, key: string, value: unknown) => {
    const descriptor = Object.getOwnPropertyDescriptor(target, key);
    Object.defineProperty(target, key, { value, configurable: true, writable: true });
    t.after(() => {
      if (descriptor) Object.defineProperty(target, key, descriptor);
      else Reflect.deleteProperty(target, key);
    });
  };
  const previousKey = process.env.STRIPE_SECRET_KEY;
  process.env.STRIPE_SECRET_KEY = SECRET;
  t.after(() => {
    if (previousKey === undefined) delete process.env.STRIPE_SECRET_KEY;
    else process.env.STRIPE_SECRET_KEY = previousKey;
  });

  const session = {
    id: 'fixture-session',
    dlmId: 'FIXTUREUSER',
    providerAccountId: 'fixture-binding',
    providerAccount: { id: 'fixture-binding', dlmId: 'FIXTUREUSER', provider: 'WECHAT_MINIPROGRAM' },
    dlmUser: { dlmId: 'FIXTUREUSER', discordUserId: null },
    expiresAt: new Date(Date.now() + 60_000),
  };
  const state = { priorRechargeCount: 1 };
  const create = t.mock.fn(async ({ data }: { data: Prisma.StripePaymentUncheckedCreateInput }) => data);
  const update = t.mock.fn(async () => ({}));
  const updateMany = t.mock.fn(async () => ({ count: 1 }));
  replace(prisma.wechatProgramSession, 'findUnique', async () => session);
  replace(prisma.wechatProgramSession, 'update', async () => session);
  replace(prisma.recharge, 'count', async () => state.priorRechargeCount);
  replace(prisma.stripePayment, 'create', create);
  replace(prisma.stripePayment, 'update', update);
  replace(prisma.stripePayment, 'updateMany', updateMany);
  t.mock.method(console, 'error', () => {});
  return { create, update, updateMany, state };
};

const orderRequest = (amount: number, currency = 'usd') => new Request('https://example.test/api/stripe/recharge/order', {
  method: 'POST',
  headers: { Authorization: 'Bearer fixture-session-token', 'Content-Type': 'application/json' },
  body: JSON.stringify({ amount, currency }),
});

test('Stripe orders resolve each recharge lookup key and follow price transfers without changing credited amounts', async (t) => {
  const fixture = setupOrder(t);
  let version = 'original';
  const checkoutPrices: string[] = [];
  const lookupKeys: string[] = [];
  t.mock.method(globalThis, 'fetch', async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input));
    if (url.pathname === '/v1/prices') {
      assert.equal(init?.cache, 'no-store');
      assert.equal(url.searchParams.get('active'), 'true');
      assert.equal(url.searchParams.get('type'), 'one_time');
      const keys = url.searchParams.getAll('lookup_keys[]');
      assert.equal(keys.length, 1);
      const key = keys[0];
      lookupKeys.push(key);
      const amount = Number(key.replace('recharge_', ''));
      return Response.json({ data: [{ ...stripePrice(amount), id: `price_${version}_${amount}` }], has_more: false });
    }
    assert.equal(url.pathname, '/v1/checkout/sessions');
    assert.equal(init?.method, 'POST');
    const params = new URLSearchParams(String(init?.body));
    const priceId = params.get('line_items[0][price]')!;
    const amount = priceId.split('_').at(-1)!;
    checkoutPrices.push(priceId);
    assert.equal(params.get('currency'), 'usd');
    assert.equal(params.get('metadata[recharge_amount]'), `${amount}.00`);
    assert.equal(params.get('payment_intent_data[metadata][recharge_amount]'), `${amount}.00`);
    return Response.json({ id: `cs_fixture_${checkoutPrices.length}`, url: 'https://checkout.stripe.com/fixture' });
  });

  for (const amount of AMOUNTS) {
    const response = await POST(orderRequest(amount));
    assert.equal(response.status, 200);
    assert.equal((await response.json()).amount, `${amount}.00`);
  }
  version = 'replacement';
  assert.equal((await POST(orderRequest(500))).status, 200);

  assert.deepEqual(lookupKeys, ['recharge_500', 'recharge_1000', 'recharge_2000', 'recharge_5000', 'recharge_500']);
  assert.deepEqual(checkoutPrices, [
    'price_original_500', 'price_original_1000', 'price_original_2000', 'price_original_5000', 'price_replacement_500',
  ]);
  assert.deepEqual(fixture.create.mock.calls.map(({ arguments: [input] }) => input.data.priceId), checkoutPrices);
  assert.deepEqual(fixture.create.mock.calls.map(({ arguments: [input] }) => String(input.data.rechargeAmount)),
    ['500', '1000', '2000', '5000', '500']);
  assert.equal(fixture.update.mock.calls.length, 5);
});

test('Stripe lookup failures return the existing checkout error before creating an order or payment session', async (t) => {
  const fixture = setupOrder(t);
  let failure: unknown;
  let status = 200;
  t.mock.method(globalThis, 'fetch', async (input: string | URL | Request) => {
    assert.equal(new URL(String(input)).pathname, '/v1/prices');
    return Response.json(failure, { status });
  });

  for (const data of [
    [],
    [{ ...stripePrice(500), lookup_key: 'recharge_1000' }],
    [{ ...stripePrice(500), active: false }],
    [{ ...stripePrice(500), type: 'recurring' }],
    [{ ...stripePrice(500), id: '' }],
    [stripePrice(500), stripePrice(500)],
  ]) {
    failure = { data, has_more: false };
    const response = await POST(orderRequest(500));
    assert.equal(response.status, 500);
    assert.deepEqual(await response.json(), { ok: false, error: 'stripe_checkout_session_failed' });
  }
  status = 401;
  failure = { error: { message: 'fixture API error' } };
  assert.equal((await POST(orderRequest(500))).status, 500);
  assert.equal(fixture.create.mock.calls.length, 0);
  assert.equal(fixture.update.mock.calls.length, 0);
  assert.equal(fixture.updateMany.mock.calls.length, 0);
});

test('Stripe keeps amount, currency and first-recharge restrictions ahead of price lookup', async (t) => {
  const fixture = setupOrder(t);
  fixture.state.priorRechargeCount = 0;
  const fetch = t.mock.method(globalThis, 'fetch', async () => {
    throw new Error('unexpected Stripe request');
  });
  assert.equal((await POST(orderRequest(123))).status, 400);
  assert.equal((await POST(orderRequest(500, 'cny'))).status, 400);
  const response = await POST(orderRequest(1000));
  assert.equal(response.status, 403);
  assert.equal((await response.json()).error, 'stripe_first_recharge_limited');
  assert.equal(fetch.mock.calls.length, 0);
  assert.equal(fixture.create.mock.calls.length, 0);
});

test('Stripe pricing calculator matches all four lookup keys independent of API result order', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input));
    assert.equal(url.pathname, '/v1/prices');
    assert.deepEqual(url.searchParams.getAll('lookup_keys[]'), AMOUNTS.map((amount) => `recharge_${amount}`));
    assert.deepEqual(url.searchParams.getAll('expand[]'), ['data.currency_options']);
    assert.equal(init?.cache, 'no-store');
    assert.equal(new Headers(init?.headers).get('Authorization'), `Bearer ${SECRET}`);
    return Response.json({ data: [...AMOUNTS].reverse().map(stripePrice), has_more: false });
  });

  const prices = await fetchStripeRechargePresetPrices(SECRET);
  assert.deepEqual(prices.map((price) => price.rmbAmount), AMOUNTS);
  assert.deepEqual(prices.map((price) => price.priceId), AMOUNTS.map((amount) => `price_fixture_${amount}`));
  assert.deepEqual(prices[0].prices, { GBP: 60, EUR: 70, USD: 80, CAD: 110 });
  assert.deepEqual(prices[3].prices, { GBP: 600, EUR: 700, USD: 800, CAD: 1100 });
  assert.equal(fetch.mock.calls.length, 1);
});

test('Stripe pricing supports a target currency as the base currency and rejects missing currency prices', async (t) => {
  const prices = AMOUNTS.map(stripePrice);
  prices[0].currency = 'cad';
  prices[0].unit_amount = prices[0].currency_options.cad.unit_amount!;
  delete prices[0].currency_options.cad;
  t.mock.method(globalThis, 'fetch', async () => Response.json({ data: prices, has_more: false }));
  assert.equal((await fetchStripeRechargePresetPrices(SECRET))[0].prices.CAD, 110);

  delete prices[0].currency_options.usd;
  await assert.rejects(fetchStripeRechargePresetPrices(SECRET), /stripe_price_currency_missing:price_fixture_500:USD/);
});

test('Stripe decimal currency prices round fractional minor units for the single checkout item', async (t) => {
  const prices = AMOUNTS.map(stripePrice);
  const gbp = prices[0].currency_options.gbp;
  gbp.unit_amount = null;
  gbp.unit_amount_decimal = '6282.025';
  t.mock.method(globalThis, 'fetch', async () => Response.json({ data: prices, has_more: false }));
  assert.equal((await fetchStripeRechargePresetPrices(SECRET))[0].prices.GBP, 62.82);
  gbp.unit_amount_decimal = '6282.5';
  assert.equal((await fetchStripeRechargePresetPrices(SECRET))[0].prices.GBP, 62.83);
  for (const invalid of ['NaN', 'Infinity', '-1', 'invalid']) {
    gbp.unit_amount_decimal = invalid;
    await assert.rejects(fetchStripeRechargePresetPrices(SECRET), /stripe_price_currency_missing:price_fixture_500:GBP/);
  }
});

test('Stripe lookup does not fall back to obsolete environment price IDs', async (t) => {
  const previous = process.env.STRIPE_RECHARGE_PRICE_500;
  process.env.STRIPE_RECHARGE_PRICE_500 = 'price_obsolete';
  t.after(() => {
    if (previous === undefined) delete process.env.STRIPE_RECHARGE_PRICE_500;
    else process.env.STRIPE_RECHARGE_PRICE_500 = previous;
  });
  t.mock.method(globalThis, 'fetch', async () => Response.json({ data: [], has_more: false }));
  assert.equal(findStripeRechargePrice(500)?.lookupKey, 'recharge_500');
  await assert.rejects(fetchStripeRechargePriceId(SECRET, 'recharge_500'), /stripe_price_retrieve_failed:recharge_500/);
});
