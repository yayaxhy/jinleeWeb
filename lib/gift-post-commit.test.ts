import assert from 'node:assert/strict';
import test from 'node:test';
import type { SessionSnapshot } from '../types/session';
import { canRetryGiftPostCommitTask, loadGiftPostCommitTasks, prepareGiftPostCommitRetry, type GiftPostCommitDb, type GiftPostCommitTaskView, type GiftPostCommitView } from './gift-post-commit';
import { handleGiftPostCommitRequest, type GiftPostCommitRequestDeps } from './gift-post-commit-request';
import { createGiftPostCommitController } from './gift-post-commit-client';

const ID = 'a4322167-9ef8-4e04-abf3-7a904d059849';
const ADMIN = '123456789012345678';
const at = new Date('2026-10-22T12:00:00.000Z');
function fixture() {
  const session: SessionSnapshot = { dlmId: 'DLM_ADMIN', discordId: ADMIN, sessionVersion: 2, username: 'admin' };
  const identity = { discordUserId: ADMIN, sessionVersion: 2, member: { discordUserId: ADMIN } as { discordUserId: string } | null };
  const request = { requestId: ID, status: 'COMPLETED', giftAuditId: 'GA_1' as string | null };
  const task = { id: 'task_1', requestId: ID, kind: 'DISCORD_MESSAGE', taskKey: 'giver_dm', status: 'FAILED', attempts: 1,
    claimToken: null as string | null, claimedAt: at as Date | null, completedAt: null as Date | null, createdAt: new Date(), updatedAt: at, errorCode: 'gift_post_commit_safe_failure' as string | null,
    retries: [{ actorDiscordId: ADMIN, createdAt: at }], payload: { secret: 'PRIVATE_MESSAGE_CONTENT' }, result: { secret: 'PRIVATE_RECEIPT' } };
  const state = { missingIdentity: false, missingRequest: false, rows: [task], isAdmin: true, forwarded: [] as unknown[] };
  const reads: Array<{ model: string; args: unknown }> = [];
  const db = {
    dlmUser: { findUnique: async (args: unknown) => { reads.push({ model: 'identity', args }); return state.missingIdentity ? null : identity; } },
    giftExecutionRequest: { findUnique: async (args: unknown) => { reads.push({ model: 'request', args }); return state.missingRequest ? null : request; } },
    giftPostCommitTask: { findMany: async (args: unknown) => { reads.push({ model: 'tasks', args }); return state.rows; } },
  } as unknown as GiftPostCommitDb;
  const deps: GiftPostCommitRequestDeps = { session: async () => session, isAdmin: () => state.isAdmin,
    load: (current, admin, id) => loadGiftPostCommitTasks(db, current, admin, id),
    prepare: (current, admin, id, taskId) => prepareGiftPostCommitRetry(db, current, admin, id, taskId),
    retry: async input => { state.forwarded.push(input); return { ok: true, ...input }; }, publicUrl: 'https://console.test' };
  return { session, identity, request, task, state, db, deps, reads,
    load: () => loadGiftPostCommitTasks(db, session, state.isAdmin, ID),
    post: (body: unknown = { requestId: ID, taskId: 'task_1' }, origin = 'https://console.test') => handleGiftPostCommitRequest(new Request('https://console.test/api/admin/gift-post-commit', {
      method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify(body) }), deps),
    get: (query = `requestId=${ID}`) => handleGiftPostCommitRequest(new Request(`https://console.test/api/admin/gift-post-commit?${query}`), deps),
  };
}

test('production reader selects only safe task metadata and never returns payload/result/claim secrets', async () => {
  const f = fixture(); const view = await f.load();
  assert.equal(view.coverage, 'RECORDED'); assert.equal(view.tasks[0].canRetry, true); assert.deepEqual(view.tasks[0].retries, [{ actorDiscordId: ADMIN, createdAt: at.toISOString() }]);
  const output = JSON.stringify(view); for (const secret of ['PRIVATE_MESSAGE_CONTENT', 'PRIVATE_RECEIPT', 'claimToken', 'payload']) assert.equal(output.includes(secret), false);
  const taskQuery = f.reads.find(row => row.model === 'tasks')!.args as { select: Record<string, unknown>; where: unknown };
  assert.equal(taskQuery.select.payload, undefined); assert.equal(taskQuery.select.result, undefined); assert.deepEqual(taskQuery.where, { requestId: ID });
});

test('legacy completed request with no tasks reports not covered instead of all external actions completed', async () => {
  const f = fixture(); f.state.rows = []; const view = await f.load(); assert.equal(view.coverage, 'NOT_RECORDED');
  assert.match(view.message, /不能据此认定所有外部动作已经完成/); assert.equal(view.tasks.length, 0);
});

test('reader does not infer task completion or retract messages from current wallets, vouchers or Revert rows', async () => {
  const f = fixture(); const view = await f.load(); assert.equal(view.tasks[0].status, 'FAILED');
  assert.deepEqual(f.reads.map(row => row.model), ['identity', 'request', 'tasks']); assert.match(view.message, /礼物墙不再发放奖励/); assert.match(view.message, /不会撤回已发消息/);
});

for (const status of ['PENDING', 'RUNNING', 'SUCCEEDED', 'UNKNOWN', 'REQUIRES_REVIEW', 'SKIPPED']) test(`${status} is viewable but cannot be queued as a manual retry`, async () => {
  const f = fixture(); f.task.status = status; const view = await f.load(); assert.equal(view.tasks[0].canRetry, false);
  assert.equal((await f.post()).status, 409); assert.equal(f.state.forwarded.length, 0);
});
for (const [name, mutate] of [
  ['exhausted', (f: ReturnType<typeof fixture>) => { f.task.attempts = 3; }],
  ['zero attempts', (f: ReturnType<typeof fixture>) => { f.task.attempts = 0; }],
  ['negative attempts', (f: ReturnType<typeof fixture>) => { f.task.attempts = -1; }],
  ['noninteger attempts', (f: ReturnType<typeof fixture>) => { f.task.attempts = 1.5; }],
  ['active claim', (f: ReturnType<typeof fixture>) => { f.task.claimToken = 'PRIVATE_CLAIM'; }],
  ['unsupported kind', (f: ReturnType<typeof fixture>) => { f.task.kind = 'ROLE_SYNC'; }],
] as const) test(`${name} cannot bypass retry eligibility`, async () => {
  const f = fixture(); mutate(f); assert.equal(canRetryGiftPostCommitTask(f.task), false); assert.equal((await f.post()).status, 409); assert.equal(f.state.forwarded.length, 0);
});

test('historical claimedAt does not forbid a released explicit FAILED task retry', async () => {
  const f = fixture(); f.task.kind = 'GIFT_WALL'; f.task.attempts = 2; f.task.claimedAt = at;
  const res = await f.post({ requestId: ID.toUpperCase(), taskId: 'task_1' }); assert.equal(res.status, 200);
  assert.deepEqual(f.state.forwarded, [{ requestId: ID, taskId: 'task_1', actorDiscordId: ADMIN }]);
});

test('error codes outside the fixed Bot whitelist are redacted even if they look like identifiers', async () => {
  const f = fixture(); for (const code of ['postgres://private', 'secret_api_key_123', 'PRIVATE_MESSAGE_CONTENT']) {
    f.task.errorCode = code; const view = await f.load(); assert.equal(view.tasks[0].errorCode, 'task_error_requires_review'); assert.equal(JSON.stringify(view).includes(code), false);
  }
});
for (const code of ['gift_post_commit_safe_failure', 'gift_post_commit_database_failed', 'gift_post_commit_requires_review', 'gift_post_commit_send_unknown', 'gift_post_commit_stale_claim']) test(`safe code ${code} is observable`, async () => {
  const f = fixture(); f.task.errorCode = code; assert.equal((await f.load()).tasks[0].errorCode, code);
});

for (const [name, change] of [
  ['removed administrator', (f: ReturnType<typeof fixture>) => { f.state.isAdmin = false; }],
  ['missing DLM', (f: ReturnType<typeof fixture>) => { f.session.dlmId = null; }],
  ['missing Discord', (f: ReturnType<typeof fixture>) => { f.session.discordId = null; }],
  ['revoked session', (f: ReturnType<typeof fixture>) => { f.identity.sessionVersion = 3; }],
  ['changed Discord binding', (f: ReturnType<typeof fixture>) => { f.identity.discordUserId = '223456789012345678'; }],
  ['missing Member binding', (f: ReturnType<typeof fixture>) => { f.identity.member = null; }],
  ['deleted account', (f: ReturnType<typeof fixture>) => { f.state.missingIdentity = true; }],
] as const) test(`${name} denies GET and POST without any Bot call`, async () => {
  const f = fixture(); change(f); assert.equal((await f.get()).status, 403); assert.equal((await f.post()).status, 403); assert.equal(f.state.forwarded.length, 0);
  assert.equal(f.reads.some(row => row.model === 'tasks'), false);
});

test('anonymous request cannot read or queue a task', async () => {
  const f = fixture(); f.deps.session = async () => null; assert.equal((await f.get()).status, 401); assert.equal((await f.post()).status, 401); assert.equal(f.reads.length, 0);
});
for (const status of ['PENDING', 'ABANDONED', 'FAILED']) test(`original request ${status} blocks task actions even if a task row exists`, async () => {
  const f = fixture(); f.request.status = status; assert.equal((await f.get()).status, 409); assert.equal((await f.post()).status, 409); assert.equal(f.reads.some(row => row.model === 'tasks'), false);
});
test('missing original request and missing completed audit link never authorize queueing', async () => {
  const f = fixture(); f.state.missingRequest = true; assert.equal((await f.get()).status, 404);
  f.state.missingRequest = false; f.request.giftAuditId = null; assert.equal((await f.post()).status, 409); assert.equal(f.state.forwarded.length, 0);
});
test('task must belong to the exact original request; caller cannot nominate another task', async () => {
  const f = fixture(); assert.equal((await f.post({ requestId: ID, taskId: 'other_task' })).status, 404);
  f.task.requestId = 'other_request'; assert.equal((await f.get()).status, 409); assert.equal(f.state.forwarded.length, 0);
});

for (const [name, body] of [ ['actor', { requestId: ID, taskId: 'task_1', actorDiscordId: 'forged' }], ['payload', { requestId: ID, taskId: 'task_1', payload: { message: 'forged' } }],
  ['empty', {}], ['array', []], ['request', { requestId: 'invalid', taskId: 'task_1' }], ['long task', { requestId: ID, taskId: 'x'.repeat(151) }],
  ['bulk', { requestId: ID, taskId: ['task_1', 'task_2'] }], ['oversize', { requestId: ID, taskId: 'x'.repeat(17000) }] ] as const) test(`${name} POST payload is rejected before preparation/forward`, async () => {
  const f = fixture(); assert.ok((await f.post(body)).status >= 400); assert.equal(f.reads.length, 0); assert.equal(f.state.forwarded.length, 0);
});

test('cross-origin and malformed JSON POST fail before all task reads', async () => {
  const f = fixture(); assert.equal((await f.post(undefined, 'https://evil.example')).status, 403);
  const res = await handleGiftPostCommitRequest(new Request('https://console.test/api/admin/gift-post-commit', { method: 'POST', headers: { origin: 'https://console.test', 'content-type': 'application/json' }, body: '{' }), f.deps);
  assert.equal(res.status, 400); assert.equal(f.reads.length, 0);
});
for (const query of [`requestId=${ID}&requestId=${ID}`, `requestId=${ID}&taskId=other`, 'requestId=bad']) test(`invalid GET query ${query} performs no task reads`, async () => {
  const f = fixture(); assert.equal((await f.get(query)).status, 400); assert.equal(f.reads.length, 0);
});

test('Bot queue response uncertainty is redacted and never reports task succeeded', async () => {
  const f = fixture(); f.deps.retry = async () => { throw new Error('SECRET_NETWORK_DETAIL'); };
  const res = await f.post(); const body = await res.json(); assert.equal(res.status, 503); assert.match(body.message, /只读刷新/); assert.equal(JSON.stringify(body).includes('SECRET'), false);
});
test('malformed or mismatched Bot acknowledgement cannot be reported as accepted', async () => {
  const f = fixture(); f.deps.retry = async () => ({ ok: true, requestId: ID, taskId: 'other' }); assert.equal((await f.post()).status, 503);
});
test('read-only success is no-store and contains no mutation calls', async () => {
  const f = fixture(); const res = await f.get(); assert.equal(res.status, 200); assert.equal(res.headers.get('cache-control'), 'no-store'); assert.equal(f.state.forwarded.length, 0);
});

const taskView = (patch: Partial<GiftPostCommitTaskView> = {}): GiftPostCommitTaskView => ({ id: 'task_1', kind: 'DISCORD_MESSAGE', taskKey: 'giver_dm', status: 'FAILED', attempts: 1,
  claimedAt: at.toISOString(), completedAt: null, updatedAt: at.toISOString(), errorCode: 'gift_post_commit_safe_failure', canRetry: true, retries: [], ...patch });
const view = (task = taskView()): GiftPostCommitView => ({ requestId: ID, coverage: 'RECORDED', message: '只核实已记录任务，不影响原资金凭证', tasks: [task] });
const json = (data: unknown, status = 200) => Response.json(data, { status });
function client(run?: (path: string, body: unknown, count: number) => Promise<Response> | Response) {
  const calls: Array<{ path: string; body: unknown }> = [];
  const controller = createGiftPostCommitController(ID, (async (input, init) => {
    const path = String(input), body = init?.body ? JSON.parse(String(init.body)) : null; calls.push({ path, body });
    return run ? run(path, body, calls.length) : json({ ok: true, ...view() });
  }) as typeof fetch);
  return { controller, calls };
}

test('explicit retry sends one bounded POST and then only GET; it never invokes gift/abandon endpoints', async () => {
  const f = client((path, body) => body ? json({ ok: true, requestId: ID, taskId: 'task_1' }) : json({ ok: true, ...view(taskView({ status: path.includes('?') ? 'FAILED' : 'PENDING' })) }));
  await f.controller.refresh(); await f.controller.retry('task_1');
  assert.deepEqual(f.calls.map(call => call.body), [null, { requestId: ID, taskId: 'task_1' }, null]);
  assert.ok(f.calls.every(call => call.path.startsWith('/api/admin/gift-post-commit'))); assert.match(f.controller.getSnapshot().message!, /不代表任务已完成/);
});
test('lost queue response plus failed GET disables retry until a subsequent authoritative refresh', async () => {
  const f = client((_, body, count) => { if (body || count === 3) throw new Error('offline'); return json({ ok: true, ...view() }); });
  await f.controller.refresh(); await f.controller.retry('task_1'); assert.equal(f.controller.getSnapshot().blocked, true);
  await f.controller.retry('task_1'); assert.equal(f.calls.length, 3);
  await f.controller.refresh(); assert.equal(f.controller.getSnapshot().blocked, false); assert.equal(f.calls.filter(call => call.body).length, 1);
});
test('two immediate retry clicks while POST pending produce one attempt', async () => {
  let release!: () => void; const pending = new Promise<void>(resolve => { release = resolve; });
  const f = client(async (_, body) => { if (body) { await pending; return json({ ok: true, requestId: ID, taskId: 'task_1' }); } return json({ ok: true, ...view() }); });
  await f.controller.refresh(); const first = f.controller.retry('task_1'); await f.controller.retry('task_1'); release(); await first;
  assert.equal(f.calls.filter(call => call.body).length, 1);
});
for (const task of [taskView({ status: 'UNKNOWN', canRetry: false }), taskView({ status: 'RUNNING', canRetry: false }), taskView({ attempts: 3, canRetry: false }), taskView({ kind: 'ROLE_SYNC', canRetry: false })]) test(`client cannot force retry ${task.status}/${task.kind}/${task.attempts}`, async () => {
  const f = client(() => json({ ok: true, ...view(task) })); await f.controller.refresh(); await f.controller.retry('task_1'); assert.equal(f.calls.length, 1);
});
test('malformed server canRetry=true for UNKNOWN fails closed', async () => {
  const f = client(() => json({ ok: true, ...view(taskView({ status: 'UNKNOWN' })) })); await f.controller.refresh(); await f.controller.retry('task_1');
  assert.equal(f.controller.getSnapshot().blocked, true); assert.equal(f.calls.length, 1);
});
test('old out-of-order task fetch cannot overwrite newer completed status', async () => {
  let release!: (value: Response) => void; const old = new Promise<Response>(resolve => { release = resolve; });
  const f = client((_, __, count) => count === 1 ? old : json({ ok: true, ...view(taskView({ status: 'SUCCEEDED', canRetry: false })) }));
  const first = f.controller.refresh(); await f.controller.refresh(); release(json({ ok: true, ...view() })); await first;
  assert.equal(f.controller.getSnapshot().view?.tasks[0].status, 'SUCCEEDED');
});
test('another request task response cannot populate this original request panel', async () => {
  const f = client(() => json({ ok: true, ...view(), requestId: 'other' })); await f.controller.refresh(); assert.equal(f.controller.getSnapshot().view, null); assert.equal(f.controller.getSnapshot().blocked, true);
});


test('message retries expire after 24 hours while historical records remain queryable', async () => {
  const f = fixture();
  f.task.createdAt = new Date(Date.now() - 24 * 60 * 60_000);
  const view = await f.load();
  assert.equal(view.tasks.length, 1); assert.equal(view.tasks[0].canRetry, false);
  assert.equal((await f.post()).status, 409); assert.equal(f.state.forwarded.length, 0);
});

test('message retry lifetime has an exclusive expiry boundary and rejects future creation dates', () => {
  const f = fixture(); f.task.createdAt = at;
  assert.equal(canRetryGiftPostCommitTask(f.task, new Date(at.getTime() + 24 * 60 * 60_000 - 1)), true);
  assert.equal(canRetryGiftPostCommitTask(f.task, new Date(at.getTime() + 24 * 60 * 60_000)), false);
  assert.equal(canRetryGiftPostCommitTask(f.task, new Date(at.getTime() - 1)), false);
});
