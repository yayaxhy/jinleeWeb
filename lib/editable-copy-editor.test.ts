import assert from 'node:assert/strict';
import test from 'node:test';
import {
  appendCopyHistory, changedCopyKeys, copyPreviewVariables, createCopyEditor, filterCopyEntries,
  refreshCopyEditor, resolveCopyConflict, updateCopyDraft, type CopyState,
} from '../components/admin/editable-copy-editor';
import { renderCopyTemplate, validateCopyOverrides, type EditableCopyEntry } from './editable-copy-contract';

const catalog: EditableCopyEntry[] = [
  { key: 'welcome', group: '欢迎', label: '欢迎消息', defaultText: '欢迎 {name}', variables: ['name'], maxLength: 100 },
  { key: 'recharge', group: '充值', label: '到账提醒', defaultText: '到账 {amount} 元', variables: ['amount'], maxLength: 100 },
  { key: 'button', group: '订单', label: '接单按钮', defaultText: '接受订单', variables: [], maxLength: 20, singleLine: true },
];
const state = (overrides: Record<string, string> = {}, revision = 1): CopyState => ({
  ok: true, enabled: true, scope: 'bot', revision, activeVersion: revision,
  overrides, catalog, history: [], nextBeforeVersion: null,
});

test('refresh merges unrelated remote updates while retaining local edits and pending reset', () => {
  let editor = createCopyEditor(state({ welcome: '你好 {name}', button: '立即接单' }));
  editor = updateCopyDraft(editor, catalog[0], '欢迎回来 {name}');
  editor = updateCopyDraft(editor, catalog[2], catalog[2].defaultText);
  const refreshed = refreshCopyEditor(editor, state({ welcome: '你好 {name}', recharge: '充值成功 {amount} 元', button: '立即接单' }, 2));
  assert.deepEqual(refreshed.draft, { welcome: '欢迎回来 {name}', recharge: '充值成功 {amount} 元' });
  assert.deepEqual(refreshed.conflicts, []);
  assert.deepEqual(changedCopyKeys(refreshed.server.overrides, refreshed.draft).sort(), ['button', 'welcome']);
  assert.equal(refreshed.server.revision, 2);
});

test('same-item conflicts cannot disappear through repeated refresh; choosing published resolves only that item', () => {
  let editor = createCopyEditor(state({ welcome: '你好 {name}' }));
  editor = updateCopyDraft(editor, catalog[0], '我的欢迎 {name}');
  editor = updateCopyDraft(editor, catalog[1], '我的到账 {amount}');
  const latest = state({ welcome: '他人的欢迎 {name}' }, 2);
  let merged = refreshCopyEditor({ ...editor, needsRefresh: true }, latest);
  assert.equal(merged.needsRefresh, false);
  assert.equal(merged.draft.welcome, '我的欢迎 {name}');
  assert.deepEqual(merged.conflicts, ['welcome']);
  merged = refreshCopyEditor(merged, latest);
  assert.deepEqual(merged.conflicts, ['welcome']);
  merged = resolveCopyConflict(merged, 'welcome', 'published');
  assert.equal(merged.draft.welcome, '他人的欢迎 {name}');
  assert.equal(merged.draft.recharge, '我的到账 {amount}');
  assert.deepEqual(merged.conflicts, []);
});

test('local restore-default versus remote edit is a conflict, and keeping mine preserves the deletion', () => {
  let editor = createCopyEditor(state({ welcome: '你好 {name}' }));
  editor = updateCopyDraft(editor, catalog[0], catalog[0].defaultText);
  const merged = refreshCopyEditor(editor, state({ welcome: '他人的欢迎 {name}' }, 2));
  assert.deepEqual(merged.conflicts, ['welcome']);
  const kept = resolveCopyConflict(merged, 'welcome', 'mine');
  assert.equal(Object.hasOwn(kept.draft, 'welcome'), false);
  assert.deepEqual(kept.conflicts, []);
  assert.deepEqual(changedCopyKeys(kept.server.overrides, kept.draft), ['welcome']);
});

test('a publish with unknown network result is recognized on refresh without creating phantom changes', () => {
  let editor = createCopyEditor(state());
  editor = updateCopyDraft(editor, catalog[0], '欢迎回来 {name}');
  const recovered = refreshCopyEditor({ ...editor, needsRefresh: true }, state({ welcome: '欢迎回来 {name}' }, 2));
  assert.equal(recovered.needsRefresh, false);
  assert.deepEqual(recovered.conflicts, []);
  assert.deepEqual(changedCopyKeys(recovered.server.overrides, recovered.draft), []);
});

test('cross-scope refresh is rejected and default text is never persisted as an override', () => {
  let editor = createCopyEditor(state());
  editor = updateCopyDraft(editor, catalog[2], '接下订单');
  assert.equal(editor.draft.button, '接下订单');
  editor = updateCopyDraft(editor, catalog[2], catalog[2].defaultText);
  assert.deepEqual(editor.draft, {});
  assert.throws(() => refreshCopyEditor(editor, { ...state(), scope: 'site' }), /范围不匹配/);
});

test('search finds both original and customized copy and combines group / modified filters', () => {
  const overrides = { welcome: '欢迎小伙伴 {name}', recharge: '已到账 {amount} 元' };
  assert.deepEqual(filterCopyEntries(catalog, { query: '小伙伴', group: '', modifiedOnly: false, overrides }).map((entry) => entry.key), ['welcome']);
  assert.deepEqual(filterCopyEntries(catalog, { query: '到账提醒', group: '充值', modifiedOnly: true, overrides }).map((entry) => entry.key), ['recharge']);
  assert.deepEqual(filterCopyEntries(catalog, { query: '', group: '订单', modifiedOnly: true, overrides }), []);
  assert.deepEqual(filterCopyEntries(catalog, { query: '', group: '', modifiedOnly: true, overrides }).map((entry) => entry.key), ['welcome', 'recharge']);
});

test('preview uses actual template renderer and invalid financial variable removal prevents publish', () => {
  const entry = catalog[1];
  assert.equal(renderCopyTemplate(entry, '充值完成：{amount} 元', copyPreviewVariables(entry)), '充值完成：100.00 元');
  assert.throws(() => validateCopyOverrides(catalog, { recharge: '充值完成' }), /必须保留/);
  assert.throws(() => validateCopyOverrides(catalog, { button: '接单\n送礼' }), /一行/);
  assert.deepEqual(Object.keys(validateCopyOverrides(catalog, { button: '接受订单' })), []);
});

test('history pagination deduplicates versions without dropping a previously loaded entry', () => {
  const version = (n: number) => ({ version: n, overrides: {}, actorId: 'admin', reason: null, createdAt: '2026-10-24T00:00:00Z' });
  assert.deepEqual(appendCopyHistory([version(3), version(2)], [version(2), version(1)]).map((item) => item.version), [3, 2, 1]);
});


test('preview uses catalog examples for fixed business facts including zero', () => {
  const entry: EditableCopyEntry = {
    key: 'fixed-terms', group: '欢迎', label: '欢迎券条款',
    defaultText: '赠送 {fixed1} 张，封顶 {fixed2} 元，额外费用 {fixed3}',
    variables: ['fixed1', 'fixed2', 'fixed3'], maxLength: 100,
    examples: { fixed1: 1, fixed2: '50.00', fixed3: 0 },
  };
  assert.deepEqual(copyPreviewVariables(entry), { fixed1: '1', fixed2: '50.00', fixed3: '0' });
  assert.equal(renderCopyTemplate(entry, entry.defaultText, copyPreviewVariables(entry)), '赠送 1 张，封顶 50.00 元，额外费用 0');
});
