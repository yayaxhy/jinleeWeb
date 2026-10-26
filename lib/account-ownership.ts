import type { Prisma } from '@prisma/client';

type OwnershipDb = Pick<Prisma.TransactionClient, 'dlmUser' | 'accountOwnership' | 'detachedDiscordAccount'>;
export type CurrentAccountOwner = { dlmId: string; discordId: string | null; memberKey: string | null };
export class AccountOwnershipError extends Error {
  constructor() { super('account_ownership_requires_review'); this.name = 'AccountOwnershipError'; }
}

/** Original DLM identifiers are never replaced with a lookup by a recycled
 * Discord ID. Reads only: a missing account cannot create a wallet here. */
export async function resolveAccountOwnerTx(db: OwnershipDb, originalDlmId: string): Promise<CurrentAccountOwner> {
  const seen = new Set<string>();
  let dlmId = originalDlmId;
  for (let step = 0; step < 32; step++) {
    if (!dlmId || seen.has(dlmId)) throw new AccountOwnershipError();
    seen.add(dlmId);
    const current = await db.dlmUser.findUnique({ where: { dlmId }, select: { dlmId: true, discordUserId: true } });
    if (current) {
      const detached = current.discordUserId ? null : await db.detachedDiscordAccount.findUnique({
        where: { ownerDlmId: current.dlmId }, select: { memberKey: true },
      });
      return { dlmId: current.dlmId, discordId: current.discordUserId, memberKey: current.discordUserId ?? detached?.memberKey ?? null };
    }
    const aliases = await db.accountOwnership.findMany({
      where: { identityKind: 'DLM', identityKey: dlmId, originalDlmId: dlmId },
      select: { currentDlmId: true }, take: 2,
    });
    if (aliases.length !== 1) throw new AccountOwnershipError();
    dlmId = aliases[0]!.currentDlmId;
  }
  throw new AccountOwnershipError();
}
