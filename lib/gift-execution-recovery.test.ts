import assert from 'node:assert/strict';
import test from 'node:test';
import { createTargetConfirmationCodec, normalizeTargetConfirmationScope, type TargetConfirmationEvidence } from './target-confirmation';
import { assertPreparedGiftRecovery, buildGiftRecoveryPreparation, GiftRecoveryConflict, loadGiftRecoveryList, registerGiftRecovery, type GiftRecoveryDb } from './gift-execution-recovery';
import { handleGiftRecoveryList, handleGiftRecoveryPrepare } from './gift-execution-recovery-request';
import type { SessionSnapshot } from '../types/session';
const id = '12345678-1234-4123-8123-123456789abc';
const payer = '111111111111111111'; const receiver = '222222222222222222'; const operator = '333333333333333333';
const at = new Date('2026-10-24T12:00:00.000Z');
const user: SessionSnapshot = { dlmId: 'PAYER', discordId: payer, username: '老板', sessionVersion: 1 };
const admin: SessionSnapshot = { dlmId: 'STAFF', discordId: operator, username: '客服', sessionVersion: 1 };
function evidence(delegated = false): TargetConfirmationEvidence {
  return { caller: { dlmId: delegated ? 'STAFF' : 'PAYER', discordUserId: delegated ? operator : payer },
    scope: normalizeTargetConfirmationScope(delegated ? { purpose: 'delegated-gift', target: '42', payerDlmId: 'PAYER', giftName: '测试礼物', quantity: 2 } : { purpose: 'gift', target: '42', lotteryId: 'draw-1', prizeName: '测试礼物代金券' }),
    target: { dlmId: 'RECEIVER', discordUserId: receiver, peiwanId: 42, displayName: '陪玩' },
    payer: delegated ? { dlmId: 'PAYER', discordUserId: payer, displayName: '老板' } : null,
    selectedVoucher: delegated ? null : { source: 'lottery', voucherId: 'draw-1', prizeName: '测试礼物代金券' } };
}
function fixture(session = user) {
  const rows = new Map<string, Record<string, any>>();
  const state = { legacy: false, sessionVersion: 1, currentDiscord: session.discordId, inserted: 0, listArgs: null as any, listRows: null as null | any[], aliases: [] as any[] };
  const db = {
    dlmUser: { findUnique: async () => ({ discordUserId: state.currentDiscord, sessionVersion: state.sessionVersion, member: { discordUserId: state.currentDiscord } }) },
    accountOwnership: { findMany: async ({ where }: any) => state.aliases.filter(row => Object.entries(where).every(([key, value]) => row[key] === value)) },
    dlmAdminOperation: { findUnique: async () => state.legacy ? { id: 'legacy' } : null },
    giftExecutionRequest: {
      findUnique: async ({ where }: any) => rows.get(where.requestId) ?? null,
      createMany: async ({ data }: any) => { if (rows.has(data.requestId)) return { count: 0 }; rows.set(data.requestId, { ...structuredClone(data), createdAt: at }); state.inserted++; return { count: 1 }; },
      findMany: async (args: any) => { state.listArgs = args; return state.listRows ?? [...rows.values()].filter(row => args.where.recoveryOwnerDlmId.in.includes(row.recoveryOwnerDlmId) && row.kind === args.where.kind); },
    },
    $queryRaw: async () => [{ requestId: id }],
  } as unknown as GiftRecoveryDb;
  return { db, rows, state };
}
const prepared = (delegated = false) => buildGiftRecoveryPreparation(evidence(delegated), delegated ? 'DELEGATED_GIFT' : 'VOUCHER_GIFT', '老板');

test('server derives the same Bot voucher/delegated protocol flags and fixed identities', () => {
  const a = prepared().intent; const b = prepared(true).intent;
  assert.equal(a.couponVoucherId, null); assert.equal(a.lotteryVoucherId, 'draw-1'); assert.equal(a.giftName, '测试礼物'); assert.equal(a.quantity, '1');
  assert.equal(a.notifyGiverPointsDm, true); assert.equal(a.feedAnonymous, false); assert.equal(a.operatorDiscordId, null);
  assert.equal(b.quantity, '2'); assert.equal(b.source, 'delegate'); assert.equal(b.transactionLabel, '客服代打赏'); assert.equal(b.operatorDiscordId, operator);
  assert.equal(b.notifyGiverPointsDm, false); assert.equal(b.feedAnonymous, true); assert.equal(b.lotteryVoucherId, null);
});
test('approved migrated owner recovers the original intent for lookup or cancellation but cannot prepare or execute it', async () => {
  const f = fixture(); await registerGiftRecovery(f.db, user, id, prepared()); const original = structuredClone(f.rows.get(id));
  const current = { ...user, dlmId: 'NEW', discordId: '999999999999999999' }; f.state.currentDiscord = current.discordId;
  f.state.aliases.push({ identityKind: 'DLM', identityKey: 'PAYER', originalDlmId: 'PAYER', currentDlmId: 'NEW' },
    { identityKind: 'DISCORD', identityKey: payer, originalDlmId: 'PAYER', currentDlmId: 'NEW' });
  const page = await loadGiftRecoveryList(f.db, current, 'VOUCHER_GIFT', null, at);
  assert.equal(page.records[0].inherited, true); assert.deepEqual(page.records[0].actor, { dlmId: 'NEW', discordId: current.discordId });
  assert.equal(page.records[0].originalActor?.dlmId, 'PAYER'); assert.equal(page.records[0].intent.payerDlmId, 'PAYER');
  await assert.rejects(assertPreparedGiftRecovery(f.db, current, id, prepared().intent), GiftRecoveryConflict);
  await assert.rejects(registerGiftRecovery(f.db, current, id, prepared()), GiftRecoveryConflict);
  assert.deepEqual(f.rows.get(id), original);
  const { createGiftExecutionController } = await import('./gift-execution-client'); const writes: string[] = [];
  const review = { requestId: id, status: 'PENDING', verified: false, intent: page.records[0].intent,
    giftAuditId: null, transactionId: null, individualTransactionId: null, gross: null, payable: null,
    reverted: false, reverts: [], message: '待核实' };
  const controller = createGiftExecutionController({ actor: { dlmId: current.dlmId, discordId: current.discordId }, kind: 'VOUCHER_GIFT',
    newId: () => '12345678-1234-4123-8123-000000000001', fetch: (async (url, init) => {
      if (init?.method === 'POST') {
        writes.push(String(url)); assert.deepEqual(JSON.parse(String(init.body)), { requestId: id, intent: prepared().intent });
        review.status = 'ABANDONED'; review.verified = true;
      }
      return String(url).includes('/recovery?') ? Response.json({ ok: true, ...page }) : Response.json({ ok: true, review });
    }) as typeof fetch });
  controller.refresh(); await controller.refreshHistory();
  assert.equal(controller.getSnapshot().records[0].inherited, true);
  await controller.abandon(); assert.equal(writes.length, 0); // A list entry alone cannot authorize cancellation.
  await controller.query(); await controller.abandon();
  assert.deepEqual(writes, ['/api/profile/gift-executions/abandon']);
  assert.equal(controller.getSnapshot().review?.status, 'ABANDONED');

});
test('old Discord reused by another account does not inherit migrated recovery', async () => {
  const f = fixture(); await registerGiftRecovery(f.db, user, id, prepared());
  f.state.aliases.push({ identityKind: 'DLM', identityKey: 'PAYER', originalDlmId: 'PAYER', currentDlmId: 'TARGET' });
  assert.equal((await loadGiftRecoveryList(f.db, { ...user, dlmId: 'REUSED' }, 'VOUCHER_GIFT', null, at)).records.length, 0);
});
test('first prepare inserts ownership and intention together; repeat returns created false without mutation', async () => {
  const f = fixture(); const p = prepared();
  const first = await registerGiftRecovery(f.db, user, id.toUpperCase(), p);
  const second = await registerGiftRecovery(f.db, user, id, p);
  assert.equal(first.created, true); assert.equal(second.created, false); assert.equal(f.state.inserted, 1);
  assert.deepEqual(first.record, second.record); assert.equal(first.record.actor.dlmId, 'PAYER');
  assert.equal(f.rows.get(id)!.status, 'PENDING'); assert.equal('confirmationToken' in f.rows.get(id)!.recoverySnapshot, false);
  await assertPreparedGiftRecovery(f.db, user, id, p.intent);
});
test('registration receipt loss still leaves a discoverable record on another device', async () => {
  const f = fixture(); await registerGiftRecovery(f.db, user, id, prepared());
  const page = await loadGiftRecoveryList(f.db, { ...user }, 'VOUCHER_GIFT', null, at);
  assert.equal(page.records[0].requestId, id); assert.equal(page.records[0].phase, 'UNCONFIRMED'); assert.equal(page.nextCursor, null);
});
test('completed or abandoned matching registrations never reset state or permit another first execution', async () => {
  for (const status of ['COMPLETED', 'ABANDONED']) {
    const f = fixture(); await registerGiftRecovery(f.db, user, id, prepared()); f.rows.get(id)!.status = status;
    const retry = await registerGiftRecovery(f.db, user, id, prepared());
    assert.equal(retry.created, false); assert.equal(f.rows.get(id)!.status, status);
    assert.equal((await loadGiftRecoveryList(f.db, user, 'VOUCHER_GIFT', null, at)).records.length, 1);
  }
});
test('same UUID with changed receiver, gift or selected voucher conflicts', async () => {
  const f = fixture(); await registerGiftRecovery(f.db, user, id, prepared());
  for (const change of [{ giftName: '另一个' }, { receiverDlmId: 'OTHER' }, { lotteryVoucherId: 'draw-2' }]) {
    await assert.rejects(registerGiftRecovery(f.db, user, id, { ...prepared(), intent: { ...prepared().intent, ...change } }), GiftRecoveryConflict);
  }
  assert.equal(f.rows.get(id)!.intent.giftName, '测试礼物');
});
test('another staff member cannot claim or forward same delegated UUID, even if an admin', async () => {
  const f = fixture(admin); await registerGiftRecovery(f.db, admin, id, prepared(true));
  const other = { ...admin, dlmId: 'OTHER-STAFF' };
  await assert.rejects(registerGiftRecovery(f.db, other, id, prepared(true)), GiftRecoveryConflict);
  await assert.rejects(assertPreparedGiftRecovery(f.db, other, id, prepared(true).intent), GiftRecoveryConflict);
  assert.equal((await loadGiftRecoveryList(f.db, other, 'DELEGATED_GIFT', null, at)).records.length, 0);
});
test('reused Discord at another DLM and stale session version do not inherit recovery', async () => {
  const f = fixture(); await registerGiftRecovery(f.db, user, id, prepared());
  assert.equal((await loadGiftRecoveryList(f.db, { ...user, dlmId: 'REBOUND' }, 'VOUCHER_GIFT', null, at)).records.length, 0);
  f.state.sessionVersion = 2;
  await assert.rejects(loadGiftRecoveryList(f.db, user, 'VOUCHER_GIFT', null, at), GiftRecoveryConflict);
  await assert.rejects(registerGiftRecovery(f.db, user, id, prepared()), GiftRecoveryConflict);
});
test('old unowned requests and legacy operation IDs are never silently claimed', async () => {
  const f = fixture(); await registerGiftRecovery(f.db, user, id, prepared());
  f.rows.get(id)!.recoveryOwnerDlmId = null;
  await assert.rejects(registerGiftRecovery(f.db, user, id, prepared()), GiftRecoveryConflict);
  const other = fixture(); other.state.legacy = true;
  await assert.rejects(registerGiftRecovery(other.db, user, id, prepared()), GiftRecoveryConflict);
  assert.equal(other.rows.size, 0);
});
test('financial forwarding requires existing same-owner complete intention', async () => {
  const f = fixture(); await assert.rejects(assertPreparedGiftRecovery(f.db, user, id, prepared().intent), GiftRecoveryConflict);
  await registerGiftRecovery(f.db, user, id, prepared());
  await assert.rejects(assertPreparedGiftRecovery(f.db, user, id, { ...prepared().intent, quantity: '2' }), GiftRecoveryConflict);
});
test('pagination restricts fixed owner, keeps old unresolved rows and includes recent completed rows', async () => {
  const f = fixture(); await registerGiftRecovery(f.db, user, id, prepared()); const row = f.rows.get(id)!;
  f.state.listRows = Array.from({ length: 21 }, (_, i) => ({ ...row, requestId: `12345678-1234-4123-8123-${String(i).padStart(12, '0')}` }));
  const page = await loadGiftRecoveryList(f.db, user, 'VOUCHER_GIFT', null, at);
  assert.equal(page.records.length, 20); assert.ok(page.nextCursor);
  assert.deepEqual(f.state.listArgs.where.recoveryOwnerDlmId, { in: ['PAYER'] });
  assert.deepEqual(f.state.listArgs.where.AND[0].OR[0], { status: { notIn: ['COMPLETED', 'ABANDONED'] } });
  assert.equal(f.state.listArgs.where.AND[0].OR[1].updatedAt.gte.toISOString(), '2026-09-24T12:00:00.000Z');
  await loadGiftRecoveryList(f.db, user, 'VOUCHER_GIFT', page.nextCursor, at);
  assert.equal(f.state.listArgs.where.AND.length, 2);
  await assert.rejects(loadGiftRecoveryList(f.db, user, 'VOUCHER_GIFT', 'bad cursor', at), GiftRecoveryConflict);
});
test('HTTP prepare validates signed scope, ignores no client identity, and never executes business', async () => {
  const codec = createTargetConfirmationCodec({ secret: 'test-secret-with-at-least-thirty-two-characters', now: () => at.getTime() });
  const proof = evidence(); const token = codec.issue(proof).confirmationToken; const f = fixture();
  const deps = { session: async () => user, isAdmin: () => false, verify: codec.verify, publicUrl: 'https://example.test',
    register: (s: SessionSnapshot, r: string, p: ReturnType<typeof prepared>) => registerGiftRecovery(f.db, s, r, p) };
  const body = { requestId: id, kind: 'VOUCHER_GIFT', confirmationToken: token, scope: proof.scope };
  const req = (data: unknown) => new Request('https://example.test/api/profile/gift-executions/prepare', { method: 'POST', headers: { origin: 'https://example.test', 'content-type': 'application/json' }, body: JSON.stringify(data) });
  const response = await handleGiftRecoveryPrepare(req(body), deps); assert.equal(response.status, 200);
  assert.equal((await response.json()).created, true); assert.equal(f.rows.get(id)!.status, 'PENDING');
  const duplicate = await handleGiftRecoveryPrepare(req(body), deps); assert.equal((await duplicate.json()).created, false);
  assert.equal((await handleGiftRecoveryPrepare(req({ ...body, actor: { dlmId: 'VICTIM' } }), deps)).status, 400);
  assert.equal((await handleGiftRecoveryPrepare(req({ ...body, scope: { ...proof.scope, target: '43' } }), deps)).status, 409);
});
test('HTTP delegated recovery requires current admin; actor filters and duplicate kind are rejected', async () => {
  let loads = 0; const deps = { session: async () => admin, isAdmin: () => false, load: async () => { loads++; return { records: [], nextCursor: null }; } };
  assert.equal((await handleGiftRecoveryList(new Request('https://example.test/?kind=DELEGATED_GIFT'), deps)).status, 403);
  assert.equal((await handleGiftRecoveryList(new Request('https://example.test/?kind=VOUCHER_GIFT&actor=OTHER'), deps)).status, 400);
  assert.equal((await handleGiftRecoveryList(new Request('https://example.test/?kind=VOUCHER_GIFT&kind=VOUCHER_GIFT'), deps)).status, 400);
  assert.equal(loads, 0);
});

test('concurrent registrations grant only one first-execution receipt and reject a conflicting intention', async () => {
  const f = fixture(); const same = await Promise.all([registerGiftRecovery(f.db, user, id, prepared()), registerGiftRecovery(f.db, user, id, prepared())]);
  assert.equal(same.filter(row => row.created).length, 1); assert.equal(f.state.inserted, 1);
  const g = fixture(); const conflict = await Promise.allSettled([registerGiftRecovery(g.db, user, id, prepared()),
    registerGiftRecovery(g.db, user, id, { ...prepared(), intent: { ...prepared().intent, giftName: '另一个礼物' } })]);
  assert.equal(conflict.filter(row => row.status === 'fulfilled').length, 1); assert.equal(g.rows.size, 1);
});
test('unbound payer and fractional delegated quantity retain Bot-compatible identity and amount', () => {
  const proof = evidence(true); proof.payer!.discordUserId = null; proof.scope.quantity = 0.00001;
  const result = buildGiftRecoveryPreparation(proof, 'DELEGATED_GIFT', '客服');
  assert.equal(result.intent.payerDiscordId, null); assert.equal(result.intent.quantity, '0.00001'); assert.equal(result.intent.operatorDiscordId, operator);
});
test('real browser controller accepts the real prepare response; another device recovers a lost prepare receipt without sending money', async () => {
  const { createGiftExecutionController, giftIntentForConfirmation } = await import('./gift-execution-client');
  const f = fixture(); const codec = createTargetConfirmationCodec({ secret: 'offline-prepare-browser-test', now: () => at.getTime() });
  const proof = evidence(); const signed = codec.issue(proof);
  const scope = { purpose: 'gift' as const, target: '42', lotteryId: 'draw-1', prizeName: '测试礼物代金券' };
  const confirmation = { ...signed, target: proof.target, selectedVoucher: proof.selectedVoucher! };
  const actor = { dlmId: user.dlmId!, discordId: user.discordId! };
  const intent = giftIntentForConfirmation(actor, scope, confirmation, '测试礼物');
  let financialPosts = 0; let losePrepareReceipt = true;
  const prepareDeps = { session: async () => user, isAdmin: () => false, verify: codec.verify, publicUrl: 'https://example.test',
    register: (s: SessionSnapshot, r: string, p: ReturnType<typeof prepared>) => registerGiftRecovery(f.db, s, r, p) };
  const transport = (async (url, init) => {
    const path = String(url);
    const request = new Request(`https://example.test${path}`, { ...init, headers: { ...init?.headers, origin: 'https://example.test' } });
    if (path.endsWith('/prepare')) {
      const response = await handleGiftRecoveryPrepare(request, prepareDeps);
      if (losePrepareReceipt) throw new Error('lost registration reply');
      return response;
    }
    if (path.includes('/recovery?')) return handleGiftRecoveryList(request, { session: async () => user, isAdmin: () => false,
      load: (session, kind, cursor) => loadGiftRecoveryList(f.db, session, kind, cursor, at) });
    if (path === '/api/lottery/use') {
      financialPosts++; await assertPreparedGiftRecovery(f.db, user, JSON.parse(String(init?.body)).requestId, intent);
      return Response.json({ ok: true });
    }
    return Response.json({ ok: false }, { status: 404 });
  }) as typeof fetch;
  const create = (requestId: string) => createGiftExecutionController({ actor, kind: 'VOUCHER_GIFT', newId: () => requestId, now: () => at.getTime(), fetch: transport });
  const input = { scope, confirmation, intent, path: '/api/lottery/use', body: { mode: 'gift', target: '42', lotteryId: 'draw-1', prizeName: scope.prizeName } };
  const first = create(id); first.refresh(); await first.submit(input);
  assert.equal(financialPosts, 0); assert.equal(f.rows.size, 1);
  const otherDevice = create('12345678-1234-4123-8123-123456789abd'); otherDevice.refresh(); await otherDevice.refreshHistory();
  assert.equal(otherDevice.getSnapshot().records[0].requestId, id); assert.equal(financialPosts, 0);
  losePrepareReceipt = false; await otherDevice.submit({ ...input, confirmation: { ...confirmation } });
  assert.equal(financialPosts, 1); assert.equal(f.rows.size, 2);
});
