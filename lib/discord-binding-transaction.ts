import { lockWechatOwnersTx } from './wechat-identity-transaction';
import { AccountProvider, DispatchRequestStatus, DlmAdminOperationStatus, MemberStatus, MiniConversationType, OrderStatus, PointShopCartStatus, Prisma } from '@prisma/client';
import { hasManualQuotaForUnbindTx, lockManualQuotaOwnersTx } from './manual-quota-transfer';

const DEC = (value: Prisma.Decimal | number | string | null | undefined) =>
  value instanceof Prisma.Decimal ? value : new Prisma.Decimal(value ?? 0);

export class ChannelBindingError extends Error {
  code: string;

  constructor(code: string) {
    super(code);
    this.code = code;
  }
}

const dlmUserWithMemberAndBindings = {
  member: true,
  accountBindings: true,
} satisfies Prisma.DlmUserInclude;

export type DlmUserBindingSnapshot = Prisma.DlmUserGetPayload<{
  include: typeof dlmUserWithMemberAndBindings;
}>;

/** Lock identities before reading any wallets; transactions retain locks until commit. */
async function lockBindingUsersTx(tx: Prisma.TransactionClient, dlmIds: string[]) {
  await lockWechatOwnersTx(tx, dlmIds);
  const before = await tx.dlmUser.findMany({ where: { dlmId: { in: dlmIds } }, select: { discordUserId: true } });
  for (const id of [...new Set(before.flatMap(user => user.discordUserId ? [user.discordUserId] : []))].sort()) {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${'discord-identity:' + id}, 0))`;
  }
  const identities = new Map<string, { dlmId: string; discordUserId: string | null }>();
  for (const dlmId of [...new Set(dlmIds)].sort()) {
    const [identity] = await tx.$queryRaw<Array<{ dlmId: string; discordUserId: string | null }>>`
      SELECT "dlmId", "discordUserId" FROM "DlmUser" WHERE "dlmId" = ${dlmId} FOR UPDATE
    `;
    if (identity) identities.set(dlmId, identity);
  }

  const lockedMembers = new Set<string>();
  const discordIds = [...new Set([...identities.values()].flatMap((user) => user.discordUserId ? [user.discordUserId] : []))].sort();
  for (const discordUserId of discordIds) {
    const [member] = await tx.$queryRaw<Array<{ discordUserId: string }>>`
      SELECT "discordUserId" FROM "Member" WHERE "discordUserId" = ${discordUserId} FOR UPDATE
    `;
    if (member) lockedMembers.add(discordUserId);
  }

  const snapshots = new Map<string, DlmUserBindingSnapshot>();
  for (const identity of identities.values()) {
    const user = await tx.dlmUser.findUnique({
      where: { dlmId: identity.dlmId },
      include: dlmUserWithMemberAndBindings,
    });
    // A missing row has no lock. Never consume a concurrently-created Member
    // or a changed identity as though its wallet had been protected above.
    if (!user || user.discordUserId !== identity.discordUserId ||
        (user.member && !lockedMembers.has(user.member.discordUserId))) {
      throw new ChannelBindingError('binding_state_changed');
    }
    snapshots.set(user.dlmId, user);
  }
  return snapshots;
}

const mergeWalletField = (
  primary: Prisma.Decimal | number | string | null | undefined,
  incoming: Prisma.Decimal | number | string | null | undefined,
) => DEC(primary).add(DEC(incoming));

const pickPreferred = (current?: string | null, fallback?: string | null) => {
  if (current && current.trim()) return current;
  if (fallback && fallback.trim()) return fallback;
  return null;
};

/** Preserve records that would otherwise be deleted or detached with the incoming identity. */
async function migrateAdditionalDlmRelationsTx(
  tx: Prisma.TransactionClient,
  canonicalDlmId: string,
  incomingDlmId: string,
) {
  const ids = [canonicalDlmId, incomingDlmId];
  const [claims, manualBosses, pendingOperation, pointShopOrders, legacyPoints, legacyAccounts] = await Promise.all([
    tx.openingBenefitClaim.findMany({ where: { dlmId: { in: ids } }, select: { dlmId: true, benefit: true, periodKey: true } }),
    tx.manualWechatBoss.findMany({ where: { dlmId: { in: ids } }, select: { dlmId: true } }),
    tx.dlmAdminOperation.findFirst({ where: { dlmId: { in: ids }, status: DlmAdminOperationStatus.PENDING }, select: { id: true } }),
    tx.pointShopOrder.findMany({ where: { dlmId: { in: ids } }, select: { dlmId: true, requestKey: true } }),
    tx.loyaltyPoint.findUnique({ where: { dlmId: incomingDlmId }, select: { discordUserId: true } }),
    tx.withdrawalAccount.findUnique({ where: { dlmId: incomingDlmId }, select: { discordUserId: true } }),
  ]);
  if (pendingOperation) throw new ChannelBindingError('account_merge_pending_operation');
  if (manualBosses.length > 1) throw new ChannelBindingError('account_merge_manual_boss_conflict');
  // The incoming account has no Discord binding. A remaining Member-owned
  // mirror belongs to an earlier identity and needs explicit ownership review.
  if (legacyPoints || legacyAccounts) throw new ChannelBindingError('account_merge_legacy_mirror_conflict');
  const canonicalClaims = new Set(claims.filter((claim) => claim.dlmId === canonicalDlmId)
    .map((claim) => JSON.stringify([claim.benefit, claim.periodKey])));
  if (claims.some((claim) => claim.dlmId === incomingDlmId && canonicalClaims.has(JSON.stringify([claim.benefit, claim.periodKey])))) {
    // Both claim IDs, coupon IDs and timestamps are evidence; never drop one
    // just to satisfy the per-account claim uniqueness constraint.
    throw new ChannelBindingError('account_merge_claim_conflict');
  }
  const canonicalRequestKeys = new Set(pointShopOrders.filter((order) => order.dlmId === canonicalDlmId).map((order) => order.requestKey));
  if (pointShopOrders.some((order) => order.dlmId === incomingDlmId && canonicalRequestKeys.has(order.requestKey))) {
    throw new ChannelBindingError('account_merge_point_shop_conflict');
  }

  // Existing chat reads update these rows without locking the DLM account.
  // Lock each affected conversation before reading its participants and cursors.
  await tx.$queryRaw`
    SELECT "id" FROM "MiniConversation"
    WHERE "userAId" = ${incomingDlmId} OR "userBId" = ${incomingDlmId}
    ORDER BY "id" FOR UPDATE
  `;
  const conversations = await tx.miniConversation.findMany({
    where: { OR: [{ userAId: incomingDlmId }, { userBId: incomingDlmId }] },
    orderBy: { id: 'asc' },
  });
  const plannedKeys = new Set<string>();
  for (const conversation of conversations) {
    const userAId = conversation.userAId === incomingDlmId ? canonicalDlmId : conversation.userAId;
    const userBId = conversation.userBId === incomingDlmId ? canonicalDlmId : conversation.userBId;
    let peerKey: string;
    if (conversation.type === MiniConversationType.DIRECT && userAId && userBId && userAId !== userBId) {
      peerKey = [userAId, userBId].sort().join(':');
    } else if ((conversation.type === MiniConversationType.SYSTEM || conversation.type === MiniConversationType.SUPPORT) && userAId === canonicalDlmId && !userBId) {
      peerKey = `${conversation.type === MiniConversationType.SYSTEM ? 'system' : 'support'}:${canonicalDlmId}`;
    } else {
      // A self-chat, missing peer, or unexpected ownership layout cannot be
      // rewritten without changing access/unread semantics.
      throw new ChannelBindingError('account_merge_conversation_conflict');
    }
    const key = JSON.stringify([conversation.type, peerKey]);
    const existing = await tx.miniConversation.findUnique({ where: { type_peerKey: { type: conversation.type, peerKey } }, select: { id: true } });
    if (plannedKeys.has(key) || (existing && existing.id !== conversation.id)) {
      // Keep both conversation IDs and messages intact: notification links and
      // moderation history refer to IDs, so deleting/coalescing loses evidence.
      throw new ChannelBindingError('account_merge_conversation_conflict');
    }
    plannedKeys.add(key);
    await tx.miniConversation.update({
      where: { id: conversation.id },
      // A/B slot positions are meaningful to concurrent read markers. Preserve
      // both slots and their cursors; only peerKey requires lexicographic order.
      data: { userAId, userBId, peerKey },
    });
  }

  await Promise.all([
    tx.openingBenefitClaim.updateMany({ where: { dlmId: incomingDlmId }, data: { dlmId: canonicalDlmId } }),
    tx.manualWechatBoss.updateMany({ where: { dlmId: incomingDlmId }, data: { dlmId: canonicalDlmId } }),
    tx.dlmAdminOperation.updateMany({ where: { dlmId: incomingDlmId }, data: { dlmId: canonicalDlmId } }),
    tx.guildNotification.updateMany({ where: { dlmId: incomingDlmId }, data: { dlmId: canonicalDlmId } }),
    tx.webPushSubscription.updateMany({ where: { dlmId: incomingDlmId }, data: { dlmId: canonicalDlmId } }),
    tx.authLoginEvent.updateMany({ where: { dlmId: incomingDlmId }, data: { dlmId: canonicalDlmId } }),
    tx.dispatchRequest.updateMany({ where: { ownerDlmId: incomingDlmId }, data: { ownerDlmId: canonicalDlmId } }),
    tx.dispatchCandidate.updateMany({ where: { workerDlmId: incomingDlmId }, data: { workerDlmId: canonicalDlmId } }),
    tx.miniMessage.updateMany({ where: { senderDlmId: incomingDlmId }, data: { senderDlmId: canonicalDlmId } }),
  ]);
}

async function assertIncomingRelationsMigratedTx(tx: Prisma.TransactionClient, incomingDlmId: string) {
  const remaining = await tx.dlmUser.findUniqueOrThrow({
    where: { dlmId: incomingDlmId },
    include: {
      _count: true,
      member: true,
      loyaltyPoint: true,
      withdrawalAccount: true,
      lotteryPity: true,
      manualWechatBoss: true,
    },
  });
  // _count includes every collection relation, including future schema additions.
  // Fail before DELETE instead of relying on Cascade/SetNull to hide omissions.
  if (Object.values(remaining._count).some((count) => count > 0) || remaining.member || remaining.loyaltyPoint ||
      remaining.withdrawalAccount || remaining.lotteryPity || remaining.manualWechatBoss) {
    throw new ChannelBindingError('account_merge_relations_remaining');
  }
}

async function mergeOpenPointShopCartsTx(
  tx: Prisma.TransactionClient,
  params: {
    canonicalDlmId: string;
    incomingDlmId: string;
    canonicalDiscordUserId?: string | null;
  },
) {
  const [canonicalOpenCart, incomingOpenCart] = await Promise.all([
    tx.pointShopCart.findFirst({
      where: {
        dlmId: params.canonicalDlmId,
        status: PointShopCartStatus.OPEN,
      },
      orderBy: { updatedAt: 'desc' },
      select: { id: true },
    }),
    tx.pointShopCart.findFirst({
      where: {
        dlmId: params.incomingDlmId,
        status: PointShopCartStatus.OPEN,
      },
      orderBy: { updatedAt: 'desc' },
      select: { id: true },
    }),
  ]);

  if (!incomingOpenCart) {
    return;
  }

  if (!canonicalOpenCart) {
    await tx.pointShopCart.update({
      where: { id: incomingOpenCart.id },
      data: {
        dlmId: params.canonicalDlmId,
        discordUserId: params.canonicalDiscordUserId ?? null,
      },
    });
    return;
  }

  if (canonicalOpenCart.id === incomingOpenCart.id) {
    return;
  }

  const incomingLines = await tx.pointShopCartItem.findMany({
    where: { cartId: incomingOpenCart.id },
    select: {
      itemId: true,
      quantity: true,
      unitPoints: true,
      itemNameSnapshot: true,
    },
  });

  for (const line of incomingLines) {
    await tx.pointShopCartItem.upsert({
      where: {
        cartId_itemId: {
          cartId: canonicalOpenCart.id,
          itemId: line.itemId,
        },
      },
      create: {
        cartId: canonicalOpenCart.id,
        itemId: line.itemId,
        quantity: line.quantity,
        unitPoints: line.unitPoints,
        itemNameSnapshot: line.itemNameSnapshot,
      },
      update: {
        quantity: { increment: line.quantity },
        unitPoints: line.unitPoints,
        itemNameSnapshot: line.itemNameSnapshot,
      },
    });
  }

  await tx.pointShopCart.update({
    where: { id: canonicalOpenCart.id },
    data: {
      version: { increment: 1 },
      discordUserId: params.canonicalDiscordUserId ?? null,
    },
  });

  await tx.pointShopCartItem.deleteMany({
    where: { cartId: incomingOpenCart.id },
  });

  await tx.pointShopCart.update({
    where: { id: incomingOpenCart.id },
    data: {
      status: PointShopCartStatus.ABANDONED,
      version: { increment: 1 },
      discordUserId: params.canonicalDiscordUserId ?? null,
    },
  });
}

async function mergeLotteryPityTx(
  tx: Prisma.TransactionClient,
  params: {
    canonicalDlmId: string;
    incomingDlmId: string;
    canonicalDiscordUserId?: string | null;
  },
) {
  const [canonicalPity, incomingPity] = await Promise.all([
    tx.lotteryPity.findUnique({
      where: { dlmId: params.canonicalDlmId },
      select: { missCount: true },
    }),
    tx.lotteryPity.findUnique({
      where: { dlmId: params.incomingDlmId },
      select: { missCount: true },
    }),
  ]);

  if (!incomingPity) {
    return;
  }

  if (canonicalPity) {
    await tx.lotteryPity.update({
      where: { dlmId: params.canonicalDlmId },
      data: {
        missCount: canonicalPity.missCount + incomingPity.missCount,
        userId: params.canonicalDiscordUserId ?? undefined,
      },
    });

    await tx.lotteryPity.delete({
      where: { dlmId: params.incomingDlmId },
    });
    return;
  }

  await tx.lotteryPity.create({
    data: {
      dlmId: params.canonicalDlmId,
      userId: params.canonicalDiscordUserId ?? null,
      missCount: incomingPity.missCount,
    },
  });

  await tx.lotteryPity.delete({
    where: { dlmId: params.incomingDlmId },
  });
}

async function syncDiscordMirrorDataTx(
  tx: Prisma.TransactionClient,
  params: {
    dlmId: string;
    discordUserId: string;
    discordDisplayName?: string | null;
    discordAvatarUrl?: string | null;
    discordProfile?: Prisma.InputJsonValue;
    mergedWallet: {
      totalBalance: Prisma.Decimal;
      income: Prisma.Decimal;
      recharge: Prisma.Decimal;
      totalSpent: Prisma.Decimal;
      loyaltyPoints: Prisma.Decimal;
    };
    mergedWithdrawAccounts: {
      withdrawAccount1: string | null;
      withdrawAccount2: string | null;
      withdrawAccount3: string | null;
    };
    fallbackMemberDisplayName?: string | null;
  },
) {
  const effectiveDisplayName = params.discordDisplayName ?? params.fallbackMemberDisplayName ?? null;

  await tx.member.update({
    where: { discordUserId: params.discordUserId },
    data: {
      serverDisplayName: effectiveDisplayName,
      totalBalance: params.mergedWallet.totalBalance,
      income: params.mergedWallet.income,
      recharge: params.mergedWallet.recharge,
      totalSpent: params.mergedWallet.totalSpent,
    },
  });

  await tx.pEIWAN
    .update({
      where: { discordUserId: params.discordUserId },
      data: {
        serverDisplayName: effectiveDisplayName,
        balance: params.mergedWallet.totalBalance,
      },
    })
    .catch(() => {});

  await tx.loyaltyPoint.upsert({
    where: { discordUserId: params.discordUserId },
    create: {
      discordUserId: params.discordUserId,
      dlmId: params.dlmId,
      points: params.mergedWallet.loyaltyPoints,
    },
    update: {
      dlmId: params.dlmId,
      points: params.mergedWallet.loyaltyPoints,
    },
  });

  await tx.withdrawalAccount.upsert({
    where: { discordUserId: params.discordUserId },
    create: {
      discordUserId: params.discordUserId,
      dlmId: params.dlmId,
      account1: params.mergedWithdrawAccounts.withdrawAccount1,
      account2: params.mergedWithdrawAccounts.withdrawAccount2,
      account3: params.mergedWithdrawAccounts.withdrawAccount3,
    },
    update: {
      dlmId: params.dlmId,
      account1: params.mergedWithdrawAccounts.withdrawAccount1,
      account2: params.mergedWithdrawAccounts.withdrawAccount2,
      account3: params.mergedWithdrawAccounts.withdrawAccount3,
    },
  });

  await tx.accountBinding.upsert({
    where: {
      provider_providerUserId: {
        provider: AccountProvider.DISCORD,
        providerUserId: params.discordUserId,
      },
    },
    create: {
      dlmId: params.dlmId,
      provider: AccountProvider.DISCORD,
      providerUserId: params.discordUserId,
      lastLoginAt: new Date(),
      ...(params.discordProfile !== undefined ? { profile: params.discordProfile } : {}),
    },
    update: {
      dlmId: params.dlmId,
      lastLoginAt: new Date(),
      ...(params.discordProfile !== undefined ? { profile: params.discordProfile } : {}),
    },
  });
}

export async function mergeWechatProgramDlmUserIntoDlmUserTx(tx: Prisma.TransactionClient, params: {
  canonicalDlmId: string;
  incomingWechatDlmId: string;
  canonicalSessionVersion?: number;
  incomingSessionVersion?: number;
  discordUserId?: string | null;
  discordDisplayName?: string | null;
  discordAvatarUrl?: string | null;
  discordProfile?: Prisma.InputJsonValue;
}) {
  const lockedUsers = await lockBindingUsersTx(tx, [params.canonicalDlmId, params.incomingWechatDlmId]);
  const canonicalDlmUser = lockedUsers.get(params.canonicalDlmId);
  const incomingDlmUser = lockedUsers.get(params.incomingWechatDlmId);

  if (!canonicalDlmUser) {
    throw new ChannelBindingError('canonical_user_not_found');
  }

  if (!incomingDlmUser) {
    throw new ChannelBindingError('wechat_user_not_found');
  }

  if ((params.canonicalSessionVersion !== undefined && params.canonicalSessionVersion !== canonicalDlmUser.sessionVersion) ||
      (params.incomingSessionVersion !== undefined && params.incomingSessionVersion !== incomingDlmUser.sessionVersion)) {
    throw new ChannelBindingError('binding_state_changed');
  }

  // The Discord session was resolved before this transaction. Do not restore
  // a binding that was removed or replaced while this request waited.
  if (params.discordUserId && params.discordUserId !== canonicalDlmUser.discordUserId) {
    throw new ChannelBindingError('discord_binding_changed');
  }

  if (canonicalDlmUser.dlmId === incomingDlmUser.dlmId) {
    return canonicalDlmUser;
  }

  // Two Discord-linked ledgers cannot be merged by deleting one DLM identity:
  // its surviving Member could otherwise recreate the same wallet on login.
  if (incomingDlmUser.discordUserId || incomingDlmUser.accountBindings.some((binding) => binding.provider === AccountProvider.DISCORD)) {
    throw new ChannelBindingError('incoming_discord_already_bound');
  }

  const incomingWechatBindings = incomingDlmUser.accountBindings.filter(
    (binding) => binding.provider === AccountProvider.WECHAT_MINIPROGRAM,
  );

  if (!incomingWechatBindings.length) {
    throw new ChannelBindingError('wechat_binding_not_found');
  }

  const conflictingWechatBinding = canonicalDlmUser.accountBindings.find(
    (binding) =>
      binding.provider === AccountProvider.WECHAT_MINIPROGRAM &&
      !incomingWechatBindings.some(
        (incomingBinding) => incomingBinding.providerUserId === binding.providerUserId,
      ),
  );

  if (conflictingWechatBinding) {
    throw new ChannelBindingError('dlm_user_already_bound_to_other_wechat');
  }

  const canonicalDiscordUserId = params.discordUserId ?? canonicalDlmUser.discordUserId ?? null;
  const canonicalDiscordDisplayName =
    params.discordDisplayName ??
    canonicalDlmUser.discordDisplayName ??
    canonicalDlmUser.member?.serverDisplayName ??
    null;
  const canonicalDiscordAvatarUrl = params.discordAvatarUrl ?? canonicalDlmUser.discordAvatarUrl ?? null;

  await migrateAdditionalDlmRelationsTx(tx, canonicalDlmUser.dlmId, incomingDlmUser.dlmId);

  await mergeOpenPointShopCartsTx(tx, {
    canonicalDlmId: canonicalDlmUser.dlmId,
    incomingDlmId: incomingDlmUser.dlmId,
    canonicalDiscordUserId,
  });

  await Promise.all([
    // Merging ownership must not grant every old bearer token access to the
    // combined wallet. The caller explicitly reports that login must refresh.
    tx.wechatProgramSession.deleteMany({
      where: { dlmId: { in: [canonicalDlmUser.dlmId, incomingDlmUser.dlmId] } },
    }),
    tx.accountBinding.updateMany({
      where: {
        dlmId: incomingDlmUser.dlmId,
        provider: {
          not: AccountProvider.DISCORD,
        },
      },
      data: {
        dlmId: canonicalDlmUser.dlmId,
        lastLoginAt: new Date(),
      },
    }),
    tx.order.updateMany({
      where: { hostDlmId: incomingDlmUser.dlmId },
      data: { hostDlmId: canonicalDlmUser.dlmId },
    }),
    tx.orderAudit.updateMany({
      where: { hostDlmId: incomingDlmUser.dlmId },
      data: { hostDlmId: canonicalDlmUser.dlmId },
    }),
    tx.orderAudit.updateMany({
      where: { workerDlmId: incomingDlmUser.dlmId },
      data: { workerDlmId: canonicalDlmUser.dlmId },
    }),
    tx.zPayRechargeOrder.updateMany({
      where: { dlmId: incomingDlmUser.dlmId },
      data: { dlmId: canonicalDlmUser.dlmId },
    }),
    tx.stripePayment.updateMany({
      where: { dlmId: incomingDlmUser.dlmId },
      data: { dlmId: canonicalDlmUser.dlmId },
    }),
    tx.wechatNativePayment.updateMany({
      where: { dlmId: incomingDlmUser.dlmId },
      data: { dlmId: canonicalDlmUser.dlmId },
    }),
    tx.recharge.updateMany({
      where: { dlmId: incomingDlmUser.dlmId },
      data: { dlmId: canonicalDlmUser.dlmId },
    }),
    tx.withdraw.updateMany({
      where: { dlmId: incomingDlmUser.dlmId },
      data: { dlmId: canonicalDlmUser.dlmId },
    }),
    tx.individualTransaction.updateMany({
      where: { dlmId: incomingDlmUser.dlmId },
      data: { dlmId: canonicalDlmUser.dlmId },
    }),
    tx.coupon.updateMany({
      where: { dlmId: incomingDlmUser.dlmId },
      data: { dlmId: canonicalDlmUser.dlmId },
    }),
    tx.coupon.updateMany({
      where: { consumeTargetDlmId: incomingDlmUser.dlmId },
      data: { consumeTargetDlmId: canonicalDlmUser.dlmId },
    }),
    tx.transaction.updateMany({
      where: { fromDlmId: incomingDlmUser.dlmId },
      data: { fromDlmId: canonicalDlmUser.dlmId },
    }),
    tx.transaction.updateMany({
      where: { toDlmId: incomingDlmUser.dlmId },
      data: { toDlmId: canonicalDlmUser.dlmId },
    }),
    tx.commission.updateMany({
      where: { fromDlmId: incomingDlmUser.dlmId },
      data: { fromDlmId: canonicalDlmUser.dlmId },
    }),
    tx.commission.updateMany({
      where: { toDlmId: incomingDlmUser.dlmId },
      data: { toDlmId: canonicalDlmUser.dlmId },
    }),
    tx.lotteryDraw.updateMany({
      where: { dlmId: incomingDlmUser.dlmId },
      data: { dlmId: canonicalDlmUser.dlmId },
    }),
    tx.lotteryDraw.updateMany({
      where: { consumeTargetDlmId: incomingDlmUser.dlmId },
      data: { consumeTargetDlmId: canonicalDlmUser.dlmId },
    }),
    tx.pointShopCart.updateMany({
      where: {
        dlmId: incomingDlmUser.dlmId,
        status: {
          not: PointShopCartStatus.OPEN,
        },
      },
      data: {
        dlmId: canonicalDlmUser.dlmId,
        discordUserId: canonicalDiscordUserId,
      },
    }),
    tx.pointShopOrder.updateMany({
      where: { dlmId: incomingDlmUser.dlmId },
      data: { dlmId: canonicalDlmUser.dlmId },
    }),
    tx.pointShopGrant.updateMany({
      where: { dlmId: incomingDlmUser.dlmId },
      data: { dlmId: canonicalDlmUser.dlmId },
    }),
    tx.pointShopGrant.updateMany({
      where: { consumeTargetDlmId: incomingDlmUser.dlmId },
      data: { consumeTargetDlmId: canonicalDlmUser.dlmId },
    }),
    tx.pointShopPointLedger.updateMany({
      where: { dlmId: incomingDlmUser.dlmId },
      data: { dlmId: canonicalDlmUser.dlmId },
    }),
  ]);

  await mergeLotteryPityTx(tx, {
    canonicalDlmId: canonicalDlmUser.dlmId,
    incomingDlmId: incomingDlmUser.dlmId,
    canonicalDiscordUserId,
  });

  const canonicalWallet = {
    totalBalance: DEC(canonicalDlmUser.member?.totalBalance ?? canonicalDlmUser.totalBalance),
    income: DEC(canonicalDlmUser.member?.income ?? canonicalDlmUser.income),
    recharge: DEC(canonicalDlmUser.member?.recharge ?? canonicalDlmUser.recharge),
    totalSpent: DEC(canonicalDlmUser.member?.totalSpent ?? canonicalDlmUser.totalSpent),
    loyaltyPoints: DEC(canonicalDlmUser.loyaltyPoints),
  };

  const incomingWallet = {
    totalBalance: DEC(incomingDlmUser.totalBalance),
    income: DEC(incomingDlmUser.income),
    recharge: DEC(incomingDlmUser.recharge),
    totalSpent: DEC(incomingDlmUser.totalSpent),
    loyaltyPoints: DEC(incomingDlmUser.loyaltyPoints),
  };

  const mergedWallet = {
    totalBalance: mergeWalletField(canonicalWallet.totalBalance, incomingWallet.totalBalance),
    income: mergeWalletField(canonicalWallet.income, incomingWallet.income),
    recharge: mergeWalletField(canonicalWallet.recharge, incomingWallet.recharge),
    totalSpent: mergeWalletField(canonicalWallet.totalSpent, incomingWallet.totalSpent),
    loyaltyPoints: mergeWalletField(canonicalWallet.loyaltyPoints, incomingWallet.loyaltyPoints),
  };

  const mergedWithdrawAccounts = {
    withdrawAccount1: pickPreferred(
      canonicalDlmUser.withdrawAccount1,
      incomingDlmUser.withdrawAccount1,
    ),
    withdrawAccount2: pickPreferred(
      canonicalDlmUser.withdrawAccount2,
      incomingDlmUser.withdrawAccount2,
    ),
    withdrawAccount3: pickPreferred(
      canonicalDlmUser.withdrawAccount3,
      incomingDlmUser.withdrawAccount3,
    ),
  };

  if (canonicalDiscordUserId) {
    await syncDiscordMirrorDataTx(tx, {
      dlmId: canonicalDlmUser.dlmId,
      discordUserId: canonicalDiscordUserId,
      discordDisplayName: canonicalDiscordDisplayName,
      discordAvatarUrl: canonicalDiscordAvatarUrl,
      discordProfile: params.discordProfile,
      mergedWallet,
      mergedWithdrawAccounts,
      fallbackMemberDisplayName: canonicalDlmUser.member?.serverDisplayName ?? null,
    });
  }

  await tx.dlmUser.update({
    where: { dlmId: canonicalDlmUser.dlmId },
    data: {
      discordUserId: canonicalDiscordUserId,
      discordDisplayName: canonicalDiscordDisplayName,
      discordAvatarUrl: canonicalDiscordAvatarUrl,
      sessionVersion: { increment: 1 },
      wechatDisplayName: pickPreferred(
        canonicalDlmUser.wechatDisplayName,
        incomingDlmUser.wechatDisplayName,
      ),
      wechatAvatarUrl: pickPreferred(canonicalDlmUser.wechatAvatarUrl, incomingDlmUser.wechatAvatarUrl),
      totalBalance: mergedWallet.totalBalance,
      income: mergedWallet.income,
      recharge: mergedWallet.recharge,
      totalSpent: mergedWallet.totalSpent,
      loyaltyPoints: mergedWallet.loyaltyPoints,
      ...mergedWithdrawAccounts,
    },
  });

  await assertIncomingRelationsMigratedTx(tx, incomingDlmUser.dlmId);

  await tx.dlmUser.delete({
    where: { dlmId: incomingDlmUser.dlmId },
  });

  return tx.dlmUser.findUniqueOrThrow({
    where: { dlmId: canonicalDlmUser.dlmId },
    include: dlmUserWithMemberAndBindings,
  });
}

export async function unbindDlmUserChannelTx(tx: Prisma.TransactionClient, params: {
  dlmId: string;
  provider: AccountProvider;
  expectedSessionVersion?: number;
}) {
  const dlmUser = (await lockBindingUsersTx(tx, [params.dlmId])).get(params.dlmId);

  if (!dlmUser) {
    throw new ChannelBindingError('dlm_user_not_found');
  }

  if (params.expectedSessionVersion !== undefined && params.expectedSessionVersion !== dlmUser.sessionVersion) {
    throw new ChannelBindingError('binding_state_changed');
  }
  const wechatProviders = [AccountProvider.WECHAT_MINIPROGRAM, AccountProvider.WECHAT_WEB];
  const isWechat = params.provider !== AccountProvider.DISCORD;
  const bindingsForProvider = dlmUser.accountBindings.filter(binding => isWechat
    ? wechatProviders.includes(binding.provider as typeof wechatProviders[number])
    : binding.provider === AccountProvider.DISCORD);

  if (!bindingsForProvider.length) {
    throw new ChannelBindingError('channel_not_bound');
  }

  const remainingBindingCount = dlmUser.accountBindings.filter(binding => isWechat
    ? binding.provider === AccountProvider.DISCORD && binding.providerUserId === dlmUser.discordUserId
    : wechatProviders.includes(binding.provider as typeof wechatProviders[number])).length;
  if (remainingBindingCount <= 0) {
    throw new ChannelBindingError('last_login_method_forbidden');
  }

  if (params.provider === AccountProvider.DISCORD && dlmUser.member?.status === MemberStatus.PEIWAN) {
    throw new ChannelBindingError('peiwan_requires_discord');
  }

  if (isWechat) {
    await tx.wechatProgramSession.deleteMany({ where: { dlmId: dlmUser.dlmId } });
    await tx.accountBinding.deleteMany({
      where: { dlmId: dlmUser.dlmId, provider: { in: wechatProviders } },
    });
    await tx.dlmUser.update({
      where: { dlmId: dlmUser.dlmId },
      data: { wechatDisplayName: null, wechatAvatarUrl: null, sessionVersion: { increment: 1 } },
    });
    return { provider: params.provider, loggedOut: true };
  }

  // Detaching a non-empty legacy Member would leave the same assets available
  // both on this DLM account and on a newly-created Discord login identity.
  // Until asset ownership can be reviewed and transferred explicitly, only
  // empty accounts without active business can use automatic Discord unbind.
  if (dlmUser.discordUserId) {
    const quotaLocks = await lockManualQuotaOwnersTx(tx, [dlmUser.discordUserId]);
    if (await hasManualQuotaForUnbindTx(tx, dlmUser.discordUserId, quotaLocks)) {
      throw new ChannelBindingError('discord_unbind_requires_asset_review');
    }
  }
  const walletFields = ['totalBalance', 'income', 'recharge', 'totalSpent'] as const;
  const hasWalletHistory = walletFields.some((field) =>
    !DEC(dlmUser[field]).isZero() || !DEC(dlmUser.member?.[field]).isZero());
  const legacyPoints = dlmUser.discordUserId ? await tx.loyaltyPoint.findUnique({
    where: { discordUserId: dlmUser.discordUserId },
    select: { points: true },
  }) : null;
  if (hasWalletHistory || !DEC(dlmUser.loyaltyPoints).isZero() || !DEC(legacyPoints?.points).isZero()) {
    throw new ChannelBindingError('discord_unbind_requires_asset_review');
  }
  const [activeOrder, activeDispatch] = await Promise.all([
    tx.order.findFirst({
      where: {
        status: { in: [OrderStatus.PENDING, OrderStatus.RUNNING] },
        OR: [
          { hostDlmId: dlmUser.dlmId },
          ...(dlmUser.discordUserId ? [{ hostId: dlmUser.discordUserId }, { workerId: dlmUser.discordUserId }] : []),
        ],
      },
      select: { id: true },
    }),
    tx.dispatchRequest.findFirst({
      where: {
        status: DispatchRequestStatus.OPEN,
        OR: [
          { ownerDlmId: dlmUser.dlmId },
          ...(dlmUser.discordUserId ? [{ ownerDiscordUserId: dlmUser.discordUserId }] : []),
        ],
      },
      select: { id: true },
    }),
  ]);
  if (activeOrder || activeDispatch) {
    throw new ChannelBindingError('discord_unbind_requires_asset_review');
  }

  const memberWalletSnapshot = {
    totalBalance: dlmUser.member?.totalBalance ?? dlmUser.totalBalance,
    income: dlmUser.member?.income ?? dlmUser.income,
    recharge: dlmUser.member?.recharge ?? dlmUser.recharge,
    totalSpent: dlmUser.member?.totalSpent ?? dlmUser.totalSpent,
  };

  await tx.accountBinding.deleteMany({
    where: {
      dlmId: dlmUser.dlmId,
      provider: AccountProvider.DISCORD,
    },
  });

  await tx.dlmUser.update({
    where: { dlmId: dlmUser.dlmId },
    data: {
      discordUserId: null,
      discordDisplayName: null,
      discordAvatarUrl: null,
      sessionVersion: { increment: 1 },
      totalBalance: memberWalletSnapshot.totalBalance,
      income: memberWalletSnapshot.income,
      recharge: memberWalletSnapshot.recharge,
      totalSpent: memberWalletSnapshot.totalSpent,
    },
  });

  await tx.wechatProgramSession.deleteMany({ where: { dlmId: dlmUser.dlmId } });
  return { provider: params.provider, loggedOut: true };
}

export const isDiscordBindingError = (error: unknown): error is ChannelBindingError =>
  error instanceof ChannelBindingError;
