import {
  CouponSource,
  CouponStatus,
  CouponType,
  OrderStatus,
  Prisma,
  PrismaClient,
} from '@prisma/client';
import type { Prisma as PrismaNamespace } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import {
  OPENING_BENEFITS_END,
  OPENING_BENEFITS_START,
  OPENING_QUALIFYING_TRANSACTION_MIN_AMOUNT,
  OPENING_TWO_ORDER_TARGET,
  OPENING_WEEKLY_SPEND_TARGET,
  getBerlinDateKey,
  getBerlinWeekKey,
  getBerlinWeekEnd,
  getBerlinWeekStart,
  getNextBerlinMidnight,
  getOpeningCouponExpiresAt,
  isOpeningBenefitsActive,
} from '@/lib/opening-benefit-rules';

export const OPENING_BENEFIT = {
  DAILY_DISCOUNT: 'OPENING_DAILY_DISCOUNT',
  WEEKLY_CROWN: 'OPENING_WEEKLY_CROWN',
  // Keep the original persisted key so someone who already claimed the old task cannot claim again.
  TWO_ORDERS: 'OPENING_NEW_USER_TWO_ORDERS',
} as const;

export type OpeningBenefitName =
  (typeof OPENING_BENEFIT)[keyof typeof OPENING_BENEFIT];

const ACTUAL_SPEND_TYPES = new Set([
  '点单',
  '打赏',
  '客服代打赏',
  '红包发出',
  '试音花费',
]);
const ACTUAL_SPEND_REVERSAL_TYPES = new Set([
  '订单撤销',
  '打赏撤销',
  '红包退回',
  '优惠返利',
]);
const ALL_ACTUAL_SPEND_TYPES = [
  ...ACTUAL_SPEND_TYPES,
  ...ACTUAL_SPEND_REVERSAL_TYPES,
];
type DbClient = PrismaClient | PrismaNamespace.TransactionClient;

export class OpeningBenefitError extends Error {
  constructor(
    public readonly code:
      | 'campaign_inactive'
      | 'already_claimed'
      | 'two_order_task_already_claimed'
      | 'weekly_spend_not_met'
      | 'two_order_task_not_eligible',
  ) {
    super(code);
  }
}

const toDecimal = (
  value: Prisma.Decimal | number | string | null | undefined,
) => new Prisma.Decimal(value ?? 0);

const isUniqueClaimError = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError &&
  error.code === 'P2002';

const getEffectiveWeekStart = (now: Date) => {
  const weekStart = getBerlinWeekStart(now);
  return weekStart < OPENING_BENEFITS_START
    ? OPENING_BENEFITS_START
    : weekStart;
};

const calculateActualSpend = (
  entries: Array<{
    typeOfTransaction: string;
    amountChange: Prisma.Decimal | null;
  }>,
) => {
  const total = entries.reduce((sum, entry) => {
    const amount = toDecimal(entry.amountChange).abs();
    if (ACTUAL_SPEND_TYPES.has(entry.typeOfTransaction)) return sum.add(amount);
    if (ACTUAL_SPEND_REVERSAL_TYPES.has(entry.typeOfTransaction))
      return sum.sub(amount);
    return sum;
  }, new Prisma.Decimal(0));
  return total.lt(0) ? new Prisma.Decimal(0) : total;
};

async function getWeeklyActualSpendTx(
  tx: DbClient,
  jinleeId: string,
  now: Date,
) {
  const entries = await tx.individualTransaction.findMany({
    where: {
      jinleeId,
      timeCreatedAt: { gte: getEffectiveWeekStart(now), lte: now },
      typeOfTransaction: { in: ALL_ACTUAL_SPEND_TYPES },
    },
    select: { typeOfTransaction: true, amountChange: true },
  });
  return calculateActualSpend(entries);
}

async function getQualifyingCampaignTransactionCountTx(
  tx: DbClient,
  jinleeId: string,
  discordUserId: string | null,
  now: Date,
) {
  const minimumAmount = new Prisma.Decimal(
    OPENING_QUALIFYING_TRANSACTION_MIN_AMOUNT,
  );
  const [qualifyingOrders, qualifyingGifts] = await Promise.all([
    tx.order.count({
      where: {
        hostJinleeId: jinleeId,
        status: OrderStatus.ENDED,
        endedAt: { gte: OPENING_BENEFITS_START, lte: now },
        grossAmount: { gt: minimumAmount },
      },
    }),
    discordUserId
      ? tx.giftAudit.findMany({
          where: {
            giverId: discordUserId,
            createdAt: { gte: OPENING_BENEFITS_START, lte: now },
            payable: { gt: minimumAmount },
          },
          select: { individualTransactionId: true },
        })
      : Promise.resolve([]),
  ]);

  if (!qualifyingGifts.length) return qualifyingOrders;

  const revertedGifts = await tx.revert.findMany({
    where: {
      originalTransactionId: {
        in: qualifyingGifts.map((gift) => gift.individualTransactionId),
      },
    },
    select: { originalTransactionId: true },
  });
  const revertedTransactionIds = new Set(
    revertedGifts.map((revert) => revert.originalTransactionId),
  );
  return (
    qualifyingOrders +
    qualifyingGifts.filter(
      (gift) => !revertedTransactionIds.has(gift.individualTransactionId),
    ).length
  );
}

export type OpeningBenefitsStatus = {
  active: boolean;
  startsAt: string;
  endsAt: string;
  commission: { eligible: boolean; targetPayoutRate: number; endsAt: string };
  dailyDiscount: {
    eligible: boolean;
    claimedToday: boolean;
    nextClaimAt: string;
    couponValidityDays: number;
  };
  weeklyCrown: {
    eligible: boolean;
    claimedThisWeek: boolean;
    weekKey: string;
    weekEndsAt: string;
    actualSpend: string;
    targetSpend: number;
  };
  twoOrderTask: {
    eligible: boolean;
    claimed: boolean;
    qualifyingTransactions: number;
    targetTransactions: number;
    minimumAmount: number;
  };
};

export async function getOpeningBenefitsStatus(params: {
  jinleeId: string;
  discordUserId?: string | null;
  now?: Date;
}): Promise<OpeningBenefitsStatus> {
  const now = params.now ?? new Date();
  const active = isOpeningBenefitsActive(now);
  const weekKey = getBerlinWeekKey(now);
  const dailyKey = getBerlinDateKey(now);

  const [user, claims, peiwan] = await Promise.all([
    prisma.jinleeUser.findUnique({
      where: { jinleeId: params.jinleeId },
      select: { discordUserId: true },
    }),
    prisma.openingBenefitClaim.findMany({
      where: {
        jinleeId: params.jinleeId,
        OR: [
          { benefit: OPENING_BENEFIT.DAILY_DISCOUNT, periodKey: dailyKey },
          { benefit: OPENING_BENEFIT.WEEKLY_CROWN, periodKey: weekKey },
          { benefit: OPENING_BENEFIT.TWO_ORDERS },
        ],
      },
      select: { benefit: true, periodKey: true },
    }),
    params.discordUserId
      ? prisma.pEIWAN.findUnique({
          where: { discordUserId: params.discordUserId },
          select: { PEIWANID: true },
        })
      : Promise.resolve(null),
  ]);

  const [weeklyActualSpend, qualifyingTransactions] = await Promise.all([
    getWeeklyActualSpendTx(prisma, params.jinleeId, now),
    active
      ? getQualifyingCampaignTransactionCountTx(
          prisma,
          params.jinleeId,
          user?.discordUserId ?? params.discordUserId ?? null,
          now,
        )
      : Promise.resolve(0),
  ]);

  const hasClaim = (benefit: OpeningBenefitName, periodKey?: string) =>
    claims.some(
      (claim) =>
        claim.benefit === benefit &&
        (!periodKey || claim.periodKey === periodKey),
    );
  const dailyClaimed = hasClaim(OPENING_BENEFIT.DAILY_DISCOUNT, dailyKey);
  const weeklyClaimed = hasClaim(OPENING_BENEFIT.WEEKLY_CROWN, weekKey);
  const twoOrderClaimed = hasClaim(OPENING_BENEFIT.TWO_ORDERS);
  const nextWeek = getBerlinWeekEnd(now);

  return {
    active,
    startsAt: OPENING_BENEFITS_START.toISOString(),
    endsAt: OPENING_BENEFITS_END.toISOString(),
    commission: {
      eligible: active && !!peiwan,
      targetPayoutRate: 91,
      endsAt: OPENING_BENEFITS_END.toISOString(),
    },
    dailyDiscount: {
      eligible: active && !dailyClaimed,
      claimedToday: dailyClaimed,
      nextClaimAt: getNextBerlinMidnight(now).toISOString(),
      couponValidityDays: 30,
    },
    weeklyCrown: {
      eligible:
        active &&
        !weeklyClaimed &&
        weeklyActualSpend.gte(OPENING_WEEKLY_SPEND_TARGET),
      claimedThisWeek: weeklyClaimed,
      weekKey,
      weekEndsAt: nextWeek.toISOString(),
      actualSpend: weeklyActualSpend.toFixed(2),
      targetSpend: OPENING_WEEKLY_SPEND_TARGET,
    },
    twoOrderTask: {
      eligible:
        active &&
        !twoOrderClaimed &&
        qualifyingTransactions >= OPENING_TWO_ORDER_TARGET,
      claimed: twoOrderClaimed,
      qualifyingTransactions,
      targetTransactions: OPENING_TWO_ORDER_TARGET,
      minimumAmount: OPENING_QUALIFYING_TRANSACTION_MIN_AMOUNT,
    },
  };
}

async function createCouponClaimTx(params: {
  tx: PrismaNamespace.TransactionClient;
  jinleeId: string;
  benefit: OpeningBenefitName;
  periodKey: string;
  couponType: CouponType;
  now: Date;
}) {
  const claim = await params.tx.openingBenefitClaim.create({
    data: {
      jinleeId: params.jinleeId,
      benefit: params.benefit,
      periodKey: params.periodKey,
    },
  });
  const coupon = await params.tx.coupon.create({
    data: {
      jinleeId: params.jinleeId,
      type: params.couponType,
      source: CouponSource.OPENING_CAMPAIGN,
      status: CouponStatus.ACTIVE,
      expiresAt: getOpeningCouponExpiresAt(params.now),
    },
    select: { id: true, expiresAt: true, type: true },
  });
  await params.tx.openingBenefitClaim.update({
    where: { id: claim.id },
    data: { couponId: coupon.id },
  });
  return coupon;
}

export async function claimOpeningBenefit(params: {
  jinleeId: string;
  benefit: OpeningBenefitName;
  now?: Date;
}) {
  const now = params.now ?? new Date();
  if (!isOpeningBenefitsActive(now))
    throw new OpeningBenefitError('campaign_inactive');

  try {
    return await prisma.$transaction(async (tx) => {
      if (params.benefit === OPENING_BENEFIT.DAILY_DISCOUNT) {
        return createCouponClaimTx({
          tx,
          jinleeId: params.jinleeId,
          benefit: params.benefit,
          periodKey: getBerlinDateKey(now),
          couponType: CouponType.DISCOUNT_90_LOTTERY,
          now,
        });
      }

      const user = await tx.jinleeUser.findUnique({
        where: { jinleeId: params.jinleeId },
        select: { discordUserId: true },
      });
      if (!user) throw new OpeningBenefitError('two_order_task_not_eligible');

      if (params.benefit === OPENING_BENEFIT.WEEKLY_CROWN) {
        const actualSpend = await getWeeklyActualSpendTx(
          tx,
          params.jinleeId,
          now,
        );
        if (actualSpend.lt(OPENING_WEEKLY_SPEND_TARGET)) {
          throw new OpeningBenefitError('weekly_spend_not_met');
        }
        return createCouponClaimTx({
          tx,
          jinleeId: params.jinleeId,
          benefit: params.benefit,
          periodKey: getBerlinWeekKey(now),
          couponType: CouponType.CROWN_75_VOUCHER,
          now,
        });
      }

      const qualifyingTransactions =
        await getQualifyingCampaignTransactionCountTx(
          tx,
          params.jinleeId,
          user.discordUserId,
          now,
        );
      if (qualifyingTransactions < OPENING_TWO_ORDER_TARGET) {
        throw new OpeningBenefitError('two_order_task_not_eligible');
      }
      return createCouponClaimTx({
        tx,
        jinleeId: params.jinleeId,
        benefit: OPENING_BENEFIT.TWO_ORDERS,
        periodKey: 'once',
        couponType: CouponType.DISCOUNT_90_LOTTERY,
        now,
      });
    });
  } catch (error) {
    if (isUniqueClaimError(error)) {
      throw new OpeningBenefitError(
        params.benefit === OPENING_BENEFIT.TWO_ORDERS
          ? 'two_order_task_already_claimed'
          : 'already_claimed',
      );
    }
    throw error;
  }
}
