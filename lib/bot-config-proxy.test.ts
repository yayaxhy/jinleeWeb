import assert from 'node:assert/strict';
import test from 'node:test';
import { handleBotConfigRequest } from './bot-config-proxy';
import { parseBotSettings, type BotConfigState } from './bot-config';
import { DEFAULT_ORDER_REQUEST_COPY, ORDER_REQUEST_COPY_LIMITS } from './order-request-copy';

const ADMIN = '12345678901234567';
const SPOOFED = '98765432109876543';
const settings = { schemaVersion: 1 as const, orderBroadcastChannelIds: [ADMIN], orderAnonChannelId: SPOOFED, orderPublicAcceptChannelIds: [] };
const state: BotConfigState = {
  ok: true, enabled: true, guildId: ADMIN, revision: 2, activeVersion: 0, active: null,
  draft: settings, draftUpdatedBy: ADMIN, draftUpdatedAt: null, history: [], nextBeforeVersion: null,
  runtime: { source: 'environment', appliedVersion: null, appliedAt: null }, effective: settings,
  poll: { lastCheckedAt: null, lastError: null },
};

function fixture() {
  const calls: Array<{ method: string; path: string; body?: Record<string, unknown> }> = [];
  const deps = {
    session: async (): Promise<{ discordId: string } | null> => ({ discordId: ADMIN }),
    isAdmin: (id: string) => id === ADMIN,
    get: async (path: string): Promise<unknown> => { calls.push({ method: 'GET', path }); return state; },
    post: async (path: string, body: Record<string, unknown>): Promise<unknown> => { calls.push({ method: 'POST', path, body }); return state; },
    publicUrl: 'https://console.test',
  };
  return { calls, deps };
}

function write(body: unknown, headers: Record<string, string> = {}) {
  return new Request('https://console.test/api/admin/bot-config', {
    method: 'POST', headers: { Origin: 'https://console.test', 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

test('anonymous and non-admin sessions cannot read or mutate the Bot configuration', async () => {
  for (const session of [null, { discordId: SPOOFED }]) {
    for (const request of [new Request('https://console.test/api/admin/bot-config'), write({ action: 'save', expectedRevision: 0, settings })]) {
      const { calls, deps } = fixture();
      deps.session = async () => session;
      const response = await handleBotConfigRequest(request, deps);
      assert.equal(response.status, 403);
      assert.deepEqual(await response.json(), { ok: false, error: 'forbidden' });
      assert.equal(calls.length, 0);
    }
  }
});

test('cross-origin and missing-origin writes are blocked before forwarding', async () => {
  for (const origin of ['https://attacker.test', 'null', '']) {
    const { calls, deps } = fixture();
    const response = await handleBotConfigRequest(write({ action: 'save', expectedRevision: 0, settings }, { Origin: origin }), deps);
    assert.equal(response.status, 403);
    assert.equal((await response.json()).error, 'invalid_origin');
    assert.equal(calls.length, 0);
  }
});

test('read requests forward only a validated history cursor and perform no mutation', async () => {
  const { calls, deps } = fixture();
  const response = await handleBotConfigRequest(new Request('https://console.test/api/admin/bot-config?beforeVersion=21'), deps);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.deepEqual(calls, [{ method: 'GET', path: '/internal/bot-config?beforeVersion=21' }]);
  for (const query of ['beforeVersion=0', 'beforeVersion=-1', 'beforeVersion=1e3', 'beforeVersion=9007199254740992', 'beforeVersion=2&beforeVersion=3']) {
    const invalid = fixture();
    assert.equal((await handleBotConfigRequest(new Request(`https://console.test/api/admin/bot-config?${query}`), invalid.deps)).status, 400);
    assert.equal(invalid.calls.length, 0);
  }
});

test('the proxy overwrites a forged actor with the real admin session and forwards only the command', async () => {
  const { calls, deps } = fixture();
  const response = await handleBotConfigRequest(write({ action: 'save', expectedRevision: 2, settings, actorDiscordId: SPOOFED }), deps);
  assert.equal(response.status, 200);
  assert.deepEqual(calls, [{ method: 'POST', path: '/internal/bot-config', body: { action: 'save', expectedRevision: 2, settings: parseBotSettings(settings), actorDiscordId: ADMIN } }]);
});

test('publish forwards only saved-draft instructions and rollback requires a version and trimmed reason', async () => {
  for (const command of [{ action: 'publish', expectedRevision: 2, reason: ' 发布频道 ' }, { action: 'rollback', expectedRevision: 3, reason: ' 恢复上一配置 ', targetVersion: 1 }]) {
    const { calls, deps } = fixture();
    assert.equal((await handleBotConfigRequest(write(command), deps)).status, 200);
    assert.equal(calls[0].body?.reason, command.reason.trim());
    assert.equal(calls[0].body?.actorDiscordId, ADMIN);
    assert.equal('settings' in calls[0].body!, false);
  }
  const { calls, deps } = fixture();
  assert.equal((await handleBotConfigRequest(write({ action: 'publish', expectedRevision: 2, reason: '发布', settings }), deps)).status, 400);
  assert.equal(calls.length, 0);
});

test('invalid schema, IDs, duplicates and channel limits cannot be saved', async () => {
  const invalidSettings = [
    { ...settings, schemaVersion: 2 }, { ...settings, orderBroadcastChannelIds: [] },
    { ...settings, orderAnonChannelId: 'channel-name' }, { ...settings, orderBroadcastChannelIds: [ADMIN, ADMIN] },
    { ...settings, orderPublicAcceptChannelIds: Array.from({ length: 11 }, (_, i) => `${BigInt('12345678901234567') + BigInt(i)}`) },
    { ...settings, internalToken: 'test-secret' },
  ];
  for (const invalid of invalidSettings) {
    assert.equal(parseBotSettings(invalid), null);
    const { calls, deps } = fixture();
    assert.equal((await handleBotConfigRequest(write({ action: 'save', expectedRevision: 0, settings: invalid }), deps)).status, 400);
    assert.equal(calls.length, 0);
  }
});

test('revision, reason length and rollback target are validated without upstream calls', async () => {
  const invalidCommands = [
    { action: 'save', expectedRevision: -1, settings }, { action: 'save', expectedRevision: 1.5, settings },
    { action: 'publish', expectedRevision: 0, reason: null }, { action: 'publish', expectedRevision: 0, reason: '字'.repeat(301) },
    { action: 'rollback', expectedRevision: 0, reason: '恢复', targetVersion: 0 },
    { action: 'erase', expectedRevision: 0 },
  ];
  for (const command of invalidCommands) {
    const { calls, deps } = fixture();
    assert.equal((await handleBotConfigRequest(write(command), deps)).status, 400);
    assert.equal(calls.length, 0);
  }
});

test('actual UTF-8 request size is bounded even when Content-Length is absent or forged', async () => {
  for (const headers of [{}, { 'Content-Length': '1' }, { 'Content-Length': '11000' }] as Array<Record<string, string>>) {
    const { calls, deps } = fixture();
    const response = await handleBotConfigRequest(write({ padding: '字'.repeat(4000) }, headers), deps);
    assert.equal(response.status, 413);
    assert.equal((await response.json()).error, 'payload_too_large');
    assert.equal(calls.length, 0);
  }
  const { calls, deps } = fixture();
  const json = JSON.stringify({ action: 'save', expectedRevision: 0, settings });
  const exactlyBounded = new Request('https://console.test/api/admin/bot-config', {
    method: 'POST', headers: { Origin: 'https://console.test', 'Content-Type': 'application/json' }, body: json.padEnd(10240, ' '),
  });
  assert.equal((await handleBotConfigRequest(exactlyBounded, deps)).status, 200);
  assert.equal(calls.length, 1);
});

test('non-JSON and malformed JSON never reach the Bot', async () => {
  const { calls, deps } = fixture();
  assert.equal((await handleBotConfigRequest(write({}, { 'Content-Type': 'text/plain' }), deps)).status, 415);
  assert.equal((await handleBotConfigRequest(new Request('https://console.test/api/admin/bot-config', {
    method: 'POST', headers: { Origin: 'https://console.test', 'Content-Type': 'application/json' }, body: '{',
  }), deps)).status, 400);
  assert.equal(calls.length, 0);
});

test('upstream conflicts and validation failures remain actionable without leaking raw errors', async () => {
  for (const [status, expectedStatus, code] of [[409, 409, 'config_conflict'], [400, 400, 'config_rejected'], [404, 404, 'version_not_found'], [500, 503, 'bot_unavailable'], [401, 503, 'bot_unavailable']] as const) {
    const { deps } = fixture();
    deps.post = async () => { throw Object.assign(new Error('postgres://secret@private:5432/token'), { status }); };
    const response = await handleBotConfigRequest(write({ action: 'save', expectedRevision: 0, settings }), deps);
    assert.equal(response.status, expectedStatus);
    assert.deepEqual(await response.json(), { ok: false, error: code });
  }
});

test('disabled environment snapshots remain readable and poll errors are redacted', async () => {
  const { deps } = fixture();
  deps.get = async () => ({ ...state, enabled: false, effective: { ...settings, orderBroadcastChannelIds: [], orderAnonChannelId: '' },
    poll: { lastCheckedAt: null, lastError: 'postgres://secret' }, internalToken: 'secret-token' });
  const response = await handleBotConfigRequest(new Request('https://console.test/api/admin/bot-config'), deps);
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.deepEqual(payload.effective.orderBroadcastChannelIds, []);
  assert.equal(payload.effective.orderAnonChannelId, '');
  assert.equal(payload.poll.lastError, 'bot_config_poll_failed');
  assert.equal('draft' in payload, false);
  assert.equal('revision' in payload, false);
  assert.ok(!JSON.stringify(payload).includes('secret'));
});

test('only explicitly safe and bounded Bot validation messages are exposed', async () => {
  for (const [status, safeMessage, message, exposed] of [
    [400, true, '频道不属于当前公会或缺少发送权限', true],
    [409, true, '配置已被其他管理员修改，请刷新后重试', true],
    [400, false, 'secret network details', false],
    [400, true, '字'.repeat(501), false],
    [503, true, 'secret unexpected details', false],
  ] as const) {
    const { deps } = fixture();
    deps.post = async () => { throw Object.assign(new Error(message), { status, safeMessage }); };
    const response = await handleBotConfigRequest(write({ action: 'save', expectedRevision: 0, settings }), deps);
    const payload = await response.json();
    assert.equal(payload.message, exposed ? message : undefined);
  }
});

test('session failures and malformed upstream responses return only a fixed unavailable error', async () => {
  const sessionFailure = fixture();
  sessionFailure.deps.session = async () => { throw new Error('secret session database URL'); };
  const response = await handleBotConfigRequest(new Request('https://console.test/api/admin/bot-config'), sessionFailure.deps);
  assert.deepEqual(await response.json(), { ok: false, error: 'bot_unavailable' });
  assert.equal(sessionFailure.calls.length, 0);
  const invalidUpstream = fixture();
  invalidUpstream.deps.get = async () => ({ ok: true, error: 'secret' });
  const invalid = await handleBotConfigRequest(new Request('https://console.test/api/admin/bot-config'), invalidUpstream.deps);
  assert.equal(invalid.status, 503);
  assert.deepEqual(await invalid.json(), { ok: false, error: 'bot_unavailable' });
});

test('v2 copy writes reject unknown fields, mentions and identity variables before reaching the Bot', async () => {
  const v2 = { ...settings, schemaVersion: 2, orderRequestCopy: { ...DEFAULT_ORDER_REQUEST_COPY } };
  for (const invalid of [
    { ...v2, orderIdPrefix: '可改前缀' },
    { ...v2, orderRequestCopy: { ...v2.orderRequestCopy, customId: 'unsafe' } },
    { ...v2, orderRequestCopy: { ...v2.orderRequestCopy, requestHint: '@everyone' } },
    { ...v2, orderRequestCopy: { ...v2.orderRequestCopy, dispatchDescription: '{ownerId}' } },
  ]) {
    const { calls, deps } = fixture();
    assert.equal((await handleBotConfigRequest(write({ action: 'save', expectedRevision: 0, settings: invalid }), deps)).status, 400);
    assert.equal(calls.length, 0);
  }
});

test('maximum valid copy and channel lists fit both incoming and forwarded 8 KiB JSON budgets', async () => {
  const ids = Array.from({ length: 10 }, (_, index) => `${BigInt('12345678901234567890') + BigInt(index)}`);
  const copy = Object.fromEntries(Object.entries(ORDER_REQUEST_COPY_LIMITS).map(([key, maximum]) => [key, '字'.repeat(maximum)]));
  const command = { action: 'save', expectedRevision: Number.MAX_SAFE_INTEGER, actorDiscordId: SPOOFED,
    settings: { schemaVersion: 2, orderBroadcastChannelIds: ids, orderAnonChannelId: ids[0], orderPublicAcceptChannelIds: ids, orderRequestCopy: copy } };
  assert(Buffer.byteLength(JSON.stringify(command), 'utf8') < 8192);
  const { calls, deps } = fixture();
  assert.equal((await handleBotConfigRequest(write(command), deps)).status, 200);
  assert(Buffer.byteLength(JSON.stringify(calls[0].body), 'utf8') < 8192);
  assert.deepEqual((calls[0].body?.settings as { orderRequestCopy: unknown }).orderRequestCopy, copy);
  assert.equal(calls[0].body?.actorDiscordId, ADMIN);
});

test('maximum legal v3 UTF-8 fields and canonical image URL fit the unchanged 8 KiB proxy budgets', async () => {
  const { DEFAULT_RUNTIME_PRESENTATION } = await import('./runtime-presentation');
  const ids = Array.from({ length: 10 }, (_, index) => `${BigInt('12345678901234567890') + BigInt(index)}`);
  const copy = Object.fromEntries(Object.entries(ORDER_REQUEST_COPY_LIMITS).map(([key, maximum]) => [key, '字'.repeat(maximum)]));
  const urlPrefix = 'https://example.com/';
  const maximum = { ...DEFAULT_RUNTIME_PRESENTATION, dispatchImageUrl: urlPrefix + 'a'.repeat(512 - urlPrefix.length),
    welcomeGreeting: '字'.repeat(100), welcomeIntro: '字'.repeat(300), completionNote: '字'.repeat(160) };
  const command = { action: 'save', expectedRevision: Number.MAX_SAFE_INTEGER, actorDiscordId: '12345678901234567890', settings: {
    schemaVersion: 3, orderBroadcastChannelIds: ids, orderAnonChannelId: ids[0], orderPublicAcceptChannelIds: ids, orderRequestCopy: copy, presentation: maximum,
  } };
  assert(Buffer.byteLength(JSON.stringify(command), 'utf8') <= 8192);
  const { calls, deps } = fixture();
  assert.equal((await handleBotConfigRequest(write(command), deps)).status, 200);
  assert(Buffer.byteLength(JSON.stringify(calls[0].body), 'utf8') <= 8192);
  assert.deepEqual((calls[0].body!.settings as { presentation: unknown }).presentation, maximum);
});

test('v3 presentation validation is enforced by the real proxy before calling Bot', async () => {
  const { DEFAULT_RUNTIME_PRESENTATION } = await import('./runtime-presentation');
  for (const patch of [{ welcomeGreeting: '@everyone' }, { dispatchImageUrl: 'http://example.com/a' }, { completionNote: '{amount}' }, { couponAmount: 999 }]) {
    const { calls, deps } = fixture();
    const invalid = { ...settings, schemaVersion: 3, orderRequestCopy: DEFAULT_ORDER_REQUEST_COPY, presentation: { ...DEFAULT_RUNTIME_PRESENTATION, ...patch } };
    assert.equal((await handleBotConfigRequest(write({ action: 'save', expectedRevision: 0, settings: invalid }), deps)).status, 400);
    assert.equal(calls.length, 0);
  }
});

function combinedFixture() {
  const { calls, deps } = fixture();
  let current = { ...state, revision: 0, draft: null } as BotConfigState;
  deps.post = async (path, body) => {
    calls.push({ method: 'POST', path, body });
    if (body.expectedRevision !== current.revision) throw Object.assign(new Error('配置已改变'), { status: 409, safeMessage: true });
    if (body.action === 'save') {
      current = { ...current, revision: current.revision! + 1, draft: body.settings as BotConfigState['draft'], draftUpdatedBy: String(body.actorDiscordId) };
    } else {
      const version = { guildId: ADMIN, version: current.activeVersion! + 1, settings: current.draft!, createdBy: ADMIN, reason: String(body.reason), rollbackOf: null, createdAt: '2026-10-24T00:00:00Z' };
      current = { ...current, revision: current.revision! + 1, activeVersion: version.version, active: version, draft: null, history: [version], effective: version.settings, runtime: { source: 'published', appliedVersion: version.version, appliedAt: version.createdAt } };
    }
    return structuredClone(current);
  };
  return { calls, deps, current: () => current, replace: (next: BotConfigState) => { current = next; } };
}

test('one UI request saves exactly its settings then publishes its next revision using the real actor', async () => {
  for (const reason of [undefined, '', '  ', '  临时调整频道  ']) {
    const f = combinedFixture();
    const response = await handleBotConfigRequest(write({ action: 'saveAndPublish', expectedRevision: 0, settings, actorDiscordId: SPOOFED, ...(reason !== undefined ? { reason } : {}) }), f.deps);
    assert.equal(response.status, 200);
    assert.deepEqual(f.calls.map(c => c.body), [
      { action: 'save', expectedRevision: 0, actorDiscordId: ADMIN, settings: parseBotSettings(settings) },
      { action: 'publish', expectedRevision: 1, actorDiscordId: ADMIN, reason: reason?.trim() || '后台保存并发布（未填写原因）' },
    ]);
    const payload = await response.json();
    assert.equal(payload.activeVersion, 1);
    assert.equal(payload.runtime.appliedVersion, 1);
    assert.equal(payload.draft, null);
  }
});

test('standalone publish and rollback accept optional reasons with auditable defaults', async () => {
  for (const action of ['publish', 'rollback']) {
    for (const reason of [undefined, '', '  ']) {
      const { calls, deps } = fixture();
      const response = await handleBotConfigRequest(write({ action, expectedRevision: 2, ...(action === 'rollback' ? { targetVersion: 1 } : {}), ...(reason !== undefined ? { reason } : {}) }), deps);
      assert.equal(response.status, 200);
      assert.equal(calls[0].body?.reason, action === 'rollback' ? '后台回滚（未填写原因）' : '后台发布（未填写原因）');
    }
  }
});

test('invalid combined requests are rejected before either Bot command', async () => {
  for (const patch of [{ reason: null }, { reason: 1 }, { reason: '字'.repeat(301) }, { settings: { ...settings, orderAnonChannelId: 'bad' } }, { unexpected: true }, { expectedRevision: Number.MAX_SAFE_INTEGER - 1 }]) {
    const f = combinedFixture();
    assert.equal((await handleBotConfigRequest(write({ action: 'saveAndPublish', expectedRevision: 0, settings, ...patch }), f.deps)).status, 400);
    assert.equal(f.calls.length, 0);
  }
});

test('failed or uncertain save never sends a publish', async () => {
  for (const status of [409, 503]) {
    const f = combinedFixture();
    f.deps.post = async (path, body) => { f.calls.push({ method: 'POST', path, body }); throw Object.assign(new Error('private failure'), { status }); };
    const response = await handleBotConfigRequest(write({ action: 'saveAndPublish', expectedRevision: 0, settings }), f.deps);
    assert.equal(response.status, status);
    assert.deepEqual(f.calls.map(c => c.body?.action), ['save']);
    assert.deepEqual(await response.json(), { ok: false, error: status === 409 ? 'config_conflict' : 'bot_unavailable', publicationStatus: 'not_attempted', refreshRequired: true });
  }
});

test('save inspection already advanced by another writer cannot authorize their draft', async () => {
  for (const patch of [{ revision: 2 }, { draftUpdatedBy: SPOOFED }, { draft: parseBotSettings({ ...settings, orderAnonChannelId: ADMIN }) }, { enabled: false }]) {
    const f = combinedFixture();
    const post = f.deps.post;
    f.deps.post = async (path, body) => ({ ...(await post(path, body) as BotConfigState), ...patch });
    const response = await handleBotConfigRequest(write({ action: 'saveAndPublish', expectedRevision: 0, settings }), f.deps);
    assert.equal(response.status, 409);
    assert.deepEqual(f.calls.map(c => c.body?.action), ['save']);
    assert.equal((await response.json()).publicationStatus, 'not_attempted');
  }
});

test('a write between the save reply and publish is rejected without retrying the newer revision', async () => {
  const f = combinedFixture();
  const post = f.deps.post;
  f.deps.post = async (path, body) => {
    if (body.action === 'publish') f.replace({ ...f.current(), revision: 2, draft: parseBotSettings({ ...settings, orderAnonChannelId: ADMIN }), draftUpdatedBy: SPOOFED });
    return post(path, body);
  };
  const response = await handleBotConfigRequest(write({ action: 'saveAndPublish', expectedRevision: 0, settings }), f.deps);
  assert.equal(response.status, 409);
  assert.deepEqual(f.calls.map(c => c.body?.expectedRevision), [0, 1]);
  assert.equal(f.current().activeVersion, 0);
  assert.equal(f.current().draftUpdatedBy, SPOOFED);
  assert.equal((await response.json()).publicationStatus, 'rejected');
});

test('channel rejection preserves a draft without claiming it is published; publish uncertainty stays explicit', async () => {
  for (const status of [400, 503]) {
    const f = combinedFixture();
    const post = f.deps.post;
    f.deps.post = async (path, body) => {
      if (body.action === 'publish') {
        f.calls.push({ method: 'POST', path, body });
        throw Object.assign(new Error(status === 400 ? '频道缺少发送权限' : 'private database failure'), { status, safeMessage: true });
      }
      return post(path, body);
    };
    const response = await handleBotConfigRequest(write({ action: 'saveAndPublish', expectedRevision: 0, settings }), f.deps);
    assert.equal(response.status, status);
    assert.equal(f.current().revision, 1);
    assert.equal(f.current().activeVersion, 0);
    assert.deepEqual(f.current().draft, parseBotSettings(settings));
    const payload = await response.json();
    assert.equal(payload.publicationStatus, status === 400 ? 'rejected' : 'unconfirmed');
    assert.equal(payload.refreshRequired, true);
    assert.equal(payload.message, status === 400 ? '频道缺少发送权限' : undefined);
  }
});

test('a lost publish reply after commit is not retried or reported as not published', async () => {
  const f = combinedFixture();
  const post = f.deps.post;
  f.deps.post = async (path, body) => {
    const result = await post(path, body);
    if (body.action === 'publish') throw new Error('reply lost');
    return result;
  };
  const response = await handleBotConfigRequest(write({ action: 'saveAndPublish', expectedRevision: 0, settings }), f.deps);
  assert.equal(response.status, 503);
  assert.equal(f.current().activeVersion, 1);
  assert.equal(f.calls.length, 2);
  assert.equal((await response.json()).publicationStatus, 'unconfirmed');
});

test('combined maximal legal Chinese settings and reason fit the Web envelope and both unchanged Bot limits', async () => {
  const { DEFAULT_RUNTIME_PRESENTATION } = await import('./runtime-presentation');
  const ids = Array.from({ length: 10 }, (_, index) => `${BigInt('12345678901234567890') + BigInt(index)}`);
  const copy = Object.fromEntries(Object.entries(ORDER_REQUEST_COPY_LIMITS).map(([key, maximum]) => [key, '字'.repeat(maximum)]));
  const urlPrefix = 'https://example.com/';
  const command = { action: 'saveAndPublish', expectedRevision: 0, reason: '因'.repeat(300), settings: {
    schemaVersion: 3, orderBroadcastChannelIds: ids, orderAnonChannelId: ids[0], orderPublicAcceptChannelIds: ids, orderRequestCopy: copy,
    presentation: { ...DEFAULT_RUNTIME_PRESENTATION, dispatchImageUrl: urlPrefix + 'a'.repeat(512 - urlPrefix.length), welcomeGreeting: '字'.repeat(100), welcomeIntro: '字'.repeat(300), completionNote: '字'.repeat(160) },
  } };
  assert(Buffer.byteLength(JSON.stringify(command), 'utf8') > 8192);
  assert(Buffer.byteLength(JSON.stringify(command), 'utf8') <= 10240);
  const f = combinedFixture();
  assert.equal((await handleBotConfigRequest(write(command), f.deps)).status, 200);
  assert.equal(f.calls.length, 2);
  for (const call of f.calls) assert(Buffer.byteLength(JSON.stringify(call.body), 'utf8') <= 8192);
});
