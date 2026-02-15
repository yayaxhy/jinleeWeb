import { CouponStatus, CouponType, LotteryStatus, OrderStatus, PointShopDeliveryType, Prisma } from '@prisma/client';
import type { Prisma as PrismaNamespace } from '@prisma/client';
import { prisma } from '@/lib/prisma';

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
    discordId: string;
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
      discordId: data.discordId,
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
  userId: string; // host id
  kind: DiscountKind;
  lotteryId?: string;
  couponId?: string;
  now?: Date;
}): Promise<ApplyDiscountResult> {
  const { orderId, userId, kind, lotteryId: targetLotteryId, couponId: targetCouponId } = params;
  const now = params.now ?? new Date();

  return prisma.$transaction(async (tx) => {
    let prizeRateCap: { rate: Prisma.Decimal; cap: Prisma.Decimal } | undefined;

    const order = await tx.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        hostId: true,
        workerId: true,
        status: true,
        unitPrice: true,
        totalMinutes: true,
      },
    });
    if (!order) return { status: 'order_not_found' };
    if (order.hostId !== userId) return { status: 'not_order_host' };
    if (order.status !== OrderStatus.ENDED) return { status: 'order_not_ended' };

    // prevent reuse
    const [existingCouponUsage, existingPointShopCouponUsage, existingLotteryUsage] = await Promise.all([
      tx.coupon.findFirst({
        where: { orderId, status: 'USED' },
        select: { id: true },
      }),
      tx.pointShopGrant.findFirst({
        where: {
          consumeOrderId: orderId,
          deliveryType: PointShopDeliveryType.COUPON,
          couponStatus: CouponStatus.USED,
        },
        select: { id: true },
      }),
      tx.lotteryDraw.findFirst({
        where: {
          userId,
          status: LotteryStatus.USED,
          requestId: orderId,
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
      where: { discordId: userId, status: 'ACTIVE', expiresAt: { lte: now } },
      data: { status: 'EXPIRED' },
    });
    await tx.lotteryDraw.updateMany({
      where: {
        userId,
        status: LotteryStatus.UNUSED,
        expiresAt: { lte: now },
        prize: { name: { in: Object.keys(DISCOUNT_PRIZE_CONFIG) } },
      },
      data: { status: LotteryStatus.EXPIRED },
    });

    let couponId: string | null = null;
    let couponSource: 'coupon' | 'point_shop_coupon' | null = null;
    let lotteryId: string | null = null;

    if (kind === 'coupon') {
      const discountCouponTypes = Object.keys(COUPON_RATE_CAP_BY_TYPE) as CouponType[];

      if (targetCouponId) {
        const availableCoupon = await tx.coupon.findFirst({
          where: {
            id: targetCouponId,
            discordId: userId,
            status: CouponStatus.ACTIVE,
            expiresAt: { gt: now },
            type: { in: discountCouponTypes },
          },
        });

        if (availableCoupon) {
          couponId = availableCoupon.id;
          couponSource = 'coupon';
          prizeRateCap = COUPON_RATE_CAP_BY_TYPE[availableCoupon.type];
        } else {
          const availablePointShopCoupon = await tx.pointShopGrant.findFirst({
            where: {
              id: targetCouponId,
              discordUserId: userId,
              deliveryType: PointShopDeliveryType.COUPON,
              couponStatus: CouponStatus.ACTIVE,
              expiresAt: { gt: now },
              couponType: { in: discountCouponTypes },
            },
            select: { id: true, couponType: true },
          });

          if (availablePointShopCoupon?.couponType) {
            couponId = availablePointShopCoupon.id;
            couponSource = 'point_shop_coupon';
            prizeRateCap = COUPON_RATE_CAP_BY_TYPE[availablePointShopCoupon.couponType];
          }
        }
      } else {
        const [availableCoupon, availablePointShopCoupon] = await Promise.all([
          tx.coupon.findFirst({
            where: {
              discordId: userId,
              status: CouponStatus.ACTIVE,
              expiresAt: { gt: now },
              type: { in: discountCouponTypes },
            },
            orderBy: { issuedAt: 'asc' },
            select: { id: true, type: true, issuedAt: true },
          }),
          tx.pointShopGrant.findFirst({
            where: {
              discordUserId: userId,
              deliveryType: PointShopDeliveryType.COUPON,
              couponStatus: CouponStatus.ACTIVE,
              expiresAt: { gt: now },
              couponType: { in: discountCouponTypes },
            },
            orderBy: { issuedAt: 'asc' },
            select: { id: true, couponType: true, issuedAt: true },
          }),
        ]);

        const usePointShopCoupon =
          !availableCoupon ||
          !!(
            availablePointShopCoupon &&
            availablePointShopCoupon.couponType &&
            availablePointShopCoupon.issuedAt <= availableCoupon.issuedAt
          );

        if (usePointShopCoupon && availablePointShopCoupon?.couponType) {
          couponId = availablePointShopCoupon.id;
          couponSource = 'point_shop_coupon';
          prizeRateCap = COUPON_RATE_CAP_BY_TYPE[availablePointShopCoupon.couponType];
        } else if (availableCoupon) {
          couponId = availableCoupon.id;
          couponSource = 'coupon';
          prizeRateCap = COUPON_RATE_CAP_BY_TYPE[availableCoupon.type];
        }
      }

      if (!couponId || !couponSource) return { status: 'no_coupon' };
    } else {
      const voucher = targetLotteryId
        ? await tx.lotteryDraw.findFirst({
            where: {
              id: targetLotteryId,
              userId,
              status: LotteryStatus.UNUSED,
              expiresAt: { gt: now },
              prize: { name: { in: Object.keys(DISCOUNT_PRIZE_CONFIG) } },
            },
            select: { id: true, prize: { select: { name: true } } },
          })
        : await tx.lotteryDraw.findFirst({
            where: {
              userId,
              status: LotteryStatus.UNUSED,
              expiresAt: { gt: now },
              prize: { name: { in: Object.keys(DISCOUNT_PRIZE_CONFIG) } },
            },
            select: { id: true, prize: { select: { name: true } } },
            orderBy: [{ expiresAt: 'asc' }, { createdAt: 'asc' }],
          });
      if (!voucher) return { status: 'no_lottery' };
      lotteryId = voucher.id;
      prizeRateCap = voucher.prize?.name ? DISCOUNT_PRIZE_CONFIG[voucher.prize.name] : undefined;
    }

    if (!order.unitPrice || order.totalMinutes == null) {
      return { status: 'insufficient_data' };
    }

    const unitPrice = new Prisma.Decimal(order.unitPrice);
    const rateCap =
      kind === 'coupon'
        ? prizeRateCap ?? { rate: COUPON_RATE, cap: COUPON_CAP }
        : prizeRateCap ?? DISCOUNT_PRIZE_CONFIG[PRIZE_NAMES.DISCOUNT_80];
    const discountAmount = computeDiscountAmount({
      unitPrice,
      totalMinutes: order.totalMinutes,
      rate: rateCap.rate,
      cap: rateCap.cap,
    });
    if (discountAmount.lte(0)) return { status: 'no_fee' };

    await suppressRechargeNotifications(tx);
    const hostAccount = await tx.member.findUnique({
      where: { discordUserId: userId },
      select: { totalBalance: true },
    });
    const balanceBefore = new Prisma.Decimal(hostAccount?.totalBalance ?? 0);
    const balanceAfter = balanceBefore.add(discountAmount);

    if (kind === 'coupon' && couponId) {
      if (couponSource === 'point_shop_coupon') {
        await tx.pointShopGrant.update({
          where: { id: couponId },
          data: {
            consumedAt: now,
            consumeOrderId: order.id,
            consumeAmount: discountAmount,
            consumeTargetId: order.workerId ?? null,
            couponStatus: CouponStatus.USED,
          },
        });
      } else {
        await tx.coupon.update({
          where: { id: couponId },
          data: {
            consumedAt: now,
            orderId: order.id,
            consumeAmount: discountAmount,
            consumeTargetId: order.workerId ?? null,
            status: CouponStatus.USED,
          },
        });
      }
    }
    if (kind === 'lottery' && lotteryId) {
      await tx.lotteryDraw.update({
        where: { id: lotteryId },
        data: {
          status: LotteryStatus.USED,
          consumeAt: now,
          requestId: order.id,
          consumeAmount: discountAmount,
          consumeTargetId: order.workerId ?? null,
        },
      });
    }

    await tx.member.update({
      where: { discordUserId: userId },
      data: {
        recharge: { increment: discountAmount },
        totalBalance: { increment: discountAmount },
      },
    });

    await recordIndividualTransaction(tx, {
      discordId: userId,
      thirdPartydiscordId: order.workerId ?? 'SYSTEM',
      balanceBefore,
      amountChange: discountAmount,
      balanceAfter,
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
