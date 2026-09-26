import { CouponSource, CouponStatus, CouponType, OrderStatus, Prisma, PrismaClient } from '@prisma/client';
import type { Prisma as PrismaNamespace } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import {
  OPENING_BENEFITS_END,
  OPENING_BENEFITS_START,
  OPENING_NEW_USER_ORDER_TARGET,
  OPENING_WEEKLY_SPEND_TARGET,
  getBerlinDateKey,
  getBerlinWeekKey,
  getBerlinWeekEnd,
  getBerlinWeekStart,
  getNewUserTaskDeadline,
  getNextBerlinMidnight,
  getOpeningCouponExpiresAt,
  isOpeningBenefitsActive,
} from '@/lib/opening-benefit-rules';

export const OPENING_BENEFIT = {
  DAILY_DISCOUNT: 'OPENING_DAILY_DISCOUNT',
  WEEKLY_CROWN: 'OPENING_WEEKLY_CROWN',
  NEW_USER_TWO_ORDERS: 'OPENING_NEW_USER_TWO_ORDERS',
} as const;

export type OpeningBenefitName = (typeof OPENING_BENEFIT)[keyof typeof OPENING_BENEFIT];

const ACTUAL_SPEND_TYPES = new Set(['点单', '打赏', '客服代打赏', '红包发出', '试音花费']);
const ACTUAL_SPEND_REVERSAL_TYPES = new Set(['订单撤销', '打赏撤销', '红包退回', '优惠返利']);
const ALL_ACTUAL_SPEND_TYPES = [...ACTUAL_SPEND_TYPES, ...ACTUAL_SPEND_REVERSAL_TYPES];
type DbClient = PrismaClient | PrismaNamespace.TransactionClient;

export class OpeningBenefitError extends Error {
  constructor(
    public readonly code:
      | 'campaign_inactive'
      | 'already_claimed'
      | 'weekly_spend_not_met'
      | 'new_user_task_not_eligible',
  ) {
    super(code);
  }
}

const toDecimal = (value: Prisma.Decimal | number | string | null | undefined) =>
  new Prisma.Decimal(value ?? 0);

const isUniqueClaimError = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';

const getEffectiveWeekStart = (now: Date) => {
  const weekStart = getBerlinWeekStart(now);
  return weekStart < OPENING_BENEFITS_START ? OPENING_BENEFITS_START : weekStart;
};

const calculateActualSpend = (
  entries: Array<{ typeOfTransaction: string; amountChange: Prisma.Decimal | null }>,
) => {
  const total = entries.reduce((sum, entry) => {
    const amount = toDecimal(entry.amountChange).abs();
    if (ACTUAL_SPEND_TYPES.has(entry.typeOfTransaction)) return sum.add(amount);
    if (ACTUAL_SPEND_REVERSAL_TYPES.has(entry.typeOfTransaction)) return sum.sub(amount);
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

async function getNewUserOrderCountTx(
  tx: DbClient,
  jinleeId: string,
  accountCreatedAt: Date,
  now: Date,
) {
  return tx.order.count({
    where: {
      hostJinleeId: jinleeId,
      status: OrderStatus.ENDED,
      endedAt: { gte: accountCreatedAt, lte: now },
    },
  });
}

const canParticipateInNewUserTask = (accountCreatedAt: Date, now: Date) =>
  accountCreatedAt >= OPENING_BENEFITS_START && now < getNewUserTaskDeadline(accountCreatedAt);

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
  newUserTask: {
    eligible: boolean;
    claimed: boolean;
    completedOrders: number;
    targetOrders: number;
    deadlineAt: string | null;
  };
};

export async function getOpeningBenefitsStatus(
  params: { jinleeId: string; discordUserId?: string | null; now?: Date },
): Promise<OpeningBenefitsStatus> {
  const now = params.now ?? new Date();
  const active = isOpeningBenefitsActive(now);
  const weekKey = getBerlinWeekKey(now);
  const dailyKey = getBerlinDateKey(now);

  const [user, claims, peiwan] = await Promise.all([
    prisma.jinleeUser.findUnique({
      where: { jinleeId: params.jinleeId },
      select: { createdAt: true },
    }),
    prisma.openingBenefitClaim.findMany({
      where: {
        jinleeId: params.jinleeId,
        OR: [
          { benefit: OPENING_BENEFIT.DAILY_DISCOUNT, periodKey: dailyKey },
          { benefit: OPENING_BENEFIT.WEEKLY_CROWN, periodKey: weekKey },
          { benefit: OPENING_BENEFIT.NEW_USER_TWO_ORDERS },
        ],
      },
      select: { benefit: true, periodKey: true },
    }),
    params.discordUserId
      ? prisma.pEIWAN.findUnique({ where: { discordUserId: params.discordUserId }, select: { PEIWANID: true } })
      : Promise.resolve(null),
  ]);

  const accountCreatedAt = user?.createdAt ?? now;
  const newUserTaskActive = active && canParticipateInNewUserTask(accountCreatedAt, now);
  const [weeklyActualSpend, completedOrders] = await Promise.all([
    getWeeklyActualSpendTx(prisma, params.jinleeId, now),
    newUserTaskActive
      ? getNewUserOrderCountTx(prisma, params.jinleeId, accountCreatedAt, now)
      : Promise.resolve(0),
  ]);

  const hasClaim = (benefit: OpeningBenefitName, periodKey?: string) =>
    claims.some((claim) => claim.benefit === benefit && (!periodKey || claim.periodKey === periodKey));
  const dailyClaimed = hasClaim(OPENING_BENEFIT.DAILY_DISCOUNT, dailyKey);
  const weeklyClaimed = hasClaim(OPENING_BENEFIT.WEEKLY_CROWN, weekKey);
  const newUserClaimed = hasClaim(OPENING_BENEFIT.NEW_USER_TWO_ORDERS);
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
      eligible: active && !weeklyClaimed && weeklyActualSpend.gte(OPENING_WEEKLY_SPEND_TARGET),
      claimedThisWeek: weeklyClaimed,
      weekKey,
      weekEndsAt: nextWeek.toISOString(),
      actualSpend: weeklyActualSpend.toFixed(2),
      targetSpend: OPENING_WEEKLY_SPEND_TARGET,
    },
    newUserTask: {
      eligible:
        newUserTaskActive
        && !newUserClaimed
        && completedOrders >= OPENING_NEW_USER_ORDER_TARGET,
      claimed: newUserClaimed,
      completedOrders,
      targetOrders: OPENING_NEW_USER_ORDER_TARGET,
      deadlineAt: newUserTaskActive ? getNewUserTaskDeadline(accountCreatedAt).toISOString() : null,
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
  if (!isOpeningBenefitsActive(now)) throw new OpeningBenefitError('campaign_inactive');

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
        select: { createdAt: true },
      });
      if (!user) throw new OpeningBenefitError('new_user_task_not_eligible');

      if (params.benefit === OPENING_BENEFIT.WEEKLY_CROWN) {
        const actualSpend = await getWeeklyActualSpendTx(tx, params.jinleeId, now);
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

      if (!canParticipateInNewUserTask(user.createdAt, now)) {
        throw new OpeningBenefitError('new_user_task_not_eligible');
      }
      const completedOrders = await getNewUserOrderCountTx(tx, params.jinleeId, user.createdAt, now);
      if (completedOrders < OPENING_NEW_USER_ORDER_TARGET) {
        throw new OpeningBenefitError('new_user_task_not_eligible');
      }
      return createCouponClaimTx({
        tx,
        jinleeId: params.jinleeId,
        benefit: params.benefit,
        periodKey: 'once',
        couponType: CouponType.DISCOUNT_90_LOTTERY,
        now,
      });
    });
  } catch (error) {
    if (isUniqueClaimError(error)) throw new OpeningBenefitError('already_claimed');
    throw error;
  }
}
