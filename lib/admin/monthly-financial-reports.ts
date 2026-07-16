import fs from 'node:fs/promises';
import path from 'node:path';
import ExcelJS from 'exceljs';
import { CouponSource, CouponStatus, Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import {
  buildCentralEuropeanMonthRange,
  formatCentralEuropeanMonthKey,
  formatDateTimeTextCentralEuropean,
  getPreviousCentralEuropeanMonthRange,
} from '@/lib/centralEuropeanDateRange';
import { parseRevenueIdentityList, resolveRevenueExclusions } from '@/lib/admin/revenue-exclusion';
import {
  buildGiftReferralExpenseSummaryFromRows,
  buildRevenueExpenseBreakdown,
  decimalSum,
  dec,
  getRevenueInviteRewardRows,
  getRevenueOrderReferralRows,
  normalizeExpenseGroupRows,
  REVENUE_EXPENSE_REASON_GIFT_REFERRAL,
  REVENUE_EXPENSE_REASON_INVITE_REWARD,
  REVENUE_EXPENSE_REASON_ORDER_REFERRAL,
  summarizeInviteRewardExpenseRows,
  summarizeOrderReferralExpenseRows,
} from '@/lib/admin/revenue-expense';
import {
  getLotteryFusionRevenueSummary,
  LOTTERY_FUSION_COUNT_BUCKET_LABEL,
  LOTTERY_FUSION_SOURCE_KIND_LABEL,
  type LotteryFusionCountBucket,
} from '@/lib/admin/lottery-fusion-revenue';

const DEFAULT_EXCLUDE_MEMBER_INPUT = '1441310169492361268';
const DEFAULT_CAPITAL_AMOUNT = 120000;
const REPORT_STORAGE_DIR =
  process.env.ADMIN_REVENUE_REPORT_DIR || path.join(process.cwd(), 'storage', 'admin-revenue-files');
const ADJUSTMENTS_FILE_PATH =
  process.env.ADMIN_FINANCIAL_ADJUSTMENTS_FILE || path.join(REPORT_STORAGE_DIR, 'financial-adjustments.json');

const FUSION_POOL_LABEL: Record<string, string> = {
  NORMAL: '银色',
  MEDIUM: '金色',
  ADVANCED: '高级',
  SPECIAL: '特殊',
};

const FUSION_COUNT_BUCKET_ORDER: LotteryFusionCountBucket[] = ['3', '4', '6', 'other'];
const FUSION_SOURCE_KIND_ORDER = ['lottery', 'coupon', 'pointshop'] as const;
const MONEY_FORMAT = '#,##0.00;[Red]\\(#,##0.00\\);\\-';
const COUNT_FORMAT = '#,##0';
const TITLE_COLOR = '17324D';
const HEADER_FILL = 'DDE8F2';
const HEADER_FONT = '1D2F3C';
const SECTION_FILL = '335F87';
const EXPENSE_TOTAL_FILL = '7A4937';
const BORDER_COLOR = 'E4EAF0';

type DecimalLike = Prisma.Decimal | string | number | bigint | null | undefined;

type RevertedGiftRow = {
  revertId: string;
  originalTransactionId: string | null;
  revertCreatedAt: Date;
  revertStatus: string;
  giftAuditCreatedAt: Date;
  individualTransactionId: string | null;
  gross: Prisma.Decimal | null;
  payable: Prisma.Decimal | null;
  feeAmount: Prisma.Decimal | null;
  bossReferralAmount: Prisma.Decimal | null;
  workerReferralAmount: Prisma.Decimal | null;
  subsidyAmount: Prisma.Decimal | null;
};

type IncomeAdjustmentRow = {
  name: string;
  amount: number;
  note: string;
};

type ExpenseAdjustmentRow = {
  source: string;
  date: string;
  description: string;
  amount: number;
  count: number;
  note: string;
};

type PriorProfitRow = {
  label: string;
  amount: number;
  note: string;
};

type BalanceAdjustmentRow = {
  item: string;
  category: string;
  amount: number;
  description: string;
};

type MonthFinancialAdjustments = {
  capitalAmount?: number;
  incomeRows: IncomeAdjustmentRow[];
  expenseRows: ExpenseAdjustmentRow[];
  priorProfitRows: PriorProfitRow[];
  assetRows: BalanceAdjustmentRow[];
  liabilityRows: BalanceAdjustmentRow[];
  equityRows: BalanceAdjustmentRow[];
};

type FinancialAdjustmentConfig = {
  default?: Partial<MonthFinancialAdjustments>;
  months?: Record<string, Partial<MonthFinancialAdjustments>>;
};

export type StoredMonthlyReportFile = {
  monthKey: string;
  fileName: string;
  relativePath: string;
  downloadHref: string;
  kindLabel: string;
  size: number;
  modifiedAt: Date;
};

type StringDirent = {
  name: string;
  isDirectory(): boolean;
  isFile(): boolean;
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

const toNumber = (value: DecimalLike) => Number(dec(value).toString());

const toPositiveCount = (value: unknown, fallback = 1) => {
  const parsed = parseNumber(value);
  if (parsed === null || parsed < 0) return fallback;
  return Math.floor(parsed);
};

const textValue = (value: unknown, fallback = '') => {
  if (value === null || value === undefined) return fallback;
  const text = String(value).trim();
  return text || fallback;
};

const safeSheetName = (name: string) =>
  name.replace(/[\\/*?:[\]]/g, '_').slice(0, 31) || 'Sheet';

const formatBreakdownText = (
  breakdown: Record<string, number>,
  labelMap: Record<string, string>,
  fallback = 'none',
) => {
  const parts = Object.entries(breakdown)
    .filter(([, count]) => count > 0)
    .sort((left, right) => right[1] - left[1])
    .map(([key, count]) => `${labelMap[key] ?? key} ${count}`);
  return parts.join(' / ') || fallback;
};

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

const jsonReplacer = (_key: string, value: unknown) => {
  if (typeof value === 'bigint') return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Prisma.Decimal) return value.toString();
  return value;
};

const toCellValue = (value: unknown): string | number | boolean | null => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'bigint') return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Prisma.Decimal) return value.toString();
  if (Array.isArray(value) || typeof value === 'object') {
    try {
      return JSON.stringify(value, jsonReplacer);
    } catch {
      return String(value);
    }
  }
  return String(value);
};

function addObjectRowsSheet(
  workbook: ExcelJS.Workbook,
  title: string,
  rows: Array<Record<string, unknown>>,
) {
  const sheet = workbook.addWorksheet(safeSheetName(title));
  if (!rows.length) {
    sheet.addRow(['无数据']);
    return;
  }

  const keySet = rows.reduce<Set<string>>((set, row) => {
    Object.keys(row ?? {}).forEach((key) => set.add(key));
    return set;
  }, new Set<string>());
  const keys: string[] = Array.from(keySet);

  sheet.columns = keys.map((key) => ({
    header: key,
    key,
    width: Math.min(40, Math.max(14, key.length + 2)),
  }));
  sheet.getRow(1).font = { bold: true };
  sheet.views = [{ state: 'frozen', ySplit: 1 }];

  for (const row of rows) {
    const output: Record<string, string | number | boolean | null> = {};
    for (const key of keys) {
      output[key] = toCellValue(row?.[key]);
    }
    sheet.addRow(output);
  }
}

function addKeyValueSheet(
  workbook: ExcelJS.Workbook,
  title: string,
  rows: Array<{ section: string; key: string; value: unknown }>,
) {
  const sheet = workbook.addWorksheet(safeSheetName(title));
  sheet.columns = [
    { header: 'section', key: 'section', width: 24 },
    { header: 'key', key: 'key', width: 42 },
    { header: 'value', key: 'value', width: 42 },
  ];
  sheet.getRow(1).font = { bold: true };
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  for (const row of rows) {
    sheet.addRow({
      section: row.section,
      key: row.key,
      value: toCellValue(row.value),
    });
  }
}

async function loadMonthlyRevenueData(params: {
  start: Date;
  end: Date;
  excludeRechargeInput?: string;
  excludeMemberInput?: string;
}) {
  const excludeRechargeInput = (params.excludeRechargeInput ?? '').trim();
  const excludeMemberInput = (params.excludeMemberInput ?? DEFAULT_EXCLUDE_MEMBER_INPUT).trim();
  const excludeRechargeRawIds = excludeRechargeInput ? parseRevenueIdentityList(excludeRechargeInput) : [];
  const excludeMemberRawIds = excludeMemberInput ? parseRevenueIdentityList(excludeMemberInput) : [];
  const [excludeRechargeResolved, excludeMemberResolved] = await Promise.all([
    resolveRevenueExclusions(excludeRechargeRawIds),
    resolveRevenueExclusions(excludeMemberRawIds),
  ]);
  const { start, end } = params;

  const excludeMembers = [...excludeRechargeResolved.preview, ...excludeMemberResolved.preview];
  const rechargeWhere: Prisma.RechargeWhereInput = {
    createdAt: { gte: start, lt: end },
    ...(buildIdentityExclusion(
      'jinleeId',
      'toWhom',
      excludeRechargeResolved.excludeJinleeIds,
      excludeRechargeResolved.excludeDiscordIds,
    ) as Prisma.RechargeWhereInput),
  };

  const withdrawWhere: Prisma.WithdrawWhereInput = {
    createdAt: { gte: start, lt: end },
    ...(buildIdentityExclusion(
      'jinleeId',
      'discordId',
      excludeRechargeResolved.excludeJinleeIds,
      excludeRechargeResolved.excludeDiscordIds,
    ) as Prisma.WithdrawWhereInput),
  };

  const zpayWhere: Prisma.ZPayRechargeOrderWhereInput = {
    status: 'PAID',
    createdAt: { gte: start, lt: end },
    ...(buildIdentityExclusion(
      'jinleeId',
      'discordUserId',
      excludeRechargeResolved.excludeJinleeIds,
      excludeRechargeResolved.excludeDiscordIds,
    ) as Prisma.ZPayRechargeOrderWhereInput),
  };

  const jinleeWhere: Prisma.JinleeUserWhereInput = buildIdentityExclusion(
    'jinleeId',
    'discordUserId',
    excludeMemberResolved.excludeJinleeIds,
    excludeMemberResolved.excludeDiscordIds,
  ) as Prisma.JinleeUserWhereInput;

  const discountRebateWhere: Prisma.IndividualTransactionWhereInput = {
    typeOfTransaction: '优惠返利',
    timeCreatedAt: { gte: start, lt: end },
  };
  const couponWhere: Prisma.CouponWhereInput = {
    status: CouponStatus.USED,
    source: { in: [CouponSource.MANUAL_GRANT, CouponSource.VIP_BENEFIT, CouponSource.CHAT_DROP] },
    consumedAt: { gte: start, lt: end },
    consumeAmount: { not: null },
    ...(buildIdentityExclusion(
      'jinleeId',
      'discordId',
      excludeMemberResolved.excludeJinleeIds,
      excludeMemberResolved.excludeDiscordIds,
    ) as Prisma.CouponWhereInput),
  };

  const [
    blockStackRows,
    rechargeRows,
    withdrawRows,
    zpayRows,
    memberRows,
    commissionRows,
    giftAuditRows,
    orderRows,
    referralPayoutRows,
    inviteRewardRows,
    discountRebateRows,
    lotteryCreatedRows,
    lotteryConsumeRows,
    scratchRows,
    expenseRows,
    pureProfitAgg,
    revertedGiftRows,
    revertedOrderRows,
    couponConsumedBySource,
  ] = await Promise.all([
    prisma.blockStackGame.findMany({
      where: { createdAt: { gte: start, lt: end } },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.recharge.findMany({ where: rechargeWhere, orderBy: { createdAt: 'desc' } }),
    prisma.withdraw.findMany({ where: withdrawWhere, orderBy: { createdAt: 'desc' } }),
    prisma.zPayRechargeOrder.findMany({ where: zpayWhere, orderBy: { createdAt: 'desc' } }),
    prisma.jinleeUser.findMany({
      where: jinleeWhere,
      orderBy: { jinleeId: 'asc' },
      select: {
        jinleeId: true,
        discordUserId: true,
        discordDisplayName: true,
        wechatDisplayName: true,
        recharge: true,
        income: true,
        totalBalance: true,
        totalSpent: true,
      },
    }),
    prisma.commission.findMany({ where: { createdAt: { gte: start, lt: end } }, orderBy: { createdAt: 'desc' } }),
    prisma.giftAudit.findMany({ where: { createdAt: { gte: start, lt: end } }, orderBy: { createdAt: 'desc' } }),
    prisma.order.findMany({
      where: {
        status: 'ENDED',
        endedAt: { gte: start, lt: end },
      },
      orderBy: { endedAt: 'desc' },
    }),
    getRevenueOrderReferralRows({
      start,
      end,
      excludeDiscordIds: excludeMemberResolved.excludeDiscordIds,
    }),
    getRevenueInviteRewardRows({
      start,
      end,
      excludeDiscordIds: excludeMemberResolved.excludeDiscordIds,
    }),
    prisma.individualTransaction.findMany({
      where: discountRebateWhere,
      orderBy: { timeCreatedAt: 'desc' },
    }),
    prisma.lotteryDraw.findMany({
      where: {
        createdAt: { gte: start, lt: end },
        ...(buildIdentityExclusion(
          'jinleeId',
          'userId',
          excludeMemberResolved.excludeJinleeIds,
          excludeMemberResolved.excludeDiscordIds,
        ) as Prisma.LotteryDrawWhereInput),
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.lotteryDraw.findMany({
      where: {
        consumeAt: { gte: start, lt: end },
        ...(buildIdentityExclusion(
          'jinleeId',
          'userId',
          excludeMemberResolved.excludeJinleeIds,
          excludeMemberResolved.excludeDiscordIds,
        ) as Prisma.LotteryDrawWhereInput),
      },
      orderBy: { consumeAt: 'desc' },
    }),
    prisma.scratchTicket.findMany({
      where: { status: 'REVEALED', revealedAt: { gte: start, lt: end } },
      orderBy: { revealedAt: 'desc' },
    }),
    prisma.expense.findMany({ where: { createdAt: { gte: start, lt: end } }, orderBy: { createdAt: 'desc' } }),
    prisma.pureProfit.aggregate({
      _sum: { amount: true },
      where: { createdAt: { gte: start, lt: end } },
    }),
    prisma.$queryRaw<RevertedGiftRow[]>(Prisma.sql`
      SELECT
        r.id AS "revertId",
        r."originalTransactionId",
        r."createdAt" AS "revertCreatedAt",
        r."status" AS "revertStatus",
        ga."createdAt" AS "giftAuditCreatedAt",
        ga."individualTransactionId",
        ga."gross",
        ga."payable",
        ga."feeAmount",
        ga."bossReferralAmount",
        ga."workerReferralAmount",
        (ga."gross" - ga."payable") AS "subsidyAmount"
      FROM "gift_audit" ga
      JOIN "revert" r
        ON r."originalTransactionId" = ga."individualTransactionId"
      WHERE r."status" = 'SUCCESS'
        AND ga."createdAt" >= ${start}
        AND ga."createdAt" < ${end}
      ORDER BY ga."createdAt" DESC
    `),
    prisma.$queryRaw<{ revertedOrderGross: Prisma.Decimal | null }[]>(Prisma.sql`
      SELECT COALESCE(SUM(oa."gross"), 0) AS "revertedOrderGross"
      FROM "order_audit" oa
      JOIN "Order" o
        ON o."id" = oa."orderId"
      JOIN "revert" r
        ON r."originalTransactionId" = CONCAT('ORDER:', oa."orderId")
      WHERE r."status" = 'SUCCESS'
        AND o."endedAt" >= ${start}
        AND o."endedAt" < ${end}
    `),
    prisma.coupon.groupBy({
      by: ['source'],
      _sum: { consumeAmount: true },
      _count: { id: true },
      where: couponWhere,
    }),
  ]);

  const blockTotalRevenue = decimalSum(blockStackRows, 'totalRevenue');
  const blockSettled = decimalSum(blockStackRows, 'settledAmount');
  const blockEnvelope = decimalSum(blockStackRows, 'collapseEnvelopeAmount');
  const blockReward = decimalSum(blockStackRows, 'collapseRewardNet');
  const blockEarning = blockTotalRevenue.sub(blockSettled).sub(blockEnvelope).sub(blockReward);

  const rechargeTotal = decimalSum(rechargeRows, 'amount');
  const withdrawTotal = decimalSum(withdrawRows, 'amount');
  const zpayTotal = decimalSum(zpayRows, 'amount');
  const netRecharge = rechargeTotal.sub(withdrawTotal);

  const memberRechargeTotal = decimalSum(memberRows, 'recharge');
  const memberIncomeTotal = decimalSum(memberRows, 'income');
  const memberBalanceTotal = decimalSum(memberRows, 'totalBalance');
  const commissionTotal = decimalSum(commissionRows, 'feeAmount');

  const giftGross = decimalSum(giftAuditRows, 'gross');
  const giftPaid = decimalSum(giftAuditRows, 'payable');
  const giftSubsidy = giftGross.sub(giftPaid);
  const revertedGiftGross = decimalSum(revertedGiftRows, 'gross');
  const revertedGiftPaid = decimalSum(revertedGiftRows, 'payable');
  const revertedGiftSubsidy = decimalSum(revertedGiftRows, 'subsidyAmount');
  const revertedGiftFee = decimalSum(revertedGiftRows, 'feeAmount');
  const revertedOrderGross = decimalSum(revertedOrderRows, 'revertedOrderGross');
  const giftGrossNet = giftGross.sub(revertedGiftGross);
  const giftPaidNet = giftPaid.sub(revertedGiftPaid);
  const giftSubsidyNet = giftSubsidy.sub(revertedGiftSubsidy);
  const giftFee = decimalSum(giftAuditRows, 'feeAmount');
  const giftFeeNet = giftFee.sub(revertedGiftFee);
  const giftReferralExpenseRow = buildGiftReferralExpenseSummaryFromRows({
    giftAuditRows,
    revertedGiftRows,
    excludeDiscordIds: excludeMemberResolved.excludeDiscordIds,
  });
  const giftReferralNet = giftReferralExpenseRow.amount;
  const orderReferralExpenseRow = summarizeOrderReferralExpenseRows(referralPayoutRows);
  const orderReferral = orderReferralExpenseRow.amount;
  const orderGross = decimalSum(orderRows, 'grossAmount');
  const orderNet = decimalSum(orderRows, 'netAmount');
  const orderFee = orderGross.sub(orderNet);
  const totalPaidFlow = giftPaidNet.add(orderGross);
  const totalFaceFlow = giftGrossNet.add(orderGross);
  const rawFeeFromOrderAndGiftModel = giftFee.add(orderFee);
  const feeFromOrderAndGiftModel = giftFeeNet.add(orderFee);
  const commissionOtherSources = commissionTotal.sub(rawFeeFromOrderAndGiftModel);
  const commissionTotalNetAll = commissionTotal.sub(revertedGiftFee);
  const discountDeductionTotal = decimalSum(discountRebateRows, 'amountChange');

  const drawCount = lotteryCreatedRows.length;
  const grossIncome = new Prisma.Decimal(drawCount).mul(29);
  const consumeTotal = decimalSum(lotteryConsumeRows, 'consumeAmount');
  const lotteryNetProfit = grossIncome.sub(consumeTotal);
  const fusionRevenue = await getLotteryFusionRevenueSummary({
    start,
    end,
    excludeJinleeIds: excludeMemberResolved.excludeJinleeIds,
    excludeDiscordIds: excludeMemberResolved.excludeDiscordIds,
  });
  const fusionCreatedRows = lotteryCreatedRows.filter((row) =>
    typeof row.nonce === 'string' ? row.nonce.startsWith('fusion:') : false,
  );
  const fusionConsumeRows = lotteryConsumeRows.filter((row) =>
    typeof row.nonce === 'string' ? row.nonce.startsWith('fusion:') : false,
  );
  const fusionPoolBreakdownText = formatBreakdownText(
    fusionRevenue.createdPoolBreakdown,
    FUSION_POOL_LABEL,
  );
  const fusionOutstandingPoolBreakdownText = formatBreakdownText(
    fusionRevenue.activeOutstandingPoolBreakdown,
    FUSION_POOL_LABEL,
  );
  const fusionRuleBreakdownText = FUSION_COUNT_BUCKET_ORDER.map(
    (bucket) => `${LOTTERY_FUSION_COUNT_BUCKET_LABEL[bucket]} ${fusionRevenue.fusionCountBreakdown[bucket]}`,
  ).join(' / ');
  const fusionRuleResultBreakdownText = FUSION_COUNT_BUCKET_ORDER.map((bucket) => {
    const poolText = formatBreakdownText(
      fusionRevenue.resultPoolByFusionCount[bucket],
      FUSION_POOL_LABEL,
    );
    return `${LOTTERY_FUSION_COUNT_BUCKET_LABEL[bucket]}: ${poolText}`;
  }).join(' / ');
  const fusionSourceKindBreakdownText = FUSION_SOURCE_KIND_ORDER.map(
    (kind) => `${LOTTERY_FUSION_SOURCE_KIND_LABEL[kind]} ${fusionRevenue.sourceKindBreakdown[kind]}`,
  ).join(' / ');
  const fusionSourcePoolBreakdownText = formatBreakdownText(
    fusionRevenue.sourcePoolBreakdown,
    FUSION_POOL_LABEL,
  );

  const scratchRevealedCount = scratchRows.length;
  const scratchGross = new Prisma.Decimal(scratchRevealedCount).mul(19);
  const scratchReward = decimalSum(scratchRows, 'prizeAmount');
  const scratchNet = scratchGross.sub(scratchReward);

  const expenseTotal = decimalSum(expenseRows, 'amount');
  const inviteRewardExpenseRow = summarizeInviteRewardExpenseRows(inviteRewardRows);
  const manualGrantCouponRow = couponConsumedBySource.find((row) => row.source === CouponSource.MANUAL_GRANT);
  const vipBenefitCouponRow = couponConsumedBySource.find((row) => row.source === CouponSource.VIP_BENEFIT);
  const chatDropCouponRow = couponConsumedBySource.find((row) => row.source === CouponSource.CHAT_DROP);
  const manualGrantCouponAmount = dec(manualGrantCouponRow?._sum.consumeAmount);
  const manualGrantCouponCount = manualGrantCouponRow?._count.id ?? 0;
  const vipBenefitCouponAmount = dec(vipBenefitCouponRow?._sum.consumeAmount);
  const vipBenefitCouponCount = vipBenefitCouponRow?._count.id ?? 0;
  const chatDropCouponAmount = dec(chatDropCouponRow?._sum.consumeAmount);
  const chatDropCouponCount = chatDropCouponRow?._count.id ?? 0;
  const expenseByReasonMap = new Map<string, { count: number; amount: Prisma.Decimal }>();
  for (const row of expenseRows) {
    const key = String(row.reason ?? '未分类');
    const existing = expenseByReasonMap.get(key);
    if (existing) {
      existing.count += 1;
      existing.amount = existing.amount.add(dec(row.amount));
    } else {
      expenseByReasonMap.set(key, { count: 1, amount: dec(row.amount) });
    }
  }
  const expenseByReasonSorted = Array.from(expenseByReasonMap.entries())
    .map(([reason, value]) => ({ reason, count: value.count, amount: value.amount }))
    .sort((a, b) => b.amount.comparedTo(a.amount));
  const expenseBreakdown = buildRevenueExpenseBreakdown({
    expenseCount: expenseRows.length,
    expenseAmount: expenseTotal,
    expenseByReasonRows: normalizeExpenseGroupRows(
      expenseByReasonSorted.map((row) => ({
        reason: row.reason,
        _count: { id: row.count },
        _sum: { amount: row.amount },
      })),
    ),
    syntheticRows: [giftReferralExpenseRow, orderReferralExpenseRow, inviteRewardExpenseRow],
  });
  const manualIncomeAdjustment = dec(pureProfitAgg._sum.amount);

  return {
    start,
    end,
    excludeRechargeInput,
    excludeMemberInput,
    excludeRechargeResolved,
    excludeMemberResolved,
    excludeMembers,
    rows: {
      blockStackRows,
      rechargeRows,
      withdrawRows,
      zpayRows,
      memberRows,
      commissionRows,
      giftAuditRows,
      orderRows,
      referralPayoutRows,
      inviteRewardRows,
      discountRebateRows,
      lotteryCreatedRows,
      lotteryConsumeRows,
      fusionCreatedRows,
      fusionConsumeRows,
      scratchRows,
      expenseRows,
      revertedGiftRows,
      revertedOrderRows,
    },
    totals: {
      blockTotalRevenue,
      blockSettled,
      blockEnvelope,
      blockReward,
      blockEarning,
      rechargeTotal,
      withdrawTotal,
      zpayTotal,
      netRecharge,
      memberRechargeTotal,
      memberIncomeTotal,
      memberBalanceTotal,
      commissionTotal,
      commissionTotalNetAll,
      giftGross,
      giftPaid,
      giftSubsidy,
      revertedGiftGross,
      revertedGiftPaid,
      revertedGiftSubsidy,
      revertedGiftFee,
      revertedOrderGross,
      giftGrossNet,
      giftPaidNet,
      giftSubsidyNet,
      giftFee,
      giftFeeNet,
      giftReferralNet,
      orderReferral,
      orderGross,
      orderNet,
      orderFee,
      totalPaidFlow,
      totalFaceFlow,
      feeFromOrderAndGiftModel,
      commissionOtherSources,
      discountDeductionTotal,
      drawCount,
      grossIncome,
      consumeTotal,
      lotteryNetProfit,
      scratchRevealedCount,
      scratchGross,
      scratchReward,
      scratchNet,
      expenseTotal,
      expenseBreakdown,
      manualGrantCouponAmount,
      manualGrantCouponCount,
      vipBenefitCouponAmount,
      vipBenefitCouponCount,
      chatDropCouponAmount,
      chatDropCouponCount,
      manualIncomeAdjustment,
    },
    summaries: {
      giftReferralExpenseRow,
      orderReferralExpenseRow,
      inviteRewardExpenseRow,
      fusionRevenue,
      fusionPoolBreakdownText,
      fusionOutstandingPoolBreakdownText,
      fusionRuleBreakdownText,
      fusionRuleResultBreakdownText,
      fusionSourceKindBreakdownText,
      fusionSourcePoolBreakdownText,
    },
  };
}

const normalizeIncomeRows = (rows: unknown): IncomeAdjustmentRow[] => {
  if (!Array.isArray(rows)) return [];
  return rows
    .map((row) => {
      if (!row || typeof row !== 'object') return null;
      const record = row as Record<string, unknown>;
      const amount = parseNumber(record.amount);
      if (amount === null) return null;
      return {
        name: textValue(record.name, textValue(record.label, '手工收入调整')),
        amount,
        note: textValue(record.note),
      };
    })
    .filter((row): row is IncomeAdjustmentRow => Boolean(row));
};

const normalizeExpenseRows = (rows: unknown): ExpenseAdjustmentRow[] => {
  if (!Array.isArray(rows)) return [];
  return rows
    .map((row) => {
      if (!row || typeof row !== 'object') return null;
      const record = row as Record<string, unknown>;
      const amount = parseNumber(record.amount);
      if (amount === null) return null;
      return {
        source: textValue(record.source, '备注支出'),
        date: textValue(record.date),
        description: textValue(record.description, textValue(record.reason, '手工支出')),
        amount,
        count: toPositiveCount(record.count, 1),
        note: textValue(record.note),
      };
    })
    .filter((row): row is ExpenseAdjustmentRow => Boolean(row));
};

const normalizePriorProfitRows = (rows: unknown): PriorProfitRow[] => {
  if (!Array.isArray(rows)) return [];
  return rows
    .map((row) => {
      if (!row || typeof row !== 'object') return null;
      const record = row as Record<string, unknown>;
      const amount = parseNumber(record.amount);
      if (amount === null) return null;
      return {
        label: textValue(record.label, textValue(record.item, '历史盈利')),
        amount,
        note: textValue(record.note),
      };
    })
    .filter((row): row is PriorProfitRow => Boolean(row));
};

const normalizeBalanceRows = (rows: unknown): BalanceAdjustmentRow[] => {
  if (!Array.isArray(rows)) return [];
  return rows
    .map((row) => {
      if (!row || typeof row !== 'object') return null;
      const record = row as Record<string, unknown>;
      const amount = parseNumber(record.amount);
      if (amount === null) return null;
      return {
        item: textValue(record.item, textValue(record.label, '调整项')),
        category: textValue(record.category),
        amount,
        description: textValue(record.description, textValue(record.note)),
      };
    })
    .filter((row): row is BalanceAdjustmentRow => Boolean(row));
};

const normalizeMonthAdjustments = (value?: Partial<MonthFinancialAdjustments>): MonthFinancialAdjustments => ({
  capitalAmount: parseNumber(value?.capitalAmount) ?? undefined,
  incomeRows: normalizeIncomeRows(value?.incomeRows),
  expenseRows: normalizeExpenseRows(value?.expenseRows),
  priorProfitRows: normalizePriorProfitRows(value?.priorProfitRows),
  assetRows: normalizeBalanceRows(value?.assetRows),
  liabilityRows: normalizeBalanceRows(value?.liabilityRows),
  equityRows: normalizeBalanceRows(value?.equityRows),
});

const mergeAdjustments = (
  base: MonthFinancialAdjustments,
  override: MonthFinancialAdjustments,
): MonthFinancialAdjustments => ({
  capitalAmount: override.capitalAmount ?? base.capitalAmount,
  incomeRows: [...base.incomeRows, ...override.incomeRows],
  expenseRows: [...base.expenseRows, ...override.expenseRows],
  priorProfitRows: [...base.priorProfitRows, ...override.priorProfitRows],
  assetRows: [...base.assetRows, ...override.assetRows],
  liabilityRows: [...base.liabilityRows, ...override.liabilityRows],
  equityRows: [...base.equityRows, ...override.equityRows],
});

async function readFinancialAdjustments(monthKey: string): Promise<MonthFinancialAdjustments> {
  let parsed: FinancialAdjustmentConfig = {};
  try {
    const raw = await fs.readFile(ADJUSTMENTS_FILE_PATH, 'utf8');
    parsed = JSON.parse(raw) as FinancialAdjustmentConfig;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }
  }

  const defaults = normalizeMonthAdjustments(parsed.default);
  const month = normalizeMonthAdjustments(parsed.months?.[monthKey]);
  return mergeAdjustments(defaults, month);
}

const styleTitle = (sheet: ExcelJS.Worksheet, title: string, lastColumn: string) => {
  sheet.mergeCells(`A1:${lastColumn}1`);
  const titleCell = sheet.getCell('A1');
  titleCell.value = title;
  titleCell.font = { bold: true, size: 18, color: { argb: TITLE_COLOR } };
  sheet.getRow(1).height = 24;
};

const styleHeaderRow = (row: ExcelJS.Row) => {
  row.eachCell({ includeEmpty: true }, (cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } };
    cell.font = { bold: true, color: { argb: HEADER_FONT } };
  });
};

const styleDataRow = (row: ExcelJS.Row) => {
  row.eachCell((cell) => {
    cell.border = { bottom: { style: 'hair', color: { argb: BORDER_COLOR } } };
  });
};

const styleTotalRow = (row: ExcelJS.Row, fill = SECTION_FILL) => {
  row.eachCell({ includeEmpty: true }, (cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } };
    cell.font = { bold: true, color: { argb: 'FFFFFF' } };
  });
};

const setMoneyCell = (cell: ExcelJS.Cell, value: DecimalLike) => {
  cell.value = toNumber(value);
  cell.numFmt = MONEY_FORMAT;
  cell.alignment = { horizontal: 'right' };
};

const setMoneyFormulaCell = (cell: ExcelJS.Cell, formula: string, result: DecimalLike) => {
  cell.value = { formula, result: toNumber(result) };
  cell.numFmt = MONEY_FORMAT;
  cell.alignment = { horizontal: 'right' };
};

const blankToNull = (value: string) => value || null;

const setCountCell = (cell: ExcelJS.Cell, value: number) => {
  cell.value = value;
  cell.numFmt = COUNT_FORMAT;
};

const getLastDayOfMonth = (year: number, month: number) =>
  new Date(Date.UTC(year, month, 0)).getUTCDate();

const getMonthLabel = (year: number, month: number) => `${month}月`;

const buildIncomeStatementRows = (
  data: Awaited<ReturnType<typeof loadMonthlyRevenueData>>,
  adjustments: MonthFinancialAdjustments,
) => [
  {
    name: '抽成净收入',
    amount: data.totals.commissionTotalNetAll,
    note: '来自 admin 当前区间数据',
  },
  {
    name: '抽奖净收入',
    amount: data.totals.lotteryNetProfit,
    note: '来自 admin 当前区间数据',
  },
  {
    name: '刮刮乐净收入',
    amount: data.totals.scratchNet,
    note: '来自 admin 当前区间数据',
  },
  {
    name: '积木游戏净收入',
    amount: data.totals.blockEarning,
    note: '来自 admin 当前区间数据',
  },
  {
    name: '手工收入调整（扣款）',
    amount: data.totals.manualIncomeAdjustment,
    note: '来自 PureProfit 表',
  },
  ...adjustments.incomeRows,
];

const getExpenseSource = (reason: string) => {
  if (reason === REVENUE_EXPENSE_REASON_GIFT_REFERRAL) return '邀请返现';
  if (reason === REVENUE_EXPENSE_REASON_ORDER_REFERRAL) return '邀请返现';
  if (reason === REVENUE_EXPENSE_REASON_INVITE_REWARD) return '邀请奖励';
  return '数据库支出';
};

const buildIncomeStatementExpenseRows = (
  data: Awaited<ReturnType<typeof loadMonthlyRevenueData>>,
  adjustments: MonthFinancialAdjustments,
) => [
  ...data.totals.expenseBreakdown.byReasonRows.map((row) => ({
    source: getExpenseSource(row.reason),
    date: '',
    description: row.reason,
    amount: row.amount,
    count: row.count,
    note:
      getExpenseSource(row.reason) === '数据库支出'
        ? `合并 ${row.count} 笔 Expense`
        : `合并 ${row.count} 笔`,
  })),
  ...adjustments.expenseRows,
];

function buildFinancialStatementWorkbook(params: {
  year: number;
  month: number;
  data: Awaited<ReturnType<typeof loadMonthlyRevenueData>>;
  adjustments: MonthFinancialAdjustments;
}) {
  const { year, month, data, adjustments } = params;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'jinlee admin';
  workbook.created = new Date();
  workbook.modified = new Date();

  const lastDay = getLastDayOfMonth(year, month);
  const incomeRows = buildIncomeStatementRows(data, adjustments);
  const expenseRows = buildIncomeStatementExpenseRows(data, adjustments);
  const incomeTotal = incomeRows.reduce((sum, row) => sum.add(dec(row.amount)), new Prisma.Decimal(0));
  const expenseTotal = expenseRows.reduce((sum, row) => sum.add(dec(row.amount)), new Prisma.Decimal(0));
  const netProfit = incomeTotal.sub(expenseTotal);

  const profitSheet = workbook.addWorksheet('利润表', {
    views: [{ showGridLines: false }],
  });
  profitSheet.columns = [
    { key: 'source', width: 20 },
    { key: 'date', width: 20 },
    { key: 'description', width: 24 },
    { key: 'amount', width: 16 },
    { key: 'count', width: 12 },
    { key: 'note', width: 50 },
  ];
  styleTitle(profitSheet, `${year}年${month}月${lastDay}号利润表`, 'F');
  profitSheet.addRow([]);
  profitSheet.addRow([]);
  profitSheet.addRow(['收入项目', null, null, '金额', null, '备注']);
  styleHeaderRow(profitSheet.getRow(4));

  const incomeStartRow = 5;
  for (const row of incomeRows) {
    const sheetRow = profitSheet.addRow([row.name, null, null, null, null, blankToNull(row.note)]);
    setMoneyCell(sheetRow.getCell(4), row.amount);
    styleDataRow(sheetRow);
  }
  const incomeEndRow = incomeStartRow + incomeRows.length - 1;
  const incomeTotalRow = incomeEndRow + 1;
  const incomeTotalSheetRow = profitSheet.addRow(['收入合计', null, null, null, null, null]);
  setMoneyFormulaCell(
    incomeTotalSheetRow.getCell(4),
    incomeRows.length ? `SUM(D${incomeStartRow}:D${incomeEndRow})` : '0',
    incomeTotal,
  );
  styleTotalRow(incomeTotalSheetRow);

  profitSheet.addRow([]);
  const expenseHeaderRowNumber = incomeTotalRow + 2;
  const expenseHeaderRow = profitSheet.addRow(['支出来源', '日期', '支出说明', '金额', '原始笔数', '备注']);
  styleHeaderRow(expenseHeaderRow);
  const expenseStartRow = expenseHeaderRowNumber + 1;
  for (const row of expenseRows) {
    const sheetRow = profitSheet.addRow([
      row.source,
      blankToNull(row.date),
      row.description,
      null,
      null,
      blankToNull(row.note),
    ]);
    setMoneyCell(sheetRow.getCell(4), row.amount);
    setCountCell(sheetRow.getCell(5), row.count);
    styleDataRow(sheetRow);
  }
  const expenseEndRow = expenseStartRow + expenseRows.length - 1;
  const expenseTotalRow = expenseEndRow + 1;
  const expenseTotalSheetRow = profitSheet.addRow(['支出合计', null, null, null, null, null]);
  setMoneyFormulaCell(
    expenseTotalSheetRow.getCell(4),
    expenseRows.length ? `SUM(D${expenseStartRow}:D${expenseEndRow})` : '0',
    expenseTotal,
  );
  expenseTotalSheetRow.getCell(5).value = {
    formula: expenseRows.length ? `SUM(E${expenseStartRow}:E${expenseEndRow})` : '0',
    result: expenseRows.reduce((sum, row) => sum + row.count, 0),
  };
  expenseTotalSheetRow.getCell(5).numFmt = COUNT_FORMAT;
  styleTotalRow(expenseTotalSheetRow, EXPENSE_TOTAL_FILL);
  const netProfitRow = profitSheet.addRow(['净利润', null, null, null, null, '收入合计 - 支出合计']);
  setMoneyFormulaCell(netProfitRow.getCell(4), `D${incomeTotalRow}-D${expenseTotalRow}`, netProfit);
  styleTotalRow(netProfitRow);
  if (expenseRows.length) {
    profitSheet.autoFilter = {
      from: `A${expenseHeaderRowNumber}`,
      to: `F${expenseEndRow}`,
    };
  }

  const capitalAmount = adjustments.capitalAmount ?? DEFAULT_CAPITAL_AMOUNT;
  const priorProfitTotal = adjustments.priorProfitRows.reduce(
    (sum, row) => sum.add(dec(row.amount)),
    new Prisma.Decimal(0),
  );
  const balanceSheet = workbook.addWorksheet('资产负债表', {
    views: [{ state: 'frozen', ySplit: 4, showGridLines: false }],
  });
  balanceSheet.columns = [
    { key: 'item', width: 22 },
    { key: 'category', width: 18 },
    { key: 'amount', width: 18 },
    { key: 'description', width: 40 },
  ];
  styleTitle(balanceSheet, `${year}年${month}月${lastDay}号资产负债表`, 'D');
  balanceSheet.addRow([]);
  balanceSheet.addRow([]);
  const balanceHeaderRow = balanceSheet.addRow(['项目', '分类', '金额', '说明']);
  styleHeaderRow(balanceHeaderRow);

  const assetSectionRow = balanceSheet.addRow(['资产', null, null, null]);
  styleTotalRow(assetSectionRow);
  const assetStartRow = assetSectionRow.number + 1;
  const assetRows: BalanceAdjustmentRow[] = [
    { item: '总用户余额', category: '', amount: toNumber(data.totals.memberBalanceTotal), description: '' },
    ...adjustments.priorProfitRows.map((row) => ({
      item: row.label,
      category: '',
      amount: row.amount,
      description: row.note,
    })),
    {
      item: `${getMonthLabel(year, month)}盈利`,
      category: '',
      amount: toNumber(netProfit),
      description: '分红',
    },
    { item: '投入资本', category: '', amount: capitalAmount, description: '' },
    ...adjustments.assetRows,
  ];
  for (const row of assetRows) {
    const sheetRow = balanceSheet.addRow([
      row.item,
      blankToNull(row.category),
      null,
      blankToNull(row.description),
    ]);
    setMoneyCell(sheetRow.getCell(3), row.amount);
  }
  const assetEndRow = assetStartRow + assetRows.length - 1;
  const assetTotalRow = balanceSheet.addRow(['资产总计（总现金）', null, null, null]);
  setMoneyFormulaCell(assetTotalRow.getCell(3), `SUM(C${assetStartRow}:C${assetEndRow})`, data.totals.memberBalanceTotal.add(priorProfitTotal).add(netProfit).add(capitalAmount).add(adjustments.assetRows.reduce((sum, row) => sum.add(dec(row.amount)), new Prisma.Decimal(0))));
  styleTotalRow(assetTotalRow);

  balanceSheet.addRow([]);
  const liabilitySectionRow = balanceSheet.addRow(['负债', null, null, null]);
  styleTotalRow(liabilitySectionRow, EXPENSE_TOTAL_FILL);
  const liabilityStartRow = liabilitySectionRow.number + 1;
  const payableDividends = priorProfitTotal.add(netProfit);
  const liabilityRows: BalanceAdjustmentRow[] = [
    {
      item: '用户余额',
      category: '流动负债',
      amount: toNumber(data.totals.memberBalanceTotal),
      description: '已按 admin 排除规则计算',
    },
    {
      item: '应付分红',
      category: '流动负债',
      amount: toNumber(payableDividends),
      description: '月底前尚未支付',
    },
    ...adjustments.liabilityRows,
  ];
  for (const row of liabilityRows) {
    const sheetRow = balanceSheet.addRow([
      row.item,
      blankToNull(row.category),
      null,
      blankToNull(row.description),
    ]);
    setMoneyCell(sheetRow.getCell(3), row.amount);
  }
  const liabilityEndRow = liabilityStartRow + liabilityRows.length - 1;
  const liabilityTotal = data.totals.memberBalanceTotal.add(payableDividends).add(
    adjustments.liabilityRows.reduce((sum, row) => sum.add(dec(row.amount)), new Prisma.Decimal(0)),
  );
  const liabilityTotalRow = balanceSheet.addRow(['负债合计', null, null, null]);
  setMoneyFormulaCell(liabilityTotalRow.getCell(3), `SUM(C${liabilityStartRow}:C${liabilityEndRow})`, liabilityTotal);
  styleTotalRow(liabilityTotalRow, EXPENSE_TOTAL_FILL);

  balanceSheet.addRow([]);
  const equitySectionRow = balanceSheet.addRow(['所有者权益', null, null, null]);
  styleTotalRow(equitySectionRow);
  const equityStartRow = equitySectionRow.number + 1;
  const equityRows: BalanceAdjustmentRow[] = [
    { item: '实际资本', category: '股东投入', amount: capitalAmount, description: '初始注资保留' },
    ...adjustments.equityRows,
  ];
  for (const row of equityRows) {
    const sheetRow = balanceSheet.addRow([
      row.item,
      blankToNull(row.category),
      null,
      blankToNull(row.description),
    ]);
    setMoneyCell(sheetRow.getCell(3), row.amount);
  }
  const equityEndRow = equityStartRow + equityRows.length - 1;
  const equityTotal = new Prisma.Decimal(capitalAmount).add(
    adjustments.equityRows.reduce((sum, row) => sum.add(dec(row.amount)), new Prisma.Decimal(0)),
  );
  const equityTotalRow = balanceSheet.addRow(['所有者权益合计', null, null, null]);
  setMoneyFormulaCell(equityTotalRow.getCell(3), `SUM(C${equityStartRow}:C${equityEndRow})`, equityTotal);
  styleTotalRow(equityTotalRow);

  balanceSheet.addRow([]);
  const totalLiabilityEquityRow = balanceSheet.addRow(['负债和所有者权益总计', null, null, '应等于资产总计']);
  setMoneyFormulaCell(
    totalLiabilityEquityRow.getCell(3),
    `C${liabilityTotalRow.number}+C${equityTotalRow.number}`,
    liabilityTotal.add(equityTotal),
  );
  styleTotalRow(totalLiabilityEquityRow);

  return workbook;
}

function buildAdminRevenueDataWorkbook(data: Awaited<ReturnType<typeof loadMonthlyRevenueData>>) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'jinlee admin';
  workbook.created = new Date();

  addKeyValueSheet(workbook, '导出参数', [
    { section: 'filters', key: 'start', value: formatDateTimeTextCentralEuropean(data.start) },
    { section: 'filters', key: 'end(exclusive)', value: formatDateTimeTextCentralEuropean(data.end) },
    { section: 'filters', key: 'excludeRecharge(raw)', value: data.excludeRechargeInput },
    { section: 'filters', key: 'excludeMember(raw)', value: data.excludeMemberInput },
    { section: 'filters', key: 'excludeRechargeJinleeIds', value: data.excludeRechargeResolved.excludeJinleeIds.join(', ') },
    { section: 'filters', key: 'excludeRechargeDiscordIds', value: data.excludeRechargeResolved.excludeDiscordIds.join(', ') },
    { section: 'filters', key: 'excludeMemberJinleeIds', value: data.excludeMemberResolved.excludeJinleeIds.join(', ') },
    { section: 'filters', key: 'excludeMemberDiscordIds', value: data.excludeMemberResolved.excludeDiscordIds.join(', ') },
    { section: 'rows', key: 'BlockStackGame', value: data.rows.blockStackRows.length },
    { section: 'rows', key: 'Recharge', value: data.rows.rechargeRows.length },
    { section: 'rows', key: 'Withdraw', value: data.rows.withdrawRows.length },
    { section: 'rows', key: 'ZPayRechargeOrder(PAID)', value: data.rows.zpayRows.length },
    { section: 'rows', key: 'JinleeUser(filtered)', value: data.rows.memberRows.length },
    { section: 'rows', key: 'Commission(all)', value: data.rows.commissionRows.length },
    { section: 'rows', key: 'GiftAudit', value: data.rows.giftAuditRows.length },
    { section: 'rows', key: 'Order(ENDED all)', value: data.rows.orderRows.length },
    { section: 'rows', key: 'ReferralPayout(filtered ENDED)', value: data.rows.referralPayoutRows.length },
    { section: 'rows', key: 'InviteLinkUsage(filtered)', value: data.rows.inviteRewardRows.length },
    { section: 'rows', key: 'IndividualTransaction(优惠返利 all)', value: data.rows.discountRebateRows.length },
    { section: 'rows', key: 'LotteryDraw(createdAt window)', value: data.rows.lotteryCreatedRows.length },
    { section: 'rows', key: 'LotteryDraw(consumeAt window)', value: data.rows.lotteryConsumeRows.length },
    { section: 'rows', key: 'LotteryFusion(createdAt window)', value: data.rows.fusionCreatedRows.length },
    { section: 'rows', key: 'LotteryFusion(consumeAt window)', value: data.rows.fusionConsumeRows.length },
    { section: 'rows', key: 'ScratchTicket(REVEALED)', value: data.rows.scratchRows.length },
    { section: 'rows', key: 'Expense', value: data.rows.expenseRows.length },
    { section: 'rows', key: 'RevertedGiftSubsidy(join)', value: data.rows.revertedGiftRows.length },
    { section: 'rows', key: 'RevertedOrder(join)', value: data.rows.revertedOrderRows.length },
    { section: 'rows', key: 'Coupon(used MANUAL_GRANT)', value: data.totals.manualGrantCouponCount },
    { section: 'rows', key: 'Coupon(used VIP_BENEFIT)', value: data.totals.vipBenefitCouponCount },
    { section: 'rows', key: 'Coupon(used CHAT_DROP)', value: data.totals.chatDropCouponCount },
  ]);

  addKeyValueSheet(workbook, '收益汇总', [
    { section: '当月充值提现', key: 'Recharge 充值总额', value: data.totals.rechargeTotal.toString() },
    { section: '当月充值提现', key: 'ZPay 已支付', value: data.totals.zpayTotal.toString() },
    { section: '当月充值提现', key: '提现总额', value: data.totals.withdrawTotal.toString() },
    { section: '当月充值提现', key: '净充值', value: data.totals.netRecharge.toString() },
    { section: '会员余额汇总', key: 'JinleeUser.recharge 合计', value: data.totals.memberRechargeTotal.toString() },
    { section: '会员余额汇总', key: 'JinleeUser.income 合计', value: data.totals.memberIncomeTotal.toString() },
    { section: '会员余额汇总', key: 'JinleeUser.totalBalance 合计', value: data.totals.memberBalanceTotal.toString() },
    { section: '会员余额汇总', key: '当月 Commission 合计', value: data.totals.commissionTotalNetAll.toString() },
    { section: '抽奖收益', key: '抽奖次数', value: data.totals.drawCount },
    { section: '抽奖收益', key: '毛收入（次数×29）', value: data.totals.grossIncome.toString() },
    { section: '抽奖收益', key: '券抵扣消耗', value: data.totals.consumeTotal.toString() },
    { section: '抽奖收益', key: '净收益', value: data.totals.lotteryNetProfit.toString() },
    { section: '重铸成本', key: '本期重铸产出', value: data.summaries.fusionRevenue.createdCount },
    { section: '重铸成本', key: '本期已核销', value: data.summaries.fusionRevenue.consumedCount },
    { section: '重铸成本', key: '本期已核销成本', value: data.summaries.fusionRevenue.realizedCost.toString() },
    { section: '重铸成本', key: '当前待核销', value: data.summaries.fusionRevenue.activeOutstandingCount },
    { section: '重铸成本', key: '本期产出池分布', value: data.summaries.fusionPoolBreakdownText },
    { section: '重铸成本', key: '当前待核销池分布', value: data.summaries.fusionOutstandingPoolBreakdownText },
    { section: '重铸成本', key: '再次投入的重铸产物来源数', value: data.summaries.fusionRevenue.rerolledLotteryInputCount },
    { section: '重铸成本', key: '再次投入的重铸次数', value: data.summaries.fusionRevenue.rerolledRequestCount },
    { section: '重铸规则', key: '规则分布', value: data.summaries.fusionRuleBreakdownText },
    { section: '重铸规则', key: '各规则产出池', value: data.summaries.fusionRuleResultBreakdownText },
    { section: '重铸来源', key: '来源类型分布', value: data.summaries.fusionSourceKindBreakdownText },
    { section: '重铸来源', key: '来源池分布', value: data.summaries.fusionSourcePoolBreakdownText },
    { section: '刮刮乐收益', key: '已刮开数量', value: data.totals.scratchRevealedCount },
    { section: '刮刮乐收益', key: '毛收入（数量×19）', value: data.totals.scratchGross.toString() },
    { section: '刮刮乐收益', key: '中奖支出', value: data.totals.scratchReward.toString() },
    { section: '刮刮乐收益', key: '净收益', value: data.totals.scratchNet.toString() },
    { section: '积木游戏收益', key: '总收入', value: data.totals.blockTotalRevenue.toString() },
    { section: '积木游戏收益', key: '结算支出', value: data.totals.blockSettled.toString() },
    { section: '积木游戏收益', key: '塌方红包', value: data.totals.blockEnvelope.toString() },
    { section: '积木游戏收益', key: '捣蛋奖励', value: data.totals.blockReward.toString() },
    { section: '积木游戏收益', key: '净收益', value: data.totals.blockEarning.toString() },
    { section: '支出记录(Expense + 邀请)', key: 'Expense 表笔数', value: data.rows.expenseRows.length },
    { section: '支出记录(Expense + 邀请)', key: 'Expense 表总额', value: data.totals.expenseTotal.toString() },
    { section: '支出记录(Expense + 邀请)', key: data.summaries.giftReferralExpenseRow.reason, value: data.summaries.giftReferralExpenseRow.amount.toString() },
    { section: '支出记录(Expense + 邀请)', key: `${data.summaries.giftReferralExpenseRow.reason}笔数`, value: data.summaries.giftReferralExpenseRow.count },
    { section: '支出记录(Expense + 邀请)', key: data.summaries.orderReferralExpenseRow.reason, value: data.summaries.orderReferralExpenseRow.amount.toString() },
    { section: '支出记录(Expense + 邀请)', key: `${data.summaries.orderReferralExpenseRow.reason}笔数`, value: data.summaries.orderReferralExpenseRow.count },
    { section: '支出记录(Expense + 邀请)', key: data.summaries.inviteRewardExpenseRow.reason, value: data.summaries.inviteRewardExpenseRow.amount.toString() },
    { section: '支出记录(Expense + 邀请)', key: `${data.summaries.inviteRewardExpenseRow.reason}笔数`, value: data.summaries.inviteRewardExpenseRow.count },
    { section: '支出记录(Expense + 邀请)', key: '扩展总支出', value: data.totals.expenseBreakdown.totalAmount.toString() },
    { section: '支出记录(Expense + 邀请)', key: '扩展总支出笔数', value: data.totals.expenseBreakdown.totalCount },
    { section: '支出记录(Expense + 邀请)', key: 'Coupon表格金额（手动送券）', value: data.totals.manualGrantCouponAmount.toString() },
    { section: '支出记录(Expense + 邀请)', key: 'Coupon表格笔数（手动送券）', value: data.totals.manualGrantCouponCount },
    { section: '支出记录(Expense + 邀请)', key: 'Coupon表格金额（VIP福利）', value: data.totals.vipBenefitCouponAmount.toString() },
    { section: '支出记录(Expense + 邀请)', key: 'Coupon表格笔数（VIP福利）', value: data.totals.vipBenefitCouponCount },
    { section: '支出记录(Expense + 邀请)', key: 'Coupon表格金额（彩蛋）', value: data.totals.chatDropCouponAmount.toString() },
    { section: '支出记录(Expense + 邀请)', key: 'Coupon表格笔数（彩蛋）', value: data.totals.chatDropCouponCount },
    { section: '抽成详情', key: '打赏面值流水', value: data.totals.giftGrossNet.toString() },
    { section: '抽成详情', key: '打赏实付流水', value: data.totals.giftPaidNet.toString() },
    { section: '抽成详情', key: '打赏抽成', value: data.totals.giftFeeNet.toString() },
    { section: '抽成详情', key: '打赏返利', value: data.totals.giftReferralNet.toString() },
    { section: '抽成详情', key: '总撤回打赏金额', value: data.totals.revertedGiftGross.toString() },
    { section: '抽成详情', key: '总撤回单子金额', value: data.totals.revertedOrderGross.toString() },
    { section: '抽成详情', key: '订单返利', value: data.totals.orderReferral.toString() },
    { section: '抽成详情', key: '打赏补贴(代金券原始)', value: data.totals.giftSubsidy.toString() },
    { section: '抽成详情', key: '打赏补贴回退(打赏撤销)', value: data.totals.revertedGiftSubsidy.toString() },
    { section: '抽成详情', key: '打赏补贴(代金券净额)', value: data.totals.giftSubsidyNet.toString() },
    { section: '抽成详情', key: '打折券抵扣金额', value: data.totals.discountDeductionTotal.toString() },
    { section: '抽成详情', key: '单子总数', value: data.rows.orderRows.length },
    { section: '抽成详情', key: '订单流水', value: data.totals.orderGross.toString() },
    { section: '抽成详情', key: '订单结算', value: data.totals.orderNet.toString() },
    { section: '抽成详情', key: '订单抽成', value: data.totals.orderFee.toString() },
    { section: '抽成详情', key: '总抽成', value: data.totals.commissionTotalNetAll.toString() },
    { section: '抽成详情', key: '总面值原价流水', value: data.totals.totalFaceFlow.toString() },
    { section: '抽成详情', key: '总实付流水', value: data.totals.totalPaidFlow.toString() },
    { section: '抽成详情', key: '模型抽成合计（订单+打赏）', value: data.totals.feeFromOrderAndGiftModel.toString() },
    { section: '抽成详情', key: '其他来源抽成', value: data.totals.commissionOtherSources.toString() },
  ]);

  addObjectRowsSheet(
    workbook,
    '重铸规则分布',
    FUSION_COUNT_BUCKET_ORDER.map((bucket) => ({
      rule: LOTTERY_FUSION_COUNT_BUCKET_LABEL[bucket],
      rerollCount: data.summaries.fusionRevenue.fusionCountBreakdown[bucket],
      resultPools: formatBreakdownText(
        data.summaries.fusionRevenue.resultPoolByFusionCount[bucket],
        FUSION_POOL_LABEL,
      ),
    })),
  );
  addObjectRowsSheet(
    workbook,
    '重铸来源类型',
    FUSION_SOURCE_KIND_ORDER.map((kind) => ({
      sourceKind: LOTTERY_FUSION_SOURCE_KIND_LABEL[kind],
      count: data.summaries.fusionRevenue.sourceKindBreakdown[kind],
    })),
  );
  addObjectRowsSheet(
    workbook,
    '重铸来源池',
    Object.entries(data.summaries.fusionRevenue.sourcePoolBreakdown).map(([pool, count]) => ({
      pool,
      poolLabel: FUSION_POOL_LABEL[pool] ?? pool,
      count,
    })),
  );
  addObjectRowsSheet(
    workbook,
    '重铸待核销池',
    Object.entries(data.summaries.fusionRevenue.activeOutstandingPoolBreakdown).map(([pool, count]) => ({
      pool,
      poolLabel: FUSION_POOL_LABEL[pool] ?? pool,
      count,
    })),
  );

  addObjectRowsSheet(workbook, '排除ID映射', data.excludeMembers);
  addObjectRowsSheet(workbook, '积木游戏明细', data.rows.blockStackRows);
  addObjectRowsSheet(workbook, '充值明细', data.rows.rechargeRows);
  addObjectRowsSheet(workbook, '提现明细', data.rows.withdrawRows);
  addObjectRowsSheet(workbook, 'ZPay已支付明细', data.rows.zpayRows);
  addObjectRowsSheet(workbook, '会员汇总明细', data.rows.memberRows);
  addObjectRowsSheet(workbook, '抽成明细_Commission', data.rows.commissionRows);
  addObjectRowsSheet(workbook, '打赏审计明细', data.rows.giftAuditRows);
  addObjectRowsSheet(workbook, '打赏补贴回退明细', data.rows.revertedGiftRows);
  addObjectRowsSheet(workbook, '订单明细_ENDED', data.rows.orderRows);
  addObjectRowsSheet(workbook, '订单返利明细', data.rows.referralPayoutRows);
  addObjectRowsSheet(workbook, '邀请进服奖励明细', data.rows.inviteRewardRows);
  addObjectRowsSheet(workbook, '优惠返利流水', data.rows.discountRebateRows);
  addObjectRowsSheet(workbook, '抽奖明细_创建时间', data.rows.lotteryCreatedRows);
  addObjectRowsSheet(workbook, '抽奖明细_消耗时间', data.rows.lotteryConsumeRows);
  addObjectRowsSheet(workbook, '重铸明细_创建时间', data.rows.fusionCreatedRows);
  addObjectRowsSheet(workbook, '重铸明细_消耗时间', data.rows.fusionConsumeRows);
  addObjectRowsSheet(workbook, '刮刮乐已刮开明细', data.rows.scratchRows);
  addObjectRowsSheet(workbook, '支出明细', data.rows.expenseRows);
  addObjectRowsSheet(
    workbook,
    '支出分类汇总',
    data.totals.expenseBreakdown.byReasonRows.map((row) => ({
      reason: row.reason,
      count: row.count,
      amount: row.amount.toString(),
    })),
  );

  return workbook;
}

export const getMonthlyReportStorageDir = () => REPORT_STORAGE_DIR;
export const getFinancialAdjustmentsFilePath = () => ADJUSTMENTS_FILE_PATH;

export const parseMonthlyReportMonthKey = (monthKey: string) => {
  const match = monthKey.trim().match(/^(\d{4})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) return null;
  return {
    ...buildCentralEuropeanMonthRange(year, month),
    monthKey: formatCentralEuropeanMonthKey(year, month),
  };
};

const getTargetMonth = (monthKey?: string) => {
  if (monthKey) {
    const parsed = parseMonthlyReportMonthKey(monthKey);
    if (!parsed) throw new Error('月份格式必须是 YYYY-MM');
    return parsed;
  }
  const previous = getPreviousCentralEuropeanMonthRange();
  return {
    ...previous,
    monthKey: formatCentralEuropeanMonthKey(previous.year, previous.month),
  };
};

const getFileStats = async (filePath: string) => {
  const stat = await fs.stat(filePath);
  return {
    size: stat.size,
    modifiedAt: stat.mtime,
  };
};

const writeWorkbook = async (workbook: ExcelJS.Workbook, filePath: string, force: boolean) => {
  try {
    if (!force) {
      await fs.access(filePath);
      return {
        filePath,
        skipped: true,
        ...(await getFileStats(filePath)),
      };
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }

  await workbook.xlsx.writeFile(filePath);
  return {
    filePath,
    skipped: false,
    ...(await getFileStats(filePath)),
  };
};

export async function generateStoredMonthlyFinancialReports(params: {
  monthKey?: string;
  force?: boolean;
} = {}) {
  const target = getTargetMonth(params.monthKey);
  const adjustments = await readFinancialAdjustments(target.monthKey);
  const data = await loadMonthlyRevenueData({
    start: target.start,
    end: target.end,
    excludeMemberInput: DEFAULT_EXCLUDE_MEMBER_INPUT,
  });
  const targetDir = path.join(REPORT_STORAGE_DIR, target.monthKey);
  await fs.mkdir(targetDir, { recursive: true });

  const financialFileName = `${target.year}年${target.month}月财务报表.xlsx`;
  const adminDataFileName = `${target.year}年${target.month}月后台收益数据.xlsx`;
  const financialFilePath = path.join(targetDir, financialFileName);
  const adminDataFilePath = path.join(targetDir, adminDataFileName);
  const force = Boolean(params.force);

  const financialWorkbook = buildFinancialStatementWorkbook({
    year: target.year,
    month: target.month,
    data,
    adjustments,
  });
  const adminDataWorkbook = buildAdminRevenueDataWorkbook(data);

  const [financialStatement, adminData] = await Promise.all([
    writeWorkbook(financialWorkbook, financialFilePath, force),
    writeWorkbook(adminDataWorkbook, adminDataFilePath, force),
  ]);

  return {
    monthKey: target.monthKey,
    year: target.year,
    month: target.month,
    start: target.start,
    end: target.end,
    financialStatement,
    adminData,
  };
}

const getDownloadHref = (relativePath: string) =>
  `/api/admin/revenue/files/download/${relativePath
    .split(path.sep)
    .map((segment) => encodeURIComponent(segment))
    .join('/')}`;

const getKindLabel = (fileName: string) => {
  if (fileName.includes('财务报表')) return '财务报表';
  if (fileName.includes('后台收益数据')) return '后台收益数据';
  return 'Excel';
};

export async function listStoredMonthlyReportFiles(): Promise<StoredMonthlyReportFile[]> {
  const files: StoredMonthlyReportFile[] = [];

  const visit = async (directory: string, monthKey = '') => {
    let entries: StringDirent[];
    try {
      entries = (await fs.readdir(directory, { withFileTypes: true })) as StringDirent[];
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
      throw error;
    }

    for (const entry of entries) {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        await visit(fullPath, entry.name);
        continue;
      }
      if (!entry.isFile() || !entry.name.toLowerCase().endsWith('.xlsx')) continue;
      const relativePath = path.relative(REPORT_STORAGE_DIR, fullPath);
      const stat = await fs.stat(fullPath);
      files.push({
        monthKey,
        fileName: entry.name,
        relativePath,
        downloadHref: getDownloadHref(relativePath),
        kindLabel: getKindLabel(entry.name),
        size: stat.size,
        modifiedAt: stat.mtime,
      });
    }
  };

  await visit(REPORT_STORAGE_DIR);
  return files.sort((left, right) => {
    const monthCompare = right.monthKey.localeCompare(left.monthKey);
    if (monthCompare !== 0) return monthCompare;
    return left.fileName.localeCompare(right.fileName, 'zh-CN');
  });
}

export const resolveStoredMonthlyReportFilePath = (segments: string[]) => {
  const relativeSegments = segments.map((segment) => decodeURIComponent(segment)).filter(Boolean);
  if (!relativeSegments.length) return null;
  if (relativeSegments.some((segment) => segment === '..' || segment.includes('/') || segment.includes('\\'))) {
    return null;
  }
  const baseDir = path.resolve(REPORT_STORAGE_DIR);
  const resolved = path.resolve(baseDir, ...relativeSegments);
  if (!resolved.startsWith(`${baseDir}${path.sep}`)) return null;
  if (!resolved.toLowerCase().endsWith('.xlsx')) return null;
  return resolved;
};
