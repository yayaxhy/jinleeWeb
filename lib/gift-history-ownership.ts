import type { Prisma } from '@prisma/client';
type OwnershipDb = Pick<Prisma.TransactionClient, 'accountOwnership'>;

/** Read permission only. Never use this to authorize an old financial POST. */
export async function giftHistoryDlmMatches(db: OwnershipDb, original: string | null, current: string | null) {
  if (!original || !current) return false;
  if (original === current) return true;
  const rows = await db.accountOwnership.findMany({ where: { identityKind: 'DLM', identityKey: original, originalDlmId: original },
    select: { currentDlmId: true }, take: 2 });
  return rows.length === 1 && rows[0].currentDlmId === current;
}
export async function giftHistoryActorMatches(db: OwnershipDb,
  original: { dlmId: string | null; discordId: string | null }, current: { dlmId: string | null; discordId: string | null }) {
  if (!await giftHistoryDlmMatches(db, original.dlmId, current.dlmId)) return false;
  if (original.discordId === current.discordId || original.discordId === null) return true;
  const rows = await db.accountOwnership.findMany({ where: { identityKind: 'DISCORD', identityKey: original.discordId, originalDlmId: original.dlmId! },
    select: { currentDlmId: true }, take: 2 });
  return rows.length === 1 && rows[0].currentDlmId === current.dlmId;
}
/** Payment member foreign keys move with their wallets, while audit and
 * individual-ledger identity snapshots stay original. Verify both current FKs. */
export async function giftHistoryPaymentOwnerMatches(db: OwnershipDb & Pick<Prisma.TransactionClient, 'dlmUser' | 'detachedDiscordAccount'>,
  original: { dlmId: string | null; discordId: string | null }, current: { dlmId: string | null; memberKey: string | null }) {
  if (!await giftHistoryDlmMatches(db, original.dlmId, current.dlmId)) return false;
  const owner = await db.dlmUser.findUnique({ where: { dlmId: current.dlmId! }, select: { discordUserId: true } });
  if (!owner) return false;
  const memberKey = owner.discordUserId ?? (await db.detachedDiscordAccount.findUnique({
    where: { ownerDlmId: current.dlmId! }, select: { memberKey: true },
  }))?.memberKey ?? null;
  return memberKey === current.memberKey || (original.discordId === null && current.memberKey === null);
}
export async function giftHistoryOriginalOwners(db: OwnershipDb, currentDlmId: string) {
  const rows = await db.accountOwnership.findMany({ where: { identityKind: 'DLM', currentDlmId: currentDlmId }, select: { originalDlmId: true } });
  return [...new Set([currentDlmId, ...rows.map(row => row.originalDlmId)])];
}

/** Admin search keeps immutable audit IDs, but expands a current account to its
 * approved history. Legacy Discord-only facts are bounded by retirement time. */
export async function giftAuditIdentityFilter(db: OwnershipDb & Pick<Prisma.TransactionClient, 'dlmUser'>,
  input: { giverId?: string; receiverId?: string }): Promise<Prisma.GiftAuditWhereInput> {
  const filters: Prisma.GiftAuditWhereInput[] = [];
  for (const [side, identifier] of [['giver', input.giverId], ['receiver', input.receiverId]] as const) {
    if (!identifier) continue;
    const rawField = side === 'giver' ? 'giverId' : 'receiverId', dlmField = side === 'giver' ? 'giverDlmId' : 'receiverDlmId';
    const conditions: Prisma.GiftAuditWhereInput[] = [{ [rawField]: identifier }, { [dlmField]: identifier }];
    const current = await db.dlmUser.findFirst({ where: { OR: [{ dlmId: identifier }, { discordUserId: identifier }] }, select: { dlmId: true } });
    if (current) {
      conditions.push({ [dlmField]: { in: await giftHistoryOriginalOwners(db, current.dlmId) } });
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
