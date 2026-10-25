import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import ts from 'typescript';
import { SITE_COPY_CATALOG, SITE_COPY_FIXED_VALUES } from './editable-copy-catalog';
import { validateCopyTemplate } from './editable-copy-contract';
import { createSiteCopy, newerSiteCopySnapshot } from './site-copy';
import { localizeSiteMetadata } from './site-copy-metadata';
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from './site';

const catalog = new Map(SITE_COPY_CATALOG.map(entry => [entry.key, entry]));
const defaultCopy = createSiteCopy();
const fixedFor = (key: string) => SITE_COPY_FIXED_VALUES[key] ?? {};

test('every actual site template validates, has a unique key, and renders its original copy without overrides', () => {
  assert.equal(catalog.size, SITE_COPY_CATALOG.length);
  for (const entry of SITE_COPY_CATALOG) {
    assert.equal(validateCopyTemplate(entry, entry.defaultText), entry.defaultText, entry.key);
    const facts = { ...Object.fromEntries(entry.variables.map(name => [name, `fact:${name}`])), ...fixedFor(entry.key) };
    const expected = entry.defaultText.replace(/\{([a-zA-Z][a-zA-Z0-9_]*)\}/g, (match, name: string) => Object.hasOwn(facts, name) ? String(facts[name]) : match);
    assert.equal(defaultCopy(entry.key, facts), expected, entry.key);
  }
});

test('published copy must retain every dynamic fact and fixed business rule from the actual catalog', () => {
  for (const entry of SITE_COPY_CATALOG) {
    for (const name of entry.requiredVariables ?? entry.variables) {
      assert.throws(() => validateCopyTemplate(entry, entry.defaultText.replaceAll(`{${name}}`, '')), /必须保留|请填写/, `${entry.key}:${name}`);
    }
    const fixed = fixedFor(entry.key);
    if (!Object.keys(fixed).length) continue;
    const facts = Object.fromEntries(entry.variables.map(name => [name, '业务事实']));
    const expected = defaultCopy(entry.key, facts);
    assert.equal(defaultCopy(entry.key, { ...facts, ...Object.fromEntries(Object.keys(fixed).map(name => [name, '错误金额'])) }), expected, entry.key);
  }
});

test('copy lookup is limited to an explicit source namespace and leaves user content and nontext values intact', () => {
  const entry = SITE_COPY_CATALOG.find(entry => entry.key.startsWith('site.app.terms.page.') && defaultCopy(entry.key) === '用户协议')!;
  assert.ok(entry);
  const copy = createSiteCopy({ [entry.key]: '公会用户约定' });
  assert.equal(copy.text('用户协议', 'site.app.terms.page'), '公会用户约定');
  assert.equal(copy.text('用户协议', 'site.components.legal.legaldocument'), '用户协议');
  assert.equal(copy.text('用户协议'), '用户协议');
  assert.equal(copy.text('我的昵称是用户协议', 'site.app.terms.page'), '我的昵称是用户协议');
  const user = Object.freeze({ nickname: '用户协议', chat: '{value1} 你好', amount: 125 });
  assert.equal(copy.text(user, 'site.app.terms.page'), user);
  assert.equal(copy.text(125, 'site.app.terms.page'), 125);
});

test('static rule placeholders still resolve display literals, and metadata never rewrites routing or image URLs', () => {
  const entry = SITE_COPY_CATALOG.find(entry => entry.source?.startsWith('lib/site.ts:') && defaultCopy(entry.key) === SITE_DESCRIPTION)!;
  const name = SITE_COPY_CATALOG.find(entry => entry.source?.startsWith('lib/site.ts:') && defaultCopy(entry.key) === SITE_NAME)!;
  const template = '欢迎来到公会，客服时间：{fixed1}。';
  const copy = createSiteCopy({ [entry.key]: template, [name.key]: '公会新名称' });
  assert.equal(copy.text(SITE_DESCRIPTION, 'site.lib.site'), '欢迎来到公会，客服时间：24 小时。');
  const metadata = localizeSiteMetadata({ title: SITE_NAME, description: SITE_DESCRIPTION, metadataBase: new URL(SITE_URL),
    alternates: { canonical: '/terms' }, openGraph: { url: SITE_URL, images: [{ url: '/og.png', alt: SITE_NAME }] },
  }, copy, 'site.app.layout');
  assert.equal(metadata.title, '公会新名称');
  assert.equal(metadata.description, '欢迎来到公会，客服时间：24 小时。');
  assert.equal(metadata.metadataBase?.toString(), SITE_URL + '/');
  assert.equal(metadata.alternates?.canonical, '/terms');
  assert.equal((metadata.openGraph as { url: string }).url, SITE_URL);
  assert.deepEqual((metadata.openGraph as { images: unknown[] }).images, [{ url: '/og.png', alt: '公会新名称' }]);
});

test('notification defaults remain exact and copy edits cannot drop or reinterpret transaction amounts', () => {
  const key = 'site.lib.recharge.order.transaction.eb6422730363';
  assert.equal(defaultCopy(key, { value1: '25.00', value2: '135' }), '你的账户已到账 25.00 币。到账后余额：135。');
  const copy = createSiteCopy({ [key]: '入账 {value1}，余额 {value2}。' });
  assert.equal(copy(key, { value1: '25.00', value2: '135' }), '入账 25.00，余额 135。');
  assert.equal(copy(key, { value1: '{value2}', value2: '135' }), '入账 {value2}，余额 135。');
  assert.equal(createSiteCopy({ [key]: '入账成功' })(key, { value1: '25.00', value2: '135' }), defaultCopy(key, { value1: '25.00', value2: '135' }));
  for (const entry of SITE_COPY_CATALOG.filter(entry => /site\.lib\.(recharge\.order\.transaction|manual\.wechat)/.test(entry.key))) {
    assert.ok(entry.maxLength <= (entry.variables.length ? 1000 : 160), entry.key);
  }
});

const root = resolve(import.meta.dirname, '..');
function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => entry.isDirectory()
    ? sourceFiles(resolve(directory, entry.name))
    : /\.tsx?$/.test(entry.name) && !/\.test\./.test(entry.name) ? [resolve(directory, entry.name)] : []);
}
const files = ['app', 'components', 'lib'].flatMap(directory => sourceFiles(resolve(root, directory)));
const sources = files.filter(file => !file.endsWith('editable-copy-catalog.ts') && !file.endsWith('bot-editable-copy-catalog.ts')).map(file => ({
  file, source: ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS),
}));
function visit(node: ts.Node, fn: (node: ts.Node) => void) { fn(node); ts.forEachChild(node, child => visit(child, fn)); }

test('every explicit copy key in production rendering resolves to a registered site entry', () => {
  let references = 0;
  for (const { file, source } of sources) visit(source, node => {
    let key: string | undefined;
    if (ts.isCallExpression(node) && ['siteCopy', 'copy', 'renderSiteCopy'].includes(node.expression.getText(source))) {
      const first = node.arguments[0]; if (first && ts.isStringLiteral(first)) key = first.text;
    }
    if (ts.isJsxAttribute(node) && node.name.getText(source) === 'copyKey' && node.initializer && ts.isStringLiteral(node.initializer)) key = node.initializer.text;
    if (!key?.startsWith('site.')) return;
    references += 1;
    assert.ok(catalog.has(key), `${relative(root, file)} references missing ${key}`);
  });
  assert.ok(references > 1000);
});

test('editable option labels retain explicit submitted values and code/style/script are never rewritten', () => {
  for (const { file, source } of sources) visit(source, node => {
    if (!ts.isJsxElement(node)) return;
    const tag = node.openingElement.tagName.getText(source);
    if (!['option', 'style', 'script', 'code', 'pre'].includes(tag)) return;
    let editable = false;
    visit(node, child => {
      if ((ts.isJsxSelfClosingElement(child) || ts.isJsxOpeningElement(child)) && child.tagName.getText(source) === 'SiteText') editable = true;
      if (ts.isCallExpression(child) && ['siteCopy', 'siteCopy.text', 'copy'].includes(child.expression.getText(source))) editable = true;
    });
    if (!editable) return;
    assert.equal(tag, 'option', `${relative(root, file)} rewrites executable or raw text in ${tag}`);
    assert.ok(node.openingElement.attributes.properties.some(attribute => ts.isJsxAttribute(attribute) && attribute.name.getText(source) === 'value'), `${relative(root, file)} has editable option without stable value`);
  });
});

test('known withdrawal messages are editable while upstream strings and stored account data remain unchanged', async () => {
  const { getWithdrawErrorMessage, getWithdrawAccountDetailSummary, WECHAT_WITHDRAW_HOST } = await import('./withdrawAccounts');
  const copy = createSiteCopy({ 'site.lib.withdrawaccounts.b813a082e639': '请先登录后继续',
    'site.lib.withdrawaccounts.invalid.host': '请使用 {value1} 保存图片。' });
  assert.equal(getWithdrawErrorMessage('unauthorized'), '请先登录 Discord 账号');
  assert.equal(getWithdrawErrorMessage('unauthorized', copy), '请先登录后继续');
  assert.equal(getWithdrawErrorMessage('请先登录 Discord 账号', copy), '请先登录 Discord 账号');
  assert.equal(getWithdrawErrorMessage('wechat_detail_invalid_host', copy), `请使用 ${WECHAT_WITHDRAW_HOST} 保存图片。`);
  assert.equal(getWithdrawAccountDetailSummary('custom-account-123', 1), '…');
});

test('voucher display names can change without mutating canonical voucher identifiers or benefits', async () => {
  const { COUPON_VOUCHER_META, SPECIAL_ACTION_COUPON_TYPE_BY_PRIZE } = await import('./voucherCatalog');
  const original = JSON.stringify({ COUPON_VOUCHER_META, SPECIAL_ACTION_COUPON_TYPE_BY_PRIZE });
  const entry = SITE_COPY_CATALOG.find(entry => entry.key.startsWith('site.lib.vouchercatalog.') && defaultCopy(entry.key) === '双倍流水5000券')!;
  assert.ok(entry);
  const copy = createSiteCopy({ [entry.key]: '流水加成券（{quota}额度）' });
  assert.equal(copy.text('双倍流水5000券', 'site.lib.vouchercatalog'), '流水加成券（5000额度）');
  assert.equal(JSON.stringify({ COUPON_VOUCHER_META, SPECIAL_ACTION_COUPON_TYPE_BY_PRIZE }), original);
});


test('unchanged or older published versions retain snapshot identity and only new publications refresh consumers', () => {
  const current = { version: 4, overrides: { key: 'saved' } };
  assert.equal(newerSiteCopySnapshot(current, { version: 4, overrides: { key: 'saved' } }), current);
  assert.equal(newerSiteCopySnapshot(current, { version: 3, overrides: {} }), current);
  const published = { version: 5, overrides: { key: 'updated' } };
  assert.equal(newerSiteCopySnapshot(current, published), published);
});
