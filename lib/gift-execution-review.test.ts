import assert from 'node:assert/strict';
import test from 'node:test';
import { Prisma } from '@prisma/client';
import type { SessionSnapshot } from '../types/session';
import type { GiftExecutionIntent } from './gift-execution-client';
import {
  giftExecutionIntentHash, loadGiftExecutionReview, parseGiftExecutionIntent, prepareGiftExecutionAbandon,
  GiftExecutionReviewConflict, type GiftExecutionReadDb,
} from './gift-execution-review';
import { handleGiftExecutionAbandonRequest, handleGiftExecutionReviewRequest } from './gift-execution-review-request';

const D = (value: string | number) => new Prisma.Decimal(value);
const id = '12345678-1234-4123-8123-123456789abc';
const payer = '111111111111111111'; const receiver = '222222222222222222'; const admin = '333333333333333333';
const at = new Date('2026-10-22T12:00:00Z');
const intentFor = (patch: Partial<GiftExecutionIntent> = {}): GiftExecutionIntent => ({
  version: 1, kind: 'VOUCHER_GIFT', payerDlmId: 'DLM-PAYER', payerDiscordId: payer, receiverDlmId: 'DLM-RECEIVER',
  receiverDiscordId: receiver, receiverPeiwanId: 42, operatorDiscordId: null, giftName: '测试礼物', quantity: '1',
  anonymous: false, feedAnonymous: false, source: 'regular', transactionLabel: null, expenseReason: null, notifyGiverPointsDm: true,
  lotteryVoucherId: patch.kind && patch.kind !== 'VOUCHER_GIFT' ? null : 'draw-1', couponVoucherId: null, ...patch,
});
function fixture(patch: Partial<GiftExecutionIntent> = {}) {
  const intent = intentFor(patch);
  const requestId = intent.kind === 'DISCORD_GIFT' ? `discord:gift:444444444444444444:${receiver}` : id;
  const result = { txId: 'payment-1', giftName: intent.giftName, quantity: intent.quantity, unitPrice: '100', gross: '100', payable: '50',
    pointsEarned: '2', receiverRate: '0.8', feeAmount: '20', netAmount: '80', heartGain: '100' };
  const fact = { kind: 'lottery', voucherId: 'draw-1', voucherType: 'prize-1', itemSku: null, source: 'LOTTERY', label: '测试礼物代金券',
    ownerDlmId: intent.payerDlmId ?? 'DLM-PAYER', ownerDiscordId: intent.payerDiscordId, targetDlmId: intent.receiverDlmId ?? 'DLM-RECEIVER',
    targetDiscordId: receiver, issuedAt: '2026-10-22T11:00:00.000Z', consumedAt: at.toISOString(), expiresAt: '2026-10-23T12:00:00.000Z',
    amount: '50', discountAmount: '50', consumptionKey: 'GIFT:audit-1', requestId: null };
  const row = { requestId, kind: intent.kind, intent: intent as unknown as Prisma.JsonValue, intentHash: giftExecutionIntentHash(intent),
    status: 'COMPLETED', giftAuditId: 'audit-1' as string | null, result: result as Prisma.JsonValue };
  const audit = { id: 'audit-1', auditVersion: 2, giverDlmId: intent.payerDlmId ?? 'DLM-PAYER', receiverDlmId: intent.receiverDlmId ?? 'DLM-RECEIVER',
    giverDiscordId: intent.payerDiscordId, giverId: intent.payerDiscordId ?? intent.payerDlmId, receiverId: receiver, receiverPeiwanId: intent.receiverPeiwanId,
    paymentTransactionId: result.txId, individualTransactionId: 'receipt-1', orderId: 1, giftName: intent.giftName,
    quantity: D(1), unitPrice: D(100), gross: D(100), payable: D(50), pointsEarned: D(2), receiverRate: D('0.8'), feeAmount: D(20), netAmount: D(80), heartGain: 100,
    voucherIds: ['draw-1'] as Prisma.JsonValue, couponIds: [] as Prisma.JsonValue, voucherConsumption: { version: 1, vouchers: [fact] } as Prisma.JsonValue };
  const payment = { Transid: 'payment-1', orderID: 1, fromId: intent.payerDiscordId, toId: receiver, fromDlmId: audit.giverDlmId,
    toDlmId: audit.receiverDlmId, amount: D(100), feeAmount: D(20), netAmount: D(80) };
  const ledger = { transactionId: 'receipt-1', discordId: intent.payerDiscordId, dlmId: audit.giverDlmId, thirdPartydiscordId: receiver,
    typeOfTransaction: intent.transactionLabel ?? '打赏', amountChange: D(50), balanceBefore: D(100), balanceAfter: D(50) };
  const state = { missing: false, missingAudit: false, missingPayment: false, missingLedger: false,
    operation: null as null | { id: string; type: string; status: string; dlmId: string; operatorDiscordId: string; details: Prisma.JsonValue; result: Prisma.JsonValue },
    reverts: [] as Array<{ id: string; status: string; createdAt: Date }>,
    current: { discordUserId: intent.payerDiscordId, sessionVersion: 1, member: intent.payerDiscordId ? { discordUserId: intent.payerDiscordId } : null },
    currentMissing: false, aliases: [] as any[], receiverDiscord: receiver, detached: new Map<string, string>(),
  };
  if (intent.kind !== 'VOUCHER_GIFT') {
    result.payable = '100'; audit.payable = D(100); ledger.amountChange = D(100); ledger.balanceAfter = D(0);
    audit.voucherIds = []; audit.voucherConsumption = { version: 1, vouchers: [] };
  }
  if (intent.kind === 'DELEGATED_GIFT') state.operation = { id: 'operation-1', type: 'DELEGATED_GIFT', status: 'COMPLETED',
    dlmId: intent.payerDlmId!, operatorDiscordId: intent.operatorDiscordId!,
    details: { giftExecutionVersion: 1, intentHash: row.intentHash, intent: intent as unknown as Prisma.JsonValue },
    result: { ...result, transactionId: result.txId, giftAuditId: audit.id, requestId } };
  const calls: Array<{ model: string; args: unknown }> = [];
  const read = <T>(model: string, data: () => T) => async (args: unknown) => { calls.push({ model, args }); return data(); };
  const db = {
    accountOwnership: { findMany: async ({ where }: any) => state.aliases.filter(row => Object.entries(where).every(([key, value]) => row[key] === value)) },
    detachedDiscordAccount: { findUnique: async ({ where }: any) => state.detached.has(where.ownerDlmId) ? { memberKey: state.detached.get(where.ownerDlmId) } : null },
    giftExecutionRequest: { findUnique: read('request', () => state.missing ? null : row) },
    giftAudit: { findUnique: read('audit', () => state.missingAudit ? null : audit) },
    individualTransaction: { findUnique: read('ledger', () => state.missingLedger ? null : ledger) },
    transaction: { findUnique: read('payment', () => state.missingPayment ? null : payment) },
    dlmAdminOperation: { findUnique: read('operation', () => state.operation) }, revert: { findMany: read('revert', () => state.reverts) },
    dlmUser: { findUnique: async (args: { where: { dlmId: string } }) => { calls.push({ model: 'identity', args });
      if (state.currentMissing) return null;
      if (args.where.dlmId === 'DLM-ADMIN') return { discordUserId: admin, sessionVersion: 1, member: { discordUserId: admin } };
      if (args.where.dlmId === payment.toDlmId) return { discordUserId: state.receiverDiscord, sessionVersion: 1, member: { discordUserId: state.receiverDiscord } };
      return state.current;
    } },
  } as unknown as GiftExecutionReadDb;
  const session: SessionSnapshot = { dlmId: audit.giverDlmId, discordId: intent.payerDiscordId, sessionVersion: 1, username: 'owner' };
  return { requestId, intent, row, result, audit, fact, payment, ledger, state, calls, db, session,
    pending: () => { row.status = 'PENDING'; row.giftAuditId = null; row.result = null; state.operation = null; },
    load: () => loadGiftExecutionReview(db, session, false, requestId) };
}

test('Web canonical hash matches the Bot domain and preserves small original quantities', () => {
  const raw = intentFor({ giftName: '  Ａ礼物  ', quantity: '000.0000100' });
  const parsed = parseGiftExecutionIntent(raw); assert.equal(parsed.giftName, 'A礼物'); assert.equal(parsed.quantity, '0.00001');
  // Produced by the real Bot canonical/hash helper, rather than a second fixture hash implementation.
  assert.equal(giftExecutionIntentHash(intentFor()), 'e14b79874485ea1419caabb1244c6d2a3706bd147bdcc8c9d18c3e30963e4ed8');
});

test('completed proof links gross payment, discounted payer debit and original full receiver payout without live voucher reads', async () => {
  const f = fixture(); const result = await f.load();
  assert.equal(result?.status, 'COMPLETED'); assert.equal(result.verified, true); assert.equal(result.gross, '100'); assert.equal(result.payable, '50');
  assert.equal(result.transactionId, 'payment-1'); assert.equal(result.individualTransactionId, 'receipt-1');
  assert.deepEqual([...new Set(f.calls.map(call => call.model))].sort(), ['audit', 'identity', 'ledger', 'operation', 'payment', 'request', 'revert']);
});
test('migrated payer reads the original result and may cancel only an existing verified pending request', async () => {
  const f = fixture(); const original = JSON.stringify(f.row.intent);
  const next = { ...f.session, dlmId: 'NEW-PAYER', discordId: '999999999999999999' };
  Object.assign(f.state.current, { discordUserId: next.discordId, member: { discordUserId: next.discordId } });
  f.state.aliases.push({ identityKind: 'DLM', identityKey: 'DLM-PAYER', originalDlmId: 'DLM-PAYER', currentDlmId: 'NEW-PAYER' },
    { identityKind: 'DISCORD', identityKey: payer, originalDlmId: 'DLM-PAYER', currentDlmId: 'NEW-PAYER' });
  f.payment.fromDlmId = 'NEW-PAYER'; f.payment.fromId = next.discordId; f.ledger.dlmId = 'NEW-PAYER';
  const review = await loadGiftExecutionReview(f.db, next, false, id);
  assert.equal(review?.verified, true); assert.equal(review?.intent.payerDlmId, 'DLM-PAYER'); assert.equal(JSON.stringify(f.row.intent), original);
  f.pending(); assert.equal((await loadGiftExecutionReview(f.db, next, false, id))?.status, 'PENDING');
  const cancellation = await prepareGiftExecutionAbandon(f.db, next, false, id);
  assert.deepEqual(cancellation?.intent, f.intent); assert.equal(cancellation?.review?.status, 'PENDING');
  f.row.status = 'REQUIRES_REVIEW'; await assert.rejects(prepareGiftExecutionAbandon(f.db, next, false, id), GiftExecutionReviewConflict);
  f.state.missing = true; assert.equal(await prepareGiftExecutionAbandon(f.db, next, false, id, f.intent), null);
});
test('moving the receiver or delegated operation FK preserves verification, while a wrong mapping still fails', async () => {
  for (const kind of ['VOUCHER_GIFT', 'DELEGATED_GIFT'] as const) {
    const f = fixture(kind === 'DELEGATED_GIFT' ? { kind, operatorDiscordId: admin, source: 'delegate', transactionLabel: '客服代打赏' } : {});
    f.state.aliases.push({ identityKind: 'DLM', identityKey: 'DLM-RECEIVER', originalDlmId: 'DLM-RECEIVER', currentDlmId: 'NEW-RECEIVER' });
    f.payment.toDlmId = 'NEW-RECEIVER'; f.payment.toId = '888888888888888888'; f.state.receiverDiscord = f.payment.toId;
    assert.equal((await f.load())?.verified, true);
    f.state.aliases[0].currentDlmId = 'WRONG'; assert.equal((await f.load())?.verified, false);
  }
});


test('detached payment FK remains verifiable without sending historical ownership to a reused Discord', async () => {
  const f = fixture(); f.session.discordId = null;
  Object.assign(f.state.current, { discordUserId: null, member: null });
  f.state.detached.set('DLM-PAYER', 'detached:DLM-PAYER');
  f.state.aliases.push({ identityKind: 'DISCORD', identityKey: payer, originalDlmId: 'DLM-PAYER', currentDlmId: 'DLM-PAYER' });
  f.payment.fromId = 'detached:DLM-PAYER';
  assert.equal((await f.load())?.verified, true); assert.equal(f.ledger.discordId, payer);
  f.payment.fromId = payer; assert.equal((await f.load())?.verified, false);
});
test('moved DLM proof cannot validate a payment linked to an unrelated member key', async () => {
  const f = fixture(); f.state.aliases.push({ identityKind: 'DLM', identityKey: 'DLM-RECEIVER', originalDlmId: 'DLM-RECEIVER', currentDlmId: 'NEW-RECEIVER' });
  f.payment.toDlmId = 'NEW-RECEIVER'; f.state.receiverDiscord = '888888888888888888';
  assert.equal((await f.load())?.verified, false);
  f.payment.toId = f.state.receiverDiscord; assert.equal((await f.load())?.verified, true);
});

test('100 percent voucher keeps gross transaction and receiver payout, with zero payer debit', async () => {
  const f = fixture(); f.result.payable = '0'; f.audit.payable = D(0); f.ledger.amountChange = D(0); f.ledger.balanceAfter = D(100);
  f.fact.amount = '100'; f.fact.discountAmount = '100';
  assert.equal((await f.load())?.verified, true);
});

test('valid original precision is retained while audit and payment use database rounding', async () => {
  const f = fixture(); f.intent.quantity = '0.00001'; f.row.intentHash = giftExecutionIntentHash(f.intent);
  Object.assign(f.result, { quantity: '0.00001', unitPrice: '10', gross: '0.0001', payable: '0.0001', receiverRate: '0.50000001', feeAmount: '0.00005', netAmount: '0.00005', heartGain: '0.0001' });
  Object.assign(f.audit, { quantity: D(0), unitPrice: D(10), gross: D('0.0001'), payable: D('0.0001'), receiverRate: D('0.5'), feeAmount: D('0.0001'), netAmount: D('0.0001'), heartGain: 0 });
  Object.assign(f.payment, { amount: D('0.0001'), feeAmount: D('0.0001'), netAmount: D('0.0001') });
  f.ledger.amountChange = D('0.0001'); f.ledger.balanceAfter = D('99.9999'); f.fact.amount = '0'; f.fact.discountAmount = '0';
  assert.equal((await f.load())?.verified, true);
});

const invalidFacts: Array<[string, (f: ReturnType<typeof fixture>) => void]> = [
  ['hash changed', f => { f.row.intentHash = 'bad'; }], ['kind changed', f => { f.row.kind = 'DELEGATED_GIFT'; }],
  ['audit missing', f => { f.state.missingAudit = true; }], ['legacy audit', f => { f.audit.auditVersion = 1; }],
  ['audit original payer', f => { f.audit.giverDlmId = 'other'; }], ['audit original receiver', f => { f.audit.receiverId = payer; }],
  ['profile changed', f => { f.audit.receiverPeiwanId = 43; }], ['payment missing', f => { f.state.missingPayment = true; }],
  ['payment owner', f => { f.payment.fromDlmId = 'other'; }], ['payment receiver', f => { f.payment.toDlmId = 'other'; }],
  ['payment owner Discord', f => { f.payment.fromId = admin; }], ['payment receiver Discord', f => { f.payment.toId = admin; }],
  ['payment uses payable instead of gross', f => { f.payment.amount = D(50); }], ['payment order', f => { f.payment.orderID = 2; }],
  ['payment fee', f => { f.payment.feeAmount = D(21); }], ['payment net', f => { f.payment.netAmount = D(79); }],
  ['payer ledger missing', f => { f.state.missingLedger = true; }], ['payer ledger target', f => { f.ledger.thirdPartydiscordId = admin; }],
  ['payer ledger type', f => { f.ledger.typeOfTransaction = '其他'; }], ['payer ledger amount', f => { f.ledger.amountChange = D(100); }],
  ['payer ledger balance', f => { f.ledger.balanceAfter = D(100); }], ['result amount', f => { f.result.gross = '101'; }],
  ['result quantity', f => { f.result.quantity = '2'; }], ['missing consumption', f => { f.audit.voucherConsumption = null; }],
  ['wrong source', f => { f.fact.source = 'VIP'; }], ['wrong consumption key', f => { f.fact.consumptionKey = 'GIFT:other'; }],
  ['voucher target Discord differs from original intent', f => { f.fact.targetDiscordId = admin; }],
  ['wrong explicit ID', f => { f.fact.voucherId = 'other'; }], ['missing voucher ids', f => { f.audit.voucherIds = []; }],
  ['wrong discount sum', f => { f.fact.discountAmount = '49'; }], ['expired original voucher', f => { f.fact.expiresAt = at.toISOString(); }],
  ['future issuance', f => { f.fact.issuedAt = '2026-10-23T12:00:00.000Z'; }],
];
for (const [name, mutate] of invalidFacts) test(`incomplete proof cannot authorize a fresh gift: ${name}`, async () => {
  const f = fixture(); mutate(f); const result = await f.load(); assert.equal(result?.status, 'REQUIRES_REVIEW'); assert.equal(result.verified, false);
});

test('pending and abandoned states require no audit, result or legacy operation evidence', async () => {
  const f = fixture(); f.pending(); assert.equal((await f.load())?.status, 'PENDING'); assert.equal((await f.load())?.verified, false);
  f.row.status = 'ABANDONED'; assert.equal((await f.load())?.verified, true);
  f.row.giftAuditId = 'audit-1'; assert.equal((await f.load())?.status, 'REQUIRES_REVIEW');
});

test('restored or reused vouchers do not erase immutable completed proof; reversal status is displayed separately', async () => {
  const f = fixture(); f.state.reverts.push({ id: 'reversal', status: 'SUCCESS', createdAt: at });
  const result = await f.load(); assert.equal(result?.verified, true); assert.equal(result.reverted, true);
  assert.match(result.message, /退款或通知情况.*联系客服/);
  assert.doesNotMatch(result.message, /持久化|凭证|审计/);
});

test('voucher owner Discord remains a historical source field while its DLM and fixed target prove ownership', async () => {
  const f = fixture(); f.fact.ownerDiscordId = admin;
  assert.equal((await f.load())?.verified, true);
  f.fact.ownerDiscordId = null;
  assert.equal((await f.load())?.verified, true);
});

test('current owner needs matching original DLM, original Discord and current session binding/version', async () => {
  for (const modify of [
    (f: ReturnType<typeof fixture>) => { f.session.dlmId = 'reused-discord-new-owner'; },
    (f: ReturnType<typeof fixture>) => { f.session.discordId = receiver; },
    (f: ReturnType<typeof fixture>) => { f.session.sessionVersion = 2; },
    (f: ReturnType<typeof fixture>) => { f.state.current.discordUserId = receiver; },
    (f: ReturnType<typeof fixture>) => { f.state.current.member = null; },
    (f: ReturnType<typeof fixture>) => { f.session.dlmId = null; },
  ]) { const f = fixture(); modify(f); assert.equal(await f.load(), null); }
});

test('historical delegated operator and receiver are not owners; a current administrator may read', async () => {
  const f = fixture({ kind: 'DELEGATED_GIFT', source: 'delegate', operatorDiscordId: admin, transactionLabel: '客服代打赏' });
  const former: SessionSnapshot = { dlmId: 'DLM-ADMIN', discordId: admin, sessionVersion: 1, username: 'former admin' };
  assert.equal(await loadGiftExecutionReview(f.db, former, false, id), null);
  assert.equal((await loadGiftExecutionReview(f.db, former, true, id))?.verified, true);
  f.state.currentMissing = true; assert.equal(await loadGiftExecutionReview(f.db, former, true, id), null);
});

test('unbound payer can read their delegated gift with the matching WeChat-only DLM session', async () => {
  const f = fixture({ kind: 'DELEGATED_GIFT', source: 'delegate', operatorDiscordId: admin, payerDiscordId: null, transactionLabel: '客服代打赏' });
  assert.equal((await f.load())?.verified, true);
});

test('Discord-only pending requests cannot be claimed by a reused Discord; completed actual DLM proof can authorize the original owner', async () => {
  const f = fixture({ kind: 'DISCORD_GIFT', operatorDiscordId: payer, payerDlmId: null, receiverDlmId: null });
  assert.equal((await f.load())?.verified, true);
  f.session.dlmId = 'NEW-DLM'; assert.equal(await f.load(), null); f.session.dlmId = 'DLM-PAYER';
  f.pending(); assert.equal(await f.load(), null);
  assert.equal((await loadGiftExecutionReview(f.db, { dlmId: 'DLM-ADMIN', discordId: admin, username: 'admin' }, true, f.requestId))?.status, 'PENDING');
});

for (const [name, corrupt] of [
  ['hash', (f: ReturnType<typeof fixture>) => { f.row.intentHash = 'bad'; }],
  ['kind', (f: ReturnType<typeof fixture>) => { f.row.kind = 'VOUCHER_GIFT'; }],
  ['malformed result', (f: ReturnType<typeof fixture>) => { f.row.result = {}; }],
  ['missing result', (f: ReturnType<typeof fixture>) => { f.row.result = null; }],
  ['missing audit id', (f: ReturnType<typeof fixture>) => { f.row.giftAuditId = null; }],
  ['missing audit', (f: ReturnType<typeof fixture>) => { f.state.missingAudit = true; }],
  ['legacy audit', (f: ReturnType<typeof fixture>) => { f.audit.auditVersion = 1; }],
  ['audit Discord', (f: ReturnType<typeof fixture>) => { f.audit.giverDiscordId = admin; }],
] as const) test(`Discord-only incomplete ${name} cannot expose details to a reused Discord account`, async () => {
  const f = fixture({ kind: 'DISCORD_GIFT', operatorDiscordId: payer, payerDlmId: null, receiverDlmId: null });
  f.session.dlmId = 'NEW-DLM'; corrupt(f);
  assert.equal(await f.load(), null);
  assert.equal(f.calls.some(call => ['operation', 'payment', 'ledger'].includes(call.model)), false);
});

test('Discord-only original payer can see incomplete proof only after the original audit establishes their DLM', async () => {
  const f = fixture({ kind: 'DISCORD_GIFT', operatorDiscordId: payer, payerDlmId: null, receiverDlmId: null });
  f.row.result = {};
  assert.equal((await f.load())?.status, 'REQUIRES_REVIEW');
  assert.equal(f.calls.filter(call => call.model === 'audit').length, 1);
  f.audit.giverDiscordId = admin;
  assert.equal(await f.load(), null);
});

test('existing abandonment uses only the stored canonical intent and rejects changed caller intent', async () => {
  const f = fixture(); f.pending();
  const prepared = await prepareGiftExecutionAbandon(f.db, f.session, false, id);
  assert.deepEqual(prepared?.intent, f.intent); assert.equal(prepared?.review?.status, 'PENDING');
  await assert.rejects(prepareGiftExecutionAbandon(f.db, f.session, false, id, { ...f.intent, quantity: '2' }), GiftExecutionReviewConflict);
  f.row.status = 'COMPLETED'; f.row.result = f.result; f.row.giftAuditId = 'audit-1';
  assert.equal((await prepareGiftExecutionAbandon(f.db, f.session, false, id))?.review?.status, 'COMPLETED');
});

test('missing v1 Web request needs the complete local intent and verified current payer or administrator before tombstoning', async () => {
  const f = fixture(); f.state.missing = true;
  await assert.rejects(prepareGiftExecutionAbandon(f.db, f.session, false, id), GiftExecutionReviewConflict);
  const prepared = await prepareGiftExecutionAbandon(f.db, f.session, false, id.toUpperCase(), f.intent);
  assert.equal(prepared?.requestId, id); assert.equal(prepared?.review, null);
  f.session.dlmId = 'OTHER'; assert.equal(await prepareGiftExecutionAbandon(f.db, f.session, false, id, f.intent), null);
  const adminSession = { dlmId: 'DLM-ADMIN', discordId: admin, username: 'admin' };
  assert.ok(await prepareGiftExecutionAbandon(f.db, adminSession, true, id, f.intent));
  await assert.rejects(prepareGiftExecutionAbandon(f.db, adminSession, true, id, { ...f.intent, quantity: '01' }), GiftExecutionReviewConflict);
});

test('missing old delegated operations and missing Discord requests cannot be inferred safe to abandon', async () => {
  const f = fixture({ kind: 'DELEGATED_GIFT', source: 'delegate', operatorDiscordId: admin }); f.state.missing = true;
  for (const status of ['PENDING', 'COMPLETED', 'FAILED']) {
    f.state.operation!.status = status;
    await assert.rejects(prepareGiftExecutionAbandon(f.db, f.session, false, id, f.intent), GiftExecutionReviewConflict);
  }
  const discord = fixture({ kind: 'DISCORD_GIFT', operatorDiscordId: payer }); discord.state.missing = true;
  await assert.rejects(prepareGiftExecutionAbandon(discord.db, discord.session, false, discord.requestId, discord.intent), GiftExecutionReviewConflict);
});

function boundary() {
  const f = fixture(); let sent = 0; let prepared = 0; let loaded = 0;
  const deps = {
    publicUrl: 'https://console.test',
    session: async (): Promise<SessionSnapshot | null> => f.session, isAdmin: (value: string) => value === admin,
    load: async (session: SessionSnapshot, isAdmin: boolean, requestId: string) => { loaded++; return loadGiftExecutionReview(f.db, session, isAdmin, requestId); },
    prepareAbandon: async (session: SessionSnapshot, isAdmin: boolean, requestId: string, raw?: unknown) => { prepared++; return prepareGiftExecutionAbandon(f.db, session, isAdmin, requestId, raw); },
    abandon: async (input: { requestId: string; intent: GiftExecutionIntent }): Promise<Record<string, unknown>> => {
      sent++; assert.equal(input.requestId, id); assert.deepEqual(input.intent, f.intent);
      return { ok: true, requestId: id, status: 'ABANDONED', giftAuditId: null, result: null };
    },
  };
  return { f, deps, sent: () => sent, prepared: () => prepared, loaded: () => loaded };
}
const get = (query = `requestId=${id}`) => new Request(`https://console.test/api/profile/gift-executions?${query}`);
const post = (body: unknown, origin = 'https://console.test') => new Request('https://console.test/api/profile/gift-executions/abandon', {
  method: 'POST', headers: { origin, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
});

test('GET authenticates, accepts one exact bounded ID, normalizes UUID casing and exposes no mutation API', async () => {
  const f = boundary(); const response = await handleGiftExecutionReviewRequest(get(`requestId=${id.toUpperCase()}`), f.deps);
  assert.equal(response.status, 200); assert.equal(response.headers.get('Cache-Control'), 'no-store'); assert.equal((await response.json()).review.requestId, id);
  for (const query of ['', 'requestId=GIFT:target', `requestId=${id}&requestId=${id}`, `requestId=${id}&retry=true`]) {
    assert.equal((await handleGiftExecutionReviewRequest(get(query), f.deps)).status, 400);
  }
  f.deps.session = async () => null; assert.equal((await handleGiftExecutionReviewRequest(get(), f.deps)).status, 401);
  assert.equal((await handleGiftExecutionReviewRequest(post({ requestId: id }), f.deps)).status, 405); assert.equal(f.sent(), 0);
});

test('absent and unauthorized reads are indistinguishable and never imply no payment', async () => {
  const absent = boundary(); absent.f.state.missing = true;
  const unauthorized = boundary(); unauthorized.f.session.dlmId = 'OTHER';
  const a = await handleGiftExecutionReviewRequest(get(), absent.deps); const b = await handleGiftExecutionReviewRequest(get(), unauthorized.deps);
  assert.equal(a.status, 404); assert.equal(b.status, 404); assert.deepEqual(await a.json(), await b.json());
});

test('abandon rejects foreign origin, extra financial parameters, missing auth and non-owner before internal send', async () => {
  const f = boundary(); f.f.pending();
  assert.equal((await handleGiftExecutionAbandonRequest(post({ requestId: id }, 'https://attacker.test'), f.deps)).status, 403);
  assert.equal((await handleGiftExecutionAbandonRequest(post({ requestId: id, quantity: 2 }), f.deps)).status, 400);
  f.f.session.dlmId = 'OTHER'; assert.equal((await handleGiftExecutionAbandonRequest(post({ requestId: id }), f.deps)).status, 404);
  f.deps.session = async () => null; assert.equal((await handleGiftExecutionAbandonRequest(post({ requestId: id }), f.deps)).status, 401);
  assert.equal(f.sent(), 0);
});

test('POST uses stored pending intent and never forwards altered body intent; completed and abandoned return without send', async () => {
  const f = boundary(); f.f.pending();
  assert.equal((await handleGiftExecutionAbandonRequest(post({ requestId: id, intent: { ...f.f.intent, receiverDlmId: 'other' } }), f.deps)).status, 409);
  assert.equal(f.sent(), 0);
  assert.equal((await handleGiftExecutionAbandonRequest(post({ requestId: id }), f.deps)).status, 200); assert.equal(f.sent(), 1);
  f.f.row.status = 'ABANDONED'; assert.equal((await handleGiftExecutionAbandonRequest(post({ requestId: id }), f.deps)).status, 200); assert.equal(f.sent(), 1);
  const done = boundary(); assert.equal((await handleGiftExecutionAbandonRequest(post({ requestId: id }), done.deps)).status, 200); assert.equal(done.sent(), 0);
});


test('inherited cancellation returns completed proof without sending, otherwise forwards only stored pending intent', async () => {
  const b = boundary(); const f = b.f;
  f.state.aliases.push({ identityKind: 'DLM', identityKey: 'DLM-PAYER', originalDlmId: 'DLM-PAYER', currentDlmId: 'NEW-PAYER' },
    { identityKind: 'DISCORD', identityKey: payer, originalDlmId: 'DLM-PAYER', currentDlmId: 'NEW-PAYER' });
  f.session.dlmId = 'NEW-PAYER'; f.session.discordId = '999999999999999999';
  Object.assign(f.state.current, { discordUserId: f.session.discordId, member: { discordUserId: f.session.discordId } });
  f.payment.fromDlmId = 'NEW-PAYER'; f.payment.fromId = f.session.discordId; f.ledger.dlmId = 'NEW-PAYER';
  assert.equal((await handleGiftExecutionAbandonRequest(post({ requestId: id }), b.deps)).status, 200); assert.equal(b.sent(), 0);
  f.pending();
  assert.equal((await handleGiftExecutionAbandonRequest(post({ requestId: id }), b.deps)).status, 200); assert.equal(b.sent(), 1);
  f.row.status = 'REQUIRES_REVIEW';
  assert.equal((await handleGiftExecutionAbandonRequest(post({ requestId: id }), b.deps)).status, 409); assert.equal(b.sent(), 1);
  f.state.missing = true;
  assert.equal((await handleGiftExecutionAbandonRequest(post({ requestId: id, intent: f.intent }), b.deps)).status, 404); assert.equal(b.sent(), 1);
});

test('missing request can send only its complete authorized canonical local intent, not a guessed ID', async () => {
  const f = boundary(); f.f.state.missing = true;
  assert.equal((await handleGiftExecutionAbandonRequest(post({ requestId: id }), f.deps)).status, 409); assert.equal(f.sent(), 0);
  assert.equal((await handleGiftExecutionAbandonRequest(post({ requestId: id, intent: f.f.intent }), f.deps)).status, 200); assert.equal(f.sent(), 1);
});

test('racing completion is accepted only as a terminal reply and still requires the client GET proof', async () => {
  const f = boundary(); f.f.pending(); f.deps.abandon = async () => ({ ok: true, requestId: id, status: 'COMPLETED', giftAuditId: 'audit-1', result: f.f.result });
  const response = await handleGiftExecutionAbandonRequest(post({ requestId: id }), f.deps);
  assert.equal(response.status, 200); const body = await response.json(); assert.equal(body.status, 'COMPLETED'); assert.match(body.message, /查询赠礼进度确认结果/);
});

test('unconfirmed, malformed or wrong-request abandonment replies never authorize a new gift', async () => {
  for (const result of [{ ok: true, requestId: id, status: 'PENDING' }, { ok: true, requestId: 'other', status: 'ABANDONED' },
    { ok: true, requestId: id, status: 'ABANDONED', giftAuditId: 'audit-1', result: {} }, { ok: true, requestId: id, status: 'COMPLETED' }]) {
    const f = boundary(); f.f.pending(); f.deps.abandon = async () => result;
    assert.equal((await handleGiftExecutionAbandonRequest(post({ requestId: id }), f.deps)).status, 503);
  }
  const f = boundary(); f.f.pending(); f.deps.abandon = async () => { throw new Error('postgres://secret'); };
  const response = await handleGiftExecutionAbandonRequest(post({ requestId: id }), f.deps);
  assert.equal(response.status, 503); assert.ok(!(await response.text()).includes('postgres'));
});
