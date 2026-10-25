// Keep this pure contract in sync with Web lib/order-request-copy.ts.
// Lengths use UTF-16 units, matching Discord's message/embed limits.
export const ORDER_REQUEST_COPY_LIMITS = {
  requestHint: 200,
  selectedHint: 200,
  endedHint: 200,
  closedHint: 200,
  dispatchTitle: 80,
  dispatchDescription: 600,
} as const;
export type OrderRequestCopy = Record<keyof typeof ORDER_REQUEST_COPY_LIMITS, string>;
export const DEFAULT_ORDER_REQUEST_COPY: Readonly<OrderRequestCopy> = Object.freeze({
  requestHint: '老板派单啦，快来抢单',
  selectedHint: '老板点到了心仪的陪玩。派单还未结束，可继续扣单！',
  endedHint: '老板已结束派单。',
  closedHint: '派单已关闭。',
  dispatchTitle: '派单进行中',
  dispatchDescription: '正在派单 呼叫陪陪啦 <a:45:1552516008793739387>\n\n<a:36:1552515993182412812> {caller}：正在呼叫陪陪',
});

const mentionPattern = /<@|<#|@everyone|@here/i;
const controlPattern = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u202a-\u202e\u2066-\u2069]/;

export function validateOrderRequestCopy(value: unknown): OrderRequestCopy {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('派单文案必须是对象');
  const input = value as Record<string, unknown>;
  const keys = Object.keys(ORDER_REQUEST_COPY_LIMITS) as Array<keyof OrderRequestCopy>;
  if (Object.keys(input).some((key) => !keys.includes(key as keyof OrderRequestCopy))) throw new Error('派单文案包含不支持的字段');
  const copy = {} as OrderRequestCopy;
  for (const key of keys) {
    const text = input[key];
    const limit = ORDER_REQUEST_COPY_LIMITS[key];
    if (typeof text !== 'string' || !text.trim() || text.length > limit) throw new Error(`${key} 需要 1 至 ${limit} 字的文案`);
    if (mentionPattern.test(text) || controlPattern.test(text) || /[\uD800-\uDFFF]/u.test(text)) throw new Error(`${key} 不能包含用户、角色、频道或全体提及及无效字符`);
    const withoutVariables = key === 'dispatchDescription' ? text.replaceAll('{caller}', '') : text;
    if (/[{}]/.test(withoutVariables)) throw new Error(`${key} 包含不支持的变量；仅派单说明可使用 {caller}`);
    if (key === 'dispatchTitle' && /[\r\n]/.test(text)) throw new Error('派单标题必须是单行');
    copy[key] = text;
  }
  return copy;
}

// Avoid half-surrogates when bounding Discord payloads containing emoji.
export function boundDiscordText(text: string, limit: number): string {
  if (text.length <= limit) return text;
  const head = text.slice(0, Math.max(0, limit - 1)).replace(/[\uD800-\uDBFF]$/, '');
  return `${head}…`;
}

function safeCaller(value: string): string {
  const clean = value.replace(/[\r\n\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g, ' ')
    .replace(/[<>]/g, '').replaceAll('@', '＠').replace(/[\\`*_~|\[\]()]/g, '\\$&').trim();
  return boundDiscordText(clean || '老板', 80);
}

export function renderOrderRequestCopy(value: unknown, context: { anonymous: boolean; callerDisplayName?: string } = { anonymous: true }) {
  let copy: OrderRequestCopy;
  try { copy = validateOrderRequestCopy(value); }
  catch { copy = { ...DEFAULT_ORDER_REQUEST_COPY }; }
  // No owner ID, mention, amount or order number is accepted as a template value.
  const caller = context.anonymous ? '匿名老板' : safeCaller(context.callerDisplayName ?? '老板');
  return {
    ...copy,
    dispatchDescription: boundDiscordText(copy.dispatchDescription.replaceAll('{caller}', () => caller), 1600),
  };
}
