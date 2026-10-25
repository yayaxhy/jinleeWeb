import type { Metadata } from 'next';
import { createSiteCopy, type SiteCopyRenderer } from './site-copy';
import { SITE_COPY_CATALOG } from './editable-copy-catalog';
const defaultCopy = createSiteCopy();
const brandEntries = new Map(SITE_COPY_CATALOG.filter(entry => entry.source?.startsWith('lib/site.ts:')).map(entry => [defaultCopy(entry.key), entry.key]));
/** Only textual metadata fields are editable. URLs, identifiers, schema and transport settings remain literal. */
export function localizeSiteMetadata(metadata: Metadata, copy: SiteCopyRenderer, namespace: string): Metadata {
  const text = (value: unknown): unknown => typeof value === 'string'
    ? brandEntries.has(value) ? copy(brandEntries.get(value)!) : copy.text(value, namespace)
    : value;
  const visit = (value: unknown, key: string): unknown => {
    if (Array.isArray(value)) return value.map(item => visit(item, key));
    if (value && typeof value === 'object' && !(value instanceof URL)) {
      return Object.fromEntries(Object.entries(value).map(([childKey, child]) => [childKey, visit(child, childKey)]));
    }
    return ['title', 'default', 'absolute', 'description', 'siteName', 'applicationName', 'alt'].includes(key) ? text(value) : value;
  };
  return visit(metadata, '') as Metadata;
}
