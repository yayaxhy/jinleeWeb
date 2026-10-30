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
import { transactionDeltaSelection, type WalletDeltaSource } from '@/lib/wallet-ledger';
import { activityTypes, OPENING_SPEND_POLICY, spendContribution } from '@/lib/transaction-activity';
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

const ONE_TIME_CLAIM_PERIOD_KEY = 'once';

export type OpeningBenefitName =
  (typeof OPENING_BENEFIT)[keyof typeof OPENING_BENEFIT];

type DbClient = PrismaClient | PrismaNamespace.TransactionClient;

export class OpeningBenefitError extends Error {
  constructor(
    public readonly code:
      | 'campaign_inactive'
      | 'already_claimed'
      | 'weekly_crown_already_claimed'
      | 'two_order_task_already_claimed'
      | 'weekly_spend_not_met'
      | 'two_order_task_not_eligible',
  ) {
    super(code);
  }
}

const isUniqueClaimError = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError &&
  error.code === 'P2002';

const getEffectiveWeekStart = (now: Date) => {
  const weekStart = getBerlinWeekStart(now);
  return weekStart < OPENING_BENEFITS_START
    ? OPENING_BENEFITS_START
    : weekStart;
};

export const calculateActualSpend = (
  entries: Array<WalletDeltaSource & { typeOfTransaction: string }>,
) => {
  const total = entries.reduce(
    (sum, entry) => sum.add(spendContribution(entry, OPENING_SPEND_POLICY)),
    new Prisma.Decimal(0),
  );
  return total.lt(0) ? new Prisma.Decimal(0) : total;
};

async function getWeeklyActualSpendTx(
  tx: DbClient,
  dlmId: string,
  now: Date,
) {
  const entries = await tx.individualTransaction.findMany({
    where: {
      dlmId,
      timeCreatedAt: { gte: getEffectiveWeekStart(now), lte: now },
      typeOfTransaction: {
        in: activityTypes(OPENING_SPEND_POLICY),
      },
    },
    select: {
      ...transactionDeltaSelection(),
      typeOfTransaction: true,
      balanceBefore: true,
      balanceAfter: true,
    },
  });
  return calculateActualSpend(entries);
}

async function getQualifyingCampaignTransactionCountTx(
  tx: DbClient,
  dlmId: string,
  discordUserId: string | null,
  now: Date,
) {
  const minimumAmount = new Prisma.Decimal(
    OPENING_QUALIFYING_TRANSACTION_MIN_AMOUNT,
  );
  const [qualifyingOrders, qualifyingGifts] = await Promise.all([
    tx.order.count({
      where: {
        hostDlmId: dlmId,
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
    claimed: boolean;
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
  dlmId: string;
  discordUserId?: string | null;
  now?: Date;
}): Promise<OpeningBenefitsStatus> {
  const now = params.now ?? new Date();
  const active = isOpeningBenefitsActive(now);
  const weekKey = getBerlinWeekKey(now);
  const dailyKey = getBerlinDateKey(now);

  const [user, claims, peiwan] = await Promise.all([
    prisma.dlmUser.findUnique({
      where: { dlmId: params.dlmId },
      select: { discordUserId: true },
    }),
    prisma.openingBenefitClaim.findMany({
      where: {
        dlmId: params.dlmId,
        OR: [
          { benefit: OPENING_BENEFIT.DAILY_DISCOUNT, periodKey: dailyKey },
          { benefit: OPENING_BENEFIT.WEEKLY_CROWN },
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
    getWeeklyActualSpendTx(prisma, params.dlmId, now),
    active
      ? getQualifyingCampaignTransactionCountTx(
          prisma,
          params.dlmId,
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
  const weeklyClaimed = hasClaim(OPENING_BENEFIT.WEEKLY_CROWN);
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
      claimed: weeklyClaimed,
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
  dlmId: string;
  benefit: OpeningBenefitName;
  periodKey: string;
  couponType: CouponType;
  now: Date;
}) {
  const claim = await params.tx.openingBenefitClaim.create({
    data: {
      dlmId: params.dlmId,
      benefit: params.benefit,
      periodKey: params.periodKey,
    },
  });
  const coupon = await params.tx.coupon.create({
    data: {
      dlmId: params.dlmId,
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
  dlmId: string;
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
          dlmId: params.dlmId,
          benefit: params.benefit,
          periodKey: getBerlinDateKey(now),
          couponType: CouponType.DISCOUNT_90_LOTTERY,
          now,
        });
      }

      const user = await tx.dlmUser.findUnique({
        where: { dlmId: params.dlmId },
        select: { discordUserId: true },
      });
      if (!user) throw new OpeningBenefitError('two_order_task_not_eligible');

      if (params.benefit === OPENING_BENEFIT.WEEKLY_CROWN) {
        // Lock the user's row so the once-per-campaign rule stays true even
        // when two claim requests arrive at the same time.
        await tx.$executeRaw`SELECT 1 FROM "DlmUser" WHERE "dlmId" = ${params.dlmId} FOR UPDATE`;
        const existingClaim = await tx.openingBenefitClaim.findFirst({
          where: {
            dlmId: params.dlmId,
            benefit: OPENING_BENEFIT.WEEKLY_CROWN,
          },
          select: { id: true },
        });
        if (existingClaim) {
          throw new OpeningBenefitError('weekly_crown_already_claimed');
        }
        const actualSpend = await getWeeklyActualSpendTx(
          tx,
          params.dlmId,
          now,
        );
        if (actualSpend.lt(OPENING_WEEKLY_SPEND_TARGET)) {
          throw new OpeningBenefitError('weekly_spend_not_met');
        }
        return createCouponClaimTx({
          tx,
          dlmId: params.dlmId,
          benefit: params.benefit,
          periodKey: ONE_TIME_CLAIM_PERIOD_KEY,
          couponType: CouponType.CROWN_75_VOUCHER,
          now,
        });
      }

      const qualifyingTransactions =
        await getQualifyingCampaignTransactionCountTx(
          tx,
          params.dlmId,
          user.discordUserId,
          now,
        );
      if (qualifyingTransactions < OPENING_TWO_ORDER_TARGET) {
        throw new OpeningBenefitError('two_order_task_not_eligible');
      }
      return createCouponClaimTx({
        tx,
        dlmId: params.dlmId,
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
          : params.benefit === OPENING_BENEFIT.WEEKLY_CROWN
            ? 'weekly_crown_already_claimed'
            : 'already_claimed',
      );
    }
    throw error;
  }
}
