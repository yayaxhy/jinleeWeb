import { cache } from 'react';
import { loadPublishedCopy } from './editable-copy-store';
import { createSiteCopy, type SiteCopySnapshot } from './site-copy';

/** Request-local cache keeps server rendering and its hydration snapshot consistent. */
export const getSiteCopySnapshot = cache(async (): Promise<SiteCopySnapshot> => {
  try { return await loadPublishedCopy('site'); }
  catch {
    console.error('[site-copy] Published copy could not be read; using bundled defaults.');
    return { version: 0, overrides: {} };
  }
});
export const getSiteCopy = cache(async () => createSiteCopy((await getSiteCopySnapshot()).overrides));

export async function renderSiteCopy(key: string, values: Record<string, string | number> = {}) { return (await getSiteCopy())(key, values); }
