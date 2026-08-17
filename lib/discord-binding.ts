import { AccountProvider, MemberStatus, PointShopCartStatus, Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

const DEC = (value: Prisma.Decimal | number | string | null | undefined) =>
  value instanceof Prisma.Decimal ? value : new Prisma.Decimal(value ?? 0);

export class ChannelBindingError extends Error {
  code: string;

  constructor(code: string) {
    super(code);
    this.code = code;
  }
}

const jinleeUserWithMemberAndBindings = {
  member: true,
  accountBindings: true,
} satisfies Prisma.JinleeUserInclude;

export type JinleeUserBindingSnapshot = Prisma.JinleeUserGetPayload<{
  include: typeof jinleeUserWithMemberAndBindings;
}>;

const mergeWalletField = (
  primary: Prisma.Decimal | number | string | null | undefined,
  incoming: Prisma.Decimal | number | string | null | undefined,
) => DEC(primary).add(DEC(incoming));

const pickPreferred = (current?: string | null, fallback?: string | null) => {
  if (current && current.trim()) return current;
  if (fallback && fallback.trim()) return fallback;
  return null;
};

async function mergeOpenPointShopCartsTx(
  tx: Prisma.TransactionClient,
  params: {
    canonicalJinleeId: string;
    incomingJinleeId: string;
    canonicalDiscordUserId?: string | null;
  },
) {
  const [canonicalOpenCart, incomingOpenCart] = await Promise.all([
    tx.pointShopCart.findFirst({
      where: {
        jinleeId: params.canonicalJinleeId,
        status: PointShopCartStatus.OPEN,
      },
      orderBy: { updatedAt: 'desc' },
      select: { id: true },
    }),
    tx.pointShopCart.findFirst({
      where: {
        jinleeId: params.incomingJinleeId,
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
        jinleeId: params.canonicalJinleeId,
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
    canonicalJinleeId: string;
    incomingJinleeId: string;
    canonicalDiscordUserId?: string | null;
  },
) {
  const [canonicalPity, incomingPity] = await Promise.all([
    tx.lotteryPity.findUnique({
      where: { jinleeId: params.canonicalJinleeId },
      select: { missCount: true },
    }),
    tx.lotteryPity.findUnique({
      where: { jinleeId: params.incomingJinleeId },
      select: { missCount: true },
    }),
  ]);

  if (!incomingPity) {
    return;
  }

  if (canonicalPity) {
    await tx.lotteryPity.update({
      where: { jinleeId: params.canonicalJinleeId },
      data: {
        missCount: canonicalPity.missCount + incomingPity.missCount,
        userId: params.canonicalDiscordUserId ?? undefined,
      },
    });

    await tx.lotteryPity.delete({
      where: { jinleeId: params.incomingJinleeId },
    });
    return;
  }

  await tx.lotteryPity.create({
    data: {
      jinleeId: params.canonicalJinleeId,
      userId: params.canonicalDiscordUserId ?? null,
      missCount: incomingPity.missCount,
    },
  });

  await tx.lotteryPity.delete({
    where: { jinleeId: params.incomingJinleeId },
  });
}

async function syncDiscordMirrorDataTx(
  tx: Prisma.TransactionClient,
  params: {
    jinleeId: string;
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
      jinleeId: params.jinleeId,
      points: params.mergedWallet.loyaltyPoints,
    },
    update: {
      jinleeId: params.jinleeId,
      points: params.mergedWallet.loyaltyPoints,
    },
  });

  await tx.withdrawalAccount.upsert({
    where: { discordUserId: params.discordUserId },
    create: {
      discordUserId: params.discordUserId,
      jinleeId: params.jinleeId,
      account1: params.mergedWithdrawAccounts.withdrawAccount1,
      account2: params.mergedWithdrawAccounts.withdrawAccount2,
      account3: params.mergedWithdrawAccounts.withdrawAccount3,
    },
    update: {
      jinleeId: params.jinleeId,
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
      jinleeId: params.jinleeId,
      provider: AccountProvider.DISCORD,
      providerUserId: params.discordUserId,
      lastLoginAt: new Date(),
      ...(params.discordProfile !== undefined ? { profile: params.discordProfile } : {}),
    },
    update: {
      jinleeId: params.jinleeId,
      lastLoginAt: new Date(),
      ...(params.discordProfile !== undefined ? { profile: params.discordProfile } : {}),
    },
  });
}

export async function mergeWechatProgramJinleeUserIntoDiscordJinleeUser(params: {
  sourceJinleeId: string;
  targetWechatJinleeId: string;
  discordUserId: string;
  discordDisplayName?: string | null;
  discordAvatarUrl?: string | null;
  discordProfile?: Prisma.InputJsonValue;
}) {
  return mergeWechatProgramJinleeUserIntoJinleeUser({
    canonicalJinleeId: params.sourceJinleeId,
    incomingWechatJinleeId: params.targetWechatJinleeId,
    discordUserId: params.discordUserId,
    discordDisplayName: params.discordDisplayName,
    discordAvatarUrl: params.discordAvatarUrl,
    discordProfile: params.discordProfile,
  });
}

export async function mergeWechatProgramJinleeUserIntoJinleeUser(params: {
  canonicalJinleeId: string;
  incomingWechatJinleeId: string;
  discordUserId?: string | null;
  discordDisplayName?: string | null;
  discordAvatarUrl?: string | null;
  discordProfile?: Prisma.InputJsonValue;
}) {
  return prisma.$transaction(async (tx) => {
    const [canonicalJinleeUser, incomingJinleeUser] = await Promise.all([
      tx.jinleeUser.findUnique({
        where: { jinleeId: params.canonicalJinleeId },
        include: jinleeUserWithMemberAndBindings,
      }),
      tx.jinleeUser.findUnique({
        where: { jinleeId: params.incomingWechatJinleeId },
        include: jinleeUserWithMemberAndBindings,
      }),
    ]);

    if (!canonicalJinleeUser) {
      throw new ChannelBindingError('canonical_user_not_found');
    }

    if (!incomingJinleeUser) {
      throw new ChannelBindingError('wechat_user_not_found');
    }

    if (canonicalJinleeUser.jinleeId === incomingJinleeUser.jinleeId) {
      return canonicalJinleeUser;
    }

    const incomingWechatBindings = incomingJinleeUser.accountBindings.filter(
      (binding) => binding.provider === AccountProvider.WECHAT_MINIPROGRAM,
    );

    if (!incomingWechatBindings.length) {
      throw new ChannelBindingError('wechat_binding_not_found');
    }

    const conflictingWechatBinding = canonicalJinleeUser.accountBindings.find(
      (binding) =>
        binding.provider === AccountProvider.WECHAT_MINIPROGRAM &&
        !incomingWechatBindings.some(
          (incomingBinding) => incomingBinding.providerUserId === binding.providerUserId,
        ),
    );

    if (conflictingWechatBinding) {
      throw new ChannelBindingError('jinlee_user_already_bound_to_other_wechat');
    }

    const canonicalDiscordUserId = params.discordUserId ?? canonicalJinleeUser.discordUserId ?? null;
    const canonicalDiscordDisplayName =
      params.discordDisplayName ??
      canonicalJinleeUser.discordDisplayName ??
      canonicalJinleeUser.member?.serverDisplayName ??
      null;
    const canonicalDiscordAvatarUrl = params.discordAvatarUrl ?? canonicalJinleeUser.discordAvatarUrl ?? null;

    await mergeOpenPointShopCartsTx(tx, {
      canonicalJinleeId: canonicalJinleeUser.jinleeId,
      incomingJinleeId: incomingJinleeUser.jinleeId,
      canonicalDiscordUserId,
    });

    await Promise.all([
      tx.wechatProgramSession.updateMany({
        where: { jinleeId: incomingJinleeUser.jinleeId },
        data: { jinleeId: canonicalJinleeUser.jinleeId },
      }),
      tx.accountBinding.updateMany({
        where: {
          jinleeId: incomingJinleeUser.jinleeId,
          provider: {
            not: AccountProvider.DISCORD,
          },
        },
        data: {
          jinleeId: canonicalJinleeUser.jinleeId,
          lastLoginAt: new Date(),
        },
      }),
      tx.order.updateMany({
        where: { hostJinleeId: incomingJinleeUser.jinleeId },
        data: { hostJinleeId: canonicalJinleeUser.jinleeId },
      }),
      tx.orderAudit.updateMany({
        where: { hostJinleeId: incomingJinleeUser.jinleeId },
        data: { hostJinleeId: canonicalJinleeUser.jinleeId },
      }),
      tx.orderAudit.updateMany({
        where: { workerJinleeId: incomingJinleeUser.jinleeId },
        data: { workerJinleeId: canonicalJinleeUser.jinleeId },
      }),
      tx.zPayRechargeOrder.updateMany({
        where: { jinleeId: incomingJinleeUser.jinleeId },
        data: { jinleeId: canonicalJinleeUser.jinleeId },
      }),
      tx.stripePayment.updateMany({
        where: { jinleeId: incomingJinleeUser.jinleeId },
        data: { jinleeId: canonicalJinleeUser.jinleeId },
      }),
      tx.wechatNativePayment.updateMany({
        where: { jinleeId: incomingJinleeUser.jinleeId },
        data: { jinleeId: canonicalJinleeUser.jinleeId },
      }),
      tx.recharge.updateMany({
        where: { jinleeId: incomingJinleeUser.jinleeId },
        data: { jinleeId: canonicalJinleeUser.jinleeId },
      }),
      tx.withdraw.updateMany({
        where: { jinleeId: incomingJinleeUser.jinleeId },
        data: { jinleeId: canonicalJinleeUser.jinleeId },
      }),
      tx.individualTransaction.updateMany({
        where: { jinleeId: incomingJinleeUser.jinleeId },
        data: { jinleeId: canonicalJinleeUser.jinleeId },
      }),
      tx.coupon.updateMany({
        where: { jinleeId: incomingJinleeUser.jinleeId },
        data: { jinleeId: canonicalJinleeUser.jinleeId },
      }),
      tx.coupon.updateMany({
        where: { consumeTargetJinleeId: incomingJinleeUser.jinleeId },
        data: { consumeTargetJinleeId: canonicalJinleeUser.jinleeId },
      }),
      tx.transaction.updateMany({
        where: { fromJinleeId: incomingJinleeUser.jinleeId },
        data: { fromJinleeId: canonicalJinleeUser.jinleeId },
      }),
      tx.transaction.updateMany({
        where: { toJinleeId: incomingJinleeUser.jinleeId },
        data: { toJinleeId: canonicalJinleeUser.jinleeId },
      }),
      tx.commission.updateMany({
        where: { fromJinleeId: incomingJinleeUser.jinleeId },
        data: { fromJinleeId: canonicalJinleeUser.jinleeId },
      }),
      tx.commission.updateMany({
        where: { toJinleeId: incomingJinleeUser.jinleeId },
        data: { toJinleeId: canonicalJinleeUser.jinleeId },
      }),
      tx.lotteryDraw.updateMany({
        where: { jinleeId: incomingJinleeUser.jinleeId },
        data: { jinleeId: canonicalJinleeUser.jinleeId },
      }),
      tx.lotteryDraw.updateMany({
        where: { consumeTargetJinleeId: incomingJinleeUser.jinleeId },
        data: { consumeTargetJinleeId: canonicalJinleeUser.jinleeId },
      }),
      tx.pointShopCart.updateMany({
        where: {
          jinleeId: incomingJinleeUser.jinleeId,
          status: {
            not: PointShopCartStatus.OPEN,
          },
        },
        data: {
          jinleeId: canonicalJinleeUser.jinleeId,
          discordUserId: canonicalDiscordUserId,
        },
      }),
      tx.pointShopOrder.updateMany({
        where: { jinleeId: incomingJinleeUser.jinleeId },
        data: { jinleeId: canonicalJinleeUser.jinleeId },
      }),
      tx.pointShopGrant.updateMany({
        where: { jinleeId: incomingJinleeUser.jinleeId },
        data: { jinleeId: canonicalJinleeUser.jinleeId },
      }),
      tx.pointShopGrant.updateMany({
        where: { consumeTargetJinleeId: incomingJinleeUser.jinleeId },
        data: { consumeTargetJinleeId: canonicalJinleeUser.jinleeId },
      }),
      tx.pointShopPointLedger.updateMany({
        where: { jinleeId: incomingJinleeUser.jinleeId },
        data: { jinleeId: canonicalJinleeUser.jinleeId },
      }),
    ]);

    await mergeLotteryPityTx(tx, {
      canonicalJinleeId: canonicalJinleeUser.jinleeId,
      incomingJinleeId: incomingJinleeUser.jinleeId,
      canonicalDiscordUserId,
    });

    const canonicalWallet = {
      totalBalance: DEC(canonicalJinleeUser.member?.totalBalance ?? canonicalJinleeUser.totalBalance),
      income: DEC(canonicalJinleeUser.member?.income ?? canonicalJinleeUser.income),
      recharge: DEC(canonicalJinleeUser.member?.recharge ?? canonicalJinleeUser.recharge),
      totalSpent: DEC(canonicalJinleeUser.member?.totalSpent ?? canonicalJinleeUser.totalSpent),
      loyaltyPoints: DEC(canonicalJinleeUser.loyaltyPoints),
    };

    const incomingWallet = {
      totalBalance: DEC(incomingJinleeUser.totalBalance),
      income: DEC(incomingJinleeUser.income),
      recharge: DEC(incomingJinleeUser.recharge),
      totalSpent: DEC(incomingJinleeUser.totalSpent),
      loyaltyPoints: DEC(incomingJinleeUser.loyaltyPoints),
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
        canonicalJinleeUser.withdrawAccount1,
        incomingJinleeUser.withdrawAccount1,
      ),
      withdrawAccount2: pickPreferred(
        canonicalJinleeUser.withdrawAccount2,
        incomingJinleeUser.withdrawAccount2,
      ),
      withdrawAccount3: pickPreferred(
        canonicalJinleeUser.withdrawAccount3,
        incomingJinleeUser.withdrawAccount3,
      ),
    };

    if (canonicalDiscordUserId) {
      await syncDiscordMirrorDataTx(tx, {
        jinleeId: canonicalJinleeUser.jinleeId,
        discordUserId: canonicalDiscordUserId,
        discordDisplayName: canonicalDiscordDisplayName,
        discordAvatarUrl: canonicalDiscordAvatarUrl,
        discordProfile: params.discordProfile,
        mergedWallet,
        mergedWithdrawAccounts,
        fallbackMemberDisplayName: canonicalJinleeUser.member?.serverDisplayName ?? null,
      });
    }

    await tx.jinleeUser.update({
      where: { jinleeId: canonicalJinleeUser.jinleeId },
      data: {
        discordUserId: canonicalDiscordUserId,
        discordDisplayName: canonicalDiscordDisplayName,
        discordAvatarUrl: canonicalDiscordAvatarUrl,
        wechatDisplayName: pickPreferred(
          canonicalJinleeUser.wechatDisplayName,
          incomingJinleeUser.wechatDisplayName,
        ),
        wechatAvatarUrl: pickPreferred(canonicalJinleeUser.wechatAvatarUrl, incomingJinleeUser.wechatAvatarUrl),
        totalBalance: mergedWallet.totalBalance,
        income: mergedWallet.income,
        recharge: mergedWallet.recharge,
        totalSpent: mergedWallet.totalSpent,
        loyaltyPoints: mergedWallet.loyaltyPoints,
        ...mergedWithdrawAccounts,
      },
    });

    await tx.jinleeUser.delete({
      where: { jinleeId: incomingJinleeUser.jinleeId },
    });

    return tx.jinleeUser.findUniqueOrThrow({
      where: { jinleeId: canonicalJinleeUser.jinleeId },
      include: jinleeUserWithMemberAndBindings,
    });
  });
}

export async function unbindJinleeUserChannel(params: {
  jinleeId: string;
  provider: AccountProvider;
}) {
  return prisma.$transaction(async (tx) => {
    const jinleeUser = await tx.jinleeUser.findUnique({
      where: { jinleeId: params.jinleeId },
      include: jinleeUserWithMemberAndBindings,
    });

    if (!jinleeUser) {
      throw new ChannelBindingError('jinlee_user_not_found');
    }

    const bindingsForProvider = jinleeUser.accountBindings.filter(
      (binding) => binding.provider === params.provider,
    );

    if (!bindingsForProvider.length) {
      throw new ChannelBindingError('channel_not_bound');
    }

    const remainingBindingCount = jinleeUser.accountBindings.length - bindingsForProvider.length;
    if (remainingBindingCount <= 0) {
      throw new ChannelBindingError('last_login_method_forbidden');
    }

    if (params.provider === AccountProvider.DISCORD && jinleeUser.member?.status === MemberStatus.PEIWAN) {
      throw new ChannelBindingError('peiwan_requires_discord');
    }

    if (params.provider === AccountProvider.WECHAT_MINIPROGRAM) {
      await tx.wechatProgramSession.deleteMany({
        where: { jinleeId: jinleeUser.jinleeId },
      });

      await tx.accountBinding.deleteMany({
        where: {
          jinleeId: jinleeUser.jinleeId,
          provider: AccountProvider.WECHAT_MINIPROGRAM,
        },
      });

      const remainingWechatBindings = await tx.accountBinding.count({
        where: {
          jinleeId: jinleeUser.jinleeId,
          provider: AccountProvider.WECHAT_MINIPROGRAM,
        },
      });

      if (remainingWechatBindings === 0) {
        await tx.jinleeUser.update({
          where: { jinleeId: jinleeUser.jinleeId },
          data: {
            wechatDisplayName: null,
            wechatAvatarUrl: null,
          },
        });
      }

      return {
        provider: params.provider,
        loggedOut: false,
      };
    }

    const memberWalletSnapshot = {
      totalBalance: jinleeUser.member?.totalBalance ?? jinleeUser.totalBalance,
      income: jinleeUser.member?.income ?? jinleeUser.income,
      recharge: jinleeUser.member?.recharge ?? jinleeUser.recharge,
      totalSpent: jinleeUser.member?.totalSpent ?? jinleeUser.totalSpent,
    };

    await tx.accountBinding.deleteMany({
      where: {
        jinleeId: jinleeUser.jinleeId,
        provider: AccountProvider.DISCORD,
      },
    });

    await tx.jinleeUser.update({
      where: { jinleeId: jinleeUser.jinleeId },
      data: {
        discordUserId: null,
        discordDisplayName: null,
        discordAvatarUrl: null,
        totalBalance: memberWalletSnapshot.totalBalance,
        income: memberWalletSnapshot.income,
        recharge: memberWalletSnapshot.recharge,
        totalSpent: memberWalletSnapshot.totalSpent,
      },
    });

    return {
      provider: params.provider,
      loggedOut: false,
    };
  });
}

export const isDiscordBindingError = (error: unknown): error is ChannelBindingError =>
  error instanceof ChannelBindingError;
