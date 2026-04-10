import { CouponStatus, CouponType, LotteryStatus, OrderStatus, PointShopDeliveryType, Prisma } from '@prisma/client';
import type { Prisma as PrismaNamespace } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { applyJinleeWalletDeltaTx, getJinleeWalletSnapshotTx } from '@/lib/jinlee-wallet';

export type DiscountKind = 'coupon' | 'lottery';

export type ApplyDiscountResult =
  | {
      status: 'applied';
      kind: DiscountKind;
      consumeAmount: Prisma.Decimal;
      couponId?: string;
      lotteryId?: string;
    }
  | { status: 'order_not_found' }
  | { status: 'not_order_host' }
  | { status: 'order_not_ended' }
  | { status: 'already_used' }
  | { status: 'no_coupon' }
  | { status: 'no_lottery' }
  | { status: 'no_fee' }
  | { status: 'insufficient_data' };

// Helpers (localized to avoid missing cross-repo deps)
const round2 = (value: Prisma.Decimal) => new Prisma.Decimal(value.toFixed(2));
const PRIZE_NAMES = {
  DISCOUNT_80: '8折券',
  DISCOUNT_70: '7折券',
  DISCOUNT_90_LOTTERY: '特殊9折券',
} as const;
const LEGACY_DISCOUNT_90_NAME = '特殊九折券';
const DISCOUNT_PRIZE_CONFIG: Record<string, { rate: Prisma.Decimal; cap: Prisma.Decimal }> = {
  [PRIZE_NAMES.DISCOUNT_70]: { rate: new Prisma.Decimal(0.3), cap: new Prisma.Decimal(150) },
  [PRIZE_NAMES.DISCOUNT_80]: { rate: new Prisma.Decimal(0.2), cap: new Prisma.Decimal(100) },
  [PRIZE_NAMES.DISCOUNT_90_LOTTERY]: { rate: new Prisma.Decimal(0.1), cap: new Prisma.Decimal(50) },
  [LEGACY_DISCOUNT_90_NAME]: { rate: new Prisma.Decimal(0.1), cap: new Prisma.Decimal(50) },
};

const suppressRechargeNotifications = async (_tx: PrismaNamespace.TransactionClient) => {
  // No-op placeholder; keep signature for compatibility.
  void _tx;
};

const recordIndividualTransaction = async (
  tx: PrismaNamespace.TransactionClient,
  data: {
    jinleeId: string;
    discordId?: string | null;
    thirdPartydiscordId: string;
    balanceBefore: Prisma.Decimal;
    amountChange: Prisma.Decimal;
    balanceAfter: Prisma.Decimal;
    typeOfTransaction: string;
    timeCreatedAt: Date;
  },
) => {
  await tx.individualTransaction.create({
    data: {
      discordId: data.discordId ?? null,
      jinleeId: data.jinleeId,
      thirdPartydiscordId: data.thirdPartydiscordId,
      balanceBefore: data.balanceBefore,
      amountChange: data.amountChange,
      balanceAfter: data.balanceAfter,
      typeOfTransaction: data.typeOfTransaction,
      timeCreatedAt: data.timeCreatedAt,
    },
  });
};

const COUPON_RATE = new Prisma.Decimal(0.1);
const COUPON_CAP = new Prisma.Decimal(20);
const FREE_MINUTES = 5;
const COUPON_RATE_CAP_BY_TYPE: Partial<Record<CouponType, { rate: Prisma.Decimal; cap: Prisma.Decimal }>> = {
  [CouponType.DISCOUNT_90]: { rate: COUPON_RATE, cap: COUPON_CAP },
  [CouponType.DISCOUNT_80]: DISCOUNT_PRIZE_CONFIG[PRIZE_NAMES.DISCOUNT_80],
  [CouponType.DISCOUNT_70]: DISCOUNT_PRIZE_CONFIG[PRIZE_NAMES.DISCOUNT_70],
  [CouponType.DISCOUNT_90_LOTTERY]: DISCOUNT_PRIZE_CONFIG[PRIZE_NAMES.DISCOUNT_90_LOTTERY],
};

type CouponSelectionCandidate = {
  id: string;
  source: 'coupon' | 'point_shop_coupon';
  expiresAt: Date;
  issuedAt: Date;
  couponType: CouponType;
};

const pickEarliestExpiryCouponCandidate = (
  candidates: Array<CouponSelectionCandidate | null>,
): CouponSelectionCandidate | null => {
  const available = candidates.filter((candidate): candidate is CouponSelectionCandidate => !!candidate);
  if (available.length === 0) return null;
  available.sort((left, right) => {
    const expireDelta = left.expiresAt.getTime() - right.expiresAt.getTime();
    if (expireDelta !== 0) return expireDelta;
    const issuedDelta = left.issuedAt.getTime() - right.issuedAt.getTime();
    if (issuedDelta !== 0) return issuedDelta;
    return left.id.localeCompare(right.id);
  });
  return available[0] ?? null;
};

const MAX_DISCOUNT_SELECTION_RETRIES = 10;

async function lockOrderForDiscountTx(tx: PrismaNamespace.TransactionClient, orderId: string) {
  await tx.$executeRaw`SELECT 1 FROM "Order" WHERE "id" = ${orderId} FOR UPDATE`;
}

async function consumeCouponCandidateTx(
  tx: PrismaNamespace.TransactionClient,
  params: {
    candidate: CouponSelectionCandidate;
    jinleeId: string;
    orderId: string;
    discountAmount: Prisma.Decimal;
    workerDiscordUserId: string | null;
    workerJinleeId: string | null;
    now: Date;
  },
) {
  const { candidate, jinleeId, orderId, discountAmount, workerDiscordUserId, workerJinleeId, now } = params;

  if (candidate.source === 'point_shop_coupon') {
    const result = await tx.pointShopGrant.updateMany({
      where: {
        id: candidate.id,
        jinleeId,
        deliveryType: PointShopDeliveryType.COUPON,
        couponType: candidate.couponType,
        couponStatus: CouponStatus.ACTIVE,
        expiresAt: { gt: now },
        consumedAt: null,
        consumeOrderId: null,
      },
      data: {
        consumedAt: now,
        consumeOrderId: orderId,
        consumeAmount: discountAmount,
        consumeTargetId: workerDiscordUserId,
        consumeTargetJinleeId: workerJinleeId,
        couponStatus: CouponStatus.USED,
      },
    });
    return result.count > 0;
  }

  const result = await tx.coupon.updateMany({
    where: {
      id: candidate.id,
      jinleeId,
      type: candidate.couponType,
      status: CouponStatus.ACTIVE,
      expiresAt: { gt: now },
      consumedAt: null,
      orderId: null,
    },
    data: {
      consumedAt: now,
      orderId,
      consumeAmount: discountAmount,
      consumeTargetId: workerDiscordUserId,
      consumeTargetJinleeId: workerJinleeId,
      status: CouponStatus.USED,
    },
  });
  return result.count > 0;
}

async function consumeLotteryVoucherTx(
  tx: PrismaNamespace.TransactionClient,
  params: {
    voucherId: string;
    jinleeId: string;
    orderId: string;
    prizeNames: string[];
    discountAmount: Prisma.Decimal;
    workerDiscordUserId: string | null;
    workerJinleeId: string | null;
    now: Date;
  },
) {
  const { voucherId, jinleeId, orderId, prizeNames, discountAmount, workerDiscordUserId, workerJinleeId, now } = params;
  const result = await tx.lotteryDraw.updateMany({
    where: {
      id: voucherId,
      jinleeId,
      status: LotteryStatus.UNUSED,
      expiresAt: { gt: now },
      consumeAt: null,
      consumeOrderId: null,
      prize: { name: { in: prizeNames } },
    },
    data: {
      status: LotteryStatus.USED,
      consumeAt: now,
      consumeAmount: discountAmount,
      consumeTargetId: workerDiscordUserId,
      consumeTargetJinleeId: workerJinleeId,
      consumeOrderId: orderId,
    },
  });
  return result.count > 0;
}

function computeDiscountAmount(params: {
  unitPrice: Prisma.Decimal;
  totalMinutes: number;
  rate: Prisma.Decimal;
  cap: Prisma.Decimal;
}) {
  const { unitPrice, totalMinutes, rate, cap } = params;
  if (totalMinutes <= FREE_MINUTES) return new Prisma.Decimal(0);

  const billableMinutes = Math.max(0, totalMinutes - FREE_MINUTES);
  if (billableMinutes <= 0) return new Prisma.Decimal(0);

  const perMinute = unitPrice.div(60);
  if (perMinute.lte(0)) return new Prisma.Decimal(0);

  let discount = round2(perMinute.mul(billableMinutes).mul(rate));
  if (discount.gt(cap)) discount = cap;
  return discount;
}

/**
 * Apply a discount for an ended order. Returns status codes for caller UI/API.
 */
export async function applyDiscountForOrder(params: {
  orderId: string;
  jinleeId: string;
  discordUserId?: string | null;
  kind: DiscountKind;
  lotteryId?: string;
  couponId?: string;
  now?: Date;
}): Promise<ApplyDiscountResult> {
  const { orderId, jinleeId, discordUserId, kind, lotteryId: targetLotteryId, couponId: targetCouponId } = params;
  const now = params.now ?? new Date();

  return prisma.$transaction(async (tx) => {
    let prizeRateCap: { rate: Prisma.Decimal; cap: Prisma.Decimal } | undefined;

    const order = await tx.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        hostId: true,
        hostJinleeId: true,
        workerId: true,
        status: true,
        unitPrice: true,
        totalMinutes: true,
      },
    });
    if (!order) return { status: 'order_not_found' };
    if ((order.hostJinleeId ?? null) !== jinleeId) return { status: 'not_order_host' };
    if (order.status !== OrderStatus.ENDED) return { status: 'order_not_ended' };
    await lockOrderForDiscountTx(tx, order.id);
    const workerTarget = order.workerId
      ? await tx.jinleeUser.findUnique({
          where: { discordUserId: order.workerId },
          select: { jinleeId: true },
        })
      : null;
    if (!order.unitPrice || order.totalMinutes == null) {
      return { status: 'insufficient_data' };
    }
    const unitPrice = new Prisma.Decimal(order.unitPrice);
    const totalMinutes = order.totalMinutes;

    // prevent reuse
    const [existingCouponUsage, existingPointShopCouponUsage, existingLotteryUsage] = await Promise.all([
      tx.coupon.findFirst({
        where: { orderId, status: 'USED' },
        select: { id: true },
      }),
      tx.pointShopGrant.findFirst({
        where: {
          consumeOrderId: orderId,
          jinleeId,
          deliveryType: PointShopDeliveryType.COUPON,
          couponStatus: CouponStatus.USED,
        },
        select: { id: true },
      }),
      tx.lotteryDraw.findFirst({
        where: {
          jinleeId,
          status: LotteryStatus.USED,
          consumeOrderId: orderId,
          prize: { name: { in: Object.keys(DISCOUNT_PRIZE_CONFIG) } },
        },
        select: { id: true },
      }),
    ]);
    if (existingCouponUsage || existingPointShopCouponUsage || existingLotteryUsage) {
      return { status: 'already_used' };
    }

    // expire outdated vouchers
    await tx.coupon.updateMany({
      where: { jinleeId, status: 'ACTIVE', expiresAt: { lte: now } },
      data: { status: 'EXPIRED' },
    });
    await tx.lotteryDraw.updateMany({
      where: {
        jinleeId,
        status: LotteryStatus.UNUSED,
        expiresAt: { lte: now },
        prize: { name: { in: Object.keys(DISCOUNT_PRIZE_CONFIG) } },
      },
      data: { status: LotteryStatus.EXPIRED },
    });

    let couponId: string | null = null;
    let couponSource: 'coupon' | 'point_shop_coupon' | null = null;
    let lotteryId: string | null = null;
    let appliedDiscountAmount: Prisma.Decimal | null = null;

    if (kind === 'coupon') {
      const discountCouponTypes = Object.keys(COUPON_RATE_CAP_BY_TYPE) as CouponType[];

      const findNextCouponCandidate = async (): Promise<CouponSelectionCandidate | null> => {
        if (targetCouponId) {
          const availableCoupon = await tx.coupon.findFirst({
            where: {
              id: targetCouponId,
              jinleeId,
              status: CouponStatus.ACTIVE,
              expiresAt: { gt: now },
              type: { in: discountCouponTypes },
            },
            select: { id: true, type: true, issuedAt: true, expiresAt: true },
          });

          if (availableCoupon) {
            return {
              id: availableCoupon.id,
              source: 'coupon',
              expiresAt: availableCoupon.expiresAt,
              issuedAt: availableCoupon.issuedAt,
              couponType: availableCoupon.type,
            };
          }

          const availablePointShopCoupon = await tx.pointShopGrant.findFirst({
            where: {
              id: targetCouponId,
              jinleeId,
              deliveryType: PointShopDeliveryType.COUPON,
              couponStatus: CouponStatus.ACTIVE,
              expiresAt: { gt: now },
              couponType: { in: discountCouponTypes },
            },
            select: { id: true, couponType: true, issuedAt: true, expiresAt: true },
          });

          return availablePointShopCoupon?.couponType && availablePointShopCoupon.expiresAt
            ? {
                id: availablePointShopCoupon.id,
                source: 'point_shop_coupon',
                expiresAt: availablePointShopCoupon.expiresAt,
                issuedAt: availablePointShopCoupon.issuedAt,
                couponType: availablePointShopCoupon.couponType,
              }
            : null;
        }

        const [availableCoupon, availablePointShopCoupon] = await Promise.all([
          tx.coupon.findFirst({
            where: {
              jinleeId,
              status: CouponStatus.ACTIVE,
              expiresAt: { gt: now },
              type: { in: discountCouponTypes },
            },
            orderBy: [{ expiresAt: 'asc' }, { issuedAt: 'asc' }],
            select: { id: true, type: true, issuedAt: true, expiresAt: true },
          }),
          tx.pointShopGrant.findFirst({
            where: {
              jinleeId,
              deliveryType: PointShopDeliveryType.COUPON,
              couponStatus: CouponStatus.ACTIVE,
              expiresAt: { gt: now },
              couponType: { in: discountCouponTypes },
            },
            orderBy: [{ expiresAt: 'asc' }, { issuedAt: 'asc' }],
            select: { id: true, couponType: true, issuedAt: true, expiresAt: true },
          }),
        ]);

        return pickEarliestExpiryCouponCandidate([
          availableCoupon
            ? {
                id: availableCoupon.id,
                source: 'coupon',
                expiresAt: availableCoupon.expiresAt,
                issuedAt: availableCoupon.issuedAt,
                couponType: availableCoupon.type,
              }
            : null,
          availablePointShopCoupon?.couponType && availablePointShopCoupon.expiresAt
            ? {
                id: availablePointShopCoupon.id,
                source: 'point_shop_coupon',
                expiresAt: availablePointShopCoupon.expiresAt,
                issuedAt: availablePointShopCoupon.issuedAt,
                couponType: availablePointShopCoupon.couponType,
              }
            : null,
        ]);
      };

      for (let attempt = 0; attempt < MAX_DISCOUNT_SELECTION_RETRIES; attempt++) {
        const selectedCoupon = await findNextCouponCandidate();
        if (!selectedCoupon) break;

        const candidateRateCap = COUPON_RATE_CAP_BY_TYPE[selectedCoupon.couponType];
        if (!candidateRateCap) {
          if (targetCouponId) break;
          continue;
        }
        const candidateDiscountAmount = computeDiscountAmount({
          unitPrice,
          totalMinutes,
          rate: candidateRateCap.rate,
          cap: candidateRateCap.cap,
        });
        if (candidateDiscountAmount.lte(0)) return { status: 'no_fee' };

        const consumed = await consumeCouponCandidateTx(tx, {
          candidate: selectedCoupon,
          jinleeId,
          orderId: order.id,
          discountAmount: candidateDiscountAmount,
          workerDiscordUserId: order.workerId ?? null,
          workerJinleeId: workerTarget?.jinleeId ?? null,
          now,
        });

        if (consumed) {
          couponId = selectedCoupon.id;
          couponSource = selectedCoupon.source;
          prizeRateCap = candidateRateCap;
          appliedDiscountAmount = candidateDiscountAmount;
          break;
        }

        if (targetCouponId) {
          break;
        }
      }

      if (!couponId || !couponSource) return { status: 'no_coupon' };
    } else {
      const prizeNames = Object.keys(DISCOUNT_PRIZE_CONFIG);

      for (let attempt = 0; attempt < MAX_DISCOUNT_SELECTION_RETRIES; attempt++) {
        const voucher = targetLotteryId
          ? await tx.lotteryDraw.findFirst({
              where: {
                id: targetLotteryId,
                jinleeId,
                status: LotteryStatus.UNUSED,
                expiresAt: { gt: now },
                prize: { name: { in: prizeNames } },
              },
              select: { id: true, prize: { select: { name: true } } },
            })
          : await tx.lotteryDraw.findFirst({
              where: {
                jinleeId,
                status: LotteryStatus.UNUSED,
                expiresAt: { gt: now },
                prize: { name: { in: prizeNames } },
              },
              select: { id: true, prize: { select: { name: true } } },
              orderBy: [{ expiresAt: 'asc' }, { createdAt: 'asc' }],
            });
        if (!voucher) break;

        const candidateRateCap = voucher.prize?.name ? DISCOUNT_PRIZE_CONFIG[voucher.prize.name] : undefined;
        if (!candidateRateCap) {
          if (targetLotteryId) break;
          continue;
        }

        const candidateDiscountAmount = computeDiscountAmount({
          unitPrice,
          totalMinutes,
          rate: candidateRateCap.rate,
          cap: candidateRateCap.cap,
        });
        if (candidateDiscountAmount.lte(0)) return { status: 'no_fee' };

        const consumed = await consumeLotteryVoucherTx(tx, {
          voucherId: voucher.id,
          jinleeId,
          orderId: order.id,
          prizeNames,
          discountAmount: candidateDiscountAmount,
          workerDiscordUserId: order.workerId ?? null,
          workerJinleeId: workerTarget?.jinleeId ?? null,
          now,
        });

        if (consumed) {
          lotteryId = voucher.id;
          prizeRateCap = candidateRateCap;
          appliedDiscountAmount = candidateDiscountAmount;
          break;
        }

        if (targetLotteryId) {
          break;
        }
      }

      if (!lotteryId) return { status: 'no_lottery' };
    }

    const rateCap =
      kind === 'coupon'
        ? prizeRateCap ?? { rate: COUPON_RATE, cap: COUPON_CAP }
        : prizeRateCap ?? DISCOUNT_PRIZE_CONFIG[PRIZE_NAMES.DISCOUNT_80];
    const discountAmount =
      appliedDiscountAmount ??
      computeDiscountAmount({
        unitPrice,
        totalMinutes,
        rate: rateCap.rate,
        cap: rateCap.cap,
      });
    if (discountAmount.lte(0)) return { status: 'no_fee' };

    await suppressRechargeNotifications(tx);
    const walletBefore = await getJinleeWalletSnapshotTx(tx, {
      jinleeId,
      discordUserId: discordUserId ?? null,
    });
    const balanceBefore = new Prisma.Decimal(walletBefore.totalBalance);

    const walletAfter = await applyJinleeWalletDeltaTx(tx, {
      jinleeId,
      discordUserId: discordUserId ?? null,
      rechargeDelta: discountAmount,
      totalBalanceDelta: discountAmount,
    });

    await recordIndividualTransaction(tx, {
      jinleeId,
      discordId: discordUserId ?? null,
      thirdPartydiscordId: order.workerId ?? 'SYSTEM',
      balanceBefore,
      amountChange: discountAmount,
      balanceAfter: new Prisma.Decimal(walletAfter.totalBalance),
      typeOfTransaction: '优惠返利',
      timeCreatedAt: now,
    });

    return {
      status: 'applied',
      kind,
      consumeAmount: discountAmount,
      couponId: couponId ?? undefined,
      lotteryId: lotteryId ?? undefined,
    };
  });
}
