import type { Prisma } from '@prisma/client';

type OwnershipDb = Pick<Prisma.TransactionClient, 'accountOwnership' | 'dlmUser'>;

/** Search original receipts through current ownership; receipt identities and
 * amounts remain unchanged. Discord-only legacy rows stop at retirement. */
async function identityFilters(db: OwnershipDb, inputs: Array<[string, string, string | undefined]>) {
  const filters: Array<Record<string, unknown>> = [];
  for (const [rawField, dlmField, identifier] of inputs) {
    if (!identifier) continue;
    const conditions: Array<Record<string, unknown>> = [{ [rawField]: identifier }, { [dlmField]: identifier }];
    const current = await db.dlmUser.findFirst({ where: { OR: [{ dlmId: identifier }, { discordUserId: identifier }] }, select: { dlmId: true } });
    if (current) {
      const owners = await db.accountOwnership.findMany({ where: { identityKind: 'DLM', currentDlmId: current.dlmId }, select: { originalDlmId: true } });
      conditions.push({ [dlmField]: { in: [...new Set([current.dlmId, ...owners.map(row => row.originalDlmId)])] } });
      const aliases = await db.accountOwnership.findMany({ where: { identityKind: 'DISCORD', currentDlmId: current.dlmId },
        select: { identityKey: true, originalDlmId: true, retiredAt: true } });
      for (const alias of aliases) {
        const generations = await db.accountOwnership.findMany({ where: { identityKind: 'DISCORD', identityKey: alias.identityKey },
          select: { originalDlmId: true, retiredAt: true }, orderBy: { retiredAt: 'asc' } });
        if (generations.some(row => row.retiredAt.getTime() === alias.retiredAt.getTime() && row.originalDlmId !== alias.originalDlmId)) continue;
        const earlier = generations.filter(row => row.retiredAt < alias.retiredAt).at(-1)?.retiredAt;
        conditions.push({ [dlmField]: null, [rawField]: alias.identityKey, createdAt: { lte: alias.retiredAt, ...(earlier ? { gt: earlier } : {}) } });
      }
    }
    filters.push({ OR: conditions });
  }
  return filters.length ? { AND: filters } : {};
}

export async function giftAuditIdentityFilter(db: OwnershipDb, input: { giverId?: string; receiverId?: string }): Promise<Prisma.GiftAuditWhereInput> {
  return identityFilters(db, [['giverId', 'giverDlmId', input.giverId], ['receiverId', 'receiverDlmId', input.receiverId]]);
}
export async function orderAuditIdentityFilter(db: OwnershipDb, input: { hostId?: string; workerId?: string }): Promise<Prisma.OrderAuditWhereInput> {
  return identityFilters(db, [['hostId', 'hostDlmId', input.hostId], ['workerId', 'workerDlmId', input.workerId]]);
}
