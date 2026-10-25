import assert from 'node:assert/strict';
import { test } from 'node:test';
import { compatibleCopyOverrides, renderCopyTemplate, validateCopyOverrides, validateCopyTemplate, type EditableCopyEntry } from './editable-copy-contract';
const entry: EditableCopyEntry = { key: 'bot.payment', group: '到账', label: '到账提醒', defaultText: '{name} 已到账 ¥{amount}，编号 {receipt}', variables: ['name','amount','receipt'], maxLength: 150 };
test('editable copy preserves every business fact and renders inserted text only once', () => {
  const template = '充值成功：{name} / ¥{amount} / 原编号 {receipt}';
  assert.equal(renderCopyTemplate(entry, template, { name: '{amount}', amount: '100.25', receipt: 'tx-1' }), '充值成功：{amount} / ¥100.25 / 原编号 tx-1');
  assert.throws(() => validateCopyTemplate(entry, '充值成功'), /必须保留/);
  assert.throws(() => validateCopyTemplate(entry, template + '{secret}'), /未提供/);
  assert.throws(() => renderCopyTemplate(entry, template, { name: 'A', amount: 100 }), /缺少变量/);
});
test('copy cannot introduce mass mentions or invalid control characters', () => {
  assert.throws(() => validateCopyTemplate(entry, entry.defaultText + '@everyone'), /提及/);
  assert.throws(() => validateCopyTemplate(entry, entry.defaultText + '<@12345678901234567>'), /提及/);
  assert.throws(() => validateCopyTemplate(entry, entry.defaultText + '\u202e'), /无效/);
  const mentionEntry = { ...entry, defaultText: '<@{name}> 已到账 ¥{amount}，编号 {receipt}' };
  assert.equal(validateCopyTemplate(mentionEntry, '到账：<@{name}> ¥{amount}，编号 {receipt}'), '到账：<@{name}> ¥{amount}，编号 {receipt}');
});
test('empty overrides reset to defaults; unknown keys cannot enter a publication', () => {
  assert.deepEqual({ ...validateCopyOverrides([entry], { [entry.key]: entry.defaultText }) }, {});
  assert.throws(() => validateCopyOverrides([entry], { 'bot.unregistered': 'x' }), /不支持/);
  assert.throws(() => validateCopyOverrides([entry], []), /对象/);
});
test('historical incompatible keys fall back without removing valid edits', () => {
  const text = '收到 ¥{amount}：{name}，原编号 {receipt}';
  const result = compatibleCopyOverrides([entry], { 'old.removed': 'old', [entry.key]: text });
  assert.equal(result.overrides[entry.key], text);
  assert.deepEqual(result.ignoredKeys, ['old.removed']);
  assert.deepEqual(compatibleCopyOverrides([entry], { [entry.key]: '丢失金额' }).ignoredKeys, [entry.key]);
});
test('oversized rendered edits fall back without cutting off amount or receipt', () => {
  const text = 'x'.repeat(100) + entry.defaultText;
  const values = { name: '某'.repeat(30), amount: '100.25', receipt: 'original-receipt-12345' };
  assert.equal(renderCopyTemplate(entry, text, values), renderCopyTemplate(entry, entry.defaultText, values));
});
test('templates cannot assemble new notifications around supplied variable values', () => {
  const greeting = { ...entry, defaultText: '欢迎 {name}', variables: ['name'] };
  assert.equal(renderCopyTemplate(greeting, '欢迎 @{name}', {name:'everyone'}), '欢迎 everyone');
  assert.equal(renderCopyTemplate(greeting, '欢迎 <@{name}>', {name:'12345678901234567'}), '欢迎 12345678901234567');
});
