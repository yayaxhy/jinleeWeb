import { AccountProvider } from '@prisma/client';
import { detachDiscordAccount } from './discord-detach';
import { DiscordDetachError } from './discord-detach-transaction';
import { ChannelBindingError } from './discord-binding-transaction';
import { prisma } from '@/lib/prisma';
import {
  unbindDlmUserChannelTx,
} from './discord-binding-transaction';

export { ChannelBindingError, isDiscordBindingError } from './discord-binding-transaction';
export type { DlmUserBindingSnapshot } from './discord-binding-transaction';

export async function unbindDlmUserChannel(params: Parameters<typeof unbindDlmUserChannelTx>[1]) {
  if (params.provider === AccountProvider.DISCORD) {
    if (params.expectedSessionVersion === undefined) throw new ChannelBindingError('binding_state_changed');
    try { return await detachDiscordAccount({ dlmId: params.dlmId, expectedSessionVersion: params.expectedSessionVersion }); }
    catch (error) { if (error instanceof DiscordDetachError) throw new ChannelBindingError(error.code); throw error; }
  }
  return prisma.$transaction((tx) => unbindDlmUserChannelTx(tx, params));
}
