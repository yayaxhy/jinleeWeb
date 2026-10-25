import type { Prisma } from '@prisma/client';

/** Synchronize a Discord profile and wallet without carrying a pre-lock snapshot. */
export async function syncDiscordCurrentUserTx(
  tx: Prisma.TransactionClient,
  session: { dlmId?: string | null; discordId: string; username: string; avatarUrl: string | null },
  createDlmId: () => string,
) {
  // An old Discord-only session may not have a DLM identity yet. Establish the
  // identity inside this transaction without copying any unlocked wallet data.
  const identity = session.dlmId ? { dlmId: session.dlmId } : await tx.dlmUser.upsert({
    where: { discordUserId: session.discordId },
    update: {},
    create: {
      dlmId: createDlmId(),
      discordUserId: session.discordId,
      discordDisplayName: session.username,
      discordAvatarUrl: session.avatarUrl,
    },
    select: { dlmId: true },
  });

  // Keep the same lock order as withdrawal and wallet updates in both repos.
  const [lockedUser] = await tx.$queryRaw<Array<{ dlmId: string; discordUserId: string | null }>>`
    SELECT "dlmId", "discordUserId" FROM "DlmUser" WHERE "dlmId" = ${identity.dlmId} FOR UPDATE
  `;
  // Session validation happens before this transaction. A concurrent unbind or
  // ownership change must not be undone when this request finally gets the lock.
  if (!lockedUser || lockedUser.discordUserId !== session.discordId) return null;
  const lockedMembers = await tx.$queryRaw<Array<{ discordUserId: string }>>`
    SELECT "discordUserId" FROM "Member" WHERE "discordUserId" = ${session.discordId} FOR UPDATE
  `;
  // A missing Member has no row lock. Do not reread a Member concurrently
  // created after that query and copy a snapshot we have never locked.
  const member = lockedMembers.length ? await tx.member.findUnique({
    where: { discordUserId: session.discordId },
    select: {
      serverDisplayName: true,
      totalBalance: true,
      income: true,
      recharge: true,
      totalSpent: true,
    },
  }) : null;

  return tx.dlmUser.update({
    where: { dlmId: identity.dlmId },
    data: {
      discordUserId: session.discordId,
      discordDisplayName: member?.serverDisplayName ?? session.username,
      discordAvatarUrl: session.avatarUrl,
      ...(member ? {
        totalBalance: member.totalBalance,
        income: member.income,
        recharge: member.recharge,
        totalSpent: member.totalSpent,
      } : {}),
    },
    include: { member: true },
  });
}
