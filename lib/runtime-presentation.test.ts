import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_RUNTIME_PRESENTATION, RUNTIME_PRESENTATION_LIMITS, WELCOME_FIXED_COUPON_TERMS, renderRuntimePresentation, validateRuntimePresentation } from './runtime-presentation';
import { parseBotSettings, presentationFromSettings, type BotSettings } from './bot-config';
import { DEFAULT_ORDER_REQUEST_COPY, renderOrderRequestCopy } from './order-request-copy';
const base = { schemaVersion: 1 as const, orderBroadcastChannelIds: ['111111111111111111'], orderAnonChannelId: '222222222222222222', orderPublicAcceptChannelIds: [] };
const presentation = { ...DEFAULT_RUNTIME_PRESENTATION };
const v3 = { ...base, schemaVersion: 3 as const, orderRequestCopy: { ...DEFAULT_ORDER_REQUEST_COPY }, presentation };

test('defaults preserve exact existing Bot welcome and immutable coupon terms', () => {
  assert.equal(presentation.dispatchImageUrl, 'https://dlmclub.com/brand/dlm-v1/operations/01-order-dispatch.png');
  assert.equal(presentation.accentColor, '#F5A623');
  assert.equal(presentation.welcomeGreeting, '您好🌷 欢迎来到点了么娱乐公会！');
  assert.equal(presentation.welcomeIntro, '很开心在这里遇见你 🩷\n🎮 无论是想找人一起开黑，还是聊聊天，都希望你在这里玩得开心。');
  assert.equal(presentation.completionNote, '');
  assert.match(WELCOME_FIXED_COUPON_TERMS, /1张9折券/);
  assert.match(WELCOME_FIXED_COUPON_TERMS, /¥50/);
  assert.deepEqual(validateRuntimePresentation(presentation), presentation);
});

test('v1 and v2 normalize into independent v3 objects without mutating historical input', () => {
  const v2: BotSettings = { ...base, schemaVersion: 2, orderRequestCopy: { ...DEFAULT_ORDER_REQUEST_COPY, requestHint: '历史提示' } };
  for (const old of [base, v2]) {
    const before = structuredClone(old); const normalized = parseBotSettings(old)!;
    assert.equal(normalized.schemaVersion, 3);
    assert.deepEqual(normalized.presentation, presentation);
    assert.deepEqual(old, before);
    normalized.presentation.welcomeGreeting = '新问候';
    normalized.orderBroadcastChannelIds.push('333333333333333333');
    assert.deepEqual(old, before); assert.deepEqual(presentationFromSettings(old), presentation);
  }
  assert.equal(parseBotSettings(v2)!.orderRequestCopy.requestHint, '历史提示');
});

test('v3 requires the exact presentation object and legacy schemas cannot smuggle new fields', () => {
  for (const invalid of [{ ...v3, presentation: undefined }, { ...v3, presentation: { ...presentation, couponAmount: 100 } },
    { ...v3, presentation: { accentColor: '#123456' } }, { ...base, presentation }, { ...base, schemaVersion: 2, orderRequestCopy: DEFAULT_ORDER_REQUEST_COPY, presentation },
    { ...v3, amount: 99 }, { ...v3, schemaVersion: 4 }]) assert.equal(parseBotSettings(invalid), null);
});

test('HTTPS URL and color are canonicalized; Unicode path is bounded after percent encoding', () => {
  const result = validateRuntimePresentation({ ...presentation, dispatchImageUrl: 'HTTPS://EXAMPLE.COM/图.png?x=1', accentColor: '#ab12ef' });
  assert.equal(result.dispatchImageUrl, 'https://example.com/%E5%9B%BE.png?x=1'); assert.equal(result.accentColor, '#AB12EF');
  assert.throws(() => validateRuntimePresentation({ ...presentation, dispatchImageUrl: 'https://example.com/' + '图'.repeat(56) }));
  const prefix = 'https://example.com/';
  assert.equal(validateRuntimePresentation({ ...presentation, dispatchImageUrl: prefix + 'a'.repeat(512 - prefix.length) }).dispatchImageUrl.length, 512);
  assert.throws(() => validateRuntimePresentation({ ...presentation, dispatchImageUrl: prefix + 'a'.repeat(513 - prefix.length) }));
});

for (const [label, url] of Object.entries({ http: 'http://example.com/a', relative: '/a.png', data: 'data:image/png;base64,AA', credentials: 'https://user:pass@example.com/a',
  fragment: 'https://example.com/a#part', emptyFragment: 'https://example.com/a#', whitespace: ' https://example.com/a', insideWhitespace: 'https://example.com/a b',
  backslash: 'https://example.com/a\\b', control: 'https://example.com/a\u0000', braces: 'https://example.com/{x}', bidi: 'https://example.com/\u202e' })) {
  test(`unsafe image URL ${label} is rejected before preview or persistence`, () => {
    assert.throws(() => validateRuntimePresentation({ ...presentation, dispatchImageUrl: url }));
    assert.equal(parseBotSettings({ ...v3, presentation: { ...presentation, dispatchImageUrl: url } }), null);
  });
}

test('presentation text rejects mentions, variables, C0/C1, bidi and unpaired surrogates', () => {
  for (const text of ['<@123>', '<@&123>', '<#123>', '@everyone', '@HERE', '{caller}', 'a\u0000', 'a\t', 'a\r', 'a\u0085', 'a\u061c', 'a\u200e', 'a\u200f', 'a\u202e', 'a\u206f', 'a\u2028', 'a\u2029', '\ud800', '\udc00']) {
    for (const key of ['welcomeGreeting', 'welcomeIntro', 'completionNote']) assert.throws(() => validateRuntimePresentation({ ...presentation, [key]: text }), `${key}:${JSON.stringify(text)}`);
  }
  assert.equal(validateRuntimePresentation({ ...presentation, welcomeGreeting: '欢迎🩷', welcomeIntro: '第一行\n第二行' }).welcomeIntro, '第一行\n第二行');
  assert.throws(() => validateRuntimePresentation({ ...presentation, welcomeGreeting: '两\n行' }));
  assert.throws(() => validateRuntimePresentation({ ...presentation, completionNote: '两\n行' }));
  assert.throws(() => validateRuntimePresentation({ ...presentation, welcomeIntro: '两\r\n行' }));
});

test('each text field enforces its UTF-16 limit and only completion note may be empty', () => {
  for (const key of ['welcomeGreeting', 'welcomeIntro', 'completionNote'] as const) {
    const limit = RUNTIME_PRESENTATION_LIMITS[key];
    assert.equal(validateRuntimePresentation({ ...presentation, [key]: '字'.repeat(limit) })[key].length, limit);
    assert.throws(() => validateRuntimePresentation({ ...presentation, [key]: '字'.repeat(limit + 1) }));
    assert.throws(() => validateRuntimePresentation({ ...presentation, [key]: '   ' }));
    if (key !== 'completionNote') assert.throws(() => validateRuntimePresentation({ ...presentation, [key]: '' }));
  }
  assert.equal(validateRuntimePresentation({ ...presentation, completionNote: '' }).completionNote, '');
  for (const color of ['red', '#123', '#12345678', '#GGGGGG']) assert.throws(() => validateRuntimePresentation({ ...presentation, accentColor: color }));
});

test('invalid presentation preview falls back as a complete safe unit', () => {
  const invalid = { ...presentation, welcomeGreeting: '@everyone', completionNote: 'should not partially render' };
  assert.deepEqual(renderRuntimePresentation(invalid), presentation);
  const copy = { ...DEFAULT_ORDER_REQUEST_COPY, dispatchDescription: '{caller} 欢迎派单' };
  const anonymous = renderOrderRequestCopy(copy, { anonymous: true, callerDisplayName: '私密昵称 123456789012345678' });
  assert.equal(anonymous.dispatchDescription, '匿名老板 欢迎派单');
  assert.equal(anonymous.dispatchDescription.includes('123456789012345678'), false);
  assert.throws(() => validateRuntimePresentation({ ...presentation, couponTerms: '改成无限返还' }));
});
