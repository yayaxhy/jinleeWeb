import type { EditableCopyEntry } from './editable-copy-contract';
import { BOT_COPY_UNITS } from './bot-copy-units';
import { SITE_COPY_UNITS } from './site-copy-units';
import { BOT_IMAGE_BINDINGS, BOT_IMAGE_ONLY_UNITS } from './bot-image-bindings';
import { SITE_IMAGE_BINDINGS, SITE_IMAGE_ONLY_UNITS } from './site-image-bindings';
import type { CopyImageBinding, CopyImageOnlyUnit, CopyImageSlot } from './editable-copy-images';

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
  images?: readonly CopyImageSlot[];
};
export type CopyUnit = Omit<CopyUnitDefinition, 'keys' | 'parts' | 'images'> & {
  keys: string[];
  entries: EditableCopyEntry[];
  parts: CopyUnitPart[];
  title: string;
  images: CopyImageSlot[];
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
      ? definition.parts.filter(part => part.key ? keys.includes(part.key) && entries.get(part.key)?.kind !== 'image' : typeof part.text === 'string')
      : keys.filter(key => entries.get(key)?.kind !== 'image').map((key, index) => ({ key, separator: index ? '\n' : '', role: 'text' as const }));
    // A rolling deployment may return an older catalog. Missing metadata must
    // never hide a valid field or create a second, disconnected override key.
    for (const key of keys) if (entries.get(key)?.kind !== 'image' && !parts.some(part => part.key === key)) parts.push({ key, separator: '\n', role: 'text' });
    const titleKey = keys.includes(definition.titleKey) ? definition.titleKey : keys[0];
    const images = (definition.images ?? []).filter(slot => keys.includes(slot.key) && entries.get(slot.key)?.kind === 'image');
    result.push({ ...definition, titleKey, keys, parts, images, entries: keys.map(key => entries.get(key)!), title: entries.get(titleKey)!.label });
    ids.add(definition.id);
    for (const key of keys) covered.add(key);
  }
  for (const entry of catalog) {
    if (covered.has(entry.key)) continue;
    result.push({ id: `single:${entry.key}`, kind: 'message', titleKey: entry.key, title: entry.label,
      keys: [entry.key], entries: [entry], parts: entry.kind === 'image' ? [] : [{ key: entry.key, role: 'text' }],
      images: entry.kind === 'image' ? [{ key: entry.key, placement: 'image' }] : [], source: entry.source });
  }
  return result;
}

export function getCopyUnits(scope: 'bot' | 'site', catalog: readonly EditableCopyEntry[]): CopyUnit[] {
  return resolveCopyUnits(catalog, bindCopyImages(scope === 'bot' ? BOT_COPY_UNITS : SITE_COPY_UNITS,
    scope === 'bot' ? BOT_IMAGE_BINDINGS : SITE_IMAGE_BINDINGS,
    scope === 'bot' ? BOT_IMAGE_ONLY_UNITS : SITE_IMAGE_ONLY_UNITS));
}

/** Keep mutually exclusive pictures in separate previews, sharing the original text keys. */
export function bindCopyImages(definitions: readonly CopyUnitDefinition[], bindings: readonly CopyImageBinding[], standalone: readonly CopyImageOnlyUnit[]): CopyUnitDefinition[] {
  const byUnit = new Map<string, CopyImageBinding[]>();
  for (const binding of bindings) byUnit.set(binding.unitId, [...(byUnit.get(binding.unitId) ?? []), binding]);
  return [
    ...definitions.flatMap(definition => {
      const matches = byUnit.get(definition.id);
      if (!matches?.length) return [definition];
      return matches.map(binding => ({ ...definition,
        id: binding.variantId ? `${definition.id}:image:${binding.variantId}` : definition.id,
        keys: [...new Set([...definition.keys, ...binding.images.map(image => image.key)])],
        images: binding.images,
        parts: binding.examples ? definition.parts?.map(part => ({ ...part, examples: { ...part.examples, ...binding.examples } })) : definition.parts,
      }));
    }),
    ...standalone.map(item => ({ id: item.id, kind: 'card' as const, titleKey: item.imageKey,
      keys: [item.imageKey], parts: [], images: [{ key: item.imageKey, placement: 'image' as const }], source: item.source })),
  ];
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
