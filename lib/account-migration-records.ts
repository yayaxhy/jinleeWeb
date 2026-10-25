import { Prisma } from '@prisma/client';

export type MigrationRow = Record<string, unknown>;
type Args = Record<string, unknown>;
export type MigrationDelegate = {
  findMany(args?: Args): Promise<MigrationRow[]>;
  findFirst(args: Args): Promise<MigrationRow | null>;
  findUnique(args: Args): Promise<MigrationRow | null>;
  count(args?: Args): Promise<number>;
  create(args: Args): Promise<MigrationRow>;
  updateMany(args: Args): Promise<{ count: number }>;
  deleteMany(args: Args): Promise<{ count: number }>;
};
export const migrationDelegate = (tx: Prisma.TransactionClient, model: string) => {
  const key = model[0].toLowerCase() + model.slice(1);
  const delegate = (tx as unknown as Record<string, MigrationDelegate>)[key];
  if (!delegate) throw new Error(`migration_model_unavailable:${model}`);
  return delegate;
};
export const migrationJson = (value: unknown): Prisma.InputJsonValue => JSON.parse(JSON.stringify(value));
export const migrationModels = Prisma.dmmf.datamodel.models;
export const migrationModel = (name: string) => {
  const model = migrationModels.find(entry => entry.name === name);
  if (!model) throw new Error(`migration_model_metadata_missing:${name}`);
  return model;
};
export function migrationRowKey(modelName: string, row: MigrationRow): MigrationRow {
  const model = migrationModel(modelName);
  const fields = model.primaryKey?.fields ?? model.fields.filter(field => field.isId).map(field => field.name);
  const key = fields.length ? fields : model.fields.filter(field => field.isUnique).map(field => field.name).slice(0, 1);
  if (!key.length || key.some(field => row[field] === undefined)) throw new Error(`migration_row_key_missing:${modelName}`);
  return Object.fromEntries(key.map(field => [field, row[field]]));
}
export function migrationUniqueKeys(modelName: string): string[][] {
  const model = migrationModel(modelName);
  return [
    ...(model.primaryKey ? [model.primaryKey.fields] : []),
    ...model.fields.filter(field => field.isId || field.isUnique).map(field => [field.name]),
    ...model.uniqueFields,
  ].map(fields => [...fields]);
}
export async function migrationConflict(tx: Prisma.TransactionClient, model: string, row: MigrationRow, patch: MigrationRow) {
  const next = { ...row, ...patch };
  for (const fields of migrationUniqueKeys(model)) {
    if (!fields.some(field => Object.hasOwn(patch, field)) || fields.some(field => next[field] == null)) continue;
    const found = await migrationDelegate(tx, model).findFirst({ where: Object.fromEntries(fields.map(field => [field, next[field]])) });
    if (found && JSON.stringify(migrationRowKey(model, found)) !== JSON.stringify(migrationRowKey(model, row))) return found;
  }
  return null;
}

export type MigrationArchiveContext = {
  tx: Prisma.TransactionClient; migrationId: string; counts: Record<string, number>;
  skipped: Array<{ model: string; recordKey: string; reason: string }>;
  archived: Set<string>;
};
export async function archiveMigrationRow(context: MigrationArchiveContext, model: string, row: MigrationRow, disposition: string) {
  const recordKey = JSON.stringify(migrationRowKey(model, row));
  const token = `${model}:${recordKey}`;
  if (context.archived.has(token)) return;
  await migrationDelegate(context.tx, 'AccountMigrationArchive').create({ data: {
    migrationId: context.migrationId, model, recordKey, disposition, payload: migrationJson(row),
  } });
  context.archived.add(token);
}
export async function updateMigrationRow(context: MigrationArchiveContext, model: string, row: MigrationRow, data: MigrationRow) {
  await archiveMigrationRow(context, model, row, 'OWNERSHIP_OR_STATE_UPDATED');
  const updated = await migrationDelegate(context.tx, model).updateMany({ where: migrationRowKey(model, row), data });
  if (updated.count !== 1) throw new Error(`migration_concurrent_change:${model}`);
  context.counts[model] = (context.counts[model] ?? 0) + 1;
}
export async function deleteArchivedMigrationRow(context: MigrationArchiveContext, model: string, row: MigrationRow, disposition: string) {
  await archiveMigrationRow(context, model, row, disposition);
  const deleted = await migrationDelegate(context.tx, model).deleteMany({ where: migrationRowKey(model, row) });
  if (deleted.count !== 1) throw new Error(`migration_concurrent_delete:${model}`);
}

/** Explicit incompatible activity only. Archive the entire dependent tree before
 * deleting anything; no FK cascade is used as an implicit data-loss policy. */
export async function archiveMigrationTree(context: MigrationArchiveContext, model: string, row: MigrationRow, reason: string, visiting = new Set<string>()) {
  const recordKey = JSON.stringify(migrationRowKey(model, row));
  const token = `${model}:${recordKey}`;
  if (visiting.has(token)) throw new Error(`migration_relation_cycle:${model}`);
  visiting.add(token);
  for (const child of migrationModels) {
    for (const relation of child.fields.filter(field => field.kind === 'object' && field.type === model && field.relationFromFields?.length)) {
      const where = Object.fromEntries(relation.relationFromFields!.map((field, index) => [field, row[relation.relationToFields![index]]]));
      for (const nested of await migrationDelegate(context.tx, child.name).findMany({ where })) {
        await archiveMigrationTree(context, child.name, nested, reason, visiting);
      }
    }
  }
  await deleteArchivedMigrationRow(context, model, row, `ARCHIVED_NOT_ACTIVE:${reason}`);
  context.skipped.push({ model, recordKey, reason });
  visiting.delete(token);
}

// Only current ownership fields are moved. Immutable GiftAudit/OrderAudit,
// payment metadata, message plans, identity snapshots, actor ids and original
// IndividualTransaction.discordId are deliberately absent.
export const migrationExtraOwnerFields: Record<string, { dlm?: string[]; member?: string[]; peiwan?: string[] }> = {
  Coupon: { member: ['discordId'] }, Withdraw: { member: ['discordId'] }, Recharge: { member: ['toWhom'] },
  FarmPlot: { member: ['discordUserId'] }, FarmActionLog: { member: ['discordUserId'] },
  FarmVisit: { member: ['viewerDiscordId', 'targetDiscordId'] },
  FarmPlotHelp: { member: ['helperDiscordId'] },
  ManualQuotaBatch: { member: ['userId'] }, ManualQuotaRestoration: { member: ['userId'] },
  CommissionBuff: { member: ['userId'] }, FlowBuff: { member: ['userId'] }, SpendBuff: { member: ['userId'] },
  AutoCommissionBuff: { member: ['userId'] },
  BossChannelBinding: { member: ['ownerId'] },
  PeiwanDeletion: { member: ['discordUserId'], peiwan: ['peiwanId'] },
  PeiwanGameProfile: { member: ['discordUserId'] },
  RedEnvelope: { member: ['creatorId'] }, RedEnvelopeClaim: { dlm: ['claimerDlmId'], member: ['claimerDiscordId'] },
  GuildJoinRecord: { member: ['userId'] },
  PeiwanReview: { peiwan: ['peiwanId'] },
  BlockStackGame: { member: ['creatorId', 'collapseRewardUserId'] },
  BlockStackPlayer: { member: ['userId'] }, BlockStackDraw: { member: ['userId'] },
};
export function migrationOwnerFields(modelName: string) {
  const model = migrationModel(modelName);
  const result = { dlm: new Set<string>(), member: new Set<string>(), peiwan: new Set<string>() };
  for (const field of model.fields) {
    const kind = field.type === 'DlmUser' ? 'dlm' : field.type === 'Member' || field.type === 'FarmProfile' ? 'member' : field.type === 'PEIWAN' ? 'peiwan' : null;
    if (kind && field.kind === 'object') for (const name of field.relationFromFields ?? []) result[kind].add(name);
  }
  const extra = migrationExtraOwnerFields[modelName];
  for (const kind of ['dlm', 'member', 'peiwan'] as const) for (const name of extra?.[kind] ?? []) result[kind].add(name);
  return result;
}
