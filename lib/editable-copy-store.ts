import { prisma } from './prisma';
import { BOT_COPY_CATALOG } from './bot-editable-copy-catalog';
import { SITE_COPY_CATALOG } from './editable-copy-catalog';
import { createEditableCopyService, type CopyDb, type CopyScope } from './editable-copy-service';

export const editableCopyEnabled = () => process.env.EDITABLE_COPY_ENABLED === 'true';
export const getEditableCopyCatalog = (scope: CopyScope) => scope === 'bot' ? BOT_COPY_CATALOG : SITE_COPY_CATALOG;
export function getEditableCopyService(scope: CopyScope) {
  return createEditableCopyService(prisma as unknown as CopyDb, scope, getEditableCopyCatalog(scope));
}
export async function loadPublishedCopy(scope: CopyScope): Promise<{ version: number; overrides: Record<string, string> }> {
  if (!editableCopyEnabled()) return { version: 0, overrides: {} };
  const result = await getEditableCopyService(scope).loadPublished();
  if (result.ignoredKeys.length) console.warn('[editable-copy] incompatible historical templates use defaults', scope, result.ignoredKeys.length);
  return { version: result.version, overrides: result.overrides };
}
export async function getCopyState(scope: CopyScope, beforeVersion?: number) {
  if (!editableCopyEnabled()) return {
    ok: true as const, enabled: false, scope, revision: 0, activeVersion: 0,
    overrides: {}, ignoredKeys: [] as string[], catalog: getEditableCopyCatalog(scope), history: [], nextBeforeVersion: null,
  };
  return { ...await getEditableCopyService(scope).inspect(beforeVersion), enabled: true };
}
