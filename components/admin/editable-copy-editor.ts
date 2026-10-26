import type { EditableCopyEntry } from '@/lib/editable-copy-contract';

export type CopyScope = 'bot' | 'site';
export type CopyOverrides = Record<string, string>;
export type CopyVersion = { version: number; overrides: CopyOverrides; actorId: string; reason: string | null; createdAt: string; ignoredKeys?: string[] };
export type CopyState = {
  ok: true;
  enabled: boolean;
  scope: CopyScope;
  revision: number;
  activeVersion: number;
  overrides: CopyOverrides;
  catalog: EditableCopyEntry[];
  history: CopyVersion[];
  nextBeforeVersion: number | null;
};
export type CopyEditor = {
  server: CopyState;
  draft: CopyOverrides;
  conflicts: string[];
  needsRefresh: boolean;
};

const own = (value: CopyOverrides, key: string) => Object.prototype.hasOwnProperty.call(value, key);
const sameItem = (a: CopyOverrides, b: CopyOverrides, key: string) => own(a, key) === own(b, key) && a[key] === b[key];

export function changedCopyKeys(a: CopyOverrides, b: CopyOverrides): string[] {
  return [...new Set([...Object.keys(a), ...Object.keys(b)])].filter((key) => !sameItem(a, b, key));
}

export function createCopyEditor(server: CopyState): CopyEditor {
  return { server, draft: { ...server.overrides }, conflicts: [], needsRefresh: false };
}

/** Refresh preserves local edits and incorporates unrelated remote changes. */
export function refreshCopyEditor(current: CopyEditor | undefined, server: CopyState): CopyEditor {
  if (!current) return createCopyEditor(server);
  if (server.scope !== current.server.scope) throw new Error('文案范围不匹配');
  const draft = { ...server.overrides };
  const conflicts = new Set<string>();
  for (const key of changedCopyKeys(current.server.overrides, current.draft)) {
    if (!sameItem(current.server.overrides, server.overrides, key) && !sameItem(current.draft, server.overrides, key)) conflicts.add(key);
    if (own(current.draft, key)) draft[key] = current.draft[key];
    else delete draft[key];
  }
  // Refreshing an unchanged revision must not silently accept unresolved conflicts.
  for (const key of current.conflicts) {
    if (!sameItem(current.draft, server.overrides, key)) conflicts.add(key);
  }
  return { server, draft, conflicts: [...conflicts], needsRefresh: false };
}

export function updateCopyDraft(editor: CopyEditor, entry: EditableCopyEntry, template: string): CopyEditor {
  const draft = { ...editor.draft };
  if (template === entry.defaultText && !entry.preserveDefault) delete draft[entry.key];
  else draft[entry.key] = template;
  return { ...editor, draft };
}

export function resolveCopyConflict(editor: CopyEditor, key: string, use: 'mine' | 'published'): CopyEditor {
  const draft = { ...editor.draft };
  if (use === 'published') {
    if (own(editor.server.overrides, key)) draft[key] = editor.server.overrides[key];
    else delete draft[key];
  }
  return { ...editor, draft, conflicts: editor.conflicts.filter((value) => value !== key) };
}

export function filterCopyEntries(catalog: EditableCopyEntry[], options: { query: string; group: string; modifiedOnly: boolean; overrides: CopyOverrides }): EditableCopyEntry[] {
  const query = options.query.trim().toLocaleLowerCase();
  return catalog.filter((entry) => {
    if (options.group && entry.group !== options.group) return false;
    if (options.modifiedOnly && !own(options.overrides, entry.key)) return false;
    return !query || [entry.label, entry.group, entry.defaultText, options.overrides[entry.key] ?? '', entry.key]
      .some((value) => value.toLocaleLowerCase().includes(query));
  });
}

export function copyPreviewVariables(entry: EditableCopyEntry): Record<string, string> {
  return Object.fromEntries(entry.variables.map((variable, index) => {
    const value = entry.examples && Object.hasOwn(entry.examples, variable) ? String(entry.examples[variable])
      : /amount|price|balance|money|fee|cost|total|income/i.test(variable) ? '100.00'
      : /duration|minute|time|hour/i.test(variable) ? '60'
      : /name|caller|boss|user|receiver|peiwan/i.test(variable) ? '示例用户'
      : /url|link/i.test(variable) ? 'https://example.com'
      : /count|number|quantity/i.test(variable) ? '1'
      : `示例${index + 1}`;
    return [variable, value];
  }));
}

export function appendCopyHistory(current: CopyVersion[], incoming: CopyVersion[]): CopyVersion[] {
  const byVersion = new Map(current.map((item) => [item.version, item]));
  for (const item of incoming) if (!byVersion.has(item.version)) byVersion.set(item.version, item);
  return [...byVersion.values()].sort((a, b) => b.version - a.version);
}
