import type { Prisma } from '@prisma/client';

type BenefitDb = Pick<Prisma.TransactionClient, 'dlmUser' | 'accountOwnership' | 'accountMigration' | 'revert'>;
const object = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const strings = (value: unknown) => Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
const date = (value: unknown) => { const result = value instanceof Date ? value : typeof value === 'string' ? new Date(value) : null; return result && Number.isFinite(result.getTime()) ? result : null; };
export type AccountMigrationBenefitContext = {
  dlmId: string | null; excludedIncomeIds: Set<string>; suppressedVipLevels: Set<number>;
  inheritedAutoCommissionUntil: Date | null;
};

/** Current ownership is separate from original income facts. The exclusions are
 * exact receipt IDs captured while source wallets are locked, never a Discord
 * nickname, amount or time-window guess. A recycled Discord ID cannot requalify
 * old income. Inherited benefit expiry does not seed the earned-income timeline. */
export async function loadAccountMigrationBenefits(db: BenefitDb, input: { dlmId?: string | null; discordUserId?: string | null }, now = new Date()): Promise<AccountMigrationBenefitContext> {
  const dlmId = input.dlmId ?? (input.discordUserId ? (await db.dlmUser.findUnique({ where: { discordUserId: input.discordUserId }, select: { dlmId: true } }))?.dlmId : null) ?? null;
  const result: AccountMigrationBenefitContext = { dlmId, excludedIncomeIds: new Set(), suppressedVipLevels: new Set(), inheritedAutoCommissionUntil: null };
  if (!dlmId) return result;
  const aliases = await db.accountOwnership.findMany({ where: { identityKind: 'DLM', currentDlmId: dlmId }, select: { originalDlmId: true } });
  const owners = [...new Set([dlmId, ...aliases.map(row => row.originalDlmId)])];
  const migrations = await db.accountMigration.findMany({ where: { status: 'COMPLETED', targetDlmId: { in: owners } }, select: { snapshot: true, inheritedAutoCommissionUntil: true, createdAt: true } });
  const origins: Array<{ dlmIds: string[]; through: Date }> = [];
  for (const migration of migrations) {
    const snapshot = object(migration.snapshot);
    for (const id of strings(snapshot.excludedAutoCommissionTransactionIds)) result.excludedIncomeIds.add(id);
    for (const level of Array.isArray(snapshot.suppressedVipLevels) ? snapshot.suppressedVipLevels : []) if (typeof level === 'number' && Number.isInteger(level) && level > 0) result.suppressedVipLevels.add(level);
    for (const origin of Array.isArray(snapshot.excludedAutoCommissionOrigins) ? snapshot.excludedAutoCommissionOrigins : []) {
      const record = object(origin), through = date(record.through);
      if (through) origins.push({ dlmIds: strings(record.dlmIds), through });
    }
    const expiry = migration.inheritedAutoCommissionUntil;
    if (expiry && expiry > now && (!result.inheritedAutoCommissionUntil || expiry > result.inheritedAutoCommissionUntil)) result.inheritedAutoCommissionUntil = expiry;
  }
  if (result.excludedIncomeIds.size || origins.length) {
    const earliest = new Date(Math.min(...migrations.map(row => row.createdAt.getTime())));
    const reversals = await db.revert.findMany({ where: { status: 'SUCCESS', createdAt: { gte: earliest }, OR: owners.flatMap(owner => [
      { details: { path: ['receiverDlmId'], equals: owner } }, { details: { path: ['workerDlmId'], equals: owner } },
    ]) }, select: { details: true } });
    for (const reversal of reversals) {
      const details = object(reversal.details);
      const giftCreatedAt = date(details.originalGiftCreatedAt);
      const excludedGift = typeof details.originalReceiverTransactionId === 'string' && result.excludedIncomeIds.has(details.originalReceiverTransactionId) ||
        typeof details.originalReceiverDlmId === 'string' && !!giftCreatedAt && origins.some(origin => origin.dlmIds.includes(details.originalReceiverDlmId as string) && giftCreatedAt <= origin.through);
      const excludedOrder = typeof details.originalWorkerTransactionId === 'string' && result.excludedIncomeIds.has(details.originalWorkerTransactionId);
      if (excludedGift && typeof details.receiverReversalTransactionId === 'string') result.excludedIncomeIds.add(details.receiverReversalTransactionId);
      if (excludedOrder && typeof details.workerReversalTransactionId === 'string') result.excludedIncomeIds.add(details.workerReversalTransactionId);
    }
  }
  return result;
}

export function inheritedAutoCommissionExpiry(earned: Date | null, context: AccountMigrationBenefitContext, now: Date) {
  const inherited = context.inheritedAutoCommissionUntil;
  return inherited && inherited > now && (!earned || inherited > earned) ? inherited : earned;
}
