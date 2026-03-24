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

const positiveDecimal = (value: string | number | Prisma.Decimal) => {
  const decimal = DEC(value);
  if (!decimal.isFinite() || decimal.lte(ZERO)) {
    return null;
  }
  return decimal;
};

type FarmPlotStatus = 'EMPTY' | 'GROWING' | 'READY';

export type FarmDashboard = {
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

function serializeDashboard(params: {
  profile: {
    coins: Prisma.Decimal;
    experience: number;
    unlockedPlots: number;
    plots: Array<{
      plotIndex: number;
      seedType: FarmSeedType | null;
      plantedAt: Date | null;
      readyAt: Date | null;
    }>;
    logs: Array<{
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
  member: { totalBalance: Prisma.Decimal; loyaltyPoints: Prisma.Decimal };
}) {
  const { profile, member } = params;
  const experience = Number(profile.experience ?? 0);
  const level = getFarmLevel(experience);
  const nextLevelExperience = getNextFarmLevelExperience(experience);
  const nextPlotCost =
    profile.unlockedPlots < MAX_PLOTS ? DEC(PLOT_UNLOCK_COSTS[profile.unlockedPlots + 1] ?? 0).toFixed(2) : null;
  const now = Date.now();

  return {
    summary: {
      coins: DEC(profile.coins ?? 0).toFixed(2),
      experience,
      level,
      nextLevelExperience,
      unlockedPlots: profile.unlockedPlots,
      nextPlotCost,
      totalBalance: DEC(member.totalBalance ?? 0).toFixed(2),
      loyaltyPoints: DEC(member.loyaltyPoints ?? 0).toFixed(2),
    },
    plots: profile.plots.map((plot) => {
      const readyAtMs = plot.readyAt?.getTime() ?? null;
      const status: FarmPlotStatus = !plot.seedType
        ? 'EMPTY'
        : readyAtMs != null && readyAtMs <= now
          ? 'READY'
          : 'GROWING';
      const remainingSeconds =
        status === 'GROWING' && readyAtMs != null ? Math.max(0, Math.ceil((readyAtMs - now) / 1000)) : 0;
      return {
        plotIndex: plot.plotIndex,
        status,
        seedType: plot.seedType as FarmSeedTypeValue | null,
        plantedAt: plot.plantedAt?.toISOString() ?? null,
        readyAt: plot.readyAt?.toISOString() ?? null,
        remainingSeconds,
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
    recentLogs: profile.logs.map((log) => ({
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

async function loadFarmDashboardTx(tx: Prisma.TransactionClient, discordUserId: string) {
  const member = await tx.member.findUnique({
    where: { discordUserId },
    select: {
      totalBalance: true,
      loyaltyPoint: {
        select: { points: true },
      },
    },
  });

  if (!member) {
    throw new Error('未找到成员资料');
  }

  const profile = await ensureFarmProfileTx(tx, discordUserId);
  const fullProfile = await tx.farmProfile.findUniqueOrThrow({
    where: { discordUserId },
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
    member: {
      totalBalance: DEC(member.totalBalance ?? 0),
      loyaltyPoints: DEC(member.loyaltyPoint?.points ?? 0),
    },
  });
}

export async function getFarmDashboard(discordUserId: string) {
  return prisma.$transaction((tx) => loadFarmDashboardTx(tx, discordUserId));
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

    const profile = await ensureFarmProfileTx(tx, discordUserId);
    await tx.farmProfile.update({
      where: { discordUserId: profile.discordUserId },
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

    return loadFarmDashboardTx(tx, discordUserId);
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

    const profile = await ensureFarmProfileTx(tx, discordUserId);
    await tx.farmProfile.update({
      where: { discordUserId: profile.discordUserId },
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

    return loadFarmDashboardTx(tx, discordUserId);
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

    return loadFarmDashboardTx(tx, discordUserId);
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

    return loadFarmDashboardTx(tx, discordUserId);
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
    const yieldCoins =
      seed.minYieldCoins +
      Math.floor(Math.random() * (seed.maxYieldCoins - seed.minYieldCoins + 1));

    await tx.farmProfile.update({
      where: { discordUserId },
      data: {
        coins: { increment: DEC(yieldCoins) },
        experience: { increment: seed.experience },
      },
    });
    await tx.farmPlot.update({
      where: { discordUserId_plotIndex: { discordUserId, plotIndex } },
      data: {
        seedType: null,
        plantedAt: null,
        readyAt: null,
        lastHarvestAt: now,
      },
    });
    await tx.farmActionLog.create({
      data: {
        discordUserId,
        actionType: FarmActionType.HARVEST,
        plotIndex,
        seedType: plot.seedType,
        coinDelta: DEC(yieldCoins),
        expDelta: seed.experience,
        note: `收获 ${seed.name}`,
      },
    });

    return loadFarmDashboardTx(tx, discordUserId);
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

    return loadFarmDashboardTx(tx, discordUserId);
  });
}
