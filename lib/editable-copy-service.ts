import { compatibleCopyOverrides, validateCopyOverrides, type EditableCopyEntry } from './editable-copy-contract';

export type CopyScope = 'bot' | 'site';
type ConfigRow = { scope: string; revision: number; activeVersion: number };
type VersionRow = { scope: string; version: number; overrides: unknown; actorId: string; reason: string; createdAt: Date };
/** Structural interface also permits offline transaction tests. */
export type CopyDb = {
  editableCopyConfig: {
    findUnique(args: { where: { scope: string } }): Promise<ConfigRow | null>;
    createMany(args: { data: Array<{ scope: string }>; skipDuplicates: boolean }): Promise<unknown>;
    updateMany(args: { where: { scope: string; revision: number; activeVersion: number }; data: { revision: { increment: number }; activeVersion: number } }): Promise<{ count: number }>;
  };
  editableCopyVersion: {
    findUnique(args: { where: { scope_version: { scope: string; version: number } } }): Promise<VersionRow | null>;
    findMany(args: { where: { scope: string; version?: { lt: number } }; orderBy: { version: 'desc' }; take: number }): Promise<VersionRow[]>;
    create(args: { data: { scope: string; version: number; overrides: Record<string, string>; actorId: string; reason: string; rollbackOf: number | null } }): Promise<unknown>;
  };
  $transaction<T>(callback: (tx: CopyDb) => Promise<T>): Promise<T>;
};
export class EditableCopyError extends Error {
  constructor(public readonly status: number, message: string) { super(message); }
}
export function parseCopyScope(value: unknown): CopyScope {
  if (value !== 'bot' && value !== 'site') throw new EditableCopyError(400, '文案范围无效');
  return value;
}

export function createEditableCopyService(db: CopyDb, scope: CopyScope, catalog: readonly EditableCopyEntry[], options: {
  validateImages?: (overrides: Record<string, string>) => Promise<void>;
} = {}) {
  const compatible = (value: unknown) => compatibleCopyOverrides(catalog, value);
  const imageKeys = new Set(catalog.filter(entry => entry.kind === 'image').map(entry => entry.key));
  const isImageKey = (key: string) => imageKeys.has(key) || key.startsWith(`${scope}.image.`);
  async function loadPublished() {
    const config = await db.editableCopyConfig.findUnique({ where: { scope } });
    if (!config?.activeVersion) return { version: 0, overrides: {}, ignoredKeys: [] as string[] };
    const row = await db.editableCopyVersion.findUnique({ where: { scope_version: { scope, version: config.activeVersion } } });
    if (!row) throw new EditableCopyError(503, '已发布的文案版本缺失');
    return { version: row.version, ...compatible(row.overrides) };
  }
  async function inspect(beforeVersion?: number) {
    const config = await db.editableCopyConfig.findUnique({ where: { scope } });
    const [active, rows] = await Promise.all([
      config?.activeVersion ? db.editableCopyVersion.findUnique({ where: { scope_version: { scope, version: config.activeVersion } } }) : null,
      db.editableCopyVersion.findMany({ where: { scope, ...(beforeVersion ? { version: { lt: beforeVersion } } : {}) }, orderBy: { version: 'desc' }, take: 21 }),
    ]);
    if (config?.activeVersion && !active) throw new EditableCopyError(503, '已发布的文案版本缺失');
    return {
      ok: true as const, scope, revision: config?.revision ?? 0, activeVersion: config?.activeVersion ?? 0,
      ...compatible(active?.overrides ?? {}), catalog,
      history: rows.slice(0, 20).map(row => ({ version: row.version, ...compatible(row.overrides), actorId: row.actorId, reason: row.reason, createdAt: row.createdAt })),
      nextBeforeVersion: rows.length > 20 ? rows[19].version : null,
    };
  }
  async function execute(value: unknown, actorId: string) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new EditableCopyError(400, '请求格式错误');
    const body = value as Record<string, unknown>;
    const keys = ['scope', 'action', 'expectedRevision', 'reason', 'imageSchemaVersion', ...(body.action === 'publish' ? ['overrides'] : ['targetVersion'])];
    if (Object.keys(body).some(key => !keys.includes(key)) || body.scope !== scope) throw new EditableCopyError(400, '请求字段无效');
    if (body.imageSchemaVersion !== undefined && body.imageSchemaVersion !== 1) throw new EditableCopyError(400, '请求字段无效');
    if (body.action !== 'publish' && body.action !== 'rollback') throw new EditableCopyError(400, '未知文案操作');
    if (!Number.isSafeInteger(body.expectedRevision) || Number(body.expectedRevision) < 0 || Number(body.expectedRevision) >= Number.MAX_SAFE_INTEGER) throw new EditableCopyError(400, '缺少有效修订号');
    if (!actorId || actorId.length > 255) throw new EditableCopyError(403, '操作身份无效');
    if (body.reason !== undefined && (typeof body.reason !== 'string' || body.reason.trim().length > 300)) throw new EditableCopyError(400, '原因不能超过 300 字');
    const reason = typeof body.reason === 'string' && body.reason.trim() ? body.reason.trim() : body.action === 'publish' ? '保存并发布文案' : '恢复历史文案';
    let overrides: Record<string, string>;
    if (body.action === 'rollback') {
      if (!Number.isSafeInteger(body.targetVersion) || Number(body.targetVersion) < 1) throw new EditableCopyError(400, '回滚版本无效');
      const previous = await db.editableCopyVersion.findUnique({ where: { scope_version: { scope, version: Number(body.targetVersion) } } });
      if (!previous) throw new EditableCopyError(404, '历史版本不存在');
      overrides = compatible(previous.overrides).overrides;
    } else {
      try { overrides = validateCopyOverrides(catalog, body.overrides); }
      catch (error) { throw new EditableCopyError(400, error instanceof Error ? error.message : '文案未通过校验'); }
    }
    await db.$transaction(async tx => {
      await tx.editableCopyConfig.createMany({ data: [{ scope }], skipDuplicates: true });
      const current = await tx.editableCopyConfig.findUnique({ where: { scope } });
      if (!current || current.revision !== body.expectedRevision) throw new EditableCopyError(409, '文案已被其他管理员修改，请刷新核对');
      let published = overrides;
      // Older editor tabs only manage text. Their full-replacement payload must
      // not reset images they never loaded or offered controls for.
      if (body.imageSchemaVersion !== 1) {
        published = Object.fromEntries(Object.entries(overrides).filter(([key]) => !isImageKey(key)));
        const active = current.activeVersion ? await tx.editableCopyVersion.findUnique({ where: { scope_version: { scope, version: current.activeVersion } } }) : null;
        if (current.activeVersion && !active) throw new EditableCopyError(503, '已发布的文案版本缺失');
        if (active?.overrides && typeof active.overrides === 'object' && !Array.isArray(active.overrides)) {
          for (const [key, value] of Object.entries(active.overrides)) if (isImageKey(key) && typeof value === 'string') published[key] = value;
        }
      }
      await options.validateImages?.(published);
      const version = current.activeVersion + 1;
      const result = await tx.editableCopyConfig.updateMany({ where: { scope, revision: current.revision, activeVersion: current.activeVersion }, data: { revision: { increment: 1 }, activeVersion: version } });
      if (result.count !== 1) throw new EditableCopyError(409, '文案已被其他管理员修改，请刷新核对');
      await tx.editableCopyVersion.create({ data: { scope, version, overrides: published, actorId, reason, rollbackOf: body.action === 'rollback' ? Number(body.targetVersion) : null } });
    });
    return inspect();
  }
  return { inspect, execute, loadPublished };
}
