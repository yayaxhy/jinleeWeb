// Pure contract; keep equivalent to Bot src/config/runtimePresentationContract.ts.
// Limits use UTF-16 units, as Discord does. URL is canonical ASCII before storage.
export const RUNTIME_PRESENTATION_LIMITS = {
  dispatchImageUrl: 512,
  accentColor: 7,
  welcomeGreeting: 100,
  welcomeIntro: 300,
  completionNote: 160,
} as const;
export type RuntimePresentation = Record<keyof typeof RUNTIME_PRESENTATION_LIMITS, string>;
export const DEFAULT_RUNTIME_PRESENTATION: Readonly<RuntimePresentation> = Object.freeze({
  dispatchImageUrl: 'https://dlmclub.com/brand/dlm-v1/operations/01-order-dispatch.png',
  accentColor: '#F5A623',
  welcomeGreeting: '您好🌷 欢迎来到点了么娱乐公会！',
  welcomeIntro: '很开心在这里遇见你 🩷\n🎮 无论是想找人一起开黑，还是聊聊天，都希望你在这里玩得开心。',
  completionNote: '',
});
const mentionPattern = /<@|<#|@everyone|@here/i;
const controlPattern = /[\u0000-\u0009\u000b-\u001f\u007f-\u009f\u061c\u200e\u200f\u2028-\u202e\u2066-\u206f]/;
const keys = Object.keys(RUNTIME_PRESENTATION_LIMITS) as Array<keyof RuntimePresentation>;

export function validateRuntimePresentation(value: unknown): RuntimePresentation {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('展示配置必须是对象');
  const input = value as Record<string, unknown>;
  if (Object.keys(input).some(key => !keys.includes(key as keyof RuntimePresentation))) throw new Error('展示配置包含不支持的字段');
  const output = {} as RuntimePresentation;
  for (const key of keys) {
    const text = input[key];
    if (typeof text !== 'string' || text.length > RUNTIME_PRESENTATION_LIMITS[key] ||
        (key !== 'completionNote' ? !text.trim() : text !== '' && !text.trim())) throw new Error(`${key} 文案为空或超过长度限制`);
    if (mentionPattern.test(text) || controlPattern.test(text) || /[\uD800-\uDFFF]/u.test(text) || /[{}]/.test(text)) throw new Error(`${key} 不能包含提及、变量或无效字符`);
    if (key !== 'welcomeIntro' && text.includes('\n')) throw new Error(`${key} 必须是单行`);
    output[key] = text;
  }
  if (!/^#[0-9a-f]{6}$/i.test(output.accentColor)) throw new Error('accentColor 需要 #RRGGBB 颜色值');
  output.accentColor = output.accentColor.toUpperCase();
  const rawUrl = output.dispatchImageUrl;
  if (/[\s\\#]/u.test(rawUrl)) throw new Error('dispatchImageUrl 不允许空白、反斜杠或片段');
  let url: URL;
  try { url = new URL(rawUrl); } catch { throw new Error('dispatchImageUrl 需要有效 HTTPS 地址'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.hash || url.href.length > RUNTIME_PRESENTATION_LIMITS.dispatchImageUrl) throw new Error('dispatchImageUrl 需要无凭据、无片段且不超过 512 字的 HTTPS 地址');
  output.dispatchImageUrl = url.href;
  return output;
}

/** Match the runtime fallback without ever evaluating templates or identity fields. */
export function renderRuntimePresentation(value: unknown): RuntimePresentation {
  try { return validateRuntimePresentation(value); }
  catch { return { ...DEFAULT_RUNTIME_PRESENTATION }; }
}

// This is fixed explanatory copy, not an editable configuration field.
export const WELCOME_FIXED_COUPON_TERMS = '🎁 一份小小的见面礼：**1张9折券已放进你的背包**。进入官网后可以查看。\n订单结束后可以使用，优惠金额会返还至账户余额，最高返还 || ¥50 ||。';
