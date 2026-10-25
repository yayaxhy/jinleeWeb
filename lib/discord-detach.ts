import { Prisma } from '@prisma/client';
import { prisma } from './prisma';
import { fetchAccountMigrationRoleSnapshot } from './account-migration-preflight';
import { detachDiscordAccountTx, DiscordDetachError } from './discord-detach-transaction';

export async function detachDiscordAccount(input: { dlmId: string; expectedSessionVersion: number }) {
  const user = await prisma.dlmUser.findUnique({ where: { dlmId: input.dlmId }, select: { discordUserId: true, sessionVersion: true } });
  if (!user?.discordUserId) throw new DiscordDetachError('channel_not_bound');
  if (user.sessionVersion !== input.expectedSessionVersion) throw new DiscordDetachError('binding_state_changed');
  const oldId = user.discordUserId;
  const roles = await fetchAccountMigrationRoleSnapshot(oldId, null);
  const rolePlan: Prisma.InputJsonValue = {
    version: 1, source: { dlmId: input.dlmId, discordId: oldId },
    target: { dlmId: input.dlmId, discordId: null }, ...roles, targetRoleIds: [],
  };
  return prisma.$transaction(tx => detachDiscordAccountTx(tx, { ...input, rolePlan }), { isolationLevel: 'Serializable', timeout: 30_000 });
}
