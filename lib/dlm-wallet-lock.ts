import type { Prisma } from '@prisma/client';

export type ExpectedDlmWalletIdentity = { dlmId: string; discordUserId: string | null };

export class DlmWalletIdentityChangedError extends Error {
  constructor() {
    super('dlm_wallet_identity_changed');
    this.name = 'DlmWalletIdentityChangedError';
  }
}

/** Caller owns the transaction and must pass every participant before touching
 * any wallet or business row. This helper never creates identities or repairs
 * balances. A missing/changed identity aborts the whole caller transaction.
 */
export async function lockDlmWalletsTx(
  tx: Prisma.TransactionClient,
  expectedIdentities: readonly ExpectedDlmWalletIdentity[],
): Promise<Map<string, ExpectedDlmWalletIdentity>> {
  const expected = new Map<string, ExpectedDlmWalletIdentity>();
  const discordOwners = new Map<string, string>();
  for (const identity of expectedIdentities) {
    if (!identity.dlmId || identity.dlmId.trim() !== identity.dlmId ||
        (identity.discordUserId !== null && (!identity.discordUserId || identity.discordUserId.trim() !== identity.discordUserId))) {
      throw new DlmWalletIdentityChangedError();
    }
    const prior = expected.get(identity.dlmId);
    if (prior && prior.discordUserId !== identity.discordUserId) throw new DlmWalletIdentityChangedError();
    if (identity.discordUserId) {
      const owner = discordOwners.get(identity.discordUserId);
      if (owner && owner !== identity.dlmId) throw new DlmWalletIdentityChangedError();
      discordOwners.set(identity.discordUserId, identity.dlmId);
    }
    expected.set(identity.dlmId, { ...identity });
  }
  const ordered = [...expected.keys()].sort();
  for (const dlmId of ordered) {
    const [locked] = await tx.$queryRaw<ExpectedDlmWalletIdentity[]>`
      SELECT "dlmId", "discordUserId" FROM "DlmUser" WHERE "dlmId" = ${dlmId} FOR UPDATE
    `;
    if (!locked || locked.discordUserId !== expected.get(dlmId)!.discordUserId) throw new DlmWalletIdentityChangedError();
  }
  for (const discordUserId of [...discordOwners.keys()].sort()) {
    const [locked] = await tx.$queryRaw<Array<{ discordUserId: string }>>`
      SELECT "discordUserId" FROM "Member" WHERE "discordUserId" = ${discordUserId} FOR UPDATE
    `;
    if (!locked || locked.discordUserId !== discordUserId) throw new DlmWalletIdentityChangedError();
  }
  const result = new Map<string, ExpectedDlmWalletIdentity>();
  for (const dlmId of ordered) {
    const current = await tx.dlmUser.findUnique({ where: { dlmId }, select: { dlmId: true, discordUserId: true } });
    if (!current || current.discordUserId !== expected.get(dlmId)!.discordUserId) throw new DlmWalletIdentityChangedError();
    result.set(dlmId, current);
  }
  return result;
}
