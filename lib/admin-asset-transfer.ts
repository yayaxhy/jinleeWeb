import { Prisma, type PrismaClient } from '@prisma/client';
import { applyJinleeWalletDeltaTx, getJinleeWalletSnapshotTx } from '@/lib/jinlee-wallet';
import { getHighestVipLevelByTotalSpent } from '@/lib/vip-levels';

const DEC = (value: Prisma.Decimal | number | string | null | undefined) =>
  value instanceof Prisma.Decimal ? value : new Prisma.Decimal(value ?? 0);

const DEFAULT_COMMISSION_RATE = new Prisma.Decimal('0.75');

type DbClient = PrismaClient | Prisma.TransactionClient;

type WalletSummary = {
  totalBalance: string;
  income: string;
  recharge: string;
  totalSpent: string;
  loyaltyPoints: string;
};

type CommissionSummary = {
  currentRate: string;
  baseRate: string;
  isPeiwan: boolean;
  peiwanId: number | null;
};

type HeartSummary = {
  outgoingPairs: number;
  incomingPairs: number;
  maxSent: number;
  maxReceived: number;
};

type BuffSummary = {
  commissionBoostExpiresAt: string | null;
  flowRemaining: string;
  flowExpiresAt: string | null;
  spendRemaining: string;
  spendExpiresAt: string | null;
  autoCommissionActiveUntil: string | null;
};

export type AssetAccountSummary = {
  discordId: string;
  exists: boolean;
  memberExists: boolean;
  jinleeId: string | null;
  serverDisplayName: string | null;
  memberStatus: string | null;
  wallet: WalletSummary;
  vip: {
    derivedLevel: number;
    lastSettledLevel: number;
    roleOptOut: boolean;
    announcementEnabled: boolean;
    hasDispatchImage: boolean;
  };
  heart: HeartSummary;
  commission: CommissionSummary;
  buffs: BuffSummary;
  hasTransferableData: boolean;
};

export type AssetTransferExecutionResult = {
  auditId: string;
  source: AssetAccountSummary;
  target: AssetAccountSummary;
  transferred: {
    totalBalance: string;
    income: string;
    recharge: string;
    totalSpent: string;
    loyaltyPoints: string;
    vipLevelAfter: number;
  };
  changed: Record<string, number>;
  warnings: string[];
};

const hasNonDefaultVipState = (summary: AssetAccountSummary['vip']) =>
  summary.lastSettledLevel > 0 ||
  summary.roleOptOut ||
  !summary.announcementEnabled ||
  summary.hasDispatchImage;

const hasActiveDate = (value: Date | null | undefined) => Boolean(value && value > new Date());

const serializeWallet = (
  totalBalance: Prisma.Decimal | number | string | null | undefined,
  income: Prisma.Decimal | number | string | null | undefined,
  recharge: Prisma.Decimal | number | string | null | undefined,
  totalSpent: Prisma.Decimal | number | string | null | undefined,
  loyaltyPoints: Prisma.Decimal | number | string | null | undefined,
): WalletSummary => ({
  totalBalance: DEC(totalBalance).toString(),
  income: DEC(income).toString(),
  recharge: DEC(recharge).toString(),
  totalSpent: DEC(totalSpent).toString(),
  loyaltyPoints: DEC(loyaltyPoints).toString(),
});

export const loadAssetAccountSummary = async (
  client: DbClient,
  discordId: string,
): Promise<AssetAccountSummary> => {
  const now = new Date();

  const [member, jinleeUser, loyaltyPoint, vipProfile, commissionBuff, flowBuff, spendBuff, autoCommissionBuff, outgoingPairs, incomingPairs, maxSent, maxReceived] =
    await Promise.all([
      client.member.findUnique({
        where: { discordUserId: discordId },
        select: {
          discordUserId: true,
          status: true,
          serverDisplayName: true,
          totalBalance: true,
          income: true,
          recharge: true,
          totalSpent: true,
          commissionRate: true,
          baseCommissionRate: true,
          peiwan: {
            select: {
              PEIWANID: true,
            },
          },
        },
      }),
      client.jinleeUser.findUnique({
        where: { discordUserId: discordId },
        select: {
          jinleeId: true,
          totalBalance: true,
          income: true,
          recharge: true,
          totalSpent: true,
          loyaltyPoints: true,
        },
      }),
      client.loyaltyPoint.findUnique({
        where: { discordUserId: discordId },
        select: { points: true },
      }),
      client.vipBenefitProfile.findUnique({
        where: { discordUserId: discordId },
        select: {
          roleOptOut: true,
          announcementEnabled: true,
          lastSettledVipLevel: true,
          dispatchImageUrl: true,
        },
      }),
      client.commissionBuff.findUnique({
        where: { userId: discordId },
        select: { boost: true, expiresAt: true },
      }),
      client.flowBuff.findUnique({
        where: { userId: discordId },
        select: { remainingExtra: true, expiresAt: true },
      }),
      client.spendBuff.findUnique({
        where: { userId: discordId },
        select: { remainingExtra: true, expiresAt: true },
      }),
      client.autoCommissionBuff.findUnique({
        where: { userId: discordId },
        select: { activeUntil: true },
      }),
      client.heartCounter.count({ where: { fromMemberId: discordId } }),
      client.heartCounter.count({ where: { toMemberId: discordId } }),
      client.heartCounter.aggregate({
        where: { fromMemberId: discordId },
        _max: { total: true },
      }),
      client.heartCounter.aggregate({
        where: { toMemberId: discordId },
        _max: { total: true },
      }),
    ]);

  const wallet = serializeWallet(
    member?.totalBalance ?? jinleeUser?.totalBalance,
    member?.income ?? jinleeUser?.income,
    member?.recharge ?? jinleeUser?.recharge,
    member?.totalSpent ?? jinleeUser?.totalSpent,
    loyaltyPoint?.points ?? jinleeUser?.loyaltyPoints,
  );

  const vipDerivedLevel = getHighestVipLevelByTotalSpent(wallet.totalSpent);
  const vip = {
    derivedLevel: vipDerivedLevel,
    lastSettledLevel: Math.max(0, vipProfile?.lastSettledVipLevel ?? 0),
    roleOptOut: vipProfile?.roleOptOut === true,
    announcementEnabled: vipProfile?.announcementEnabled !== false,
    hasDispatchImage: Boolean(vipProfile?.dispatchImageUrl),
  };

  const heart = {
    outgoingPairs: outgoingPairs,
    incomingPairs: incomingPairs,
    maxSent: Number(maxSent._max.total ?? 0),
    maxReceived: Number(maxReceived._max.total ?? 0),
  };

  const buffs = {
    commissionBoostExpiresAt: commissionBuff?.expiresAt && commissionBuff.expiresAt > now ? commissionBuff.expiresAt.toISOString() : null,
    flowRemaining:
      flowBuff?.expiresAt && flowBuff.expiresAt > now ? DEC(flowBuff.remainingExtra).toString() : '0',
    flowExpiresAt: flowBuff?.expiresAt && flowBuff.expiresAt > now ? flowBuff.expiresAt.toISOString() : null,
    spendRemaining:
      spendBuff?.expiresAt && spendBuff.expiresAt > now ? DEC(spendBuff.remainingExtra).toString() : '0',
    spendExpiresAt: spendBuff?.expiresAt && spendBuff.expiresAt > now ? spendBuff.expiresAt.toISOString() : null,
    autoCommissionActiveUntil:
      autoCommissionBuff?.activeUntil && autoCommissionBuff.activeUntil > now
        ? autoCommissionBuff.activeUntil.toISOString()
        : null,
  };

  const hasTransferableData =
    DEC(wallet.totalBalance).gt(0) ||
    DEC(wallet.totalSpent).gt(0) ||
    DEC(wallet.loyaltyPoints).gt(0) ||
    hasNonDefaultVipState(vip) ||
    heart.outgoingPairs > 0 ||
    heart.incomingPairs > 0 ||
    !DEC(member?.baseCommissionRate ?? DEFAULT_COMMISSION_RATE).eq(DEFAULT_COMMISSION_RATE) ||
    Boolean(buffs.commissionBoostExpiresAt) ||
    DEC(buffs.flowRemaining).gt(0) ||
    DEC(buffs.spendRemaining).gt(0);

  return {
    discordId,
    exists: Boolean(member || jinleeUser),
    memberExists: Boolean(member),
    jinleeId: jinleeUser?.jinleeId ?? null,
    serverDisplayName: member?.serverDisplayName ?? null,
    memberStatus: member?.status ?? null,
    wallet,
    vip,
    heart,
    commission: {
      currentRate: DEC(member?.commissionRate ?? DEFAULT_COMMISSION_RATE).toString(),
      baseRate: DEC(member?.baseCommissionRate ?? DEFAULT_COMMISSION_RATE).toString(),
      isPeiwan: Boolean(member?.peiwan),
      peiwanId: member?.peiwan?.PEIWANID ?? null,
    },
    buffs,
    hasTransferableData,
  };
};

const mergeHeartCountersTx = async (
  tx: Prisma.TransactionClient,
  sourceDiscordId: string,
  targetDiscordId: string,
) => {
  const rows = await tx.heartCounter.findMany({
    where: {
      OR: [{ fromMemberId: sourceDiscordId }, { toMemberId: sourceDiscordId }],
    },
    select: {
      id: true,
      fromMemberId: true,
      toMemberId: true,
      total: true,
    },
  });

  let createdPairs = 0;
  let mergedPairs = 0;
  let selfLoopsDropped = 0;

  for (const row of rows) {
    const nextFrom = row.fromMemberId === sourceDiscordId ? targetDiscordId : row.fromMemberId;
    const nextTo = row.toMemberId === sourceDiscordId ? targetDiscordId : row.toMemberId;

    if (nextFrom === nextTo) {
      selfLoopsDropped += 1;
      continue;
    }

    const existing = await tx.heartCounter.findUnique({
      where: {
        fromMemberId_toMemberId: {
          fromMemberId: nextFrom,
          toMemberId: nextTo,
        },
      },
      select: { id: true },
    });

    if (existing) {
      await tx.heartCounter.update({
        where: { id: existing.id },
        data: { total: { increment: row.total } },
      });
      mergedPairs += 1;
      continue;
    }

    await tx.heartCounter.create({
      data: {
        fromMemberId: nextFrom,
        toMemberId: nextTo,
        total: row.total,
      },
    });
    createdPairs += 1;
  }

  if (rows.length > 0) {
    await tx.heartCounter.deleteMany({
      where: {
        id: { in: rows.map((row) => row.id) },
      },
    });
  }

  return {
    sourceRows: rows.length,
    createdPairs,
    mergedPairs,
    selfLoopsDropped,
  };
};

const syncManualBuffsTx = async (
  tx: Prisma.TransactionClient,
  sourceDiscordId: string,
  targetDiscordId: string,
  warnings: string[],
) => {
  const now = new Date();
  const [sourceCommissionBuff, targetCommissionBuff, sourceFlowBuff, targetFlowBuff, sourceSpendBuff, targetSpendBuff, sourceAutoCommissionBuff, targetAutoCommissionBuff] =
    await Promise.all([
      tx.commissionBuff.findUnique({ where: { userId: sourceDiscordId } }),
      tx.commissionBuff.findUnique({ where: { userId: targetDiscordId } }),
      tx.flowBuff.findUnique({ where: { userId: sourceDiscordId } }),
      tx.flowBuff.findUnique({ where: { userId: targetDiscordId } }),
      tx.spendBuff.findUnique({ where: { userId: sourceDiscordId } }),
      tx.spendBuff.findUnique({ where: { userId: targetDiscordId } }),
      tx.autoCommissionBuff.findUnique({ where: { userId: sourceDiscordId }, select: { activeUntil: true } }),
      tx.autoCommissionBuff.findUnique({ where: { userId: targetDiscordId }, select: { activeUntil: true } }),
    ]);

  const changed = {
    commissionBuffTransferred: 0,
    commissionBuffCleared: 0,
    flowBuffTransferred: 0,
    flowBuffCleared: 0,
    spendBuffTransferred: 0,
    spendBuffCleared: 0,
  };

  const sourceCommissionActive = Boolean(sourceCommissionBuff?.expiresAt && sourceCommissionBuff.expiresAt > now);
  const targetCommissionActive = Boolean(targetCommissionBuff?.expiresAt && targetCommissionBuff.expiresAt > now);
  if (sourceCommissionActive && sourceCommissionBuff) {
    const expiresAt =
      targetCommissionActive && targetCommissionBuff && targetCommissionBuff.expiresAt > sourceCommissionBuff.expiresAt
        ? targetCommissionBuff.expiresAt
        : sourceCommissionBuff.expiresAt;
    await tx.commissionBuff.upsert({
      where: { userId: targetDiscordId },
      create: {
        userId: targetDiscordId,
        boost: sourceCommissionBuff.boost,
        expiresAt,
      },
      update: {
        boost: sourceCommissionBuff.boost,
        expiresAt,
      },
    });
    changed.commissionBuffTransferred = 1;
  }
  if (sourceCommissionBuff) {
    await tx.commissionBuff.delete({ where: { userId: sourceDiscordId } }).catch(() => {});
    changed.commissionBuffCleared = 1;
  }

  const sourceFlowActive =
    Boolean(sourceFlowBuff?.expiresAt && sourceFlowBuff.expiresAt > now) && DEC(sourceFlowBuff?.remainingExtra).gt(0);
  const targetFlowActive =
    Boolean(targetFlowBuff?.expiresAt && targetFlowBuff.expiresAt > now) && DEC(targetFlowBuff?.remainingExtra).gt(0);
  if (sourceFlowActive && sourceFlowBuff) {
    const expiresAt =
      targetFlowActive && targetFlowBuff && targetFlowBuff.expiresAt > sourceFlowBuff.expiresAt
        ? targetFlowBuff.expiresAt
        : sourceFlowBuff.expiresAt;
    const remainingExtra = DEC(targetFlowActive ? targetFlowBuff?.remainingExtra : 0).add(sourceFlowBuff.remainingExtra);
    await tx.flowBuff.upsert({
      where: { userId: targetDiscordId },
      create: {
        userId: targetDiscordId,
        remainingExtra,
        expiresAt,
      },
      update: {
        remainingExtra,
        expiresAt,
      },
    });
    changed.flowBuffTransferred = 1;
  }
  if (sourceFlowBuff) {
    await tx.flowBuff.delete({ where: { userId: sourceDiscordId } }).catch(() => {});
    changed.flowBuffCleared = 1;
  }

  const sourceSpendActive =
    Boolean(sourceSpendBuff?.expiresAt && sourceSpendBuff.expiresAt > now) && DEC(sourceSpendBuff?.remainingExtra).gt(0);
  const targetSpendActive =
    Boolean(targetSpendBuff?.expiresAt && targetSpendBuff.expiresAt > now) && DEC(targetSpendBuff?.remainingExtra).gt(0);
  if (sourceSpendActive && sourceSpendBuff) {
    const expiresAt =
      targetSpendActive && targetSpendBuff && targetSpendBuff.expiresAt > sourceSpendBuff.expiresAt
        ? targetSpendBuff.expiresAt
        : sourceSpendBuff.expiresAt;
    const remainingExtra = DEC(targetSpendActive ? targetSpendBuff?.remainingExtra : 0).add(sourceSpendBuff.remainingExtra);
    await tx.spendBuff.upsert({
      where: { userId: targetDiscordId },
      create: {
        userId: targetDiscordId,
        remainingExtra,
        expiresAt,
      },
      update: {
        remainingExtra,
        expiresAt,
      },
    });
    changed.spendBuffTransferred = 1;
  }
  if (sourceSpendBuff) {
    await tx.spendBuff.delete({ where: { userId: sourceDiscordId } }).catch(() => {});
    changed.spendBuffCleared = 1;
  }

  if (hasActiveDate(sourceAutoCommissionBuff?.activeUntil) || hasActiveDate(targetAutoCommissionBuff?.activeUntil)) {
    warnings.push('自动 91% 抽成未参与资产转移，仍按各账号自身历史收入窗口重算。');
  }

  return changed;
};

const syncCommissionConfigTx = async (
  tx: Prisma.TransactionClient,
  sourceDiscordId: string,
  targetDiscordId: string,
  warnings: string[],
) => {
  const [sourceMember, targetMember] = await Promise.all([
    tx.member.findUnique({
      where: { discordUserId: sourceDiscordId },
      select: {
        commissionRate: true,
        baseCommissionRate: true,
        peiwan: { select: { PEIWANID: true } },
      },
    }),
    tx.member.findUnique({
      where: { discordUserId: targetDiscordId },
      select: {
        commissionRate: true,
        baseCommissionRate: true,
        peiwan: { select: { PEIWANID: true } },
      },
    }),
  ]);

  if (!sourceMember || !targetMember) {
    return {
      sourceReset: 0,
      targetUpdated: 0,
      sourcePeiwanReset: 0,
      targetPeiwanUpdated: 0,
    };
  }

  const sourceBase = DEC(sourceMember.baseCommissionRate ?? DEFAULT_COMMISSION_RATE);

  await tx.member.update({
    where: { discordUserId: targetDiscordId },
    data: {
      commissionRate: sourceBase,
      baseCommissionRate: sourceBase,
    },
  });

  await tx.member.update({
    where: { discordUserId: sourceDiscordId },
    data: {
      commissionRate: DEFAULT_COMMISSION_RATE,
      baseCommissionRate: DEFAULT_COMMISSION_RATE,
    },
  });

  let targetPeiwanUpdated = 0;
  let sourcePeiwanReset = 0;

  if (targetMember.peiwan) {
    await tx.pEIWAN.update({
      where: { discordUserId: targetDiscordId },
      data: {
        commissionRate: sourceBase,
        baseCommissionRate: sourceBase,
      },
    });
    targetPeiwanUpdated = 1;
  }

  if (sourceMember.peiwan) {
    await tx.pEIWAN.update({
      where: { discordUserId: sourceDiscordId },
      data: {
        commissionRate: DEFAULT_COMMISSION_RATE,
        baseCommissionRate: DEFAULT_COMMISSION_RATE,
      },
    });
    sourcePeiwanReset = 1;
  }

  if (sourceMember.peiwan && !targetMember.peiwan) {
    warnings.push('目标账号当前不是陪玩档案，已转移会员基础抽成，但未写入 PEIWAN 专属抽成镜像。');
  }

  return {
    sourceReset: 1,
    targetUpdated: 1,
    sourcePeiwanReset,
    targetPeiwanUpdated,
  };
};

export const executeAssetTransfer = async (
  tx: Prisma.TransactionClient,
  params: {
    operatorDiscordId: string | null;
    sourceDiscordId: string;
    targetDiscordId: string;
    forceMerge: boolean;
  },
): Promise<AssetTransferExecutionResult> => {
  const warnings: string[] = [];

  await tx.$queryRaw`
    SELECT 1
    FROM "Member"
    WHERE "discordUserId" IN (${params.sourceDiscordId}, ${params.targetDiscordId})
    FOR UPDATE
  `;

  const [sourceSummaryBefore, targetSummaryBefore, sourceJinleeUser, targetJinleeUser, sourceVipProfile, targetVipProfile, sourceLoyaltyPoint] =
    await Promise.all([
      loadAssetAccountSummary(tx, params.sourceDiscordId),
      loadAssetAccountSummary(tx, params.targetDiscordId),
      tx.jinleeUser.findUnique({
        where: { discordUserId: params.sourceDiscordId },
        select: { jinleeId: true },
      }),
      tx.jinleeUser.findUnique({
        where: { discordUserId: params.targetDiscordId },
        select: { jinleeId: true },
      }),
      tx.vipBenefitProfile.findUnique({
        where: { discordUserId: params.sourceDiscordId },
      }),
      tx.vipBenefitProfile.findUnique({
        where: { discordUserId: params.targetDiscordId },
      }),
      tx.loyaltyPoint.findUnique({
        where: { discordUserId: params.sourceDiscordId },
        select: { points: true },
      }),
    ]);

  if (!sourceSummaryBefore.memberExists || !sourceJinleeUser?.jinleeId) {
    throw new Error('源账号不存在，或尚未建立 Jinlee 身份');
  }
  if (!targetSummaryBefore.memberExists || !targetJinleeUser?.jinleeId) {
    throw new Error('目标账号不存在，或尚未建立 Jinlee 身份');
  }

  const sourceWalletBefore = await getJinleeWalletSnapshotTx(tx, {
    jinleeId: sourceJinleeUser.jinleeId,
    discordUserId: params.sourceDiscordId,
  });
  const targetWalletBefore = await getJinleeWalletSnapshotTx(tx, {
    jinleeId: targetJinleeUser.jinleeId,
    discordUserId: params.targetDiscordId,
  });

  const targetWalletAfter = await applyJinleeWalletDeltaTx(tx, {
    jinleeId: targetJinleeUser.jinleeId,
    discordUserId: params.targetDiscordId,
    totalBalanceDelta: sourceWalletBefore.totalBalance,
    incomeDelta: sourceWalletBefore.income,
    rechargeDelta: sourceWalletBefore.recharge,
    totalSpentDelta: sourceWalletBefore.totalSpent,
    loyaltyPointsDelta: sourceWalletBefore.loyaltyPoints,
  });

  const sourceWalletAfter = await applyJinleeWalletDeltaTx(tx, {
    jinleeId: sourceJinleeUser.jinleeId,
    discordUserId: params.sourceDiscordId,
    totalBalanceDelta: sourceWalletBefore.totalBalance.negated(),
    incomeDelta: sourceWalletBefore.income.negated(),
    rechargeDelta: sourceWalletBefore.recharge.negated(),
    totalSpentDelta: sourceWalletBefore.totalSpent.negated(),
    loyaltyPointsDelta: sourceWalletBefore.loyaltyPoints.negated(),
  });

  await tx.loyaltyPoint.upsert({
    where: { discordUserId: params.targetDiscordId },
    create: {
      discordUserId: params.targetDiscordId,
      jinleeId: targetJinleeUser.jinleeId,
      points: targetWalletAfter.loyaltyPoints,
    },
    update: {
      jinleeId: targetJinleeUser.jinleeId,
      points: targetWalletAfter.loyaltyPoints,
    },
  });

  if (sourceLoyaltyPoint) {
    await tx.loyaltyPoint.update({
      where: { discordUserId: params.sourceDiscordId },
      data: { points: new Prisma.Decimal(0) },
    });
  }

  if (sourceWalletBefore.totalBalance.gt(0)) {
    await tx.individualTransaction.create({
      data: {
        discordId: params.sourceDiscordId,
        jinleeId: sourceJinleeUser.jinleeId,
        thirdPartydiscordId: params.targetDiscordId,
        balanceBefore: sourceWalletBefore.totalBalance,
        amountChange: sourceWalletBefore.totalBalance,
        balanceAfter: sourceWalletAfter.totalBalance,
        typeOfTransaction: '资产转出',
      },
    });

    await tx.individualTransaction.create({
      data: {
        discordId: params.targetDiscordId,
        jinleeId: targetJinleeUser.jinleeId,
        thirdPartydiscordId: params.sourceDiscordId,
        balanceBefore: targetWalletBefore.totalBalance,
        amountChange: sourceWalletBefore.totalBalance,
        balanceAfter: targetWalletAfter.totalBalance,
        typeOfTransaction: '资产转入',
      },
    });
  }

  const derivedTargetVipLevel = getHighestVipLevelByTotalSpent(targetWalletAfter.totalSpent.toString());
  const sourceVipLevel = Math.max(0, sourceVipProfile?.lastSettledVipLevel ?? 0);
  const targetVipLevel = Math.max(0, targetVipProfile?.lastSettledVipLevel ?? 0);
  const targetSettledVipLevel = Math.max(sourceVipLevel, targetVipLevel, derivedTargetVipLevel);

  if (sourceVipProfile || targetVipProfile || derivedTargetVipLevel > 0) {
    await tx.vipBenefitProfile.upsert({
      where: { discordUserId: params.targetDiscordId },
      create: {
        discordUserId: params.targetDiscordId,
        roleOptOut: sourceVipProfile?.roleOptOut ?? targetVipProfile?.roleOptOut ?? false,
        announcementEnabled:
          sourceVipProfile?.announcementEnabled ?? targetVipProfile?.announcementEnabled ?? true,
        lastSettledVipLevel: targetSettledVipLevel,
        dispatchImageUrl: sourceVipProfile?.dispatchImageUrl ?? targetVipProfile?.dispatchImageUrl ?? null,
      },
      update: {
        roleOptOut: sourceVipProfile?.roleOptOut ?? targetVipProfile?.roleOptOut ?? false,
        announcementEnabled:
          sourceVipProfile?.announcementEnabled ?? targetVipProfile?.announcementEnabled ?? true,
        lastSettledVipLevel: targetSettledVipLevel,
        dispatchImageUrl: sourceVipProfile?.dispatchImageUrl ?? targetVipProfile?.dispatchImageUrl ?? null,
      },
    });
  }

  if (sourceVipProfile) {
    await tx.vipBenefitProfile.update({
      where: { discordUserId: params.sourceDiscordId },
      data: {
        roleOptOut: false,
        announcementEnabled: true,
        lastSettledVipLevel: 0,
        dispatchImageUrl: null,
      },
    });
  }

  const heartChanged = await mergeHeartCountersTx(tx, params.sourceDiscordId, params.targetDiscordId);
  const commissionChanged = await syncCommissionConfigTx(
    tx,
    params.sourceDiscordId,
    params.targetDiscordId,
    warnings,
  );
  const buffChanged = await syncManualBuffsTx(
    tx,
    params.sourceDiscordId,
    params.targetDiscordId,
    warnings,
  );

  const sourceSummaryAfter = await loadAssetAccountSummary(tx, params.sourceDiscordId);
  const targetSummaryAfter = await loadAssetAccountSummary(tx, params.targetDiscordId);

  const changed = {
    walletBalanceTransferred: sourceWalletBefore.totalBalance.gt(0) ? 1 : 0,
    loyaltyPointRowReset: sourceLoyaltyPoint ? 1 : 0,
    vipTargetUpdated: sourceVipProfile || targetVipProfile || derivedTargetVipLevel > 0 ? 1 : 0,
    vipSourceReset: sourceVipProfile ? 1 : 0,
    heartSourceRowsProcessed: heartChanged.sourceRows,
    heartPairsCreated: heartChanged.createdPairs,
    heartPairsMerged: heartChanged.mergedPairs,
    heartSelfLoopsDropped: heartChanged.selfLoopsDropped,
    ...commissionChanged,
    ...buffChanged,
  } satisfies Record<string, number>;

  const audit = await tx.assetTransferAudit.create({
    data: {
      operatorDiscordId: params.operatorDiscordId,
      sourceDiscordId: params.sourceDiscordId,
      targetDiscordId: params.targetDiscordId,
      sourceJinleeId: sourceJinleeUser.jinleeId,
      targetJinleeId: targetJinleeUser.jinleeId,
      forceMerge: params.forceMerge,
      sourceSnapshot: sourceSummaryBefore,
      targetSnapshot: targetSummaryBefore,
      transferred: {
        totalBalance: sourceWalletBefore.totalBalance.toString(),
        income: sourceWalletBefore.income.toString(),
        recharge: sourceWalletBefore.recharge.toString(),
        totalSpent: sourceWalletBefore.totalSpent.toString(),
        loyaltyPoints: sourceWalletBefore.loyaltyPoints.toString(),
        vipLevelAfter: derivedTargetVipLevel,
        sourceWalletAfter: {
          totalBalance: sourceWalletAfter.totalBalance.toString(),
          income: sourceWalletAfter.income.toString(),
          recharge: sourceWalletAfter.recharge.toString(),
          totalSpent: sourceWalletAfter.totalSpent.toString(),
          loyaltyPoints: sourceWalletAfter.loyaltyPoints.toString(),
        },
        targetWalletAfter: {
          totalBalance: targetWalletAfter.totalBalance.toString(),
          income: targetWalletAfter.income.toString(),
          recharge: targetWalletAfter.recharge.toString(),
          totalSpent: targetWalletAfter.totalSpent.toString(),
          loyaltyPoints: targetWalletAfter.loyaltyPoints.toString(),
        },
      },
      changed,
      warnings,
    },
    select: { id: true },
  });

  return {
    auditId: audit.id,
    source: sourceSummaryAfter,
    target: targetSummaryAfter,
    transferred: {
      totalBalance: sourceWalletBefore.totalBalance.toString(),
      income: sourceWalletBefore.income.toString(),
      recharge: sourceWalletBefore.recharge.toString(),
      totalSpent: sourceWalletBefore.totalSpent.toString(),
      loyaltyPoints: sourceWalletBefore.loyaltyPoints.toString(),
      vipLevelAfter: derivedTargetVipLevel,
    },
    changed,
    warnings,
  };
};
