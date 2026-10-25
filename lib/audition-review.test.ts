import assert from 'node:assert/strict';
import test from 'node:test';
import { Prisma } from '@prisma/client';
import { loadAuditionReview, validAuditionInviteId } from './audition-review';
import { handleAuditionReviewRequest } from './audition-review-request';

const D = (value: string | number) => new Prisma.Decimal(value);
const at = new Date('2026-10-22T01:02:03Z');
function fixture() {
  const invite = { id: 'invite-1', orderRequestId: 'request-1', bossId: 'boss-discord', workerId: 'worker-discord', peiwanId: 123,
    bossDlmId: 'dlm-boss', workerDlmId: 'dlm-worker', bossDiscordIdSnapshot: 'boss-discord', workerDiscordIdSnapshot: 'worker-discord',
    quotedGross: D(5), status: 'FULFILLED', transactionId: 'payment-1', grossAmount: D(5), feeAmount: D(1.25), netAmount: D(3.75),
    createdAt: at, updatedAt: at, expiresAt: at, acceptedAt: at, declinedAt: null, joinedAt: at, chargedAt: at, fulfilledAt: at, canceledAt: null,
    failureReason: 'postgres://secret', roomChannelId: 'private-room', roomGuildId: 'private-guild' };
  const payments = [{ Transid: 'payment-1', orderID: 42, fromId: 'boss-discord', toId: 'worker-discord', fromDlmId: 'dlm-boss', toDlmId: 'dlm-worker',
    amount: D(5), feeAmount: D(1.25), netAmount: D(3.75), createdAt: at }];
  const audits = [{ id: 'audit-1', auditVersion: 2, paymentTransactionId: 'payment-1', individualTransactionId: 'IT1', orderId: 42,
    giftName: '真人试音', quantity: D(1), unitPrice: D(5), gross: D(5), payable: D(5), feeAmount: D(1.25), netAmount: D(3.75),
    giverId: 'boss-discord', receiverId: 'worker-discord', giverDlmId: 'dlm-boss', receiverDlmId: 'dlm-worker', giverDiscordId: 'boss-discord',
    giverFromIncome: D(2), giverFromRecharge: D(3), receiverIncomeDelta: D(1.75), receiverRechargeDelta: D(2), receiverEarnDelta: D(5),
    pointsEarned: D(0), spendBonusExtra: D(0), flowBonusExtra: D(0), voucherIds: [] as string[], couponIds: [] as string[], voucherConsumption: { version: 1, vouchers: [] as unknown[] },
    receiverPeiwanId: 123, heartApplied: 0 as number | null, createdAt: at }];
  const ledgers = [{ transactionId: 'IT1', discordId: 'boss-discord', dlmId: 'dlm-boss', thirdPartydiscordId: 'worker-discord',
    typeOfTransaction: '试音花费', balanceBefore: D(10), amountChange: D(5), balanceAfter: D(5), timeCreatedAt: at }];
  const commissions = [{ transactionId: 'payment-1', orderID: 42, fromId: 'boss-discord', toId: 'worker-discord', fromDlmId: 'dlm-boss', toDlmId: 'dlm-worker', feeAmount: D(1.25), createdAt: at }];
  const reverts: Array<{ id: string; originalTransactionId: string; status: string; createdAt: Date; details?: unknown }> = [];
  const calls: Array<{ model: string; args: unknown }> = [];
  let missing = false;
  const users = new Map<string, string | null>([['dlm-boss', 'boss-discord'], ['dlm-worker', 'worker-discord']]);
  const ownership = new Map<string, string[]>();
  const detached = new Map<string, string>();
  const read = <T>(model: string, data: () => T) => async (args: unknown) => { calls.push({ model, args }); return data(); };
  // Only explicit SELECT APIs are injected: any writes, identity sync or balance reads fail.
  const db = { auditionInvite: { findUnique: read('invite', () => missing ? null : invite) },
    transaction: { findMany: read('payment', () => payments) }, giftAudit: { findMany: read('audit', () => audits) },
    individualTransaction: { findMany: read('ledger', () => ledgers) }, commission: { findMany: read('commission', () => commissions) },
    revert: { findMany: read('revert', () => reverts) },
    accountOwnership: { findMany: async (args: { where: { identityKey: string } }) => {
      calls.push({ model: 'ownership', args });
      return (ownership.get(args.where.identityKey) ?? []).map(currentDlmId => ({ currentDlmId }));
    } },
    dlmUser: { findUnique: async (args: { where: { dlmId: string }; select: unknown }) => {
      calls.push({ model: 'user', args });
      return users.has(args.where.dlmId) ? { discordUserId: users.get(args.where.dlmId) } : null;
    } },
    detachedDiscordAccount: { findUnique: async (args: { where: { ownerDlmId: string } }) => {
      calls.push({ model: 'detached', args });
      const memberKey = detached.get(args.where.ownerDlmId); return memberKey ? { memberKey } : null;
    } } } as unknown as Parameters<typeof loadAuditionReview>[0];
  return { invite, payments, audits, ledgers, commissions, reverts, calls, db, users, ownership, detached, missing: () => { missing = true; } };
}

test('exact fulfilled payment/audit/payer/commission facts prove completion including negative-recharge offsets', async () => {
  const f = fixture(); const result = await loadAuditionReview(f.db, 'invite-1');
  assert.equal(result?.outcome, 'CONSISTENT'); assert.deepEqual(result.issues, []);
  assert.equal(result.audits[0].receiverIncomeDelta, '1.75'); assert.equal(result.audits[0].receiverRechargeDelta, '2');
  assert.equal(result.audits[0].receiverEarnDelta, '5'); assert.equal(result.audits[0].heartApplied, 0);
  assert.match(result.scope, /未核验独立收款流水/);
  const serialized = JSON.stringify(result);
  assert.ok(!serialized.includes('postgres')); assert.ok(!serialized.includes('private-room'));
});


function migrateParticipants(f: ReturnType<typeof fixture>, sameOwner = false) {
  f.ownership.set('dlm-boss', ['new-boss']);
  f.ownership.set('dlm-worker', [sameOwner ? 'new-boss' : 'new-worker']);
  f.users.delete('dlm-boss'); f.users.delete('dlm-worker');
  f.users.set('new-boss', 'new-boss-discord');
  if (!sameOwner) f.users.set('new-worker', 'new-worker-discord');
  f.invite.bossId = f.payments[0].fromId = f.commissions[0].fromId = 'new-boss-discord';
  f.invite.workerId = f.payments[0].toId = f.commissions[0].toId = sameOwner ? 'new-boss-discord' : 'new-worker-discord';
  f.payments[0].fromDlmId = f.commissions[0].fromDlmId = f.ledgers[0].dlmId = 'new-boss';
  f.payments[0].toDlmId = f.commissions[0].toDlmId = sameOwner ? 'new-boss' : 'new-worker';
}
test('approved migrated current FKs retain consistent completed audition with original facts unchanged', async () => {
  const f = fixture(); const originalAudit = JSON.stringify(f.audits); migrateParticipants(f);
  const result = await loadAuditionReview(f.db, 'invite-1');
  assert.equal(result?.outcome, 'CONSISTENT'); assert.deepEqual(result.issues, []);
  assert.equal(result.invite.bossDlmId, 'dlm-boss'); assert.equal(result.invite.bossDiscordId, 'boss-discord');
  assert.equal(result.invite.currentBossDiscordId, 'new-boss-discord'); assert.equal(result.invite.peiwanId, 123);
  assert.equal(result.payerLedgers[0].dlmId, 'new-boss'); assert.equal(result.payerLedgers[0].discordId, 'boss-discord');
  assert.equal(JSON.stringify(f.audits), originalAudit);
  assert.ok(f.calls.filter(c => c.model === 'user').every(c => JSON.stringify((c.args as { select: unknown }).select) === '{"discordUserId":true}'));
});
test('completed audition remains verifiable when both original participants later merge into one owner', async () => {
  const f = fixture(); migrateParticipants(f, true);
  assert.equal((await loadAuditionReview(f.db, 'invite-1'))?.outcome, 'CONSISTENT');
});
test('detached current wallet Member key can verify history without sending to or trusting an old Discord', async () => {
  const f = fixture(); migrateParticipants(f); f.users.set('new-boss', null); f.detached.set('new-boss', 'detached-boss');
  f.invite.bossId = f.payments[0].fromId = f.commissions[0].fromId = 'detached-boss';
  assert.equal((await loadAuditionReview(f.db, 'invite-1'))?.outcome, 'CONSISTENT');
});
for (const [name, alter] of [
  ['missing migration proof', (f: ReturnType<typeof fixture>) => { f.ownership.delete('dlm-boss'); }],
  ['ambiguous migration proof', (f: ReturnType<typeof fixture>) => { f.ownership.set('dlm-boss', ['new-boss', 'other']); }],
  ['wrong migration destination', (f: ReturnType<typeof fixture>) => { f.ownership.set('dlm-boss', ['other']); }],
  ['stale payment and invite Member FKs', (f: ReturnType<typeof fixture>) => { f.invite.bossId = f.payments[0].fromId = f.commissions[0].fromId = 'boss-discord'; }],
  ['stale invite Member FK', (f: ReturnType<typeof fixture>) => { f.invite.bossId = 'boss-discord'; }],
  ['stale ledger owner', (f: ReturnType<typeof fixture>) => { f.ledgers[0].dlmId = 'dlm-boss'; }],
  ['stale commission owner', (f: ReturnType<typeof fixture>) => { f.commissions[0].toDlmId = 'dlm-worker'; }],
  ['rewritten immutable audit owner', (f: ReturnType<typeof fixture>) => { f.audits[0].giverDlmId = 'new-boss'; }],
  ['rewritten original ledger Discord', (f: ReturnType<typeof fixture>) => { f.ledgers[0].discordId = 'new-boss-discord'; }],
] as const) test(`migration does not conceal inconsistent facts: ${name}`, async () => {
  const f = fixture(); migrateParticipants(f); alter(f);
  assert.equal((await loadAuditionReview(f.db, 'invite-1'))?.outcome, 'REQUIRES_REVIEW');
});

const alterations: Array<[string, (f: ReturnType<typeof fixture>) => void]> = [
  ['missing original DLM snapshot', f => { f.invite.bossDlmId = ''; }],
  ['missing quote', f => { f.invite.quotedGross = null as unknown as Prisma.Decimal; }],
  ['quote exceeds supported precision', f => { f.invite.quotedGross = D('5.001'); }],
  ['quote exceeds range', f => { f.invite.quotedGross = D('1000000000000000'); }],
  ['invalid fixed PEIWAN integer', f => { f.invite.peiwanId = 0.5; }],
  ['invite participant changed after snapshot', f => { f.invite.bossId = 'other'; }],
  ['same payer and worker identity', f => { f.invite.workerDlmId = 'dlm-boss'; }],
  ['reassigned payment owner', f => { f.payments[0].fromDlmId = 'new-owner'; }],
  ['payment Member differs without proven ownership', f => { f.payments[0].fromId = 'new-discord'; }],
  ['wrong charged amount', f => { f.payments[0].amount = D('5.0001'); }],
  ['fee plus net mismatch', f => { f.payments[0].feeAmount = D(2); }],
  ['missing payment', f => { f.payments.length = 0; }],
  ['duplicate payment', f => { f.payments.push({ ...f.payments[0] }); }],
  ['missing audit', f => { f.audits.length = 0; f.ledgers.length = 0; }],
  ['duplicate audit for payment/order', f => { f.audits.push({ ...f.audits[0], id: 'audit-2' }); }],
  ['legacy audit has no applied-effect proof', f => { f.audits[0].auditVersion = 1; }],
  ['wrong fixed worker profile', f => { f.audits[0].receiverPeiwanId = 999; }],
  ['wrong audit original payment ID', f => { f.audits[0].paymentTransactionId = 'different-payment'; }],
  ['payer split does not equal gross', f => { f.audits[0].giverFromRecharge = D(0); }],
  ['receiver split does not equal net', f => { f.audits[0].receiverIncomeDelta = D(0); }],
  ['earn delta differs from quote', f => { f.audits[0].receiverEarnDelta = D(0); }],
  ['heart null is not observed zero', f => { f.audits[0].heartApplied = null; }],
  ['unexpected loyalty points', f => { f.audits[0].pointsEarned = D(1); }],
  ['unexpected spend bonus', f => { f.audits[0].spendBonusExtra = D(1); }],
  ['unexpected flow bonus', f => { f.audits[0].flowBonusExtra = D(1); }],
  ['unexpected voucher used', f => { f.audits[0].voucherIds = ['voucher']; }],
  ['missing voucher consumption facts', f => { f.audits[0].voucherConsumption = null as unknown as typeof f.audits[0]['voucherConsumption']; }],
  ['missing payer receipt', f => { f.ledgers.length = 0; }],
  ['payer receipt ID differs from audit', f => { f.ledgers[0].transactionId = 'IT2'; }],
  ['payer receipt is actually a credit', f => { f.ledgers[0].balanceAfter = D(15); }],
  ['payer receipt wrong beneficiary', f => { f.ledgers[0].thirdPartydiscordId = 'wrong'; }],
  ['missing commission', f => { f.commissions.length = 0; }],
  ['wrong commission order', f => { f.commissions[0].orderID = 43; }],
  ['duplicate commission with mismatched unique links', f => { f.commissions.push({ ...f.commissions[0], orderID: 43 }); }],
  ['missing charged time', f => { f.invite.chargedAt = null as unknown as Date; }],
];
for (const [name, alter] of alterations) test(`inconsistent facts require review: ${name}`, async () => {
  const f = fixture(); alter(f); const result = await loadAuditionReview(f.db, 'invite-1');
  assert.equal(result?.outcome, 'REQUIRES_REVIEW'); assert.ok(result.issues.length > 0);
});
test('a permitted zero-price audition has valid observed zero payment and effect facts', async () => {
  const f = fixture();
  f.invite.quotedGross = f.invite.grossAmount = f.invite.feeAmount = f.invite.netAmount = D(0);
  f.payments[0].amount = f.payments[0].feeAmount = f.payments[0].netAmount = D(0);
  const audit = f.audits[0];
  audit.unitPrice = audit.gross = audit.payable = audit.feeAmount = audit.netAmount = audit.giverFromIncome = audit.giverFromRecharge =
    audit.receiverIncomeDelta = audit.receiverRechargeDelta = audit.receiverEarnDelta = D(0);
  f.ledgers[0].amountChange = D(0); f.ledgers[0].balanceAfter = D(10); f.commissions[0].feeAmount = D(0);
  const result = await loadAuditionReview(f.db, 'invite-1');
  assert.equal(result?.outcome, 'CONSISTENT'); assert.equal(result.invite.quotedGross, '0'); assert.deepEqual(result.issues, []);
});
test('pending and accepted statuses never claim no debit or successful completion', async () => {
  for (const status of ['PENDING', 'ACCEPTED']) {
    const f = fixture(); f.invite.status = status;
    assert.equal((await loadAuditionReview(f.db, 'invite-1'))?.outcome, 'WAITING');
    f.invite.transactionId = null as unknown as string;
    const result = await loadAuditionReview(f.db, 'invite-1');
    assert.equal(result?.outcome, 'WAITING'); assert.match(result.summary, /不能据此认定未扣费/);
  }
});
test('successful reversal is distinct from unreversed completion, without claiming refund verification', async () => {
  const f = fixture(); f.reverts.push({ id: 'revert-1', originalTransactionId: 'IT1', status: 'SUCCESS', createdAt: at, details: { secret: 'private audit note' } });
  const result = await loadAuditionReview(f.db, 'invite-1');
  assert.equal(result?.outcome, 'REVERTED'); assert.match(result.summary, /退款凭证需核实/);
  assert.ok(!JSON.stringify(result).includes('private audit note'));
});
test('pending reversal blocks a completion assertion', async () => {
  const f = fixture(); f.reverts.push({ id: 'revert-1', originalTransactionId: 'IT1', status: 'PENDING', createdAt: at });
  assert.equal((await loadAuditionReview(f.db, 'invite-1'))?.outcome, 'REQUIRES_REVIEW');
});
test('missing exact invite returns no guessed payment search; production queries only explicit links', async () => {
  const f = fixture(); f.missing(); assert.equal(await loadAuditionReview(f.db, 'invite-1'), null); assert.equal(f.calls.length, 1);
  const good = fixture(); await loadAuditionReview(good.db, 'invite-1');
  assert.deepEqual((good.calls.find(c => c.model === 'ledger')!.args as { where: unknown }).where, { transactionId: { in: ['IT1'] } });
  assert.deepEqual((good.calls.find(c => c.model === 'commission')!.args as { where: unknown }).where,
    { OR: [{ transactionId: 'payment-1' }, { orderID: { in: [42] } }] });
  assert.deepEqual((good.calls.find(c => c.model === 'revert')!.args as { where: unknown }).where, { originalTransactionId: { in: ['IT1'] } });
});

const get = (query = 'inviteId=invite-1', method = 'GET') => new Request(`https://console.test/api/admin/auditions?${query}`, { method });
function boundary() {
  const f = fixture(); let loaded = 0;
  const deps = { session: async (): Promise<{ discordId: string } | null> => ({ discordId: 'admin' }), isAdmin: (id: string) => id === 'admin',
    load: async (id: string) => { ++loaded; return loadAuditionReview(f.db, id); } };
  return { f, deps, loaded: () => loaded };
}
test('anonymous and non-admin sessions cannot query financial facts', async () => {
  for (const session of [null, { discordId: 'staff' }]) {
    const f = boundary(); f.deps.session = async () => session;
    const response = await handleAuditionReviewRequest(get(), f.deps);
    assert.equal(response.status, 403); assert.equal(f.loaded(), 0); assert.equal(response.headers.get('Cache-Control'), 'no-store');
  }
});
test('GET requires one exact bounded invite ID and rejects all other operations', async () => {
  assert.equal(validAuditionInviteId('x'.repeat(100)), true); assert.equal(validAuditionInviteId('x'.repeat(101)), false);
  for (const query of ['', 'inviteId=', 'inviteId=../file', `inviteId=${'x'.repeat(101)}`, 'inviteId=invite-1&inviteId=other', 'inviteId=invite-1&retry=true']) {
    const f = boundary(); assert.equal((await handleAuditionReviewRequest(get(query), f.deps)).status, 400); assert.equal(f.loaded(), 0);
  }
  for (const method of ['POST', 'DELETE', 'PUT']) {
    const f = boundary(); assert.equal((await handleAuditionReviewRequest(get(undefined, method), f.deps)).status, 405); assert.equal(f.loaded(), 0);
  }
});
test('successful read is no-store and missing invite explicitly does not prove no charge', async () => {
  const f = boundary(); const good = await handleAuditionReviewRequest(get(), f.deps);
  assert.equal(good.status, 200); assert.equal(good.headers.get('Cache-Control'), 'no-store');
  assert.equal((await good.json()).review.outcome, 'CONSISTENT');
  f.f.missing(); const missing = await handleAuditionReviewRequest(get(), f.deps);
  assert.equal(missing.status, 404); assert.match((await missing.json()).message, /不能证明未扣费/);
});
test('database/session errors are unknown results with no secret disclosure or charge retry advice', async () => {
  for (const part of ['session', 'load'] as const) {
    const f = boundary(); f.deps[part] = async () => { throw new Error('postgres://secret private-host'); };
    const response = await handleAuditionReviewRequest(get(), f.deps);
    assert.equal(response.status, 503); const text = await response.text(); assert.ok(!text.includes('postgres')); assert.match(text, /勿再次发起扣费/);
  }
});
