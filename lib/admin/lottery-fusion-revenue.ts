import {
  CouponStatus,
  PointShopDeliveryStatus,
  PointShopDeliveryType,
  Prisma,
} from '@prisma/client';
import { prisma } from '@/lib/prisma';
import {
  isLotteryFusionNonce,
  resolveLotteryFusionPoolFallback,
} from '@/lib/lottery-fusion';
import { COUPON_VOUCHER_META } from '@/lib/voucherCatalog';

const LOTTERY_FUSION_DRAW_NONCE_PREFIX = 'fusion:';

export type LotteryFusionCountBucket = '3' | '4' | '6' | 'other';
export type LotteryFusionSourceKind = 'lottery' | 'coupon' | 'pointshop';

export const LOTTERY_FUSION_COUNT_BUCKET_LABEL: Record<LotteryFusionCountBucket, string> = {
  '3': '3 个融合',
  '4': '4 个融合',
  '6': '6 个融合',
  other: '其他/历史',
};

export const LOTTERY_FUSION_SOURCE_KIND_LABEL: Record<LotteryFusionSourceKind, string> = {
  lottery: '抽奖奖品',
  coupon: 'Coupon 券',
  pointshop: 'PointShop 券',
};

type LotteryFusionCreatedOutputRow = {
  id?: string;
  requestId: string | null;
  pool: string;
};

type LotteryFusionOutstandingOutputRow = {
  pool: string;
};

type LotteryFusionSourceRow = {
  requestId: string | null;
  sourceKind: LotteryFusionSourceKind;
  pool: string;
  sourceNonce?: string | null;
};

export type LotteryFusionActivityBreakdown = {
  createdPoolBreakdown: Record<string, number>;
  activeOutstandingPoolBreakdown: Record<string, number>;
  fusionCountBreakdown: Record<LotteryFusionCountBucket, number>;
  sourcePoolBreakdown: Record<string, number>;
  sourceKindBreakdown: Record<LotteryFusionSourceKind, number>;
  rerolledLotteryInputCount: number;
  rerolledRequestCount: number;
  resultPoolByFusionCount: Record<LotteryFusionCountBucket, Record<string, number>>;
};

export type LotteryFusionRevenueSummary = {
  createdCount: number;
  consumedCount: number;
  realizedCost: Prisma.Decimal;
  activeOutstandingCount: number;
} & LotteryFusionActivityBreakdown;

const buildIdentityExclusion = (
  jinleeField: string,
  discordField: string | null,
  excludeJinleeIds: string[],
  excludeDiscordIds: string[],
) => {
  const clauses: Record<string, unknown>[] = [];
  if (excludeJinleeIds.length) {
    clauses.push({ [jinleeField]: { in: excludeJinleeIds } });
  }
  if (discordField && excludeDiscordIds.length) {
    clauses.push({ [discordField]: { in: excludeDiscordIds } });
  }
  return clauses.length ? { NOT: { OR: clauses } } : {};
};

const dec = (value: unknown) => {
  if (value instanceof Prisma.Decimal) return value;
  if (typeof value === 'string' || typeof value === 'number') {
    return new Prisma.Decimal(value);
  }
  if (typeof value === 'bigint') {
    return new Prisma.Decimal(value.toString());
  }
  if (value && typeof value === 'object' && 'toString' in value) {
    return new Prisma.Decimal((value as { toString: () => string }).toString());
  }
  return new Prisma.Decimal(0);
};

const incrementBreakdown = (breakdown: Record<string, number>, key?: string | null) => {
  const normalized = key?.trim();
  if (!normalized) return;
  breakdown[normalized] = (breakdown[normalized] ?? 0) + 1;
};

const createFusionCountBreakdown = <T>(buildValue: () => T): Record<LotteryFusionCountBucket, T> => ({
  '3': buildValue(),
  '4': buildValue(),
  '6': buildValue(),
  other: buildValue(),
});

const createSourceKindBreakdown = (): Record<LotteryFusionSourceKind, number> => ({
  lottery: 0,
  coupon: 0,
  pointshop: 0,
});

const resolveFusionCountBucket = (count: number): LotteryFusionCountBucket => {
  if (count === 3) return '3';
  if (count === 4) return '4';
  if (count === 6) return '6';
  return 'other';
};

type PrizeCatalogValue = {
  pool: string;
};

const buildPrizeCatalogByName = async (names: string[]) => {
  if (!names.length) return new Map<string, PrizeCatalogValue>();
  const prizes = await prisma.lotteryPrize.findMany({
    where: { name: { in: names } },
    select: {
      name: true,
      pool: true,
    },
  });
  return prizes.reduce((map, prize) => {
    map.set(prize.name, {
      pool: prize.pool,
    });
    return map;
  }, new Map<string, PrizeCatalogValue>());
};

const resolveSourcePool = (
  prizeName: string,
  prizeCatalogByName: Map<string, PrizeCatalogValue>,
) => {
  return prizeCatalogByName.get(prizeName)?.pool ?? resolveLotteryFusionPoolFallback(prizeName);
};

export const buildLotteryFusionActivityBreakdown = (params: {
  createdOutputs: LotteryFusionCreatedOutputRow[];
  outstandingOutputs: LotteryFusionOutstandingOutputRow[];
  sourceItems: LotteryFusionSourceRow[];
}): LotteryFusionActivityBreakdown => {
  const sourceItemsByRequestId = new Map<string, LotteryFusionSourceRow[]>();
  const sourcePoolBreakdown: Record<string, number> = {};
  const sourceKindBreakdown = createSourceKindBreakdown();
  let rerolledLotteryInputCount = 0;

  for (const source of params.sourceItems) {
    incrementBreakdown(sourcePoolBreakdown, source.pool);
    sourceKindBreakdown[source.sourceKind] += 1;

    if (source.sourceKind === 'lottery' && isLotteryFusionNonce(source.sourceNonce)) {
      rerolledLotteryInputCount += 1;
    }

    if (!source.requestId) {
      continue;
    }

    const current = sourceItemsByRequestId.get(source.requestId) ?? [];
    current.push(source);
    sourceItemsByRequestId.set(source.requestId, current);
  }

  const createdPoolBreakdown: Record<string, number> = {};
  const activeOutstandingPoolBreakdown: Record<string, number> = {};
  const fusionCountBreakdown = createFusionCountBreakdown(() => 0);
  const resultPoolByFusionCount = createFusionCountBreakdown(() => ({} as Record<string, number>));
  const rerolledRequestIds = new Set<string>();

  for (const output of params.createdOutputs) {
    incrementBreakdown(createdPoolBreakdown, output.pool);

    const sourceItems = output.requestId ? (sourceItemsByRequestId.get(output.requestId) ?? []) : [];
    const countBucket = resolveFusionCountBucket(sourceItems.length);
    fusionCountBreakdown[countBucket] += 1;
    incrementBreakdown(resultPoolByFusionCount[countBucket], output.pool);

    if (
      output.requestId &&
      sourceItems.some(
        (source) => source.sourceKind === 'lottery' && isLotteryFusionNonce(source.sourceNonce),
      )
    ) {
      rerolledRequestIds.add(output.requestId);
    }
  }

  for (const output of params.outstandingOutputs) {
    incrementBreakdown(activeOutstandingPoolBreakdown, output.pool);
  }

  return {
    createdPoolBreakdown,
    activeOutstandingPoolBreakdown,
    fusionCountBreakdown,
    sourcePoolBreakdown,
    sourceKindBreakdown,
    rerolledLotteryInputCount,
    rerolledRequestCount: rerolledRequestIds.size,
    resultPoolByFusionCount,
  };
};

export const getLotteryFusionRevenueSummary = async (params: {
  start: Date;
  end: Date;
  excludeJinleeIds: string[];
  excludeDiscordIds: string[];
  now?: Date;
}): Promise<LotteryFusionRevenueSummary> => {
  const { start, end, excludeJinleeIds, excludeDiscordIds, now = new Date() } = params;

  const createdWhere: Prisma.LotteryDrawWhereInput = {
    nonce: { startsWith: LOTTERY_FUSION_DRAW_NONCE_PREFIX },
    createdAt: { gte: start, lt: end },
    ...(buildIdentityExclusion(
      'jinleeId',
      'userId',
      excludeJinleeIds,
      excludeDiscordIds,
    ) as Prisma.LotteryDrawWhereInput),
  };

  const consumedWhere: Prisma.LotteryDrawWhereInput = {
    nonce: { startsWith: LOTTERY_FUSION_DRAW_NONCE_PREFIX },
    consumeAt: { gte: start, lt: end },
    ...(buildIdentityExclusion(
      'jinleeId',
      'userId',
      excludeJinleeIds,
      excludeDiscordIds,
    ) as Prisma.LotteryDrawWhereInput),
  };

  const activeOutstandingWhere: Prisma.LotteryDrawWhereInput = {
    nonce: { startsWith: LOTTERY_FUSION_DRAW_NONCE_PREFIX },
    status: 'UNUSED',
    consumeAt: null,
    OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    ...(buildIdentityExclusion(
      'jinleeId',
      'userId',
      excludeJinleeIds,
      excludeDiscordIds,
    ) as Prisma.LotteryDrawWhereInput),
  };

  const [createdOutputs, consumedAgg, outstandingOutputs] = await Promise.all([
    prisma.lotteryDraw.findMany({
      where: createdWhere,
      select: {
        id: true,
        requestId: true,
        pool: true,
      },
    }),
    prisma.lotteryDraw.aggregate({
      _count: { id: true },
      _sum: { consumeAmount: true },
      where: consumedWhere,
    }),
    prisma.lotteryDraw.findMany({
      where: activeOutstandingWhere,
      select: {
        pool: true,
      },
    }),
  ]);

  const requestIds = [
    ...new Set(
      createdOutputs
        .map((row) => row.requestId?.trim() ?? '')
        .filter((value): value is string => Boolean(value)),
    ),
  ];
  const outputIds = createdOutputs
    .map((row) => row.id?.trim() ?? '')
    .filter((value): value is string => Boolean(value));

  let sourceItems: LotteryFusionSourceRow[] = [];

  if (requestIds.length > 0) {
    const [sourceDraws, sourceCoupons, sourcePointShopGrants] = await Promise.all([
      prisma.lotteryDraw.findMany({
        where: {
          requestId: { in: requestIds },
          id: outputIds.length ? { notIn: outputIds } : undefined,
        },
        select: {
          requestId: true,
          pool: true,
          nonce: true,
        },
      }),
      prisma.coupon.findMany({
        where: {
          orderId: { in: requestIds },
          status: CouponStatus.USED,
        },
        select: {
          orderId: true,
          type: true,
        },
      }),
      prisma.pointShopGrant.findMany({
        where: {
          consumeOrderId: { in: requestIds },
          deliveryType: PointShopDeliveryType.COUPON,
          deliveryStatus: PointShopDeliveryStatus.DELIVERED,
          couponStatus: CouponStatus.USED,
        },
        select: {
          consumeOrderId: true,
          couponType: true,
          itemName: true,
        },
      }),
    ]);

    const couponPrizeNames = sourceCoupons.map(
      (coupon) => COUPON_VOUCHER_META[coupon.type]?.prizeName ?? coupon.type,
    );
    const pointShopPrizeNames = sourcePointShopGrants.map((grant) =>
      grant.couponType
        ? (COUPON_VOUCHER_META[grant.couponType]?.prizeName ?? grant.itemName.trim())
        : grant.itemName.trim(),
    );
    const prizeCatalogByName = await buildPrizeCatalogByName([
      ...new Set([...couponPrizeNames, ...pointShopPrizeNames].filter(Boolean)),
    ]);

    sourceItems = [
      ...sourceDraws.map((draw) => ({
        requestId: draw.requestId ?? null,
        sourceKind: 'lottery' as const,
        pool: draw.pool,
        sourceNonce: draw.nonce,
      })),
      ...sourceCoupons.map((coupon) => {
        const prizeName = COUPON_VOUCHER_META[coupon.type]?.prizeName ?? coupon.type;
        return {
          requestId: coupon.orderId ?? null,
          sourceKind: 'coupon' as const,
          pool: resolveSourcePool(prizeName, prizeCatalogByName),
        };
      }),
      ...sourcePointShopGrants.map((grant) => {
        const prizeName = grant.couponType
          ? (COUPON_VOUCHER_META[grant.couponType]?.prizeName ?? grant.itemName.trim())
          : grant.itemName.trim();
        return {
          requestId: grant.consumeOrderId ?? null,
          sourceKind: 'pointshop' as const,
          pool: resolveSourcePool(prizeName, prizeCatalogByName),
        };
      }),
    ];
  }

  const activity = buildLotteryFusionActivityBreakdown({
    createdOutputs,
    outstandingOutputs,
    sourceItems,
  });

  return {
    createdCount: createdOutputs.length,
    consumedCount: consumedAgg._count.id,
    realizedCost: dec(consumedAgg._sum.consumeAmount),
    activeOutstandingCount: outstandingOutputs.length,
    ...activity,
  };
};
