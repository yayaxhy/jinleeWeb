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
