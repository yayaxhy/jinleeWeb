import type { PrismaClient } from '@prisma/client';
import { isDiscordSnowflake } from './discord-id';
import { resolveVoucherTargetIdentity, VoucherRequestIdentityError, type VoucherRequestIdentity } from './voucher-request-identity';

export const GIFT_RESULT_UNCONFIRMED = '打赏结果未确认，请按原编号核实余额、礼物和操作记录。新赠礼独立执行，不代表原笔失败。';

type LookupClient = Pick<PrismaClient, 'member' | 'pEIWAN' | 'dlmUser'>;
export class GiftRequestIdentityError extends Error {
  constructor() {
    super('赠礼账户绑定状态已变化，请刷新后重新确认付款方和收礼方。');
    this.name = 'GiftRequestIdentityError';
  }
}
export async function resolveGiftTargetIdentity(client: LookupClient, target: string, requirePeiwan = false) {
  try {
    return await resolveVoucherTargetIdentity(client, target, requirePeiwan);
  } catch (error) {
    if (error instanceof VoucherRequestIdentityError) throw new GiftRequestIdentityError();
    throw error;
  }
}
export function buildGiftIdentityPayload(giver: { dlmId: string; discordUserId: string | null }, receiver: VoucherRequestIdentity, allowUnboundGiver = false) {
  if (!giver.dlmId || giver.dlmId.trim() !== giver.dlmId ||
      (giver.discordUserId === null ? !allowUnboundGiver : !isDiscordSnowflake(giver.discordUserId)) ||
      !receiver.dlmId || !isDiscordSnowflake(receiver.discordUserId)) throw new GiftRequestIdentityError();
  return {
    giverId: giver.discordUserId, giverDlmId: giver.dlmId,
    receiverId: receiver.discordUserId, receiverDlmId: receiver.dlmId,
    ...(receiver.peiwanId != null ? { receiverPeiwanId: receiver.peiwanId } : {}),
  };
}
export async function resolveDelegatedGiftIdentity(client: LookupClient, dlmId: string, peiwanReference: string) {
  const giver = await client.dlmUser.findUnique({ where: { dlmId }, select: { dlmId: true, discordUserId: true } });
  if (!giver) throw new GiftRequestIdentityError();
  const receiver = await resolveGiftTargetIdentity(client, peiwanReference, true);
  if (!receiver) throw new GiftRequestIdentityError();
  return { ...buildGiftIdentityPayload(giver, receiver, true), peiwanId: String(receiver.peiwanId) };
}
