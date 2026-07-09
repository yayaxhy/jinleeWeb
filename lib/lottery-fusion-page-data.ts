import {
  CouponStatus,
  LotteryPrizeType,
  LotteryStatus,
  PointShopDeliveryStatus,
  PointShopDeliveryType,
} from '@prisma/client';
import { getCurrentJinleeUser } from '@/lib/current-jinlee-user';
import {
  buildLotteryFusionHistoryEntries,
  buildLotteryFusionSourceRef,
  isLotteryFusionNonce,
  resolveLotteryFusionPoolFallback,
  type LotteryFusionHistoryEntry,
  type LotteryFusionHistorySourceShape,
} from '@/lib/lottery-fusion';
import { prisma } from '@/lib/prisma';
import { COUPON_VOUCHER_META, inferPrizeTypeByPrizeName } from '@/lib/voucherCatalog';
import type {
  FusionItemView,
  FusionMembershipView,
} from '@/components/profile/LotteryFusionClient';

const VIP_LEVELS = [
  { vipLevel: 1, threshold: 500 },
  { vipLevel: 2, threshold: 1500 },
  { vipLevel: 3, threshold: 3000 },
  { vipLevel: 4, threshold: 5000 },
  { vipLevel: 5, threshold: 10000 },
  { vipLevel: 6, threshold: 20000 },
  { vipLevel: 7, threshold: 50000 },
  { vipLevel: 8, threshold: 120000 },
  { vipLevel: 9, threshold: 210000 },
  { vipLevel: 10, threshold: 340000 },
  { vipLevel: 11, threshold: 520000 },
  { vipLevel: 12, threshold: 880000 },
] as const;

type PrizeCatalogValue = {
  pool: string;
  type: string;
  imageUrl: string | null;
};

const toNumber = (value: unknown) => {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
};

const buildPrizeCatalogByName = async (names: string[]) => {
  if (!names.length) return new Map<string, PrizeCatalogValue>();
  const prizes = await prisma.lotteryPrize.findMany({
    where: { name: { in: names } },
    select: {
      name: true,
      pool: true,
      type: true,
      imageUrl: true,
    },
  });
  return prizes.reduce((map, prize) => {
    map.set(prize.name, {
      pool: prize.pool,
      type: prize.type,
      imageUrl: prize.imageUrl ?? null,
    });
    return map;
  }, new Map<string, PrizeCatalogValue>());
};

const resolvePrizeCatalogValue = (
  prizeName: string,
  fallbackType: string,
  prizeCatalogByName: Map<string, PrizeCatalogValue>,
) => {
  const catalogValue = prizeCatalogByName.get(prizeName);
  return {
    pool: catalogValue?.pool ?? resolveLotteryFusionPoolFallback(prizeName),
    type: catalogValue?.type ?? fallbackType,
    imageUrl: catalogValue?.imageUrl ?? null,
  };
};

const buildMembership = (totalSpent: number): FusionMembershipView => {
  const currentLevel =
    [...VIP_LEVELS].reverse().find((item) => totalSpent >= item.threshold) ?? VIP_LEVELS[0];
  const previousThreshold =
    VIP_LEVELS.find((item) => item.vipLevel === currentLevel.vipLevel - 1)?.threshold ?? 0;
  const nextThreshold =
    VIP_LEVELS.find((item) => item.vipLevel === currentLevel.vipLevel + 1)?.threshold ??
    currentLevel.threshold;
  const progressBase = currentLevel.vipLevel === 1 ? 0 : previousThreshold;
  const progressRange = Math.max(1, nextThreshold - progressBase);
  const progressPercent = Math.max(
    0,
    Math.min(100, ((totalSpent - progressBase) / progressRange) * 100),
  );

  return {
    level: currentLevel.vipLevel,
    currentValue: totalSpent,
    nextValue: nextThreshold,
    progressPercent,
  };
};

export const getLotteryFusionPageData = async () => {
  const currentUser = await getCurrentJinleeUser();
  if (!currentUser) {
    return null;
  }

  const now = new Date();
  const [draws, coupons, pointShopGrants] = await Promise.all([
    prisma.lotteryDraw.findMany({
      where: {
        jinleeId: currentUser.jinleeId,
        status: LotteryStatus.UNUSED,
        consumeAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      include: {
        prize: {
          select: {
            id: true,
            name: true,
            pool: true,
            type: true,
            imageUrl: true,
          },
        },
      },
      take: 200,
    }),
    prisma.coupon.findMany({
      where: {
        jinleeId: currentUser.jinleeId,
        status: CouponStatus.ACTIVE,
        expiresAt: { gt: now },
        consumedAt: null,
      },
      orderBy: [{ issuedAt: 'desc' }, { id: 'desc' }],
      take: 200,
    }),
    prisma.pointShopGrant.findMany({
      where: {
        jinleeId: currentUser.jinleeId,
        deliveryType: PointShopDeliveryType.COUPON,
        deliveryStatus: PointShopDeliveryStatus.DELIVERED,
        couponStatus: CouponStatus.ACTIVE,
        consumedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      orderBy: [{ issuedAt: 'desc' }, { id: 'desc' }],
      take: 200,
    }),
  ]);

  const couponPrizeNames = coupons.map(
    (coupon) => COUPON_VOUCHER_META[coupon.type]?.prizeName ?? coupon.type,
  );
  const pointShopPrizeNames = pointShopGrants.map((grant) =>
    grant.couponType
      ? (COUPON_VOUCHER_META[grant.couponType]?.prizeName ?? grant.itemName.trim())
      : grant.itemName.trim(),
  );
  const prizeCatalogByName = await buildPrizeCatalogByName([
    ...new Set([...couponPrizeNames, ...pointShopPrizeNames].filter(Boolean)),
  ]);

  const drawItems: FusionItemView[] = draws
    .filter((draw) => draw.prize)
    .map((draw) => ({
      id: buildLotteryFusionSourceRef('lottery', draw.id),
      sourceKind: 'lottery',
      prizeName: draw.prize?.name ?? '未命名奖品',
      prizeType: draw.prize?.type ?? 'COUPON',
      pool: draw.prize?.pool ?? draw.pool,
      expiresAt: draw.expiresAt?.toISOString() ?? null,
      createdAt: draw.createdAt.toISOString(),
      imageUrl: draw.prize?.imageUrl ?? null,
    }));

  const couponItems: FusionItemView[] = coupons.map((coupon) => {
    const meta = COUPON_VOUCHER_META[coupon.type];
    const prizeName = meta?.prizeName ?? coupon.type;
    const resolved = resolvePrizeCatalogValue(
      prizeName,
      meta?.prizeType ?? LotteryPrizeType.COUPON,
      prizeCatalogByName,
    );
    return {
      id: buildLotteryFusionSourceRef('coupon', coupon.id),
      sourceKind: 'coupon',
      prizeName,
      prizeType: resolved.type,
      pool: resolved.pool,
      expiresAt: coupon.expiresAt?.toISOString() ?? null,
      createdAt: coupon.issuedAt.toISOString(),
      imageUrl: resolved.imageUrl,
    };
  });

  const pointShopItems: FusionItemView[] = pointShopGrants.map((grant) => {
    const prizeName = grant.couponType
      ? (COUPON_VOUCHER_META[grant.couponType]?.prizeName ?? grant.itemName.trim())
      : grant.itemName.trim();
    const fallbackType = grant.couponType
      ? (COUPON_VOUCHER_META[grant.couponType]?.prizeType ?? LotteryPrizeType.COUPON)
      : inferPrizeTypeByPrizeName(prizeName);
    const resolved = resolvePrizeCatalogValue(prizeName, fallbackType, prizeCatalogByName);
    return {
      id: buildLotteryFusionSourceRef('pointshop', grant.id),
      sourceKind: 'pointshop',
      prizeName,
      prizeType: resolved.type,
      pool: resolved.pool,
      expiresAt: grant.expiresAt?.toISOString() ?? null,
      createdAt: grant.issuedAt.toISOString(),
      imageUrl: resolved.imageUrl,
    };
  });

  return {
    initialItems: [...drawItems, ...couponItems, ...pointShopItems].sort(
      (left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt),
    ),
    membership: buildMembership(toNumber(currentUser.jinleeUser.totalSpent)),
  };
};

export const getLotteryFusionHistoryPageData = async (): Promise<{
  historyEntries: LotteryFusionHistoryEntry[];
} | null> => {
  const currentUser = await getCurrentJinleeUser();
  if (!currentUser) {
    return null;
  }

  const outputDraws = await prisma.lotteryDraw.findMany({
    where: {
      jinleeId: currentUser.jinleeId,
      nonce: { startsWith: 'fusion:' },
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    include: {
      prize: {
        select: {
          name: true,
          pool: true,
          type: true,
          imageUrl: true,
        },
      },
    },
    take: 100,
  });

  const requestIds = [
    ...new Set(
      outputDraws
        .map((draw) => draw.requestId)
        .filter((value): value is string => Boolean(value)),
    ),
  ];
  const outputIds = outputDraws.map((draw) => draw.id);
  const [sourceDraws, sourceCoupons, sourcePointShopGrants] =
    requestIds.length > 0
      ? await Promise.all([
          prisma.lotteryDraw.findMany({
            where: {
              jinleeId: currentUser.jinleeId,
              requestId: { in: requestIds },
              id: { notIn: outputIds },
            },
            orderBy: [{ consumeAt: 'desc' }, { id: 'desc' }],
            include: {
              prize: {
                select: {
                  name: true,
                  pool: true,
                  type: true,
                  imageUrl: true,
                },
              },
            },
            take: 600,
          }),
          prisma.coupon.findMany({
            where: {
              jinleeId: currentUser.jinleeId,
              orderId: { in: requestIds },
            },
            orderBy: [{ consumedAt: 'desc' }, { id: 'desc' }],
            take: 600,
          }),
          prisma.pointShopGrant.findMany({
            where: {
              jinleeId: currentUser.jinleeId,
              consumeOrderId: { in: requestIds },
            },
            orderBy: [{ consumedAt: 'desc' }, { id: 'desc' }],
            take: 600,
          }),
        ])
      : [[], [], []];

  const sourcePrizeCatalogByName = await buildPrizeCatalogByName([
    ...new Set(
      [
        ...sourceCoupons.map(
          (coupon) => COUPON_VOUCHER_META[coupon.type]?.prizeName ?? coupon.type,
        ),
        ...sourcePointShopGrants.map((grant) =>
          grant.couponType
            ? (COUPON_VOUCHER_META[grant.couponType]?.prizeName ?? grant.itemName.trim())
            : grant.itemName.trim(),
        ),
      ].filter(Boolean),
    ),
  ]);

  const historySourceItems: LotteryFusionHistorySourceShape[] = [
    ...sourceDraws.map((draw) => ({
      id: draw.id,
      requestId: draw.requestId ?? null,
      sourceKind: 'lottery' as const,
      createdAt: draw.createdAt,
      consumeAt: draw.consumeAt,
      pool: draw.prize?.pool ?? draw.pool,
      prizeName: draw.prize?.name ?? '未命名奖品',
      prizeType: draw.prize?.type ?? 'COUPON',
      imageUrl: draw.prize?.imageUrl ?? null,
    })),
    ...sourceCoupons.map((coupon) => {
      const prizeName = COUPON_VOUCHER_META[coupon.type]?.prizeName ?? coupon.type;
      const resolved = resolvePrizeCatalogValue(
        prizeName,
        COUPON_VOUCHER_META[coupon.type]?.prizeType ?? LotteryPrizeType.COUPON,
        sourcePrizeCatalogByName,
      );
      return {
        id: coupon.id,
        requestId: coupon.orderId ?? null,
        sourceKind: 'coupon' as const,
        createdAt: coupon.issuedAt,
        consumeAt: coupon.consumedAt,
        pool: resolved.pool,
        prizeName,
        prizeType: resolved.type,
        imageUrl: resolved.imageUrl,
      };
    }),
    ...sourcePointShopGrants.map((grant) => {
      const prizeName = grant.couponType
        ? (COUPON_VOUCHER_META[grant.couponType]?.prizeName ?? grant.itemName.trim())
        : grant.itemName.trim();
      const resolved = resolvePrizeCatalogValue(
        prizeName,
        grant.couponType
          ? (COUPON_VOUCHER_META[grant.couponType]?.prizeType ?? LotteryPrizeType.COUPON)
          : inferPrizeTypeByPrizeName(prizeName),
        sourcePrizeCatalogByName,
      );
      return {
        id: grant.id,
        requestId: grant.consumeOrderId ?? null,
        sourceKind: 'pointshop' as const,
        createdAt: grant.issuedAt,
        consumeAt: grant.consumedAt,
        pool: resolved.pool,
        prizeName,
        prizeType: resolved.type,
        imageUrl: resolved.imageUrl,
      };
    }),
  ];

  return {
    historyEntries: buildLotteryFusionHistoryEntries(
      outputDraws
        .filter((draw) => isLotteryFusionNonce(draw.nonce))
        .map((draw) => ({
          id: draw.id,
          requestId: draw.requestId ?? null,
          nonce: draw.nonce,
          createdAt: draw.createdAt,
          status: draw.status,
          expiresAt: draw.expiresAt,
          consumeAt: draw.consumeAt,
          pool: draw.prize?.pool ?? draw.pool,
          prizeName: draw.prize?.name ?? '未命名奖品',
          prizeType: draw.prize?.type ?? 'COUPON',
          imageUrl: draw.prize?.imageUrl ?? null,
        })),
      historySourceItems,
    ),
  };
};
