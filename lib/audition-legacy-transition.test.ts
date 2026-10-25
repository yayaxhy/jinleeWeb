import test from 'node:test';
import assert from 'node:assert/strict';
import { createAuditionLegacyService, parseAuditionLegacyCommand, AuditionLegacyError, type AuditionLegacyCommand, type AuditionLegacyState, type AuditionLegacyReceipt, type AuditionLegacyStore, type AuditionLegacyInvite } from './audition-legacy-transition';
const A = '100000000000000001', B = '100000000000000002', ADMIN = '100000000000000003';
const now = new Date('2026-10-24T12:00:00.000Z');
function command(overrides: Partial<AuditionLegacyCommand> = {}): AuditionLegacyCommand { return { requestId: '12345678-1234-4234-8234-123456789012', inviteId: 'invite_1', bossDlmId: 'DLM_A', workerDlmId: 'DLM_B', bossDiscordIdSnapshot: A, workerDiscordIdSnapshot: B, peiwanId: 18, quotedGross: '25.00', evidenceReference: 'discord-message-original-123', evidenceNote: '已核实原派单报价与双方身份，双方均确认未入房且账目未扣费。', confirmedUnpaidAndNotJoined: true, ...overrides }; }
function state(): AuditionLegacyState { return {
  invite: { id: 'invite_1', orderRequestId: 'request_1', bossId: A, workerId: B, roomChannelId: '100000000000000010', roomGuildId: '100000000000000011', bossDlmId: null, workerDlmId: null, bossDiscordIdSnapshot: null, workerDiscordIdSnapshot: null, peiwanId: null, quotedGross: null, status: 'PENDING', failureReason: null, transactionId: null, grossAmount: null, feeAmount: null, netAmount: null, createdAt: '2026-10-24T11:55:00.000Z', updatedAt: '2026-10-24T11:55:00.000Z', expiresAt: '2026-10-24T12:05:00.000Z', acceptedAt: null, joinedAt: null, chargedAt: null, fulfilledAt: null, declinedAt: null, canceledAt: null },
  request: { orderId: 'request_1', ownerId: A, createdAt: '2026-10-24T11:54:00.000Z' }, ledgers: [], audits: [], payments: [],
  accounts: [{ dlmId: 'DLM_A', discordUserId: A }, { dlmId: 'DLM_B', discordUserId: B }], members: [A, B], bindings: [{ dlmId: 'DLM_A', providerUserId: A }, { dlmId: 'DLM_B', providerUserId: B }], profile: { PEIWANID: 18, discordUserId: B }, ownership: [],
}; }
function fixture() {
  const f = { state: state(), receipts: [] as AuditionLegacyReceipt[], writes: [] as string[], failSave: false, failFill: false, onLock: () => {}, tamperAfter: false };
  let tail = Promise.resolve();
  const service = createAuditionLegacyService({ async transaction(body) {
    let release!: () => void; const preceding = tail; tail = new Promise<void>(r => { release = r; }); await preceding;
    const snapshot = structuredClone({ state: f.state, receipts: f.receipts, writes: f.writes });
    const store: AuditionLegacyStore = {
      async lockRequest() { f.writes.push('request-lock'); }, async lockParticipantsAndInvite() { f.writes.push('participants-invite-lock'); f.onLock(); },
      async receipt(id) { return f.receipts.find(r => r.requestId === id) ?? null; }, async receiptForInvite(id) { return f.receipts.find(r => r.inviteId === id) ?? null; },
      async load() { return structuredClone(f.state); },
      async fill(before, changes) { if (f.failFill || before.updatedAt !== f.state.invite.updatedAt) return false; f.writes.push('metadata-only'); f.state.invite = { ...f.state.invite, ...changes, quotedGross: String(Number(changes.quotedGross ?? f.state.invite.quotedGross)), updatedAt: now.toISOString() } as AuditionLegacyInvite; if (f.tamperAfter) f.state.invite.status = 'FULFILLED'; return true; },
      async save(receipt) { if (f.failSave) throw new Error('storage failed'); f.writes.push('immutable-receipt'); f.receipts.push(structuredClone(receipt)); },
    };
    try { return await body(store); } catch (error) { f.state = snapshot.state; f.receipts = snapshot.receipts; f.writes = snapshot.writes; throw error; } finally { release(); }
  } }, () => now);
  return { f, service };
}
const rejects = (promise: Promise<unknown>, code: string) => assert.rejects(promise, error => error instanceof AuditionLegacyError && error.code === code);

test('original manual quote is preserved, only null metadata filled, unchanged status/time/money, atomic receipt', async () => {
  const { f, service } = fixture(); const before = structuredClone(f.state.invite); const c = command();
  const preview = await service.preview(ADMIN, c); assert.equal(preview.after.quotedGross, '25.00'); assert.equal(f.writes.length, 0);
  const receipt = await service.execute(ADMIN, 'ADMIN_DLM', c, preview.previewHash, true);
  for (const field of ['status', 'expiresAt', 'acceptedAt', 'joinedAt', 'chargedAt', 'grossAmount', 'feeAmount', 'netAmount'] as const) assert.equal(f.state.invite[field], before[field]);
  assert.equal(f.state.invite.quotedGross, '25'); assert.equal(receipt.beforeSnapshot.invite.quotedGross, null); assert.equal(receipt.afterSnapshot.quotedGross, '25');
  assert.deepEqual(f.writes, ['request-lock', 'participants-invite-lock', 'metadata-only', 'immutable-receipt']);
});
test('same request replay returns original result and does not refill', async () => {
  const { f, service } = fixture(); const c = command(); const p = await service.preview(ADMIN, c); const first = await service.execute(ADMIN, null, c, p.previewHash, true);
  f.state.invite.status = 'FULFILLED'; const next = await service.execute(ADMIN, null, c, p.previewHash, true); assert.deepEqual(next, first);
  assert.equal(f.writes.filter(v => v === 'metadata-only').length, 1); assert.deepEqual(await service.query(ADMIN, c.requestId), first);
  await rejects(service.execute(ADMIN, null, command({ quotedGross: '30' }), p.previewHash, true), 'request_conflict');
});
test('no metadata defaults or current quote accepted; explicit original evidence required', () => {
  const c = command(); assert.equal(parseAuditionLegacyCommand({ ...c, quotedGross: '0' }).quotedGross, '0.00');
  for (const override of [{ quotedGross: '' }, { quotedGross: '1e2' }, { quotedGross: '1.001' }, { quotedGross: '-1' }, { confirmedUnpaidAndNotJoined: false }, { evidenceReference: '' }, { evidenceNote: '' }, { peiwanId: null }, { bossDlmId: '' }, { currentQuote: '50' }]) assert.throws(() => parseAuditionLegacyCommand({ ...c, ...override }), AuditionLegacyError);
});
test('existing snapshot may agree but never overwritten, decimal comparisons exact', async () => {
  const { f, service } = fixture(); f.state.invite.bossDlmId = 'DLM_A'; f.state.invite.quotedGross = '25';
  const p = await service.preview(ADMIN, command()); assert.ok(!('bossDlmId' in p.changes)); assert.ok(!('quotedGross' in p.changes));
  await rejects(service.preview(ADMIN, command({ bossDlmId: 'WRONG' })), 'identity_conflict');
  await rejects(service.preview(ADMIN, command({ quotedGross: '250' })), 'snapshot_conflict');
  f.state.invite.quotedGross = '10'; await rejects(service.preview(ADMIN, command({ quotedGross: '100' })), 'snapshot_conflict');
});
test('joined, charged, unknown, expired and receipt candidates never become unpaid', async () => {
  for (const patch of [{ joinedAt: now.toISOString() }, { chargedAt: now.toISOString() }, { transactionId: 'P1' }, { grossAmount: '0' }, { failureReason: 'settlement_unknown' }, { status: 'FULFILLED' }, { expiresAt: now.toISOString() }, { status: 'ACCEPTED' }]) {
    const { f, service } = fixture(); Object.assign(f.state.invite, patch); await rejects(service.preview(ADMIN, command()), 'requires_review'); assert.equal(f.writes.length, 0);
  }
  for (const key of ['ledgers', 'audits', 'payments'] as const) { const { f, service } = fixture(); (f.state[key] as unknown[]).push({ id: 'existing-payment' }); await rejects(service.preview(ADMIN, command()), 'requires_review'); }
});
test('accepted original timestamp remains unchanged', async () => {
  const { f, service } = fixture(); f.state.invite.status = 'ACCEPTED'; f.state.invite.acceptedAt = '2026-10-24T11:57:00.000Z';
  const p = await service.preview(ADMIN, command()); await service.execute(ADMIN, null, command(), p.previewHash, true); assert.equal(f.state.invite.acceptedAt, '2026-10-24T11:57:00.000Z');
});
test('current identity, original request owner, profile and migration conflicts reject instead of guessing', async () => {
  const changes: Array<(s: AuditionLegacyState) => void> = [s => { s.accounts[0].discordUserId = B; }, s => { s.request!.ownerId = B; }, s => { s.profile!.PEIWANID = 55; }, s => { s.bindings[0].dlmId = 'OTHER'; }, s => { s.members = [A]; }, s => { s.ownership.push({ identityKind: 'DISCORD', identityKey: A, originalDlmId: 'DLM_A', retiredAt: now.toISOString() }); }];
  for (const change of changes) { const { f, service } = fixture(); change(f.state); await rejects(service.preview(ADMIN, command()), 'identity_conflict'); }
});
test('preview changes and concurrent status changes after locks block mutation', async () => {
  const { f, service } = fixture(); const c = command(), p = await service.preview(ADMIN, c); f.state.invite.expiresAt = '2026-10-24T12:06:00.000Z';
  await rejects(service.execute(ADMIN, null, c, p.previewHash, true), 'preview_changed');
  const p2 = await service.preview(ADMIN, c); f.onLock = () => { f.state.invite.joinedAt = now.toISOString(); };
  await rejects(service.execute(ADMIN, null, c, p2.previewHash, true), 'requires_review'); assert.equal(f.receipts.length, 0);
});
test('save failure, compare-and-swap failure and unexpected after state roll back metadata', async () => {
  for (const kind of ['failSave', 'failFill', 'tamperAfter'] as const) { const { f, service } = fixture(); const c = command(), p = await service.preview(ADMIN, c), before = structuredClone(f.state); f[kind] = true; await assert.rejects(service.execute(ADMIN, null, c, p.previewHash, true)); assert.deepEqual(f.state, before); assert.equal(f.receipts.length, 0); }
});
test('two requests cannot both fill the same invitation', async () => {
  const { f, service } = fixture(); const a = command(), b = command({ requestId: '22345678-1234-4234-8234-123456789012' });
  const pa = await service.preview(ADMIN, a), pb = await service.preview(ADMIN, b);
  const results = await Promise.allSettled([service.execute(ADMIN, null, a, pa.previewHash, true), service.execute(ADMIN, null, b, pb.previewHash, true)]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1); assert.equal(f.receipts.length, 1);
});
test('explicit confirmation and original preview required; valid actor alone not HTTP authorization', async () => {
  const { f, service } = fixture(); await rejects(service.execute(ADMIN, null, command(), '0'.repeat(64), false), 'confirmation_required');
  await rejects(service.preview('bad', command()), 'forbidden'); assert.equal(f.writes.length, 0);
});
