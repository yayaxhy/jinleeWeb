import type { Metadata } from 'next';
import { createSiteCopy, type SiteCopyRenderer } from './site-copy';
import { SITE_COPY_CATALOG } from './editable-copy-catalog';
import { SITE_OG_IMAGE } from './site';
const defaultCopy = createSiteCopy();
const brandEntries = new Map(SITE_COPY_CATALOG.filter(entry => entry.source?.startsWith('lib/site.ts:')).map(entry => [defaultCopy(entry.key), entry.key]));
/** The registered sharing artwork is the only metadata URL that can be replaced. */
export function withSiteImageMetadata(metadata: Metadata, copy: SiteCopyRenderer): Metadata {
  const image = (value: unknown): unknown => {
    if (typeof value === 'string') return value === SITE_OG_IMAGE ? copy.image('site.image.brand.social-preview', value) : value;
    if (Array.isArray(value)) return value.map(image);
    if (value && typeof value === 'object' && !(value instanceof URL) && 'url' in value) {
      return { ...value, url: image(value.url) };
    }
    return value;
  };
  return {
    ...metadata,
    ...(metadata.openGraph && 'images' in metadata.openGraph
      ? { openGraph: { ...metadata.openGraph, images: image(metadata.openGraph.images) } } : {}),
    ...(metadata.twitter && 'images' in metadata.twitter
      ? { twitter: { ...metadata.twitter, images: image(metadata.twitter.images) } } : {}),
  } as Metadata;
}
/** Text and registered sharing artwork are editable. Identifiers and transport settings remain literal. */
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
  return withSiteImageMetadata(visit(metadata, '') as Metadata, copy);
}
