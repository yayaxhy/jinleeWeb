import { SITE_COPY_CATALOG, SITE_COPY_FIXED_VALUES } from './editable-copy-catalog';
import { isUploadedCopyImage, renderCopyTemplate } from './editable-copy-contract';
import { SITE_IMAGE_CATALOG } from './editable-image-catalog';

export type SiteCopySnapshot = { version: number; overrides: Record<string, string> };
/** Published versions are immutable; polling the same version must retain callback identity. */
export function newerSiteCopySnapshot(current: SiteCopySnapshot, next: SiteCopySnapshot): SiteCopySnapshot {
  return next.version > current.version ? next : current;
}
export type SiteCopyValues = Record<string, string | number>;
const imageKeys = new Set(SITE_IMAGE_CATALOG.map(entry => entry.key));
const entries = new Map(SITE_COPY_CATALOG.map((entry) => [entry.key, entry]));
const byDefault = new Map<string, typeof SITE_COPY_CATALOG[number][]>();
for (const entry of SITE_COPY_CATALOG) {
  const fixed = SITE_COPY_FIXED_VALUES[entry.key] ?? {};
  if (entry.variables.some(name => !Object.hasOwn(fixed, name))) continue;
  const original = renderCopyTemplate(entry, entry.defaultText, fixed);
  const matches = byDefault.get(original) ?? [];
  matches.push(entry);
  byDefault.set(original, matches);
}
export function createSiteCopy(overrides: Record<string, string> = {}) {
  const copy = (key: string, values: SiteCopyValues = {}): string => {
    const entry = entries.get(key);
    if (!entry) return '';
    const facts = { ...values, ...SITE_COPY_FIXED_VALUES[key] };
    try { return renderCopyTemplate(entry, overrides[key] ?? entry.defaultText, facts); }
    catch { return renderCopyTemplate(entry, entry.defaultText, facts); }
  };
  /** Only display literals registered in the catalog can be resolved. No source data is mutated. */
  copy.text = <T,>(value: T, namespace?: string): T | string => {
    if (typeof value !== 'string') return value;
    const matches = byDefault.get(value);
    if (!matches?.length) return value;
    const entry = matches.find((item) => namespace && item.key.startsWith(namespace + '.'));
    return entry ? copy(entry.key) : value;
  };
  /** Missing or invalid image overrides preserve the caller’s exact original source. */
  copy.image = (key: string, fallback: string): string =>
    imageKeys.has(key) && isUploadedCopyImage(overrides[key]) ? overrides[key] : fallback;
  return copy;
}
export type SiteCopyRenderer = ReturnType<typeof createSiteCopy>;
