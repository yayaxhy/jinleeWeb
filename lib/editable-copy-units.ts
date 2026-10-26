import type { EditableCopyEntry } from './editable-copy-contract';
import { BOT_COPY_UNITS } from './bot-copy-units';
import { SITE_COPY_UNITS } from './site-copy-units';

/** Presentation metadata only. All writes continue to use the existing copy keys. */
export type CopyUnitPart = {
  key?: string;
  text?: string;
  role?: 'title' | 'text' | 'label' | 'button' | 'footer' | 'attribute';
  separator?: string;
  examples?: Readonly<Record<string, string | number>>;
};
export type CopyUnitDefinition = {
  id: string;
  kind: 'message' | 'card' | 'section';
  titleKey: string;
  keys: readonly string[];
  parts?: readonly CopyUnitPart[];
  source?: string;
};
export type CopyUnit = Omit<CopyUnitDefinition, 'keys' | 'parts'> & {
  keys: string[];
  entries: EditableCopyEntry[];
  parts: CopyUnitPart[];
  title: string;
};

export function resolveCopyUnits(catalog: readonly EditableCopyEntry[], definitions: readonly CopyUnitDefinition[]): CopyUnit[] {
  const entries = new Map(catalog.map(entry => [entry.key, entry]));
  const covered = new Set<string>();
  const ids = new Set<string>();
  const result: CopyUnit[] = [];
  for (const definition of definitions) {
    if (ids.has(definition.id)) continue;
    const keys = [...new Set(definition.keys)].filter(key => entries.has(key));
    if (!keys.length) continue;
    const parts = definition.parts
      ? definition.parts.filter(part => part.key ? keys.includes(part.key) : typeof part.text === 'string')
      : keys.map((key, index) => ({ key, separator: index ? '\n' : '', role: 'text' as const }));
    // A rolling deployment may return an older catalog. Missing metadata must
    // never hide a valid field or create a second, disconnected override key.
    for (const key of keys) if (!parts.some(part => part.key === key)) parts.push({ key, separator: '\n', role: 'text' });
    const titleKey = keys.includes(definition.titleKey) ? definition.titleKey : keys[0];
    result.push({ ...definition, titleKey, keys, parts, entries: keys.map(key => entries.get(key)!), title: entries.get(titleKey)!.label });
    ids.add(definition.id);
    for (const key of keys) covered.add(key);
  }
  for (const entry of catalog) {
    if (covered.has(entry.key)) continue;
    result.push({ id: `single:${entry.key}`, kind: 'message', titleKey: entry.key, title: entry.label,
      keys: [entry.key], entries: [entry], parts: [{ key: entry.key, role: 'text' }], source: entry.source });
  }
  return result;
}

export function getCopyUnits(scope: 'bot' | 'site', catalog: readonly EditableCopyEntry[]): CopyUnit[] {
  return resolveCopyUnits(catalog, scope === 'bot' ? BOT_COPY_UNITS : SITE_COPY_UNITS);
}

export function filterCopyUnits(units: readonly CopyUnit[], options: {
  query: string;
  modifiedOnly: boolean;
  conflictsOnly: boolean;
  overrides: Record<string, string>;
  conflicts: readonly string[];
}): CopyUnit[] {
  const query = options.query.trim().toLocaleLowerCase();
  const conflicts = new Set(options.conflicts);
  return units.filter(unit => {
    if (options.modifiedOnly && !unit.keys.some(key => Object.hasOwn(options.overrides, key))) return false;
    if (options.conflictsOnly && !unit.keys.some(key => conflicts.has(key))) return false;
    return !query || [unit.title, ...unit.entries.flatMap(entry => [entry.label, entry.group, entry.defaultText, options.overrides[entry.key] ?? '', entry.key])]
      .some(value => value.toLocaleLowerCase().includes(query));
  });
}
