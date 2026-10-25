import { Prisma } from '@prisma/client';

const KINDS = ['flow', 'spend'] as const;
const TABLE = { flow: Prisma.sql`flow_buff`, spend: Prisma.sql`spend_buff` };
type Anchor = { userId: string; remainingExtra: Prisma.Decimal; expiresAt: Date; createdAt: Date };
export type ManualQuotaLocks = { users: Set<string>; created: Map<string, Anchor> };
const conflict = () => new Error('增益归属或额度已变化，请核实后再迁移。');

/** After all DLM/Member locks, before any quota snapshot. Same anchor protocol
 * as Bot consume/restore: flow then spend, users sorted within each kind.
 */
export async function lockManualQuotaOwnersTx(tx: Prisma.TransactionClient, userIds: readonly string[]): Promise<ManualQuotaLocks> {
  const users = [...new Set(userIds)].sort();
  if (users.some((id) => !id || id.trim() !== id)) throw conflict();
  const created = new Map<string, Anchor>();
  for (const kind of KINDS) for (const userId of users) {
    const inserted = await tx.$executeRaw(Prisma.sql`
      INSERT INTO ${TABLE[kind]} (user_id, remaining_extra, expires_at, created_at, updated_at)
      VALUES (${userId}, 0, ${new Date(0)}, now(), now()) ON CONFLICT (user_id) DO NOTHING
    `);
    const [row] = await tx.$queryRaw<Anchor[]>(Prisma.sql`
      SELECT user_id AS "userId", remaining_extra AS "remainingExtra", expires_at AS "expiresAt", created_at AS "createdAt"
      FROM ${TABLE[kind]} WHERE user_id = ${userId} FOR UPDATE
    `);
    if (!row || row.userId !== userId) throw conflict();
    if (inserted === 1) created.set(`${kind}:${userId}`, row);
  }
  return { users: new Set(users), created };
}

function requireLocked(locks: ManualQuotaLocks, ids: readonly string[]) {
  if (ids.some((id) => !locks.users.has(id))) throw conflict();
}

/** Asset transfer moves each restored entitlement without changing its amount,
 * expiry, or identity. Expired/consumed rows remain historical evidence.
 */
export async function moveManualQuotaRestorationsTx(
  tx: Prisma.TransactionClient, sourceUserId: string, targetUserId: string, locks: ManualQuotaLocks,
) {
  if (sourceUserId === targetUserId) throw conflict();
  requireLocked(locks, [sourceUserId, targetUserId]);
  const rows = await tx.manualQuotaRestoration.findMany({ where: { userId: sourceUserId }, orderBy: { id: 'asc' } });
  const counts = { flowRestorationsTransferred: 0, spendRestorationsTransferred: 0 };
  for (const row of rows) {
    if (row.kind !== 'flow' && row.kind !== 'spend') throw conflict();
    const moved = await tx.manualQuotaRestoration.updateMany({
      where: { id: row.id, userId: sourceUserId, kind: row.kind, remainingExtra: row.remainingExtra, expiresAt: row.expiresAt },
      data: { userId: targetUserId },
    });
    if (moved.count !== 1) throw conflict();
    counts[row.kind === 'flow' ? 'flowRestorationsTransferred' : 'spendRestorationsTransferred'] += 1;
  }
  return counts;
}

/** Ordinary batches keep their own expiry, including expired/consumed history.
 * They never enter the restoration table or the legacy base amount.
 */
export async function moveManualQuotaBatchesTx(
  tx: Prisma.TransactionClient, sourceUserId: string, targetUserId: string, locks: ManualQuotaLocks,
) {
  if (sourceUserId === targetUserId) throw conflict();
  requireLocked(locks, [sourceUserId, targetUserId]);
  const rows = await tx.manualQuotaBatch.findMany({ where: { userId: sourceUserId }, orderBy: { id: 'asc' } });
  const counts = { flowBatchesTransferred: 0, spendBatchesTransferred: 0 };
  for (const row of rows) {
    if ((row.kind !== 'flow' && row.kind !== 'spend') || !row.remainingExtra.isFinite() || row.remainingExtra.lt(0)) throw conflict();
    const moved = await tx.manualQuotaBatch.updateMany({
      where: { id: row.id, userId: sourceUserId, kind: row.kind, remainingExtra: row.remainingExtra, expiresAt: row.expiresAt },
      data: { userId: targetUserId },
    });
    if (moved.count !== 1) throw conflict();
    counts[row.kind === 'flow' ? 'flowBatchesTransferred' : 'spendBatchesTransferred'] += 1;
  }
  return counts;
}

/** Discord rename differs from merging assets: preserve the base row as well.
 * Only this transaction's empty destination placeholders can be removed.
 */
export async function remapManualQuotaOwnersTx(
  tx: Prisma.TransactionClient,
  mappings: readonly { from: string; to: string }[],
  locks: ManualQuotaLocks,
) {
  requireLocked(locks, mappings.flatMap(({ from, to }) => [from, to]));
  const changed: Record<string, number> = {};
  for (const { from, to } of mappings) {
    if (from === to) throw conflict();
    for (const kind of KINDS) {
      const destination = kind === 'flow'
        ? await tx.flowBuff.findUnique({ where: { userId: to } })
        : await tx.spendBuff.findUnique({ where: { userId: to } });
      if (destination) {
        const placeholder = locks.created.get(`${kind}:${to}`);
        const hasRestorations = await tx.manualQuotaRestoration.count({ where: { userId: to, kind } });
        const hasOrdinaryBatches = await tx.manualQuotaBatch.count({ where: { userId: to, kind } });
        if (!placeholder || !destination.remainingExtra.isZero() || hasRestorations || hasOrdinaryBatches ||
            destination.expiresAt.getTime() !== placeholder.expiresAt.getTime() ||
            destination.createdAt.getTime() !== placeholder.createdAt.getTime()) throw conflict();
        const deleteArgs = {
          where: { userId: to, remainingExtra: 0, expiresAt: placeholder.expiresAt, createdAt: placeholder.createdAt },
        };
        const removed = kind === 'flow' ? await tx.flowBuff.deleteMany(deleteArgs) : await tx.spendBuff.deleteMany(deleteArgs);
        if (removed.count !== 1) throw conflict();
      }
      // The source is locked. A concurrent target grant causes a unique-key
      // failure here, rolling back the entire account migration.
      const renameArgs = { where: { userId: from }, data: { userId: to } };
      if (kind === 'flow') await tx.flowBuff.update(renameArgs);
      else await tx.spendBuff.update(renameArgs);
      changed[`${kind}:${from}`] = 1;
    }
    const ordinary = await moveManualQuotaBatchesTx(tx, from, to, locks);
    changed[`ordinary:${from}`] = ordinary.flowBatchesTransferred + ordinary.spendBatchesTransferred;
    const moved = await moveManualQuotaRestorationsTx(tx, from, to, locks);
    changed[`restorations:${from}`] = moved.flowRestorationsTransferred + moved.spendRestorationsTransferred;
  }
  return changed;
}

/** Only currently usable quota requires benefit ownership handling. Expired
 * legacy, ordinary and restored balances never become usable through a new voucher.
 */
export async function hasManualQuotaForUnbindTx(tx: Prisma.TransactionClient, userId: string, locks: ManualQuotaLocks, now = new Date()) {
  requireLocked(locks, [userId]);
  const [flow, spend, ordinary, restored] = await Promise.all([
    tx.flowBuff.findUnique({ where: { userId } }),
    tx.spendBuff.findUnique({ where: { userId } }),
    tx.manualQuotaBatch.findFirst({ where: { userId, remainingExtra: { gt: 0 }, expiresAt: { gt: now } }, select: { id: true } }),
    tx.manualQuotaRestoration.findFirst({ where: { userId, remainingExtra: { gt: 0 }, expiresAt: { gt: now } }, select: { id: true } }),
  ]);
  return Boolean((flow && flow.expiresAt > now && flow.remainingExtra.gt(0)) || (spend && spend.expiresAt > now && spend.remainingExtra.gt(0)) || ordinary || restored);
}
