import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import * as prismaTypes from '@prisma/client';
import { retrieveStripePaymentAccounting, type StripePaymentAccounting } from './stripe-recharge';

// Closed imports keep the production Prisma singleton, notifications and all
// provider I/O out of these lifecycle/webhook control-flow tests.
function loadOffline(path: string, dependencies: Record<string, unknown>) {
  const source = readFileSync(new URL(path, import.meta.url), 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports: Record<string, any> = {};
  runInNewContext(js, {
    exports, require: (name: string) => { assert(name in dependencies, `unexpected import ${name}`); return dependencies[name]; },
    console: { log() {}, warn() {}, error() {} }, Response, Date,
  });
  return exports;
}

const accounting = (refundedAmount = 0): StripePaymentAccounting => ({
  paymentIntentId: 'pi-1', chargeId: 'ch-1', chargedAmount: 10000, chargedCurrency: 'cny', refundedAmount,
  balanceTransactionId: 'txn-1', balanceAmount: 10000, balanceFee: 100, balanceNet: 9900, balanceCurrency: 'cny',
});
const success = (value = accounting()) => ({ outTradeNo: 'order-1', checkoutSessionId: 'session-1', accounting: value, stripeEventId: 'event-success' });

function fixture(overrides: Record<string, unknown> = {}) {
  let row: Record<string, any> = { id: 'payment-1', dlmId: 'old-owner', outTradeNo: 'order-1', status: 'PENDING', paymentStatus: 'PENDING',
    paymentIntentId: 'pi-1', chargeId: 'ch-1', refundedAmount: 0, ...overrides };
  const writes: Array<Record<string, any>> = [];
  const matches = (where: Record<string, any>) => Object.entries(where).every(([key, value]) => row[key] === value);
  const update = (data: Record<string, any>) => { writes.push(data); row = { ...row, ...Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined)) }; return { ...row }; };
  const prisma = { stripePayment: {
    findUnique: async ({ where }: any) => matches(where) ? { ...row } : null,
    update: async ({ where, data }: any) => { assert(matches(where)); return update(data); },
    updateMany: async ({ where, data }: any) => { if (!matches(where)) return { count: 0 }; update(data); return { count: 1 }; },
  } };
  const payment = loadOffline('./stripe-payment.ts', { '@/lib/prisma': { prisma } });
  return { payment, row: () => row, writes };
}

for (const priorStatus of ['REFUNDED', 'PARTIALLY_REFUNDED']) {
  test(`original policy lets a later success accounting snapshot replace ${priorStatus}`, async () => {
    const f = fixture({ paymentStatus: priorStatus, refundedAmount: 10000 });
    const result = await f.payment.recordStripePaymentSuccess(success());
    assert.equal(result.paymentStatus, 'SUCCEEDED'); assert.equal(result.refundedAmount, 0);
    assert.equal(result.latestStripeEventId, 'event-success');
  });
}

for (const paymentStatus of ['DISPUTED', 'DISPUTE_CLOSED']) {
  test(`original success and refund handlers preserve an already-read ${paymentStatus}`, async () => {
    const f = fixture({ paymentStatus }); await f.payment.recordStripePaymentSuccess(success());
    assert.equal(f.row().paymentStatus, paymentStatus);
    await f.payment.recordStripeRefund({ paymentIntentId: 'pi-1', accounting: accounting(10000), stripeEventId: 'refund' });
    assert.equal(f.row().paymentStatus, paymentStatus); assert.equal(f.row().refundedAmount, 10000);
  });
}

test('original refund records partial/full accounting on paid orders without touching their credit status', async () => {
  for (const [amount, paymentStatus] of [[100, 'PARTIALLY_REFUNDED'], [10000, 'REFUNDED']] as const) {
    const f = fixture({ status: 'PAID', paymentStatus: 'SUCCEEDED' });
    await f.payment.recordStripeRefund({ paymentIntentId: 'pi-1', accounting: accounting(amount), stripeEventId: 'refund' });
    assert.equal(f.row().paymentStatus, paymentStatus); assert.equal(f.row().status, 'PAID');
    assert.equal(f.row().refundedAmount, amount);
  }
});

test('early refund without a stored matching PI remains unmatched rather than recovering via new metadata rules', async () => {
  const f = fixture({ paymentIntentId: null });
  assert.equal(await f.payment.recordStripeRefund({ paymentIntentId: 'pi-1', accounting: accounting(10000), stripeEventId: 'refund' }), null);
  assert.equal(f.writes.length, 0);
});

test('original dispute handlers use PI or charge and let the last received event determine dispute state', async () => {
  const f = fixture();
  assert.equal(await f.payment.recordStripeDispute({ chargeId: 'ch-1', disputeId: 'dp-1', closed: true, disputeStatus: 'won', stripeEventId: 'closed' }), true);
  assert.equal(f.row().paymentStatus, 'DISPUTE_CLOSED');
  assert.equal(await f.payment.recordStripeDispute({ paymentIntentId: 'pi-1', disputeId: 'dp-2', closed: false, stripeEventId: 'created' }), true);
  assert.equal(f.row().paymentStatus, 'DISPUTED'); assert.equal(f.row().disputeId, 'dp-2');
  assert.equal(await f.payment.recordStripeDispute({ disputeId: 'no-reference', closed: false, stripeEventId: 'missing' }), null);
});

test('original failure handler updates only unpaid status, without the withdrawn lifecycle or reference-conflict checks', async () => {
  const f = fixture({ paymentStatus: 'SUCCEEDED' });
  await f.payment.recordStripeCheckoutFailure({ outTradeNo: 'order-1', checkoutSessionId: 'another-session', paymentIntentId: 'another-pi', expired: true });
  assert.equal(f.row().status, 'FAILED'); assert.equal(f.row().paymentStatus, 'EXPIRED');
  const paid = fixture({ status: 'PAID', paymentStatus: 'SUCCEEDED' });
  await paid.payment.recordStripeCheckoutFailure({ outTradeNo: 'order-1', expired: true });
  assert.equal(paid.writes.length, 0);
});

function webhook(options: { overrides?: Record<string, unknown>; accounting?: StripePaymentAccounting; settlement?: Record<string, unknown> } = {}) {
  const f = fixture(options.overrides);
  const events: Array<Record<string, any>> = [], credits: unknown[] = [], notices: unknown[] = [], retrievals: unknown[] = [];
  const route = loadOffline('../app/api/payment/stripe/notify/route.ts', {
    '@prisma/client': prismaTypes,
    '@/lib/stripe-recharge': {
      getStripeWebhookSecret: () => 'offline-only', getStripeSecretKey: () => 'offline-only',
      verifyStripeWebhookPayload: () => events.shift(), getStripePaymentIntentId: (session: any) => session.payment_intent,
      retrieveStripePaymentAccounting: async (input: unknown) => { retrievals.push(input); return options.accounting ?? accounting(); },
    },
    '@/lib/stripe-payment': f.payment,
    '@/lib/recharge-order': { settleRechargeOrderPayment: async (input: unknown) => { credits.push(input); return options.settlement ?? { kind: 'paid', dlmId: 'actual-owner' }; } },
    '@/lib/notification-center': { publishGuildNotification: async (notice: unknown) => { notices.push(notice); } },
  });
  const run = async (type: string, object: Record<string, unknown>) => {
    events.push({ id: 'event-1', type, data: { object } });
    return route.POST(new Request('https://example.test/stripe', { method: 'POST', body: '{}' }));
  };
  const session = { id: 'session-1', payment_intent: 'pi-1', payment_status: 'paid', client_reference_id: 'order-1',
    metadata: { out_trade_no: 'order-1', recharge_amount: '100' } };
  return { ...f, run, session, credits, notices, retrievals };
}

test('webhook keeps its original lifecycle gate for refunded/disputed success notifications', async () => {
  for (const [paymentStatus, refunded] of [['PENDING', 1], ['PENDING', 10000], ['DISPUTED', 0], ['DISPUTE_CLOSED', 0]] as const) {
    const f = webhook({ overrides: { paymentStatus }, accounting: accounting(refunded) });
    assert.equal((await f.run('checkout.session.completed', f.session)).status, 200);
    assert.equal(f.credits.length, 0); assert.equal(f.notices.length, 0);
  }
});

test('successful webhook preserves original order-reference priority and notifies the actual credited account', async () => {
  const f = webhook();
  assert.equal((await f.run('checkout.session.completed', { ...f.session, metadata: { out_trade_no: 'different-metadata', recharge_amount: '100' } })).status, 200);
  assert.equal((f.credits[0] as any).outTradeNo, 'order-1');
  assert.equal(f.row().dlmId, 'old-owner');
  assert.equal(f.notices.length, 0, 'credit transaction owns notification enqueue; webhook must not create another');
});

test('already-credited success response does not enqueue another notification', async () => {
  const f = webhook({ settlement: { kind: 'already_paid' } });
  assert.equal((await f.run('checkout.session.completed', f.session)).status, 200);
  assert.equal(f.notices.length, 0);
});

test('original refund/dispute webhook records known references and acknowledges missing references without new recovery', async () => {
  const f = webhook({ accounting: accounting(10000) });
  assert.equal((await f.run('refund.created', { payment_intent: 'pi-1' })).status, 200);
  assert.equal(f.row().paymentStatus, 'REFUNDED'); assert.equal(f.retrievals.length, 1);
  assert.equal((await f.run('refund.created', { charge: 'ch-1' })).status, 200);
  assert.equal(f.retrievals.length, 1, 'charge-only refund does not introduce provider requests');
  assert.equal((await f.run('charge.dispute.created', { id: 'dp-1', charge: 'ch-1', status: 'needs_response' })).status, 200);
  assert.equal(f.row().paymentStatus, 'DISPUTED'); assert.equal(f.retrievals.length, 1);
  assert.equal((await f.run('charge.dispute.closed', { id: 'dp-1', charge: 'ch-1', status: 'won' })).status, 200);
  assert.equal(f.row().paymentStatus, 'DISPUTE_CLOSED');
  assert.equal(f.credits.length, 0); assert.equal(f.notices.length, 0);
});

test('original accounting accepts expanded charges without the newly-required PI, metadata or dispute flags', async (t) => {
  const requests: string[] = [];
  t.mock.method(globalThis, 'fetch', async (url: unknown) => {
    requests.push(String(url));
    return Response.json({ id: 'pi-1', latest_charge: { id: 'ch-1', amount: 10000, amount_refunded: 0, currency: 'CNY',
      balance_transaction: { id: 'txn-1', amount: 10000, fee: 100, net: 9900, currency: 'CNY' } } });
  });
  assert.deepEqual(await retrieveStripePaymentAccounting({ secretKey: 'offline-only', paymentIntentId: 'pi-1' }), accounting());
  assert.equal(requests.length, 1); assert.match(requests[0], /payment_intents\/pi-1/);
});

test('original accounting retains the existing PaymentIntent identity check', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => Response.json({ id: 'another-pi' }));
  await assert.rejects(retrieveStripePaymentAccounting({ secretKey: 'offline-only', paymentIntentId: 'pi-1' }), /stripe_payment_intent_retrieve_failed/);
});
