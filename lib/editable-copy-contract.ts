/** Presentation-only templates. No evaluation, markup injection or business data mutation. */
export type EditableCopyEntry = {
  key: string;
  kind?: 'image';
  group: string;
  label: string;
  defaultText: string;
  variables: readonly string[];
  requiredVariables?: readonly string[];
  maxLength: number;
  singleLine?: boolean;
  allowEmpty?: boolean;
  preserveDefault?: boolean;
  source?: string;
  examples?: Readonly<Record<string, string | number>>;
};
export type CopyValues = Readonly<Record<string, string | number>>;
export type CopyOverrides = Record<string, string>;
const VARIABLE = /\{([a-zA-Z][a-zA-Z0-9_]*)\}/g;
const UNSAFE_CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u202a-\u202e\u2066-\u2069]/;
const MENTION = /<[@#][^>]*>|@everyone|@here/gi;
export const COPY_MAX_BYTES = 2 * 1024 * 1024;
export const isUploadedCopyImage = (value: unknown): value is string => typeof value === 'string'
  && /^\/api\/copy\/images\/[a-f0-9]{64}\.(png|jpg|webp|gif)$/.test(value);
export class CopyImageReferenceError extends Error {
  constructor() { super('图片未找到，请重新上传。'); }
}

function mentions(text: string): string[] { return [...text.matchAll(MENTION)].map(match => match[0]).sort(); }

export function validateCopyTemplate(entry: EditableCopyEntry, text: unknown): string {
  if (entry.kind === 'image') {
    if (typeof text !== 'string' || text.length > entry.maxLength || (text !== entry.defaultText && !isUploadedCopyImage(text))) throw new CopyImageReferenceError();
    return text;
  }
  if (typeof text !== 'string' || text.length > entry.maxLength || (!text.trim() && !(entry.allowEmpty && text === ''))) throw new Error(`${entry.label}：请填写不超过 ${entry.maxLength} 字的文案`);
  if (UNSAFE_CONTROL.test(text) || /[\uD800-\uDFFF]/u.test(text)) throw new Error(`${entry.label}：含有无效字符`);
  if (entry.singleLine && /[\r\n]/.test(text)) throw new Error(`${entry.label}：只能填写一行`);
  const variables = [...text.matchAll(VARIABLE)].map(match => match[1]);
  if (variables.some(name => !entry.variables.includes(name))) throw new Error(`${entry.label}：包含未提供的变量`);
  for (const name of entry.requiredVariables ?? entry.variables) {
    if (!variables.includes(name)) throw new Error(`${entry.label}：必须保留 {${name}}，用于显示原业务数据`);
  }
  // Existing system-controlled mentions remain possible, but an edited copy
  // cannot acquire a new recipient, role or @everyone notification.
  if (JSON.stringify(mentions(text)) !== JSON.stringify(mentions(entry.defaultText))) throw new Error(`${entry.label}：不能新增或改变系统提及`);
  return text;
}

export function validateCopyOverrides(catalog: readonly EditableCopyEntry[], value: unknown): CopyOverrides {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('文案修改必须是对象');
  const entries = new Map(catalog.map(entry => [entry.key, entry]));
  const result: CopyOverrides = Object.create(null) as CopyOverrides;
  for (const [key, text] of Object.entries(value)) {
    const entry = entries.get(key);
    if (!entry) throw new Error(`不支持的文案：${key}`);
    const checked = validateCopyTemplate(entry, text);
    if (entry.preserveDefault || checked !== entry.defaultText) result[key] = checked;
  }
  if (new TextEncoder().encode(JSON.stringify(result)).length > COPY_MAX_BYTES) throw new Error('文案修改总量超过限制');
  return result;
}

/** Older immutable versions may contain templates removed by a later release. */
export function compatibleCopyOverrides(catalog: readonly EditableCopyEntry[], value: unknown): { overrides: CopyOverrides; ignoredKeys: string[] } {
  const overrides: CopyOverrides = Object.create(null) as CopyOverrides;
  const ignoredKeys: string[] = [];
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { overrides, ignoredKeys };
  const entries = new Map(catalog.map(entry => [entry.key, entry]));
  for (const [key, text] of Object.entries(value)) {
    const entry = entries.get(key);
    try {
      if (!entry) throw new Error('removed');
      const checked = validateCopyTemplate(entry, text);
      if (entry.preserveDefault || checked !== entry.defaultText) overrides[key] = checked;
    } catch { ignoredKeys.push(key); }
  }
  return { overrides, ignoredKeys };
}

export function renderCopyTemplate(entry: EditableCopyEntry, template: string, values: CopyValues = {}): string {
  for (const name of entry.variables) {
    if (!Object.hasOwn(values, name)) throw new Error(`文案 ${entry.key} 缺少变量 ${name}`);
  }
  const render = (text: string) => text.replace(VARIABLE, (match, name: string) =>
    entry.variables.includes(name) && Object.hasOwn(values, name) ? String(values[name]) : match);
  let safe = entry.defaultText;
  try { safe = validateCopyTemplate(entry, template); } catch { /* Bad persisted copy never disables the underlying operation. */ }
  const rendered = render(safe);
  const original = render(entry.defaultText);
  // A template may assemble a mention around a variable (e.g. @{name}).
  // Compare after interpolation too, against the same original business data.
  if (safe !== entry.defaultText && JSON.stringify(mentions(rendered)) !== JSON.stringify(mentions(original))) return original;
  // Never truncate an amount, identity or receipt. Long custom text falls back
  // to the original message, whose existing transport limits remain in force.
  return safe !== entry.defaultText && rendered.length > entry.maxLength ? original : rendered;
}
