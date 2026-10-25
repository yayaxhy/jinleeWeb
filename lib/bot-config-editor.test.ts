import assert from 'node:assert/strict';
import test from 'node:test';

import { canSaveAndPublish, copyValidationError, editorAfterState, editorCopy, editorIsDirty, editorSettings, toEditor } from '../components/admin/bot-config-editor';
import type { BotConfigState, BotSettings } from './bot-config';
import { DEFAULT_ORDER_REQUEST_COPY, renderOrderRequestCopy } from './order-request-copy';

const settings: BotSettings = {
  schemaVersion: 1,
  orderBroadcastChannelIds: ['111111111111111111'],
  orderAnonChannelId: '222222222222222222',
  orderPublicAcceptChannelIds: [],
};
const changed: BotSettings = { ...settings, orderBroadcastChannelIds: ['333333333333333333'] };
const base: BotConfigState = {
  ok: true,
  enabled: true,
  guildId: '999999999999999999',
  revision: 1,
  draft: settings,
  runtime: { source: 'environment', appliedVersion: null, appliedAt: null },
  effective: settings,
  poll: { lastCheckedAt: null, lastError: null },
};

test('refresh preserves unsaved editor input even when the server draft changes', () => {
  const editor = { ...toEditor(settings), anonymous: '444444444444444444' };
  const refreshed = { ...base, revision: 2, draft: changed };
  assert.equal(editorAfterState(editor, refreshed, false), editor);
  assert.equal(editorIsDirty(editor, refreshed), true);
  assert.deepEqual(editorAfterState(editor, refreshed, true), toEditor(changed));
  assert.deepEqual(editorAfterState(null, refreshed, false), toEditor(changed));
});

test('one-click publish accepts current edits without a stored draft or reason', () => {
  const editor = toEditor(settings);
  assert.equal(canSaveAndPublish(base, editor, '频道迁移'), true);
  assert.equal(canSaveAndPublish(base, toEditor(changed), '频道迁移'), true);
  assert.equal(canSaveAndPublish(base, { ...editor, broadcast: `${editor.broadcast} ` }, '频道迁移'), true);
  assert.equal(canSaveAndPublish({ ...base, draft: null }, editor, ''), true);
  assert.equal(canSaveAndPublish({ ...base, enabled: false }, editor, '频道迁移'), false);
  assert.equal(canSaveAndPublish({ ...base, revision: undefined }, editor, '频道迁移'), false);
  assert.equal(canSaveAndPublish(base, editor, '   '), true);
  assert.equal(canSaveAndPublish(base, editor, '因'.repeat(300)), true);
  assert.equal(canSaveAndPublish(base, editor, '因'.repeat(301)), false);
});

test('after publish or rollback the editor uses published settings while the runtime still reports an older version', () => {
  const published: BotConfigState = {
    ...base,
    draft: null,
    activeVersion: 2,
    active: { guildId: base.guildId, version: 2, settings: changed, createdBy: 'admin', reason: '频道迁移', rollbackOf: null, createdAt: '2026-10-21T12:00:00Z' },
  };
  assert.deepEqual(editorAfterState(toEditor(settings), published, true), toEditor(changed));
  assert.equal(canSaveAndPublish(published, toEditor(changed), '重复发布'), true);
});

test('CSV input parses to validated settings without losing ID precision or accepting duplicate IDs', () => {
  const editor = { ...toEditor(settings), broadcast: '111111111111111111,\n333333333333333333' };
  assert.deepEqual(editorSettings(editor)?.orderBroadcastChannelIds, ['111111111111111111', '333333333333333333']);
  assert.equal(editorSettings({ ...editor, broadcast: '111111111111111111,111111111111111111' }), null);
  assert.equal(editorSettings({ ...editor, anonymous: 'invalid' }), null);
  assert.equal(editorSettings({ ...editor, broadcast: '' }), null);
});

test('legacy settings edit as v3 with defaults without mutating the original version', () => {
  const original = structuredClone(settings);
  const editor = toEditor(settings);
  assert.deepEqual(editorCopy(editor), DEFAULT_ORDER_REQUEST_COPY);
  assert.equal(editorSettings(editor)?.schemaVersion, 3);
  assert.deepEqual(settings, original);
  assert.equal(editorIsDirty(editor, base), false);
});

test('copy edits survive refresh and are ready for one-click save and publish', () => {
  const editor = { ...toEditor(settings), requestHint: '新派单提示' };
  assert.equal(editorIsDirty(editor, base), true);
  assert.equal(canSaveAndPublish(base, editor, ''), true);
  assert.equal(editorAfterState(editor, { ...base, revision: 2 }, false), editor);
  const saved = { ...base, revision: 2, draft: editorSettings(editor)! };
  assert.equal(canSaveAndPublish(saved, editor, '更新文案'), true);
});

test('preview uses the production variable whitelist, escapes public nicknames and hides anonymous identity', () => {
  const editor = { ...toEditor(settings), dispatchDescription: '欢迎 {caller}！' };
  assert.equal(copyValidationError(editor), null);
  assert.equal(renderOrderRequestCopy(editorCopy(editor), { anonymous: true, callerDisplayName: 'private' }).dispatchDescription, '欢迎 匿名老板！');
  assert.equal(renderOrderRequestCopy(editorCopy(editor), { anonymous: false, callerDisplayName: '**老板** @everyone' }).dispatchDescription.includes('@everyone'), false);
  for (const value of ['{ownerId}', '{amount}', '@everyone', '<@12345678901234567>', '字'.repeat(601)]) {
    const invalid = { ...editor, dispatchDescription: value };
    assert.equal(editorSettings(invalid), null);
    assert.notEqual(copyValidationError(invalid), null);
    assert.equal(canSaveAndPublish({ ...base, draft: editorSettings(editor) }, invalid, '非法文案'), false);
  }
});

test('all valid presentation edits publish directly and survive refreshed server state', () => {
  const original = toEditor(settings);
  for (const [key, value] of Object.entries({ dispatchImageUrl: 'https://example.com/new.png', accentColor: '#112233', welcomeGreeting: '新问候', welcomeIntro: '新的介绍\n第二行', completionNote: '谢谢惠顾' })) {
    const editor = { ...original, [key]: value };
    assert.equal(editorIsDirty(editor, base), true);
    assert.equal(canSaveAndPublish(base, editor, ''), true);
    assert.equal(editorAfterState(editor, { ...base, revision: 2 }, false), editor);
    const saved = { ...base, revision: 2, draft: editorSettings(editor)! };
    assert.equal(canSaveAndPublish(saved, toEditor(saved.draft), '更新展示'), true);
  }
});

test('presentation normalization applies after save and legacy rollback restores defaults', () => {
  const editor = { ...toEditor(settings), accentColor: '#abcdef', dispatchImageUrl: 'HTTPS://EXAMPLE.COM/a.png', completionNote: '当前附言' };
  const saved = editorSettings(editor)!;
  assert.equal(saved.schemaVersion, 3);
  assert.equal(toEditor(saved).accentColor, '#ABCDEF');
  assert.equal(toEditor(saved).dispatchImageUrl, 'https://example.com/a.png');
  assert.deepEqual(editorAfterState(editor, { ...base, draft: saved }, true), toEditor(saved));
  const rollback = { ...base, draft: null, active: { guildId: base.guildId, version: 9, settings, createdBy: 'admin', reason: '恢复旧版', rollbackOf: 1, createdAt: '2026-10-22T12:00:00Z' } };
  assert.equal(editorAfterState(editor, rollback, true).completionNote, '');
  assert.equal(editorAfterState(editor, rollback, true).accentColor, '#F5A623');
});

test('invalid presentation blocks saving and publishing without affecting runtime environment display', () => {
  const invalid = { ...toEditor(settings), welcomeIntro: '{caller}' };
  assert.equal(editorSettings(invalid), null);
  assert.equal(canSaveAndPublish(base, invalid, '错误配置'), false);
  const emptyEnvironment: BotSettings = { ...settings, orderBroadcastChannelIds: [], orderAnonChannelId: '' };
  assert.equal(toEditor(emptyEnvironment).welcomeGreeting, '您好🌷 欢迎来到点了么娱乐公会！');
  assert.equal(editorSettings(toEditor(emptyEnvironment)), null);
});

test('invalid or exhausted revisions cannot authorize a combined save and publish', () => {
  for (const revision of [-1, 1.5, Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER - 1]) {
    assert.equal(canSaveAndPublish({ ...base, revision }, toEditor(settings), ''), false);
  }
});
