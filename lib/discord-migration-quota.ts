import { AccountProvider, Prisma } from '@prisma/client';
import { lockManualQuotaOwnersTx } from './manual-quota-transfer';

/** The rename route may include a legacy Member without a DLM identity. Lock
 * all actual DLM rows first, then both Member keys, before quota anchors.
 */
export async function prepareDiscordQuotaMigrationTx(tx: Prisma.TransactionClient, input: {
  oldId: string; newId: string; archiveId: string | null;
  sourceDlmId: string | null; targetDlmIds: readonly string[];
}) {
  const fail = () => new Error('账号绑定或增益归属已变化，请刷新并核实后再迁移。');
  const expected = new Map<string, string>();
  if (input.sourceDlmId) expected.set(input.sourceDlmId, input.oldId);
  for (const dlmId of input.targetDlmIds) {
    if (expected.has(dlmId) && expected.get(dlmId) !== input.newId) throw fail();
    expected.set(dlmId, input.newId);
  }
  if (input.targetDlmIds.length > 1) throw fail();
  for (const dlmId of [...expected.keys()].sort()) {
    const [row] = await tx.$queryRaw<Array<{ dlmId: string; discordUserId: string | null }>>`
      SELECT "dlmId", "discordUserId" FROM "DlmUser" WHERE "dlmId" = ${dlmId} FOR UPDATE
    `;
    if (!row || row.discordUserId !== expected.get(dlmId)) throw fail();
  }
  for (const discordId of [input.oldId, input.newId].sort()) {
    const [row] = await tx.$queryRaw<Array<{ discordUserId: string }>>`
      SELECT "discordUserId" FROM "Member" WHERE "discordUserId" = ${discordId} FOR UPDATE
    `;
    if (!row && (discordId === input.oldId || [...expected.values()].includes(discordId))) throw fail();
  }
  const [identities, bindings] = await Promise.all([
    tx.dlmUser.findMany({ where: { discordUserId: { in: [input.oldId, input.newId] } }, select: { dlmId: true, discordUserId: true } }),
    tx.accountBinding.findMany({ where: { provider: AccountProvider.DISCORD, providerUserId: { in: [input.oldId, input.newId] } }, select: { dlmId: true, providerUserId: true } }),
  ]);
  if (identities.length !== expected.size || identities.some((row) => expected.get(row.dlmId) !== row.discordUserId) ||
      bindings.some((row) => expected.get(row.dlmId) !== row.providerUserId)) throw fail();
  if (input.archiveId) {
    const [flow, spend, ordinary, restored] = await Promise.all([
      tx.flowBuff.findUnique({ where: { userId: input.archiveId } }),
      tx.spendBuff.findUnique({ where: { userId: input.archiveId } }),
      tx.manualQuotaBatch.findFirst({ where: { userId: input.archiveId }, select: { id: true } }),
      tx.manualQuotaRestoration.findFirst({ where: { userId: input.archiveId }, select: { id: true } }),
    ]);
    if (flow || spend || ordinary || restored) throw fail();
  }
  return lockManualQuotaOwnersTx(tx, [input.oldId, input.newId, ...(input.archiveId ? [input.archiveId] : [])]);
}
