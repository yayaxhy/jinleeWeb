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

export async function assertSingleWechatOwnerTx(tx: Prisma.TransactionClient, unionId: string, expectedDlmId?: string) {
  const bindings = await tx.accountBinding.findMany({
    where: { provider: { in: WECHAT_PROVIDERS }, unionId }, select: { dlmId: true },
  });
  const owners = [...new Set(bindings.map(binding => binding.dlmId))];
  if (owners.length > 1 || (expectedDlmId && owners.some(owner => owner !== expectedDlmId))) {
    throw new WechatIdentityError('wechat_identity_conflict');
  }
  return owners[0] ?? null;
}

type Input = {
  provider: typeof WECHAT_PROVIDERS[number]; openId: string; unionId?: string | null;
  displayName?: string | null; avatarUrl?: string | null; profile?: Prisma.InputJsonValue;
};

/** Verified OAuth/code2Session identity resolves one owner; it never merges wallets. */
export async function ensureWechatIdentityTx(tx: Prisma.TransactionClient, input: Input, generateId: () => string) {
  const where = { provider_providerUserId: { provider: input.provider, providerUserId: input.openId } };
  const before = await tx.accountBinding.findUnique({ where, select: { unionId: true } });
  await lockWechatIdentitiesTx(tx, { unionIds: [input.unionId, before?.unionId], providerKeys: [
    { provider: input.provider, providerUserId: input.openId },
  ] });
  const existing = await tx.accountBinding.findUnique({ where });
  if (existing && existing.unionId !== before?.unionId && existing.unionId !== input.unionId) {
    throw new WechatIdentityError('wechat_identity_changed');
  }
  if (existing?.unionId && input.unionId && existing.unionId !== input.unionId) {
    throw new WechatIdentityError('wechat_identity_mismatch');
  }
  const unionId = input.unionId || existing?.unionId || null;
  // Existing mini-program logins can use their original owner when unionid is omitted.
  // New registrations require the stable cross-app identity.
  if (!existing && !unionId) throw new WechatIdentityError('wechat_unionid_required');
  const unionOwner = unionId ? await assertSingleWechatOwnerTx(tx, unionId, existing?.dlmId) : null;
  const dlmId = existing?.dlmId ?? unionOwner;
  if (dlmId) {
    const locked = await tx.$queryRaw<Array<{ dlmId: string }>>`
      SELECT "dlmId" FROM "DlmUser" WHERE "dlmId" = ${dlmId} FOR UPDATE
    `;
    if (!locked.length) throw new WechatIdentityError('wechat_identity_changed');
    const current = await tx.accountBinding.findUnique({ where });
    if ((existing?.id ?? null) !== (current?.id ?? null) || (existing && current?.dlmId !== dlmId)) {
      throw new WechatIdentityError('wechat_identity_changed');
    }
    if (unionId) await assertSingleWechatOwnerTx(tx, unionId, dlmId);
  }
  const profilePatch = {
    ...(input.displayName !== undefined ? { wechatDisplayName: input.displayName } : {}),
    ...(input.avatarUrl !== undefined ? { wechatAvatarUrl: input.avatarUrl } : {}),
  };
  const dlmUser = dlmId ? await tx.dlmUser.update({ where: { dlmId }, data: profilePatch, include: { member: true } })
    : await tx.dlmUser.create({ data: { dlmId: generateId(), ...profilePatch }, include: { member: true } });
  const binding = existing ? await tx.accountBinding.update({ where: { id: existing.id }, data: {
    ...(unionId ? { unionId } : {}), lastLoginAt: new Date(),
    ...(input.profile !== undefined ? { profile: input.profile } : {}),
  } }) : await tx.accountBinding.create({ data: {
    dlmId: dlmUser.dlmId, provider: input.provider, providerUserId: input.openId,
    unionId, lastLoginAt: new Date(), ...(input.profile !== undefined ? { profile: input.profile } : {}),
  } });
  return { dlmUser, bindingId: binding.id };
}
