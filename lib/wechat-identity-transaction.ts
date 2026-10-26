import { AccountProvider, Prisma } from '@prisma/client';

export const WECHAT_PROVIDERS = [AccountProvider.WECHAT_WEB, AccountProvider.WECHAT_MINIPROGRAM];
export class WechatIdentityError extends Error {
  constructor(public readonly code: string) { super(code); }
}

/** Acquire before wallet locks in every login, unbind and account merge. */
export async function lockWechatIdentitiesTx(tx: Prisma.TransactionClient, input: {
  unionIds?: Array<string | null | undefined>;
  providerKeys?: Array<{ provider: AccountProvider; providerUserId: string }>;
}) {
  const keys = new Set<string>();
  for (const unionId of input.unionIds ?? []) if (unionId) keys.add(`wechat:union:${unionId}`);
  for (const key of input.providerKeys ?? []) keys.add(`wechat:provider:${key.provider}:${key.providerUserId}`);
  for (const key of [...keys].sort()) await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))`;
}

export async function lockWechatOwnersTx(tx: Prisma.TransactionClient, dlmIds: string[]) {
  const before = await tx.accountBinding.findMany({
    where: { dlmId: { in: [...new Set(dlmIds)] }, provider: { in: WECHAT_PROVIDERS } },
    select: { id: true, dlmId: true, unionId: true, provider: true, providerUserId: true },
  });
  await lockWechatIdentitiesTx(tx, { unionIds: before.map(row => row.unionId), providerKeys: before });
  return before;
}
