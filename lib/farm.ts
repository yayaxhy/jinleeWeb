import { FarmActionType, FarmSeedType, Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import {
  BALANCE_TO_COINS_RATE,
  COINS_TO_POINTS_RATE,
  FARM_SEEDS,
  FARM_SEED_ORDER,
  getFarmLevel,
  getNextFarmLevelExperience,
  INITIAL_PLOTS,
  MAX_PLOTS,
  PLOT_UNLOCK_COSTS,
  POINTS_TO_COINS_RATE,
  type FarmSeedTypeValue,
} from '@/lib/farmConfig';

const DEC = (value: Prisma.Decimal | number | string) => new Prisma.Decimal(value);
const ZERO = DEC(0);
const FARM_COUNTERPART_ID = 'farm-system';
const FARM_STEAL_RATE = 0.05;

type FarmPlotStatus = 'EMPTY' | 'GROWING' | 'READY';
type FarmGrowthStage = 'SPROUT' | 'YOUNG' | 'MATURE' | 'READY';

const positiveDecimal = (value: string | number | Prisma.Decimal) => {
  const decimal = DEC(value);
  if (!decimal.isFinite() || decimal.lte(ZERO)) {
    return null;
  }
  return decimal;
};

export type FarmDashboard = {
  owner: {
    discordUserId: string;
    displayName: string;
    peiwanId: number | null;
    isSelf: boolean;
  };
  summary: {
    coins: string;
    experience: number;
    level: number;
    nextLevelExperience: number | null;
    unlockedPlots: number;
    nextPlotCost: string | null;
    totalBalance: string;
    loyaltyPoints: string;
  };
  plots: Array<{
    plotIndex: number;
    status: FarmPlotStatus;
    seedType: FarmSeedTypeValue | null;
    plantedAt: string | null;
    readyAt: string | null;
    remainingSeconds: number;
    progressRatio: number;
    growthStage: FarmGrowthStage;
    stolenCoins: string;
    stolenBy: string | null;
    canSteal: boolean;
  }>;
  seeds: Array<{
    code: FarmSeedTypeValue;
    name: string;
    emoji: string;
    description: string;
    costCoins: string;
    minYieldCoins: string;
    maxYieldCoins: string;
    experience: number;
    durationMinutes: number;
    unlockLevel: number;
    unlocked: boolean;
  }>;
  recentLogs: Array<{
    id: string;
    actionType: FarmActionType;
    plotIndex: number | null;
    seedType: FarmSeedTypeValue | null;
    balanceDelta: string;
    pointDelta: string;
    coinDelta: string;
    expDelta: number;
    note: string | null;
    createdAt: string;
  }>;
};

type FarmProfileWithRelations = Awaited<ReturnType<typeof ensureFarmProfileTx>> & {
  logs?: Array<{
    id: string;
    actionType: FarmActionType;
    plotIndex: number | null;
    seedType: FarmSeedType | null;
    balanceDelta: Prisma.Decimal;
    pointDelta: Prisma.Decimal;
    coinDelta: Prisma.Decimal;
    expDelta: number;
    note: string | null;
    createdAt: Date;
  }>;
};

async function ensureFarmProfileTx(tx: Prisma.TransactionClient, discordUserId: string) {
  const existing = await tx.farmProfile.findUnique({
    where: { discordUserId },
    include: {
      plots: {
        orderBy: { plotIndex: 'asc' },
      },
    },
  });

  if (!existing) {
    await tx.farmProfile.create({
      data: {
        discordUserId,
        unlockedPlots: INITIAL_PLOTS,
        plots: {
          create: Array.from({ length: INITIAL_PLOTS }, (_, index) => ({
            plotIndex: index + 1,
          })),
        },
      },
    });
  } else {
    const existingIndexes = new Set(existing.plots.map((plot) => plot.plotIndex));
    const missingIndexes: number[] = [];
    for (let plotIndex = 1; plotIndex <= existing.unlockedPlots; plotIndex += 1) {
      if (!existingIndexes.has(plotIndex)) {
        missingIndexes.push(plotIndex);
      }
    }
    if (missingIndexes.length > 0) {
      await tx.farmPlot.createMany({
        data: missingIndexes.map((plotIndex) => ({
          discordUserId,
          plotIndex,
        })),
      });
    }
  }

  return tx.farmProfile.findUniqueOrThrow({
    where: { discordUserId },
    include: {
      plots: {
        orderBy: { plotIndex: 'asc' },
      },
    },
  });
}

function getOwnerDisplayName(owner: {
  discordUserId: string;
  serverDisplayName: string | null;
  peiwan: { PEIWANID: number; serverDisplayName: string | null } | null;
}) {
  return owner.peiwan?.serverDisplayName ?? owner.serverDisplayName ?? owner.discordUserId;
}

function getGrowthStage(plot: {
  seedType: FarmSeedType | null;
  plantedAt: Date | null;
  readyAt: Date | null;
}, nowMs: number): { progressRatio: number; growthStage: FarmGrowthStage; status: FarmPlotStatus; remainingSeconds: number } {
  if (!plot.seedType || !plot.plantedAt || !plot.readyAt) {
    return { progressRatio: 0, growthStage: 'SPROUT', status: 'EMPTY', remainingSeconds: 0 };
  }

  const plantedAtMs = plot.plantedAt.getTime();
  const readyAtMs = plot.readyAt.getTime();
  const totalMs = Math.max(1, readyAtMs - plantedAtMs);
  const elapsedMs = Math.max(0, Math.min(totalMs, nowMs - plantedAtMs));
  const progressRatio = Math.max(0, Math.min(1, elapsedMs / totalMs));
  const isReady = readyAtMs <= nowMs;
  const remainingSeconds = isReady ? 0 : Math.max(0, Math.ceil((readyAtMs - nowMs) / 1000));

  if (isReady) {
    return { progressRatio: 1, growthStage: 'READY', status: 'READY', remainingSeconds };
  }
  if (progressRatio < 0.34) {
    return { progressRatio, growthStage: 'SPROUT', status: 'GROWING', remainingSeconds };
  }
  if (progressRatio < 0.68) {
    return { progressRatio, growthStage: 'YOUNG', status: 'GROWING', remainingSeconds };
  }
  return { progressRatio, growthStage: 'MATURE', status: 'GROWING', remainingSeconds };
}

function serializeDashboard(params: {
  profile: FarmProfileWithRelations;
  owner: {
    discordUserId: string;
    totalBalance: Prisma.Decimal;
    loyaltyPoints: Prisma.Decimal;
    serverDisplayName: string | null;
    peiwan: { PEIWANID: number; serverDisplayName: string | null } | null;
  };
  viewerDiscordId: string;
}) {
  const { profile, owner, viewerDiscordId } = params;
  const experience = Number(profile.experience ?? 0);
  const level = getFarmLevel(experience);
  const nextLevelExperience = getNextFarmLevelExperience(experience);
  const nextPlotCost =
    profile.unlockedPlots < MAX_PLOTS ? DEC(PLOT_UNLOCK_COSTS[profile.unlockedPlots + 1] ?? 0).toFixed(2) : null;
  const now = Date.now();
  const ownerDisplayName = getOwnerDisplayName(owner);

  return {
    owner: {
      discordUserId: owner.discordUserId,
      displayName: ownerDisplayName,
      peiwanId: owner.peiwan?.PEIWANID ?? null,
      isSelf: owner.discordUserId === viewerDiscordId,
    },
    summary: {
      coins: DEC(profile.coins ?? 0).toFixed(2),
      experience,
      level,
      nextLevelExperience,
      unlockedPlots: profile.unlockedPlots,
      nextPlotCost,
      totalBalance: DEC(owner.totalBalance ?? 0).toFixed(2),
      loyaltyPoints: DEC(owner.loyaltyPoints ?? 0).toFixed(2),
    },
    plots: profile.plots.map((plot) => {
      const growth = getGrowthStage(plot, now);
      return {
        plotIndex: plot.plotIndex,
        status: growth.status,
        seedType: plot.seedType as FarmSeedTypeValue | null,
        plantedAt: plot.plantedAt?.toISOString() ?? null,
        readyAt: plot.readyAt?.toISOString() ?? null,
        remainingSeconds: growth.remainingSeconds,
        progressRatio: growth.progressRatio,
        growthStage: growth.growthStage,
        stolenCoins: DEC(plot.stolenCoins ?? 0).toFixed(2),
        stolenBy: plot.lastStolenBy ?? null,
        canSteal:
          owner.discordUserId !== viewerDiscordId &&
          growth.status === 'READY' &&
          DEC(plot.stolenCoins ?? 0).eq(ZERO) &&
          !plot.lastStolenAt,
      };
    }),
    seeds: FARM_SEED_ORDER.map((seedCode) => {
      const seed = FARM_SEEDS[seedCode];
      return {
        code: seed.code,
        name: seed.name,
        emoji: seed.emoji,
        description: seed.description,
        costCoins: DEC(seed.costCoins).toFixed(2),
        minYieldCoins: DEC(seed.minYieldCoins).toFixed(2),
        maxYieldCoins: DEC(seed.maxYieldCoins).toFixed(2),
        experience: seed.experience,
        durationMinutes: seed.durationMinutes,
        unlockLevel: seed.unlockLevel,
        unlocked: level >= seed.unlockLevel,
      };
    }),
    recentLogs: (profile.logs ?? []).map((log) => ({
      id: log.id,
      actionType: log.actionType,
      plotIndex: log.plotIndex,
      seedType: log.seedType as FarmSeedTypeValue | null,
      balanceDelta: DEC(log.balanceDelta ?? 0).toFixed(2),
      pointDelta: DEC(log.pointDelta ?? 0).toFixed(2),
      coinDelta: DEC(log.coinDelta ?? 0).toFixed(2),
      expDelta: log.expDelta,
      note: log.note ?? null,
      createdAt: log.createdAt.toISOString(),
    })),
  } satisfies FarmDashboard;
}

async function loadFarmDashboardTx(
  tx: Prisma.TransactionClient,
  ownerDiscordId: string,
  viewerDiscordId = ownerDiscordId,
) {
  const owner = await tx.member.findUnique({
    where: { discordUserId: ownerDiscordId },
    select: {
      discordUserId: true,
      totalBalance: true,
      serverDisplayName: true,
      peiwan: {
        select: {
          PEIWANID: true,
          serverDisplayName: true,
        },
      },
      loyaltyPoint: {
        select: { points: true },
      },
    },
  });

  if (!owner) {
    throw new Error('未找到成员资料');
  }

  await ensureFarmProfileTx(tx, ownerDiscordId);
  const fullProfile = await tx.farmProfile.findUniqueOrThrow({
    where: { discordUserId: ownerDiscordId },
    include: {
      plots: { orderBy: { plotIndex: 'asc' } },
      logs: {
        orderBy: { createdAt: 'desc' },
        take: 10,
      },
    },
  });

  return serializeDashboard({
    profile: fullProfile,
    owner: {
      discordUserId: owner.discordUserId,
      totalBalance: DEC(owner.totalBalance ?? 0),
      loyaltyPoints: DEC(owner.loyaltyPoint?.points ?? 0),
      serverDisplayName: owner.serverDisplayName ?? null,
      peiwan: owner.peiwan,
    },
    viewerDiscordId,
  });
}

export async function getFarmDashboard(ownerDiscordId: string, viewerDiscordId = ownerDiscordId) {
  return prisma.$transaction((tx) => loadFarmDashboardTx(tx, ownerDiscordId, viewerDiscordId));
}

export async function exchangeBalanceToCoins(discordUserId: string, amount: string | number) {
  const balanceAmount = positiveDecimal(amount);
  if (!balanceAmount) throw new Error('请输入有效的余额数量');

  return prisma.$transaction(async (tx) => {
    const member = await tx.member.findUnique({
      where: { discordUserId },
      select: { totalBalance: true },
    });
    if (!member) throw new Error('未找到成员资料');
    const totalBalance = DEC(member.totalBalance ?? 0);
    if (totalBalance.lt(balanceAmount)) {
      throw new Error('总余额不足');
    }

    const coinDelta = balanceAmount.mul(BALANCE_TO_COINS_RATE);
    const balanceAfter = totalBalance.sub(balanceAmount);
    await tx.member.update({
      where: { discordUserId },
      data: { totalBalance: { decrement: balanceAmount } },
    });

    await ensureFarmProfileTx(tx, discordUserId);
    await tx.farmProfile.update({
      where: { discordUserId },
      data: { coins: { increment: coinDelta } },
    });

    await tx.individualTransaction.create({
      data: {
        discordId: discordUserId,
        thirdPartydiscordId: FARM_COUNTERPART_ID,
        balanceBefore: totalBalance,
        amountChange: balanceAmount.negated(),
        balanceAfter,
        typeOfTransaction: '农场兑换金币',
      },
    });

    await tx.farmActionLog.create({
      data: {
        discordUserId,
        actionType: FarmActionType.BALANCE_TO_COINS,
        balanceDelta: balanceAmount.negated(),
        coinDelta,
        note: `余额兑换金币 ${balanceAmount.toFixed(2)} -> ${coinDelta.toFixed(2)}`,
      },
    });

    return loadFarmDashboardTx(tx, discordUserId, discordUserId);
  });
}

export async function exchangePointsToCoins(discordUserId: string, amount: string | number) {
  const pointAmount = positiveDecimal(amount);
  if (!pointAmount) throw new Error('请输入有效的积分数量');

  return prisma.$transaction(async (tx) => {
    const loyaltyPoint = await tx.loyaltyPoint.upsert({
      where: { discordUserId },
      create: { discordUserId, points: ZERO },
      update: {},
      select: { points: true },
    });
    const currentPoints = DEC(loyaltyPoint.points ?? 0);
    if (currentPoints.lt(pointAmount)) {
      throw new Error('锦鲤积分不足');
    }

    const coinDelta = pointAmount.mul(POINTS_TO_COINS_RATE);
    await tx.loyaltyPoint.update({
      where: { discordUserId },
      data: { points: { decrement: pointAmount } },
    });

    await ensureFarmProfileTx(tx, discordUserId);
    await tx.farmProfile.update({
      where: { discordUserId },
      data: { coins: { increment: coinDelta } },
    });

    await tx.farmActionLog.create({
      data: {
        discordUserId,
        actionType: FarmActionType.POINTS_TO_COINS,
        pointDelta: pointAmount.negated(),
        coinDelta,
        note: `积分兑换金币 ${pointAmount.toFixed(2)} -> ${coinDelta.toFixed(2)}`,
      },
    });

    return loadFarmDashboardTx(tx, discordUserId, discordUserId);
  });
}

export async function exchangeCoinsToPoints(discordUserId: string, amount: string | number) {
  const coinAmount = positiveDecimal(amount);
  if (!coinAmount) throw new Error('请输入有效的金币数量');

  return prisma.$transaction(async (tx) => {
    const profile = await ensureFarmProfileTx(tx, discordUserId);
    const currentCoins = DEC(profile.coins ?? 0);
    if (currentCoins.lt(coinAmount)) {
      throw new Error('金币不足');
    }

    const pointDelta = coinAmount.mul(COINS_TO_POINTS_RATE);
    await tx.farmProfile.update({
      where: { discordUserId },
      data: { coins: { decrement: coinAmount } },
    });
    await tx.loyaltyPoint.upsert({
      where: { discordUserId },
      create: {
        discordUserId,
        points: pointDelta,
      },
      update: {
        points: { increment: pointDelta },
      },
    });
    await tx.farmActionLog.create({
      data: {
        discordUserId,
        actionType: FarmActionType.COINS_TO_POINTS,
        pointDelta,
        coinDelta: coinAmount.negated(),
        note: `金币兑换积分 ${coinAmount.toFixed(2)} -> ${pointDelta.toFixed(2)}`,
      },
    });

    return loadFarmDashboardTx(tx, discordUserId, discordUserId);
  });
}

export async function plantFarmSeed(
  discordUserId: string,
  plotIndex: number,
  seedType: FarmSeedTypeValue,
) {
  const seed = FARM_SEEDS[seedType];
  if (!seed) throw new Error('未知种子');
  if (!Number.isInteger(plotIndex) || plotIndex < 1) throw new Error('地块编号无效');

  return prisma.$transaction(async (tx) => {
    const profile = await ensureFarmProfileTx(tx, discordUserId);
    const level = getFarmLevel(profile.experience);
    if (level < seed.unlockLevel) {
      throw new Error(`庄园等级不足，${seed.name} 需要 Lv.${seed.unlockLevel}`);
    }
    if (plotIndex > profile.unlockedPlots) {
      throw new Error('该地块尚未解锁');
    }

    const plot = profile.plots.find((item) => item.plotIndex === plotIndex);
    if (!plot) {
      throw new Error('未找到对应地块');
    }
    if (plot.seedType) {
      throw new Error('该地块正在种植中，请先收获');
    }

    const currentCoins = DEC(profile.coins ?? 0);
    const cost = DEC(seed.costCoins);
    if (currentCoins.lt(cost)) {
      throw new Error('金币不足');
    }

    const now = new Date();
    const readyAt = new Date(now.getTime() + seed.durationMinutes * 60 * 1000);
    await tx.farmProfile.update({
      where: { discordUserId },
      data: { coins: { decrement: cost } },
    });
    await tx.farmPlot.update({
      where: { discordUserId_plotIndex: { discordUserId, plotIndex } },
      data: {
        seedType: seedType as FarmSeedType,
        plantedAt: now,
        readyAt,
        lastStolenAt: null,
        lastStolenBy: null,
        stolenCoins: ZERO,
      },
    });
    await tx.farmActionLog.create({
      data: {
        discordUserId,
        actionType: FarmActionType.PLANT,
        plotIndex,
        seedType: seedType as FarmSeedType,
        coinDelta: cost.negated(),
        note: `种植 ${seed.name}`,
      },
    });

    return loadFarmDashboardTx(tx, discordUserId, discordUserId);
  });
}

export async function harvestFarmPlot(discordUserId: string, plotIndex: number) {
  if (!Number.isInteger(plotIndex) || plotIndex < 1) throw new Error('地块编号无效');

  return prisma.$transaction(async (tx) => {
    const profile = await ensureFarmProfileTx(tx, discordUserId);
    const plot = profile.plots.find((item) => item.plotIndex === plotIndex);
    if (!plot || !plot.seedType || !plot.readyAt) {
      throw new Error('该地块没有可收获作物');
    }

    const now = new Date();
    if (plot.readyAt.getTime() > now.getTime()) {
      throw new Error('作物尚未成熟');
    }

    const seed = FARM_SEEDS[plot.seedType as FarmSeedTypeValue];
    const rawYield =
      seed.minYieldCoins +
      Math.floor(Math.random() * (seed.maxYieldCoins - seed.minYieldCoins + 1));
    const stolenCoins = DEC(plot.stolenCoins ?? 0);
    const netYieldRaw = DEC(rawYield).sub(stolenCoins);
    const netYield = netYieldRaw.lessThan(ZERO) ? ZERO : netYieldRaw;

    await tx.farmProfile.update({
      where: { discordUserId },
      data: {
        coins: { increment: netYield },
        experience: { increment: seed.experience },
      },
    });
    await tx.farmPlot.update({
      where: { discordUserId_plotIndex: { discordUserId, plotIndex } },
      data: {
        seedType: null,
        plantedAt: null,
        readyAt: null,
        lastStolenAt: null,
        lastStolenBy: null,
        stolenCoins: ZERO,
        lastHarvestAt: now,
      },
    });
    await tx.farmActionLog.create({
      data: {
        discordUserId,
        actionType: FarmActionType.HARVEST,
        plotIndex,
        seedType: plot.seedType,
        coinDelta: netYield,
        expDelta: seed.experience,
        note: stolenCoins.gt(ZERO)
          ? `收获 ${seed.name}（被偷 ${stolenCoins.toFixed(2)} 金币）`
          : `收获 ${seed.name}`,
      },
    });

    return {
      dashboard: await loadFarmDashboardTx(tx, discordUserId, discordUserId),
      harvestCoins: netYield.toFixed(2),
      stolenCoins: stolenCoins.toFixed(2),
      experience: seed.experience,
      seedName: seed.name,
    };
  });
}

export async function expandFarm(discordUserId: string) {
  return prisma.$transaction(async (tx) => {
    const profile = await ensureFarmProfileTx(tx, discordUserId);
    if (profile.unlockedPlots >= MAX_PLOTS) {
      throw new Error('已达到最大地块数量');
    }

    const targetPlots = profile.unlockedPlots + 1;
    const cost = DEC(PLOT_UNLOCK_COSTS[targetPlots] ?? 0);
    const currentCoins = DEC(profile.coins ?? 0);
    if (currentCoins.lt(cost)) {
      throw new Error('金币不足，无法扩地');
    }

    await tx.farmProfile.update({
      where: { discordUserId },
      data: {
        coins: { decrement: cost },
        unlockedPlots: targetPlots,
      },
    });
    await tx.farmPlot.create({
      data: {
        discordUserId,
        plotIndex: targetPlots,
      },
    });
    await tx.farmActionLog.create({
      data: {
        discordUserId,
        actionType: FarmActionType.EXPAND,
        plotIndex: targetPlots,
        coinDelta: cost.negated(),
        note: `解锁第 ${targetPlots} 块地`,
      },
    });

    return loadFarmDashboardTx(tx, discordUserId, discordUserId);
  });
}

export async function stealFarmPlot(viewerDiscordId: string, targetDiscordId: string, plotIndex: number) {
  if (!Number.isInteger(plotIndex) || plotIndex < 1) throw new Error('地块编号无效');
  if (viewerDiscordId === targetDiscordId) throw new Error('不能偷自己的地');

  return prisma.$transaction(async (tx) => {
    const viewerProfile = await ensureFarmProfileTx(tx, viewerDiscordId);
    const viewerMember = await tx.member.findUnique({
      where: { discordUserId: viewerDiscordId },
      select: { discordUserId: true, serverDisplayName: true },
    });
    const targetMember = await tx.member.findUnique({
      where: { discordUserId: targetDiscordId },
      select: {
        discordUserId: true,
        serverDisplayName: true,
        peiwan: {
          select: { serverDisplayName: true },
        },
      },
    });

    if (!viewerMember || !targetMember) {
      throw new Error('未找到庄园主人');
    }

    const targetProfile = await ensureFarmProfileTx(tx, targetDiscordId);
    const plot = targetProfile.plots.find((item) => item.plotIndex === plotIndex);
    if (!plot || !plot.seedType || !plot.readyAt) {
      throw new Error('该地块没有可偷的作物');
    }
    if (plot.readyAt.getTime() > Date.now()) {
      throw new Error('作物尚未成熟');
    }
    if (plot.lastStolenAt || DEC(plot.stolenCoins ?? 0).gt(ZERO)) {
      throw new Error('这块地已经被偷过一次');
    }

    const seed = FARM_SEEDS[plot.seedType as FarmSeedTypeValue];
    const expectedYield = (seed.minYieldCoins + seed.maxYieldCoins) / 2;
    const stolenCoins = DEC(Math.max(1, Math.floor(expectedYield * FARM_STEAL_RATE)));
    const now = new Date();
    const viewerName = viewerMember.serverDisplayName ?? viewerMember.discordUserId;
    const targetName = targetMember.peiwan?.serverDisplayName ?? targetMember.serverDisplayName ?? targetMember.discordUserId;

    await tx.farmProfile.update({
      where: { discordUserId: viewerProfile.discordUserId },
      data: { coins: { increment: stolenCoins } },
    });
    await tx.farmPlot.update({
      where: { discordUserId_plotIndex: { discordUserId: targetDiscordId, plotIndex } },
      data: {
        lastStolenAt: now,
        lastStolenBy: viewerDiscordId,
        stolenCoins,
      },
    });
    await tx.farmActionLog.createMany({
      data: [
        {
          discordUserId: viewerDiscordId,
          actionType: FarmActionType.STEAL,
          plotIndex,
          seedType: plot.seedType,
          coinDelta: stolenCoins,
          note: `从 ${targetName} 的第 ${plotIndex} 块地偷到 ${stolenCoins.toFixed(2)} 金币`,
        },
        {
          discordUserId: targetDiscordId,
          actionType: FarmActionType.STEAL,
          plotIndex,
          seedType: plot.seedType,
          coinDelta: stolenCoins.negated(),
          note: `${viewerName} 从第 ${plotIndex} 块地偷走 ${stolenCoins.toFixed(2)} 金币`,
        },
      ],
    });

    return {
      viewerDashboard: await loadFarmDashboardTx(tx, viewerDiscordId, viewerDiscordId),
      targetDashboard: await loadFarmDashboardTx(tx, targetDiscordId, viewerDiscordId),
      stolenCoins: stolenCoins.toFixed(2),
      targetName,
      seedName: seed.name,
    };
  });
}

