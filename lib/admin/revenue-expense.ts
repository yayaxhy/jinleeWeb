import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

export const REVENUE_EXPENSE_REASON_GIFT_REFERRAL = '邀请返现（打赏）';
export const REVENUE_EXPENSE_REASON_ORDER_REFERRAL = '邀请返现（订单）';
export const REVENUE_EXPENSE_REASON_INVITE_REWARD = '邀请奖励（进服）';

type DecimalLike = Prisma.Decimal | string | number | bigint | null | undefined;

type CountLike = bigint | number | null | undefined;

export type RevenueExpenseReasonRow = {
  reason: string;
  count: number;
  amount: Prisma.Decimal;
};

export type RevenueOrderReferralRow = {
  id: string;
  referralId: string;
  inviterId: string;
  orderId: string;
  amount: Prisma.Decimal | null;
  createdAt: Date;
  orderEndedAt: Date | null;
  hostId: string | null;
  workerId: string | null;
};

export type RevenueInviteRewardRow = {
  id: string;
  guildId: string;
  inviteeId: string;
  inviterId: string;
  code: string | null;
  rewardedAt: Date;
  rewardAmount: Prisma.Decimal;
  createdAt: Date;
};

type GiftReferralAuditLike = {
  bossReferralInviterId?: string | null;
  bossReferralAmount?: DecimalLike;
  workerReferralInviterId?: string | null;
  workerReferralAmount?: DecimalLike;
};

type GiftReferralAggregateRow = {
  amount: Prisma.Decimal | null;
  count: CountLike;
};

const parseNumber = (value: unknown): number | null => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return Number.isNaN(value) ? null : value;
  if (typeof value === 'bigint') return Number(value);
  if (typeof value === 'string') {
    const numeric = Number(value);
    return Number.isNaN(numeric) ? null : numeric;
  }
  if (typeof value === 'object' && value !== null && 'toString' in value) {
    const text = (value as { toString?: () => string }).toString?.();
    if (text) {
      const numeric = Number(text);
      return Number.isNaN(numeric) ? null : numeric;
    }
  }
  return null;
};

export const dec = (value: DecimalLike) => {
  if (value instanceof Prisma.Decimal) return value;
  const numeric = parseNumber(value);
  return new Prisma.Decimal(numeric ?? 0);
};

const toCount = (value: CountLike) => Number(value ?? 0);

export const decimalSum = (rows: Array<Record<string, unknown>>, field: string) =>
  rows.reduce((sum, row) => sum.add(dec(row?.[field] as DecimalLike)), new Prisma.Decimal(0));

export const sortRevenueExpenseReasonRows = (rows: RevenueExpenseReasonRow[]) =>
  [...rows].sort((a, b) => b.amount.comparedTo(a.amount));

export const normalizeExpenseGroupRows = (
  rows: Array<{
    reason: string | null;
    _count: { id: number };
    _sum: { amount: DecimalLike };
  }>,
): RevenueExpenseReasonRow[] =>
  rows.map((row) => ({
    reason: row.reason ?? '未分类',
    count: row._count.id,
    amount: dec(row._sum.amount),
  }));

export const buildRevenueExpenseBreakdown = (params: {
  expenseCount: number;
  expenseAmount: DecimalLike;
  expenseByReasonRows: RevenueExpenseReasonRow[];
  syntheticRows: RevenueExpenseReasonRow[];
}) => {
  const expenseAmount = dec(params.expenseAmount);
  const syntheticRows = params.syntheticRows.map((row) => ({
    reason: row.reason,
    count: row.count,
    amount: dec(row.amount),
  }));
  const totalAmount = syntheticRows.reduce((sum, row) => sum.add(row.amount), expenseAmount);
  const totalCount = syntheticRows.reduce((sum, row) => sum + row.count, params.expenseCount);
  const byReasonRows = sortRevenueExpenseReasonRows([
    ...params.expenseByReasonRows,
    ...syntheticRows.filter((row) => row.count > 0 || !row.amount.isZero()),
  ]);

  return {
    totalAmount,
    totalCount,
    syntheticRows,
    byReasonRows,
  };
};

export async function getRevenueOrderReferralRows(params: {
  start: Date;
  end: Date;
  excludeDiscordIds?: string[];
}): Promise<RevenueOrderReferralRow[]> {
  const excludeDiscordIds = Array.from(new Set((params.excludeDiscordIds ?? []).filter(Boolean)));
  const inviterExclusion = excludeDiscordIds.length
    ? Prisma.sql` AND r."inviterId" NOT IN (${Prisma.join(excludeDiscordIds)})`
    : Prisma.empty;

  return prisma.$queryRaw<RevenueOrderReferralRow[]>(Prisma.sql`
    SELECT
      rp."id",
      rp."referralId",
      r."inviterId",
      rp."orderId",
      rp."amount",
      rp."createdAt",
      o."endedAt" AS "orderEndedAt",
      o."hostId",
      o."workerId"
    FROM "ReferralPayout" rp
    JOIN "Referral" r
      ON r."inviteeId" = rp."referralId"
    JOIN "Order" o
      ON o."id" = rp."orderId"
    WHERE rp."createdAt" >= ${params.start}
      AND rp."createdAt" < ${params.end}
      AND o."status" = 'ENDED'
      ${inviterExclusion}
    ORDER BY rp."createdAt" DESC
  `);
}

export async function getRevenueInviteRewardRows(params: {
  start: Date;
  end: Date;
  excludeDiscordIds?: string[];
}): Promise<RevenueInviteRewardRow[]> {
  const excludeDiscordIds = Array.from(new Set((params.excludeDiscordIds ?? []).filter(Boolean)));
  return prisma.inviteLinkUsage.findMany({
    where: {
      rewardedAt: { gte: params.start, lt: params.end },
      ...(excludeDiscordIds.length ? { inviterId: { notIn: excludeDiscordIds } } : {}),
    },
    orderBy: { rewardedAt: 'desc' },
    select: {
      id: true,
      guildId: true,
      inviteeId: true,
      inviterId: true,
      code: true,
      rewardedAt: true,
      rewardAmount: true,
      createdAt: true,
    },
  });
}

const summarizeGiftReferralAuditRows = (
  rows: GiftReferralAuditLike[],
  excludeDiscordIds: string[],
) => {
  const excluded = new Set(excludeDiscordIds);
  let amount = new Prisma.Decimal(0);
  let count = 0;

  for (const row of rows) {
    const bossAmount = dec(row.bossReferralAmount);
    if (row.bossReferralInviterId && !excluded.has(row.bossReferralInviterId) && bossAmount.gt(0)) {
      amount = amount.add(bossAmount);
      count += 1;
    }

    const workerAmount = dec(row.workerReferralAmount);
    if (row.workerReferralInviterId && !excluded.has(row.workerReferralInviterId) && workerAmount.gt(0)) {
      amount = amount.add(workerAmount);
      count += 1;
    }
  }

  return { amount, count };
};

export function buildGiftReferralExpenseSummaryFromRows(params: {
  giftAuditRows: GiftReferralAuditLike[];
  revertedGiftRows: GiftReferralAuditLike[];
  excludeDiscordIds?: string[];
}): RevenueExpenseReasonRow {
  const excludeDiscordIds = Array.from(new Set((params.excludeDiscordIds ?? []).filter(Boolean)));
  const gross = summarizeGiftReferralAuditRows(params.giftAuditRows, excludeDiscordIds);
  const reverted = summarizeGiftReferralAuditRows(params.revertedGiftRows, excludeDiscordIds);

  return {
    reason: REVENUE_EXPENSE_REASON_GIFT_REFERRAL,
    count: Math.max(0, gross.count - reverted.count),
    amount: gross.amount.sub(reverted.amount),
  };
}

export async function getGiftReferralExpenseSummary(params: {
  start: Date;
  end: Date;
  excludeDiscordIds?: string[];
}): Promise<RevenueExpenseReasonRow> {
  const excludeDiscordIds = Array.from(new Set((params.excludeDiscordIds ?? []).filter(Boolean)));
  const bossExclusion = excludeDiscordIds.length
    ? Prisma.sql` AND ga."bossReferralInviterId" NOT IN (${Prisma.join(excludeDiscordIds)})`
    : Prisma.empty;
  const workerExclusion = excludeDiscordIds.length
    ? Prisma.sql` AND ga."workerReferralInviterId" NOT IN (${Prisma.join(excludeDiscordIds)})`
    : Prisma.empty;

  const [grossRows, revertedRows] = await Promise.all([
    prisma.$queryRaw<GiftReferralAggregateRow[]>(Prisma.sql`
      SELECT
        COALESCE(SUM(
          CASE
            WHEN COALESCE(ga."bossReferralAmount", 0) > 0 ${bossExclusion}
              THEN COALESCE(ga."bossReferralAmount", 0)
            ELSE 0
          END
        ), 0) + COALESCE(SUM(
          CASE
            WHEN COALESCE(ga."workerReferralAmount", 0) > 0 ${workerExclusion}
              THEN COALESCE(ga."workerReferralAmount", 0)
            ELSE 0
          END
        ), 0) AS "amount",
        COALESCE(SUM(
          CASE
            WHEN COALESCE(ga."bossReferralAmount", 0) > 0 ${bossExclusion}
              THEN 1
            ELSE 0
          END
        ), 0) + COALESCE(SUM(
          CASE
            WHEN COALESCE(ga."workerReferralAmount", 0) > 0 ${workerExclusion}
              THEN 1
            ELSE 0
          END
        ), 0) AS "count"
      FROM "gift_audit" ga
      WHERE ga."createdAt" >= ${params.start}
        AND ga."createdAt" < ${params.end}
    `),
    prisma.$queryRaw<GiftReferralAggregateRow[]>(Prisma.sql`
      SELECT
        COALESCE(SUM(
          CASE
            WHEN COALESCE(ga."bossReferralAmount", 0) > 0 ${bossExclusion}
              THEN COALESCE(ga."bossReferralAmount", 0)
            ELSE 0
          END
        ), 0) + COALESCE(SUM(
          CASE
            WHEN COALESCE(ga."workerReferralAmount", 0) > 0 ${workerExclusion}
              THEN COALESCE(ga."workerReferralAmount", 0)
            ELSE 0
          END
        ), 0) AS "amount",
        COALESCE(SUM(
          CASE
            WHEN COALESCE(ga."bossReferralAmount", 0) > 0 ${bossExclusion}
              THEN 1
            ELSE 0
          END
        ), 0) + COALESCE(SUM(
          CASE
            WHEN COALESCE(ga."workerReferralAmount", 0) > 0 ${workerExclusion}
              THEN 1
            ELSE 0
          END
        ), 0) AS "count"
      FROM "gift_audit" ga
      JOIN "revert" r
        ON r."originalTransactionId" = ga."individualTransactionId"
      WHERE r."status" = 'SUCCESS'
        AND ga."createdAt" >= ${params.start}
        AND ga."createdAt" < ${params.end}
    `),
  ]);

  const gross = grossRows[0] ?? { amount: new Prisma.Decimal(0), count: 0 };
  const reverted = revertedRows[0] ?? { amount: new Prisma.Decimal(0), count: 0 };

  return {
    reason: REVENUE_EXPENSE_REASON_GIFT_REFERRAL,
    count: Math.max(0, toCount(gross.count) - toCount(reverted.count)),
    amount: dec(gross.amount).sub(dec(reverted.amount)),
  };
}

export function summarizeOrderReferralExpenseRows(
  rows: Array<Pick<RevenueOrderReferralRow, 'amount'>>,
): RevenueExpenseReasonRow {
  return {
    reason: REVENUE_EXPENSE_REASON_ORDER_REFERRAL,
    count: rows.length,
    amount: decimalSum(rows as Array<Record<string, unknown>>, 'amount'),
  };
}

export function summarizeInviteRewardExpenseRows(
  rows: Array<Pick<RevenueInviteRewardRow, 'rewardAmount'>>,
): RevenueExpenseReasonRow {
  return {
    reason: REVENUE_EXPENSE_REASON_INVITE_REWARD,
    count: rows.length,
    amount: decimalSum(rows as Array<Record<string, unknown>>, 'rewardAmount'),
  };
}
