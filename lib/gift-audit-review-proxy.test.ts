import assert from 'node:assert/strict';
import test from 'node:test';
import { handleGiftAuditReviewRequest } from './gift-audit-review-proxy';
import { parseGiftReviewCommand } from './gift-audit-review';

const ACTOR = '12345678901234567';
const command = { transactionId: 'IT1', requestId: '00000000-0000-4000-8000-000000000001', expectedSnapshotHash: 'a'.repeat(64),
  outcome: 'EVIDENCE_ADDED', note: '已收到付款方工单，请继续核对收款拆分与权益。', evidenceReferences: ['工单123'] };
function fixture() {
  const calls: Array<{ method: string; path: string; body?: Record<string, unknown> }> = [];
  const deps = {
    session: async (): Promise<{ discordId: string } | null> => ({ discordId: ACTOR }),
    isAdmin: (id: string) => id === ACTOR,
    get: async (path: string): Promise<unknown> => { calls.push({ method: 'GET', path }); return { ok: true, automaticReversalAuthorized: false }; },
    post: async (path: string, body: Record<string, unknown>): Promise<unknown> => { calls.push({ method: 'POST', path, body }); return { ok: true, automaticReversalAuthorized: false }; },
    publicUrl: 'https://console.test',
  };
  return { deps, calls };
}
const read = (query = 'transactionId=IT1') => new Request(`https://console.test/api/admin/gift-audit-review?${query}`);
const write = (body: unknown = command, headers: Record<string, string> = {}) => new Request('https://console.test/api/admin/gift-audit-review', {
  method: 'POST', headers: { Origin: 'https://console.test', 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body),
});

test('gift audit facts and evidence are restricted to admin sessions', async () => {
  for (const session of [null, { discordId: '23456789012345678' }]) for (const request of [read(), write()]) {
    const f = fixture(); f.deps.session = async () => session;
    assert.equal((await handleGiftAuditReviewRequest(request, f.deps)).status, 403);
    assert.deepEqual(f.calls, []);
  }
});
test('cross-origin, missing-origin and non-JSON writes never reach the Bot', async () => {
  for (const [headers, status] of [[{ Origin: 'https://wrong.test' }, 403], [{ Origin: '' }, 403], [{ 'Content-Type': 'text/plain' }, 415]] as const) {
    const f = fixture(); assert.equal((await handleGiftAuditReviewRequest(write(command, headers), f.deps)).status, status);
    assert.deepEqual(f.calls, []);
  }
});
test('only validated transaction and history cursor are forwarded by read-only GET', async () => {
  const f = fixture(); const response = await handleGiftAuditReviewRequest(read('transactionId=IT1&beforeNoteId=note-1'), f.deps);
  assert.equal(response.status, 200); assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.deepEqual(f.calls, [{ method: 'GET', path: '/internal/gift-audit-review?transactionId=IT1&beforeNoteId=note-1' }]);
  for (const query of ['', 'transactionId=IT1&transactionId=IT2', 'transactionId=../secret', 'transactionId=IT1&token=x', 'transactionId=IT1&beforeNoteId=a&beforeNoteId=b']) {
    const bad = fixture(); assert.equal((await handleGiftAuditReviewRequest(read(query), bad.deps)).status, 400); assert.equal(bad.calls.length, 0);
  }
});
test('the proxy substitutes authenticated admin identity and preserves the request ID', async () => {
  const f = fixture();
  assert.equal((await handleGiftAuditReviewRequest(write({ ...command, actorDiscordId: '23456789012345678' }), f.deps)).status, 200);
  assert.equal(f.calls[0].body?.actorDiscordId, ACTOR);
  assert.equal(f.calls[0].body?.requestId, command.requestId);
  assert.equal(f.calls[0].path, '/internal/gift-audit-review');
});
test('refund approvals, amount edits and invalid evidence fail validation', async () => {
  for (const changed of [{ outcome: 'APPROVED' }, { amount: '100' }, { note: '短' }, { note: '字'.repeat(2001) },
    { evidenceReferences: [] }, { evidenceReferences: ['重复', '重复'] }, { evidenceReferences: ['字'.repeat(301)] },
    { expectedSnapshotHash: 'bad' }, { requestId: 'not-uuid' }]) {
    assert.equal(parseGiftReviewCommand({ ...command, ...changed }), null);
    const f = fixture(); assert.equal((await handleGiftAuditReviewRequest(write({ ...command, ...changed }), f.deps)).status, 400);
    assert.equal(f.calls.length, 0);
  }
});
test('actual UTF-8 body bytes are bounded independently of Content-Length', async () => {
  for (const headers of [{}, { 'Content-Length': '1' }] as Array<Record<string, string>>) {
    const f = fixture(); const response = await handleGiftAuditReviewRequest(write({ ...command, note: '字'.repeat(6000) }, headers), f.deps);
    assert.equal(response.status, 413); assert.equal(f.calls.length, 0);
  }
  const f = fixture();
  assert.equal((await handleGiftAuditReviewRequest(write(command, { 'Content-Length': '20000' }), f.deps)).status, 413);
  assert.equal(f.calls.length, 0);
});
test('safe conflicts retain status while internal errors do not expose credentials', async () => {
  const f = fixture(); f.deps.post = async () => { throw Object.assign(new Error('原交易已变化'), { status: 409, safeMessage: true }); };
  const response = await handleGiftAuditReviewRequest(write(), f.deps);
  assert.equal(response.status, 409); assert.equal((await response.json()).message, '原交易已变化');
  f.deps.get = async () => { throw new Error('postgres://secret @ private-host'); };
  const failed = await handleGiftAuditReviewRequest(read(), f.deps);
  assert.equal(failed.status, 503); assert.ok(!(await failed.text()).includes('postgres'));
});
test('an unexpected upstream approval response is refused', async () => {
  const f = fixture(); f.deps.post = async () => ({ ok: true, automaticReversalAuthorized: true });
  assert.equal((await handleGiftAuditReviewRequest(write(), f.deps)).status, 503);
});
