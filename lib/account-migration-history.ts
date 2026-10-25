import type { Prisma } from '@prisma/client';
/** History access follows current ownership; actor access is only for admins in
 * the route. An old Discord login cannot gain history just by reusing an ID. */
export async function accountMigrationHistoryOwners(tx: Prisma.TransactionClient, dlmId: string) {
  const aliases = await tx.accountOwnership.findMany({ where: { currentDlmId: dlmId, identityKind: 'DLM' }, select: { originalDlmId: true } });
  return [...new Set([dlmId, ...aliases.map(row => row.originalDlmId)])];
}
export const PRIVATE_MIGRATION_ARCHIVE_MODELS = ['AccountBinding', 'WechatProgramSession', 'AuthLoginEvent', 'WebPushSubscription'];
