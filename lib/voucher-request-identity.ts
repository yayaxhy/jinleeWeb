import type { PrismaClient } from '@prisma/client';
import { isDiscordSnowflake } from './discord-id';

type LookupClient = Pick<PrismaClient, 'member' | 'pEIWAN' | 'dlmUser'>;
export type VoucherRequestIdentity = { dlmId: string; discordUserId: string; peiwanId?: number };
export class VoucherRequestIdentityError extends Error {
  constructor() {
    super('账号绑定状态已变化，请刷新后重新确认用券对象。');
    this.name = 'VoucherRequestIdentityError';
  }
}

/** Resolve the user-entered target once. These fixed DLM/Discord assertions
 * travel together to Bot, which checks them again under transaction locks.
 */
export async function resolveVoucherTargetIdentity(client: LookupClient, raw: string, requirePeiwan = false): Promise<VoucherRequestIdentity | null> {
  const target = raw.trim();
  if (!target) return null;
  const member = await client.member.findUnique({ where: { discordUserId: target }, select: { discordUserId: true } });
  let discordUserId = member?.discordUserId ?? null;
  let peiwanId: number | undefined;
  if (!discordUserId) {
    const numeric = Number(target);
    if (!Number.isSafeInteger(numeric) || numeric <= 0) return null;
    const peiwan = await client.pEIWAN.findUnique({ where: { PEIWANID: numeric }, select: { discordUserId: true, PEIWANID: true } });
    if (!peiwan?.discordUserId) return null;
    discordUserId = peiwan.discordUserId; peiwanId = peiwan.PEIWANID;
  }
  if (!isDiscordSnowflake(discordUserId)) return null;
  if (requirePeiwan && peiwanId == null) {
    const peiwan = await client.pEIWAN.findUnique({ where: { discordUserId }, select: { discordUserId: true, PEIWANID: true } });
    if (!peiwan || peiwan.discordUserId !== discordUserId) return null;
    peiwanId = peiwan.PEIWANID;
  }
  const identity = await client.dlmUser.findUnique({ where: { discordUserId }, select: { dlmId: true, discordUserId: true } });
  if (!identity || identity.discordUserId !== discordUserId) throw new VoucherRequestIdentityError();
  return { dlmId: identity.dlmId, discordUserId, ...(peiwanId != null ? { peiwanId } : {}) };
}

export function buildVoucherIdentityPayload(owner: { dlmId: string; discordUserId: string | null }, target?: VoucherRequestIdentity) {
  if (!owner.dlmId || !owner.discordUserId || !isDiscordSnowflake(owner.discordUserId)) throw new VoucherRequestIdentityError();
  return {
    userId: owner.discordUserId, userDlmId: owner.dlmId,
    ...(target ? { targetDiscordId: target.discordUserId, targetDlmId: target.dlmId, ...(target.peiwanId != null ? { peiwanId: target.peiwanId } : {}) } : {}),
  };
}
