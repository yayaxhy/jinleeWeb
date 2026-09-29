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

const dlmUserWithMemberAndBindings = {
  member: true,
  accountBindings: true,
} satisfies Prisma.DlmUserInclude;

export type DlmUserBindingSnapshot = Prisma.DlmUserGetPayload<{
  include: typeof dlmUserWithMemberAndBindings;
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

export async function mergeWechatProgramDlmUserIntoDiscordDlmUser(params: {
  sourceDlmId: string;
  targetWechatDlmId: string;
  discordUserId: string;
  discordDisplayName?: string | null;
  discordAvatarUrl?: string | null;
  discordProfile?: Prisma.InputJsonValue;
}) {
  return mergeWechatProgramDlmUserIntoDlmUser({
    canonicalDlmId: params.sourceDlmId,
    incomingWechatDlmId: params.targetWechatDlmId,
    discordUserId: params.discordUserId,
    discordDisplayName: params.discordDisplayName,
    discordAvatarUrl: params.discordAvatarUrl,
    discordProfile: params.discordProfile,
  });
}

export async function mergeWechatProgramDlmUserIntoDlmUser(params: {
  canonicalDlmId: string;
  incomingWechatDlmId: string;
  discordUserId?: string | null;
  discordDisplayName?: string | null;
  discordAvatarUrl?: string | null;
  discordProfile?: Prisma.InputJsonValue;
}) {
  return prisma.$transaction(async (tx) => {
    const [canonicalDlmUser, incomingDlmUser] = await Promise.all([
      tx.dlmUser.findUnique({
        where: { dlmId: params.canonicalDlmId },
        include: dlmUserWithMemberAndBindings,
      }),
      tx.dlmUser.findUnique({
        where: { dlmId: params.incomingWechatDlmId },
        include: dlmUserWithMemberAndBindings,
      }),
    ]);

    if (!canonicalDlmUser) {
      throw new ChannelBindingError('canonical_user_not_found');
    }

    if (!incomingDlmUser) {
      throw new ChannelBindingError('wechat_user_not_found');
    }

    if (canonicalDlmUser.dlmId === incomingDlmUser.dlmId) {
      return canonicalDlmUser;
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

    await mergeOpenPointShopCartsTx(tx, {
      canonicalDlmId: canonicalDlmUser.dlmId,
      incomingDlmId: incomingDlmUser.dlmId,
      canonicalDiscordUserId,
    });

    await Promise.all([
      tx.wechatProgramSession.updateMany({
        where: { dlmId: incomingDlmUser.dlmId },
        data: { dlmId: canonicalDlmUser.dlmId },
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

    await tx.dlmUser.delete({
      where: { dlmId: incomingDlmUser.dlmId },
    });

    return tx.dlmUser.findUniqueOrThrow({
      where: { dlmId: canonicalDlmUser.dlmId },
      include: dlmUserWithMemberAndBindings,
    });
  });
}

export async function unbindDlmUserChannel(params: {
  dlmId: string;
  provider: AccountProvider;
}) {
  return prisma.$transaction(async (tx) => {
    const dlmUser = await tx.dlmUser.findUnique({
      where: { dlmId: params.dlmId },
      include: dlmUserWithMemberAndBindings,
    });

    if (!dlmUser) {
      throw new ChannelBindingError('dlm_user_not_found');
    }

    const bindingsForProvider = dlmUser.accountBindings.filter(
      (binding) => binding.provider === params.provider,
    );

    if (!bindingsForProvider.length) {
      throw new ChannelBindingError('channel_not_bound');
    }

    const remainingBindingCount = dlmUser.accountBindings.length - bindingsForProvider.length;
    if (remainingBindingCount <= 0) {
      throw new ChannelBindingError('last_login_method_forbidden');
    }

    if (params.provider === AccountProvider.DISCORD && dlmUser.member?.status === MemberStatus.PEIWAN) {
      throw new ChannelBindingError('peiwan_requires_discord');
    }

    if (params.provider === AccountProvider.WECHAT_MINIPROGRAM) {
      await tx.wechatProgramSession.deleteMany({
        where: { dlmId: dlmUser.dlmId },
      });

      await tx.accountBinding.deleteMany({
        where: {
          dlmId: dlmUser.dlmId,
          provider: AccountProvider.WECHAT_MINIPROGRAM,
        },
      });

      const remainingWechatBindings = await tx.accountBinding.count({
        where: {
          dlmId: dlmUser.dlmId,
          provider: AccountProvider.WECHAT_MINIPROGRAM,
        },
      });

      if (remainingWechatBindings === 0) {
        await tx.dlmUser.update({
          where: { dlmId: dlmUser.dlmId },
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
