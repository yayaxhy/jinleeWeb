import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import ExcelJS from 'exceljs';
import { CouponSource, CouponStatus, Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import {
  isNewEntityReportMonth,
  NEW_ENTITY_OPERATIONS_STARTED_AT,
  newEntityOnlyTime,
  newEntityReportStart,
} from '@/lib/operating-entity-cutover';
import {
  buildCentralEuropeanMonthRange,
  formatCentralEuropeanMonthKey,
  formatDateTimeTextCentralEuropean,
  getCentralEuropeanMonthParts,
  getPreviousCentralEuropeanMonthRange,
} from '@/lib/centralEuropeanDateRange';
import {
  buildRevenueCouponIdentityExclusion,
  parseRevenueIdentityList,
  resolveRevenueExclusions,
} from '@/lib/admin/revenue-exclusion';
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
import { getVoucherReversalAdjustments } from '@/lib/admin/voucher-reversal';

// The new operating entity started with no money in its bank account.
const NEW_ENTITY_OPENING_BANK_BALANCE = new Prisma.Decimal(0);
const PRIOR_PERIOD_ADJUSTMENT_PREFIX = '前期调整（';
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

export const calculateRecordedBankCash = (
  opening: Prisma.Decimal,
  rechargeInflow: Prisma.Decimal,
  withdrawalOutflow: Prisma.Decimal,
  manualExpenseOutflow: Prisma.Decimal,
  dividendPaymentOutflow = new Prisma.Decimal(0),
) => {
  const movement = rechargeInflow.sub(withdrawalOutflow).sub(manualExpenseOutflow).sub(dividendPaymentOutflow);
  return { movement, closing: opening.add(movement) };
};

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

type BalanceSheetModelRow = {
  item: string;
  category: string;
  note: string;
  amount: Prisma.Decimal;
};

// Profit and loss changes equity; it is neither a cash asset nor an
// automatically declared dividend. Keep unreconciled balances visible.
export const buildMonthlyBalanceSheetModel = (params: {
  estimatedBankCash: Prisma.Decimal;
  userBalance: Prisma.Decimal;
  netProfit: Prisma.Decimal;
  openingCapital: Prisma.Decimal;
  dividendDeclared: Prisma.Decimal;
  dividendPayable: Prisma.Decimal;
  adjustments: Pick<MonthFinancialAdjustments, 'priorProfitRows' | 'assetRows' | 'liabilityRows' | 'equityRows'>;
}) => {
  const { estimatedBankCash, userBalance, netProfit, openingCapital, dividendDeclared, dividendPayable, adjustments } = params;
  const mapAdjustments = (rows: BalanceAdjustmentRow[]): BalanceSheetModelRow[] => rows.map((row) => ({
    item: row.item,
    category: row.category,
    note: row.description,
    amount: dec(row.amount),
  }));
  const assetRows: BalanceSheetModelRow[] = [
    {
      item: '期末银行余额（账面推算）',
      category: '现金（待核对）',
      note: '根据已记录现金收支推算，尚未与银行流水核对',
      amount: estimatedBankCash,
    },
    ...mapAdjustments(adjustments.assetRows),
  ];
  const liabilityRows: BalanceSheetModelRow[] = [
    {
      item: '用户余额',
      category: '流动负债',
      note: '已按 admin 排除规则计算；仍需核对新主体承担范围',
      amount: userBalance,
    },
    { item: '应付分红', category: '流动负债', note: '已决定但尚未实际付款', amount: dividendPayable },
    ...mapAdjustments(adjustments.liabilityRows),
  ];
  const equityRows: BalanceSheetModelRow[] = [
    { item: '期初经营资本', category: '资本结转', note: '含前期盈亏及已决定分红；允许为负', amount: openingCapital },
    ...adjustments.priorProfitRows.map((row) => ({
      item: row.label,
      category: '前期盈亏',
      note: row.note,
      amount: dec(row.amount),
    })),
    {
      item: '当月盈亏',
      category: netProfit.gt(0) ? '本期盈利' : netProfit.lt(0) ? '本期亏损' : '本期持平',
      note: '本月收入合计－支出合计；非股东分红',
      amount: netProfit,
    },
    {
      item: dividendDeclared.lt(0) ? '分红决定冲回' : '已决定分红',
      category: '资本分配',
      note: '正数决定减少资本、增加应付；冲回则相反，不计入利润表支出',
      amount: dividendDeclared.neg(),
    },
    ...mapAdjustments(adjustments.equityRows),
  ];
  const sumRows = (rows: BalanceSheetModelRow[]) => rows.reduce(
    (sum, row) => sum.add(row.amount), new Prisma.Decimal(0),
  );
  const assetTotal = sumRows(assetRows);
  const liabilityTotal = sumRows(liabilityRows);
  const equityTotal = sumRows(equityRows);
  const liabilityAndEquityTotal = liabilityTotal.add(equityTotal);
  return {
    assetRows,
    liabilityRows,
    equityRows,
    assetTotal,
    liabilityTotal,
    equityTotal,
    liabilityAndEquityTotal,
    reconciliationDifference: assetTotal.sub(liabilityAndEquityTotal),
  };
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
  dlmField: string,
  discordField: string | null,
  excludeDlmIds: string[],
  excludeDiscordIds: string[],
) => {
  const clauses: Record<string, unknown>[] = [];
  if (excludeDlmIds.length) {
    clauses.push({ [dlmField]: { in: excludeDlmIds } });
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
  monthKey?: string;
  excludeRechargeInput?: string;
  excludeMemberInput?: string;
}) {
  const excludeRechargeInput = (params.excludeRechargeInput ?? '').trim();
  const excludeMemberInput = (params.excludeMemberInput ?? '').trim();
  const excludeRechargeRawIds = excludeRechargeInput ? parseRevenueIdentityList(excludeRechargeInput) : [];
  const excludeMemberRawIds = excludeMemberInput ? parseRevenueIdentityList(excludeMemberInput) : [];
  const [excludeRechargeResolved, excludeMemberResolved] = await Promise.all([
    resolveRevenueExclusions(excludeRechargeRawIds),
    resolveRevenueExclusions(excludeMemberRawIds),
  ]);
  const start = newEntityReportStart(params.start);
  const { end } = params;
  const startMonthParts = getCentralEuropeanMonthParts(start);
  const monthKey = params.monthKey ?? formatCentralEuropeanMonthKey(startMonthParts.year, startMonthParts.month);

  const excludeMembers = [...excludeRechargeResolved.preview, ...excludeMemberResolved.preview];
  const rechargeWhere: Prisma.RechargeWhereInput = {
    createdAt: { gte: start, lt: end },
    ...(buildIdentityExclusion(
      'dlmId',
      'toWhom',
      excludeRechargeResolved.excludeDlmIds,
      excludeRechargeResolved.excludeDiscordIds,
    ) as Prisma.RechargeWhereInput),
  };

  const withdrawWhere: Prisma.WithdrawWhereInput = {
    createdAt: { gte: start, lt: end },
    ...(buildIdentityExclusion(
      'dlmId',
      'discordId',
      excludeRechargeResolved.excludeDlmIds,
      excludeRechargeResolved.excludeDiscordIds,
    ) as Prisma.WithdrawWhereInput),
  };

  const paidRechargeOrderWhere: Prisma.ZPayRechargeOrderWhereInput = {
    status: 'PAID',
    paidAt: { gte: start, lt: end },
    ...(buildIdentityExclusion(
      'dlmId',
      'discordUserId',
      excludeRechargeResolved.excludeDlmIds,
      excludeRechargeResolved.excludeDiscordIds,
    ) as Prisma.ZPayRechargeOrderWhereInput),
  };
  const zpayWhere: Prisma.ZPayRechargeOrderWhereInput = {
    ...paidRechargeOrderWhere,
    channel: { in: ['alipay', 'wxpay'] },
  };
  const stripeWhere: Prisma.StripePaymentWhereInput = {
    status: 'PAID',
    paidAt: { gte: start, lt: end },
    ...(buildIdentityExclusion(
      'dlmId',
      'discordUserId',
      excludeRechargeResolved.excludeDlmIds,
      excludeRechargeResolved.excludeDiscordIds,
    ) as Prisma.StripePaymentWhereInput),
  };
  const wechatNativeWhere: Prisma.WechatNativePaymentWhereInput = {
    status: 'PAID',
    paidAt: { gte: start, lt: end },
    ...(buildIdentityExclusion(
      'dlmId',
      'discordUserId',
      excludeRechargeResolved.excludeDlmIds,
      excludeRechargeResolved.excludeDiscordIds,
    ) as Prisma.WechatNativePaymentWhereInput),
  };

  const dlmWhere: Prisma.DlmUserWhereInput = buildIdentityExclusion(
    'dlmId',
    'discordUserId',
    excludeMemberResolved.excludeDlmIds,
    excludeMemberResolved.excludeDiscordIds,
  ) as Prisma.DlmUserWhereInput;

  const discountRebateWhere: Prisma.IndividualTransactionWhereInput = {
    typeOfTransaction: '优惠返利',
    timeCreatedAt: { gte: start, lt: end },
  };
  const couponWhere: Prisma.CouponWhereInput = {
    status: CouponStatus.USED,
    source: { in: Object.values(CouponSource) },
    issuedAt: newEntityOnlyTime(),
    consumedAt: { gte: start, lt: end },
    consumeAmount: { not: null },
    ...buildRevenueCouponIdentityExclusion(
      excludeMemberResolved.excludeDlmIds,
      excludeMemberResolved.excludeDiscordIds,
    ),
  };

  const [
    blockStackRows,
    rechargeRows,
    withdrawRows,
    zpayRows,
    stripeRows,
    wechatNativeRows,
    memberRows,
    commissionRows,
    giftAuditRows,
    orderRows,
    referralPayoutRows,
    inviteRewardRows,
    discountRebateRows,
    scratchPurchaseRows,
    lotteryCreatedRows,
    lotteryConsumeRows,
    scratchRows,
    expenseRows,
    manualExpenseRows,
    pureProfitAgg,
    revertedGiftRows,
    revertedOrderRows,
    couponConsumedBySource,
    pointShopCouponRows,
    pointShopBalanceRows,
  ] = await Promise.all([
    prisma.blockStackGame.findMany({
      where: { createdAt: { gte: start, lt: end } },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.recharge.findMany({ where: rechargeWhere, orderBy: { createdAt: 'desc' } }),
    prisma.withdraw.findMany({ where: withdrawWhere, orderBy: { createdAt: 'desc' } }),
    prisma.zPayRechargeOrder.findMany({ where: zpayWhere, orderBy: { paidAt: 'desc' } }),
    prisma.stripePayment.findMany({ where: stripeWhere, orderBy: { paidAt: 'desc' } }),
    prisma.wechatNativePayment.findMany({ where: wechatNativeWhere, orderBy: { paidAt: 'desc' } }),
    prisma.dlmUser.findMany({
      where: dlmWhere,
      orderBy: { dlmId: 'asc' },
      select: {
        dlmId: true,
        discordUserId: true,
        discordDisplayName: true,
        wechatDisplayName: true,
        recharge: true,
        income: true,
        totalBalance: true,
        totalSpent: true,
        member: { select: { totalBalance: true } },
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
    prisma.individualTransaction.findMany({
      where: {
        typeOfTransaction: '刮刮乐购卡',
        timeCreatedAt: { gte: start, lt: end },
        ...(buildIdentityExclusion(
          'dlmId',
          'discordId',
          excludeMemberResolved.excludeDlmIds,
          excludeMemberResolved.excludeDiscordIds,
        ) as Prisma.IndividualTransactionWhereInput),
      },
      orderBy: { timeCreatedAt: 'desc' },
    }),
    prisma.lotteryDraw.findMany({
      where: {
        createdAt: { gte: start, lt: end },
        ...(buildIdentityExclusion(
          'dlmId',
          'userId',
          excludeMemberResolved.excludeDlmIds,
          excludeMemberResolved.excludeDiscordIds,
        ) as Prisma.LotteryDrawWhereInput),
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.lotteryDraw.findMany({
      where: {
        consumeAt: { gte: start, lt: end },
        createdAt: newEntityOnlyTime(),
        ...(buildIdentityExclusion(
          'dlmId',
          'userId',
          excludeMemberResolved.excludeDlmIds,
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
    prisma.monthlyManualExpense.findMany({
      where: { monthKey },
      orderBy: { updatedAt: 'desc' },
      include: {
        operator: {
          select: {
            discordUserId: true,
            serverDisplayName: true,
          },
        },
      },
    }),
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
        AND ga."createdAt" > ${NEW_ENTITY_OPERATIONS_STARTED_AT}
        AND r."createdAt" >= ${start}
        AND r."createdAt" < ${end}
      ORDER BY r."createdAt" DESC
    `),
    prisma.$queryRaw<{ revertedOrderGross: Prisma.Decimal | null; revertedOrderFee: Prisma.Decimal | null }[]>(Prisma.sql`
      SELECT
        COALESCE(SUM(oa."gross"), 0) AS "revertedOrderGross",
        COALESCE(SUM(oa."gross" - oa."netAmount"), 0) AS "revertedOrderFee"
      FROM "order_audit" oa
      JOIN "Order" o
        ON o."id" = oa."orderId"
      JOIN "revert" r
        ON r."originalTransactionId" = CONCAT('ORDER:', oa."orderId")
      WHERE r."status" = 'SUCCESS'
        AND o."endedAt" > ${NEW_ENTITY_OPERATIONS_STARTED_AT}
        AND r."createdAt" >= ${start}
        AND r."createdAt" < ${end}
    `),
    prisma.coupon.groupBy({
      by: ['source'],
      _sum: { consumeAmount: true },
      _count: { id: true },
      where: couponWhere,
    }),
    prisma.pointShopGrant.findMany({
      where: {
        deliveryType: 'COUPON',
        deliveryStatus: 'DELIVERED',
        couponStatus: CouponStatus.USED,
        issuedAt: newEntityOnlyTime(),
        consumedAt: { gte: start, lt: end },
        consumeAmount: { not: null },
        ...(buildIdentityExclusion(
          'dlmId', 'discordUserId',
          excludeMemberResolved.excludeDlmIds,
          excludeMemberResolved.excludeDiscordIds,
        ) as Prisma.PointShopGrantWhereInput),
      },
      orderBy: { consumedAt: 'desc' },
    }),
    prisma.pointShopGrant.findMany({
      where: {
        deliveryType: 'BALANCE',
        deliveryStatus: 'DELIVERED',
        issuedAt: { gte: start, lt: end },
        consumeAmount: { not: null },
        ...(buildIdentityExclusion(
          'dlmId', 'discordUserId',
          excludeMemberResolved.excludeDlmIds,
          excludeMemberResolved.excludeDiscordIds,
        ) as Prisma.PointShopGrantWhereInput),
      },
      orderBy: { issuedAt: 'desc' },
    }),
  ]);
  const voucherReversals = await getVoucherReversalAdjustments({
    start,
    end,
    excludeDlmIds: excludeMemberResolved.excludeDlmIds,
  });

  const blockTotalRevenue = decimalSum(blockStackRows, 'totalRevenue');
  const blockSettled = decimalSum(blockStackRows, 'settledAmount');
  const blockEnvelope = decimalSum(blockStackRows, 'collapseEnvelopeAmount');
  const blockReward = decimalSum(blockStackRows, 'collapseRewardNet');
  const blockEarning = blockTotalRevenue.sub(blockSettled).sub(blockEnvelope).sub(blockReward);

  const rechargeTotal = decimalSum(rechargeRows, 'amount');
  const rechargeCashInflow = rechargeRows.reduce(
    (sum, row) => dec(row.amount).gt(0) ? sum.add(row.amount) : sum,
    new Prisma.Decimal(0),
  );
  const negativeRechargeAmount = rechargeRows.reduce(
    (sum, row) => dec(row.amount).lt(0) ? sum.add(dec(row.amount).abs()) : sum,
    new Prisma.Decimal(0),
  );
  const withdrawTotal = decimalSum(withdrawRows, 'amount');
  const zpayTotal = decimalSum(zpayRows, 'amount');
  const stripeTotal = decimalSum(stripeRows, 'rechargeAmount');
  const wechatNativeTotal = decimalSum(wechatNativeRows, 'rechargeAmount');
  const netRecharge = rechargeTotal.sub(withdrawTotal);

  const effectiveMemberRows = memberRows.map((row) => ({
    ...row,
    totalBalance: row.member?.totalBalance ?? row.totalBalance,
  }));
  const memberRechargeTotal = decimalSum(effectiveMemberRows, 'recharge');
  const memberIncomeTotal = decimalSum(effectiveMemberRows, 'income');
  const memberBalanceTotal = decimalSum(effectiveMemberRows, 'totalBalance');
  const commissionTotal = decimalSum(commissionRows, 'feeAmount');

  const giftGross = decimalSum(giftAuditRows, 'gross');
  const giftPaid = decimalSum(giftAuditRows, 'payable');
  const giftSubsidy = giftGross.sub(giftPaid);
  const revertedGiftGross = decimalSum(revertedGiftRows, 'gross');
  const revertedGiftPaid = decimalSum(revertedGiftRows, 'payable');
  const revertedGiftSubsidy = decimalSum(revertedGiftRows, 'subsidyAmount');
  const revertedGiftFee = decimalSum(revertedGiftRows, 'feeAmount');
  const revertedOrderGross = decimalSum(revertedOrderRows, 'revertedOrderGross');
  const revertedOrderFee = decimalSum(revertedOrderRows, 'revertedOrderFee');
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
  const feeFromOrderAndGiftModel = giftFeeNet.add(orderFee).sub(revertedOrderFee);
  const commissionOtherSources = commissionTotal.sub(rawFeeFromOrderAndGiftModel);
  const commissionTotalNetAll = commissionTotal.sub(revertedGiftFee).sub(revertedOrderFee);
  const discountDeductionTotal = decimalSum(discountRebateRows, 'amountChange');

  const drawCount = lotteryCreatedRows.length;
  const grossIncome = new Prisma.Decimal(drawCount).mul(29);
  const consumeTotal = decimalSum(lotteryConsumeRows, 'consumeAmount').add(voucherReversals.lotteryAdjustment);
  const lotteryNetProfit = grossIncome.sub(consumeTotal);
  const fusionRevenue = await getLotteryFusionRevenueSummary({
    start,
    end,
    excludeDlmIds: excludeMemberResolved.excludeDlmIds,
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
  const scratchGross = scratchPurchaseRows.reduce(
    (sum, row) => sum.add(dec(row.balanceBefore).sub(dec(row.balanceAfter))),
    new Prisma.Decimal(0),
  );
  const scratchReward = decimalSum(scratchRows, 'prizeAmount');
  const scratchNet = scratchGross.sub(scratchReward);

  const expenseTotal = decimalSum(expenseRows, 'amount');
  const manualExpenseTotal = decimalSum(manualExpenseRows, 'amount');
  const manualCashExpenseTotal = manualExpenseRows.reduce(
    (sum, row) => row.note.startsWith(PRIOR_PERIOD_ADJUSTMENT_PREFIX) ? sum : sum.add(row.amount),
    new Prisma.Decimal(0),
  );
  const priorPeriodExpenseAdjustmentTotal = manualExpenseTotal.sub(manualCashExpenseTotal);
  const inviteRewardExpenseRow = summarizeInviteRewardExpenseRows(inviteRewardRows);
  const manualGrantCouponRow = couponConsumedBySource.find((row) => row.source === CouponSource.MANUAL_GRANT);
  const vipBenefitCouponRow = couponConsumedBySource.find((row) => row.source === CouponSource.VIP_BENEFIT);
  const chatDropCouponRow = couponConsumedBySource.find((row) => row.source === CouponSource.CHAT_DROP);
  const openingCampaignCouponRow = couponConsumedBySource.find(
    (row) => row.source === CouponSource.OPENING_CAMPAIGN,
  );
  const giftWallCouponRow = couponConsumedBySource.find((row) => row.source === CouponSource.GIFT_WALL);
  const unknownCouponRow = couponConsumedBySource.find((row) => row.source === CouponSource.UNKNOWN);
  const manualGrantCouponAmount = dec(manualGrantCouponRow?._sum.consumeAmount);
  const manualGrantCouponCount = manualGrantCouponRow?._count.id ?? 0;
  const vipBenefitCouponAmount = dec(vipBenefitCouponRow?._sum.consumeAmount);
  const vipBenefitCouponCount = vipBenefitCouponRow?._count.id ?? 0;
  const chatDropCouponAmount = dec(chatDropCouponRow?._sum.consumeAmount);
  const chatDropCouponCount = chatDropCouponRow?._count.id ?? 0;
  const openingCampaignCouponAmount = dec(openingCampaignCouponRow?._sum.consumeAmount);
  const openingCampaignCouponCount = openingCampaignCouponRow?._count.id ?? 0;
  const giftWallCouponAmount = dec(giftWallCouponRow?._sum.consumeAmount);
  const giftWallCouponCount = giftWallCouponRow?._count.id ?? 0;
  const unknownCouponAmount = dec(unknownCouponRow?._sum.consumeAmount);
  const unknownCouponCount = unknownCouponRow?._count.id ?? 0;
  const pointShopCouponAmount = decimalSum(pointShopCouponRows, 'consumeAmount');
  const pointShopBalanceAmount = decimalSum(pointShopBalanceRows, 'consumeAmount');
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
  const couponExpenseAmount = manualGrantCouponAmount
    .add(vipBenefitCouponAmount)
    .add(chatDropCouponAmount)
    .add(openingCampaignCouponAmount)
    .add(giftWallCouponAmount)
    .add(unknownCouponAmount)
    .add(pointShopCouponAmount)
    .add(voucherReversals.couponAdjustment)
    .add(voucherReversals.pointShopAdjustment);
  const couponExpenseCount =
    manualGrantCouponCount +
    vipBenefitCouponCount +
    chatDropCouponCount +
    openingCampaignCouponCount +
    giftWallCouponCount +
    unknownCouponCount +
    pointShopCouponRows.length + voucherReversals.rows.filter((row) => row.kind !== 'lottery').length;
  const totalExpenseAmount = expenseBreakdown.totalAmount.add(couponExpenseAmount).add(pointShopBalanceAmount);
  const totalExpenseCount = expenseBreakdown.totalCount + couponExpenseCount + pointShopBalanceRows.length;
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
      stripeRows,
      wechatNativeRows,
      memberRows: effectiveMemberRows,
      commissionRows,
      giftAuditRows,
      orderRows,
      referralPayoutRows,
      inviteRewardRows,
      discountRebateRows,
      scratchPurchaseRows,
      lotteryCreatedRows,
      lotteryConsumeRows,
      fusionCreatedRows,
      fusionConsumeRows,
      scratchRows,
      expenseRows,
      manualExpenseRows,
      revertedGiftRows,
      revertedOrderRows,
      pointShopCouponRows,
      pointShopBalanceRows,
      voucherReversalRows: voucherReversals.rows,
    },
    totals: {
      blockTotalRevenue,
      blockSettled,
      blockEnvelope,
      blockReward,
      blockEarning,
      rechargeTotal,
      rechargeCashInflow,
      negativeRechargeAmount,
      withdrawTotal,
      zpayTotal,
      stripeTotal,
      wechatNativeTotal,
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
      revertedOrderFee,
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
      manualExpenseTotal,
      manualCashExpenseTotal,
      priorPeriodExpenseAdjustmentTotal,
      expenseBreakdown,
      manualGrantCouponAmount,
      manualGrantCouponCount,
      vipBenefitCouponAmount,
      vipBenefitCouponCount,
      chatDropCouponAmount,
      chatDropCouponCount,
      openingCampaignCouponAmount,
      openingCampaignCouponCount,
      giftWallCouponAmount,
      giftWallCouponCount,
      unknownCouponAmount,
      unknownCouponCount,
      pointShopCouponAmount,
      pointShopCouponCount: pointShopCouponRows.length,
      pointShopBalanceAmount,
      pointShopBalanceCount: pointShopBalanceRows.length,
      voucherCouponAdjustment: voucherReversals.couponAdjustment,
      voucherPointShopAdjustment: voucherReversals.pointShopAdjustment,
      voucherLotteryAdjustment: voucherReversals.lotteryAdjustment,
      totalExpenseAmount,
      totalExpenseCount,
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

const getManualExpenseOperatorLabel = (row: Awaited<ReturnType<typeof loadMonthlyRevenueData>>['rows']['manualExpenseRows'][number]) =>
  row.operator.serverDisplayName?.trim() || row.operatorId;

const buildManualExpenseRows = (data: Awaited<ReturnType<typeof loadMonthlyRevenueData>>) =>
  data.rows.manualExpenseRows.map((row) => ({
    source: '人工支出',
    date: formatDateTimeTextCentralEuropean(row.updatedAt),
    description: row.note,
    amount: row.amount,
    count: 1,
    note: `操作人：${getManualExpenseOperatorLabel(row)}（${row.operatorId}）${row.imageFileName ? ' · 已附图片' : ''}`,
  }));

const buildCouponExpenseRows = (data: Awaited<ReturnType<typeof loadMonthlyRevenueData>>) => {
  const couponRows = [
    {
      description: '手动送券已使用',
      amount: data.totals.manualGrantCouponAmount,
      count: data.totals.manualGrantCouponCount,
    },
    {
      description: 'VIP 福利券已使用',
      amount: data.totals.vipBenefitCouponAmount,
      count: data.totals.vipBenefitCouponCount,
    },
    {
      description: '彩蛋券已使用',
      amount: data.totals.chatDropCouponAmount,
      count: data.totals.chatDropCouponCount,
    },
    {
      description: '开业活动券已使用',
      amount: data.totals.openingCampaignCouponAmount,
      count: data.totals.openingCampaignCouponCount,
    },
    {
      description: '礼物墙券已使用',
      amount: data.totals.giftWallCouponAmount,
      count: data.totals.giftWallCouponCount,
    },
    {
      description: '未分类来源券已使用',
      amount: data.totals.unknownCouponAmount,
      count: data.totals.unknownCouponCount,
    },
    {
      description: '积分商城券已使用',
      amount: data.totals.pointShopCouponAmount,
      count: data.totals.pointShopCouponCount,
    },
  ];

  return couponRows
    .filter((row) => row.count > 0 || !row.amount.isZero())
    .map((row) => ({
      source: '优惠券成本',
      date: '',
      description: row.description,
      amount: row.amount,
      count: row.count,
      note: `Coupon 表已核销 ${row.count} 笔`,
    }));
};

const buildVoucherReversalExpenseRows = (data: Awaited<ReturnType<typeof loadMonthlyRevenueData>>) =>
  data.rows.voucherReversalRows
    .filter((row) => row.kind !== 'lottery')
    .map((row) => ({
      source: '券撤销调整',
      date: formatDateTimeTextCentralEuropean(row.eventAt),
      description: row.phase === 'original' ? '原使用月券成本保留' : '撤销当月券成本冲回',
      amount: row.amount,
      count: 1,
      note: `${row.kind}${row.source ? ` · ${row.source}` : ''}`,
    }));

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
  // All newly issued and redeemed vouchers use the same gross-income and
  // voucher-expense management-accounting convention.
  ...buildCouponExpenseRows(data),
  ...buildVoucherReversalExpenseRows(data),
  ...(data.totals.pointShopBalanceCount > 0
    ? [{
        source: '积分商城',
        date: '',
        description: '积分商城余额到账',
        amount: data.totals.pointShopBalanceAmount,
        count: data.totals.pointShopBalanceCount,
        note: '用户钱包已增加；不是新的现金充值',
      }]
    : []),
  ...buildManualExpenseRows(data),
  ...adjustments.expenseRows,
];

function buildFinancialStatementWorkbook(params: {
  year: number;
  month: number;
  data: Awaited<ReturnType<typeof loadMonthlyRevenueData>>;
  adjustments: MonthFinancialAdjustments;
  cashOpeningBalance: Prisma.Decimal;
  openingCapital: Prisma.Decimal;
  dividendLedger: Awaited<ReturnType<typeof getDividendLedgerState>>;
  walletReconciliation?: MonthlyFinancialReportPreview['walletReconciliation'];
}) {
  const { year, month, data, adjustments, cashOpeningBalance, openingCapital, dividendLedger, walletReconciliation } = params;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'DLMClub admin';
  workbook.created = new Date();
  workbook.modified = new Date();

  const lastDay = getLastDayOfMonth(year, month);
  const incomeRows = buildIncomeStatementRows(data, adjustments);
  const expenseRows = buildIncomeStatementExpenseRows(data, adjustments);
  const incomeTotal = incomeRows.reduce((sum, row) => sum.add(dec(row.amount)), new Prisma.Decimal(0));
  const expenseTotal = expenseRows.reduce((sum, row) => sum.add(dec(row.amount)), new Prisma.Decimal(0));
  const netProfit = incomeTotal.sub(expenseTotal);
  const recordedBankCash = calculateRecordedBankCash(
    cashOpeningBalance, data.totals.rechargeCashInflow,
    data.totals.withdrawTotal, data.totals.manualCashExpenseTotal, dividendLedger.paidThisMonth,
  );

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
  const netProfitRow = profitSheet.addRow(['当月盈亏', null, null, null, null, '收入合计 - 支出合计']);
  setMoneyFormulaCell(netProfitRow.getCell(4), `D${incomeTotalRow}-D${expenseTotalRow}`, netProfit);
  styleTotalRow(netProfitRow);
  if (expenseRows.length) {
    profitSheet.autoFilter = {
      from: `A${expenseHeaderRowNumber}`,
      to: `F${expenseEndRow}`,
    };
  }

  const balanceModel = buildMonthlyBalanceSheetModel({
    estimatedBankCash: recordedBankCash.closing,
    userBalance: data.totals.memberBalanceTotal,
    netProfit,
    openingCapital,
    dividendDeclared: dividendLedger.declaredThisMonth,
    dividendPayable: dividendLedger.payableAtMonthEnd,
    adjustments,
  });
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
  for (const row of balanceModel.assetRows) {
    const sheetRow = balanceSheet.addRow([
      row.item,
      blankToNull(row.category),
      null,
      blankToNull(row.note),
    ]);
    setMoneyCell(sheetRow.getCell(3), row.amount);
  }
  const assetEndRow = assetStartRow + balanceModel.assetRows.length - 1;
  const assetTotalRow = balanceSheet.addRow(['资产合计（待核对）', null, null, '银行余额来自已记录现金收支推算，不能视为实有资产证明']);
  setMoneyFormulaCell(assetTotalRow.getCell(3), `SUM(C${assetStartRow}:C${assetEndRow})`, balanceModel.assetTotal);
  styleTotalRow(assetTotalRow);

  balanceSheet.addRow([]);
  const liabilitySectionRow = balanceSheet.addRow(['负债', null, null, null]);
  styleTotalRow(liabilitySectionRow, EXPENSE_TOTAL_FILL);
  const liabilityStartRow = liabilitySectionRow.number + 1;
  for (const row of balanceModel.liabilityRows) {
    const sheetRow = balanceSheet.addRow([
      row.item,
      blankToNull(row.category),
      null,
      blankToNull(row.note),
    ]);
    setMoneyCell(sheetRow.getCell(3), row.amount);
  }
  const liabilityEndRow = liabilityStartRow + balanceModel.liabilityRows.length - 1;
  const liabilityTotalRow = balanceSheet.addRow(['负债合计', null, null, null]);
  setMoneyFormulaCell(liabilityTotalRow.getCell(3), `SUM(C${liabilityStartRow}:C${liabilityEndRow})`, balanceModel.liabilityTotal);
  styleTotalRow(liabilityTotalRow, EXPENSE_TOTAL_FILL);

  balanceSheet.addRow([]);
  const equitySectionRow = balanceSheet.addRow(['所有者权益', null, null, null]);
  styleTotalRow(equitySectionRow);
  const equityStartRow = equitySectionRow.number + 1;
  for (const row of balanceModel.equityRows) {
    const sheetRow = balanceSheet.addRow([
      row.item,
      blankToNull(row.category),
      null,
      blankToNull(row.note),
    ]);
    setMoneyCell(sheetRow.getCell(3), row.amount);
  }
  const equityEndRow = equityStartRow + balanceModel.equityRows.length - 1;
  const equityTotalRow = balanceSheet.addRow(['所有者权益合计', null, null, null]);
  setMoneyFormulaCell(equityTotalRow.getCell(3), `SUM(C${equityStartRow}:C${equityEndRow})`, balanceModel.equityTotal);
  styleTotalRow(equityTotalRow);

  balanceSheet.addRow([]);
  const totalLiabilityEquityRow = balanceSheet.addRow(['负债和所有者权益总计', null, null, '与资产的差额须逐项核对，不自动配平']);
  setMoneyFormulaCell(
    totalLiabilityEquityRow.getCell(3),
    `C${liabilityTotalRow.number}+C${equityTotalRow.number}`,
    balanceModel.liabilityAndEquityTotal,
  );
  styleTotalRow(totalLiabilityEquityRow);

  const reconciliationRow = balanceSheet.addRow(['资产减负债和所有者权益（待核对）', null, null, '差额为零也不能替代银行流水和科目核对']);
  setMoneyFormulaCell(
    reconciliationRow.getCell(3),
    `C${assetTotalRow.number}-C${totalLiabilityEquityRow.number}`,
    balanceModel.reconciliationDifference,
  );
  styleTotalRow(reconciliationRow, EXPENSE_TOTAL_FILL);

  addKeyValueSheet(workbook, '现金收支核对', [
    ...(walletReconciliation ? [
      { section: '钱包余额核对', key: '期初用户余额', value: walletReconciliation.openingBalance },
      { section: '钱包余额核对', key: '期末用户余额', value: walletReconciliation.closingBalance },
      { section: '钱包余额核对', key: '本期净变动', value: walletReconciliation.netMovement },
      { section: '钱包余额核对', key: '流水连续性', value: walletReconciliation.ledgerContinuous ? '通过' : '未通过' },
      ...walletReconciliation.movements.map((row) => ({
        section: '钱包流水类型', key: `${row.type}（${row.count} 笔）`, value: row.amount,
      })),
    ] : []),
    { section: '现金余额推算', key: '期初银行余额', value: cashOpeningBalance.toString() },
    { section: '实际现金流入', key: '正数 Recharge', value: data.totals.rechargeCashInflow.toString() },
    { section: '实际现金流出', key: '提现（按已打款口径）', value: data.totals.withdrawTotal.toString() },
    { section: '实际现金流出', key: '人工记录支出（不含前期调整）', value: data.totals.manualCashExpenseTotal.toString() },
    { section: '实际现金流出', key: '已支付股东分红', value: dividendLedger.paidThisMonth.toString() },
    { section: '利润分配', key: '当月决定分红', value: dividendLedger.declaredThisMonth.toString() },
    { section: '利润分配', key: '期末应付分红', value: dividendLedger.payableAtMonthEnd.toString() },
    { section: '现金余额推算', key: '本期已记录现金净流入', value: recordedBankCash.movement.toString() },
    { section: '现金余额推算', key: '期末账面银行余额（待核对）', value: recordedBankCash.closing.toString() },
    { section: '非当月现金流', key: '前期支出调整', value: data.totals.priorPeriodExpenseAdjustmentTotal.toString() },
    { section: '待核对', key: '负数 Recharge（扣款或退款需区分）', value: data.totals.negativeRechargeAmount.toString() },
    { section: '说明', key: '预存余额消费', value: '不产生新的银行现金流入' },
    { section: '说明', key: 'Stripe 手续费', value: '由人工支出记录，勿自动重复计入' },
    { section: '说明', key: '资产合计', value: '银行余额为已记录现金收支推算，须与银行流水核对；盈亏仅列入所有者权益，不作为资产或自动分红' },
  ]);

  return workbook;
}

function buildAdminRevenueDataWorkbook(
  data: Awaited<ReturnType<typeof loadMonthlyRevenueData>>,
  walletLedgerRows?: Awaited<ReturnType<typeof prisma.individualTransaction.findMany>>,
) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'DLMClub admin';
  workbook.created = new Date();

  addKeyValueSheet(workbook, '导出参数', [
    { section: 'filters', key: 'start', value: formatDateTimeTextCentralEuropean(data.start) },
    { section: 'filters', key: 'end(exclusive)', value: formatDateTimeTextCentralEuropean(data.end) },
    { section: 'filters', key: 'excludeRecharge(raw)', value: data.excludeRechargeInput },
    { section: 'filters', key: 'excludeMember(raw)', value: data.excludeMemberInput },
    { section: 'filters', key: 'excludeRechargeDlmIds', value: data.excludeRechargeResolved.excludeDlmIds.join(', ') },
    { section: 'filters', key: 'excludeRechargeDiscordIds', value: data.excludeRechargeResolved.excludeDiscordIds.join(', ') },
    { section: 'filters', key: 'excludeMemberDlmIds', value: data.excludeMemberResolved.excludeDlmIds.join(', ') },
    { section: 'filters', key: 'excludeMemberDiscordIds', value: data.excludeMemberResolved.excludeDiscordIds.join(', ') },
    { section: 'rows', key: 'BlockStackGame', value: data.rows.blockStackRows.length },
    { section: 'rows', key: 'Recharge', value: data.rows.rechargeRows.length },
    { section: 'rows', key: 'Withdraw', value: data.rows.withdrawRows.length },
    { section: 'rows', key: 'ZPayRechargeOrder(PAID)', value: data.rows.zpayRows.length },
    { section: 'rows', key: 'WechatNativePayment(PAID)', value: data.rows.wechatNativeRows.length },
    { section: 'rows', key: 'StripePayment(PAID)', value: data.rows.stripeRows.length },
    { section: 'rows', key: 'DlmUser(filtered)', value: data.rows.memberRows.length },
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
    { section: 'rows', key: 'MonthlyManualExpense', value: data.rows.manualExpenseRows.length },
    { section: 'rows', key: 'RevertedGiftSubsidy(join)', value: data.rows.revertedGiftRows.length },
    { section: 'rows', key: 'RevertedOrder(join)', value: data.rows.revertedOrderRows.length },
    { section: 'rows', key: 'Coupon(used MANUAL_GRANT)', value: data.totals.manualGrantCouponCount },
    { section: 'rows', key: 'Coupon(used VIP_BENEFIT)', value: data.totals.vipBenefitCouponCount },
    { section: 'rows', key: 'Coupon(used CHAT_DROP)', value: data.totals.chatDropCouponCount },
    { section: 'rows', key: 'Coupon(used OPENING_CAMPAIGN)', value: data.totals.openingCampaignCouponCount },
  ]);

  addKeyValueSheet(workbook, '收益汇总', [
    { section: '当月充值提现', key: 'Recharge 充值总额', value: data.totals.rechargeTotal.toString() },
    { section: '当月充值提现', key: 'ZPay 已支付', value: data.totals.zpayTotal.toString() },
    { section: '当月充值提现', key: '微信原生已支付', value: data.totals.wechatNativeTotal.toString() },
    { section: '当月充值提现', key: 'Stripe 已支付', value: data.totals.stripeTotal.toString() },
    { section: '当月充值提现', key: '提现总额', value: data.totals.withdrawTotal.toString() },
    { section: '当月充值提现', key: '净充值', value: data.totals.netRecharge.toString() },
    { section: '会员余额汇总', key: 'DlmUser.recharge 合计', value: data.totals.memberRechargeTotal.toString() },
    { section: '会员余额汇总', key: 'DlmUser.income 合计', value: data.totals.memberIncomeTotal.toString() },
    { section: '会员余额汇总', key: 'DlmUser.totalBalance 合计', value: data.totals.memberBalanceTotal.toString() },
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
    { section: '刮刮乐收益', key: '购卡实收（钱包扣款）', value: data.totals.scratchGross.toString() },
    { section: '刮刮乐收益', key: '中奖支出', value: data.totals.scratchReward.toString() },
    { section: '刮刮乐收益', key: '净收益', value: data.totals.scratchNet.toString() },
    { section: '积木游戏收益', key: '总收入', value: data.totals.blockTotalRevenue.toString() },
    { section: '积木游戏收益', key: '结算支出', value: data.totals.blockSettled.toString() },
    { section: '积木游戏收益', key: '塌方红包', value: data.totals.blockEnvelope.toString() },
    { section: '积木游戏收益', key: '捣蛋奖励', value: data.totals.blockReward.toString() },
    { section: '积木游戏收益', key: '净收益', value: data.totals.blockEarning.toString() },
    { section: '支出记录(Expense + 邀请)', key: 'Expense 表笔数', value: data.rows.expenseRows.length },
    { section: '支出记录(Expense + 邀请)', key: 'Expense 表总额', value: data.totals.expenseTotal.toString() },
    { section: '支出记录(Expense + 邀请)', key: '人工月度支出笔数', value: data.rows.manualExpenseRows.length },
    { section: '支出记录(Expense + 邀请)', key: '人工月度支出总额', value: data.totals.manualExpenseTotal.toString() },
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
    { section: '支出记录(Expense + 邀请)', key: 'Coupon表格金额（开业活动）', value: data.totals.openingCampaignCouponAmount.toString() },
    { section: '支出记录(Expense + 邀请)', key: 'Coupon表格笔数（开业活动）', value: data.totals.openingCampaignCouponCount },
    { section: '支出记录(Expense + 邀请)', key: 'Coupon表格金额（礼物墙）', value: data.totals.giftWallCouponAmount.toString() },
    { section: '支出记录(Expense + 邀请)', key: 'Coupon表格笔数（礼物墙）', value: data.totals.giftWallCouponCount },
    { section: '支出记录(Expense + 邀请)', key: 'Coupon表格金额（未分类）', value: data.totals.unknownCouponAmount.toString() },
    { section: '支出记录(Expense + 邀请)', key: 'Coupon表格笔数（未分类）', value: data.totals.unknownCouponCount },
    { section: '支出记录(Expense + 邀请)', key: '积分商城券已使用', value: data.totals.pointShopCouponAmount.toString() },
    { section: '支出记录(Expense + 邀请)', key: '积分商城券已使用笔数', value: data.totals.pointShopCouponCount },
    { section: '支出记录(Expense + 邀请)', key: '积分商城余额到账', value: data.totals.pointShopBalanceAmount.toString() },
    { section: '支出记录(Expense + 邀请)', key: '积分商城余额到账笔数', value: data.totals.pointShopBalanceCount },
    { section: '券撤销调整', key: 'Coupon 券成本调整', value: data.totals.voucherCouponAdjustment.toString() },
    { section: '券撤销调整', key: '积分商城券成本调整', value: data.totals.voucherPointShopAdjustment.toString() },
    { section: '券撤销调整', key: '抽奖奖品成本调整', value: data.totals.voucherLotteryAdjustment.toString() },
    { section: '支出记录(Expense + 邀请)', key: '总支出', value: data.totals.totalExpenseAmount.toString() },
    { section: '支出记录(Expense + 邀请)', key: '总支出笔数', value: data.totals.totalExpenseCount },
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
  addObjectRowsSheet(workbook, '微信原生已支付明细', data.rows.wechatNativeRows);
  addObjectRowsSheet(workbook, 'Stripe已支付明细', data.rows.stripeRows);
  addObjectRowsSheet(workbook, '会员汇总明细', data.rows.memberRows);
  addObjectRowsSheet(workbook, '抽成明细_Commission', data.rows.commissionRows);
  addObjectRowsSheet(workbook, '打赏审计明细', data.rows.giftAuditRows);
  addObjectRowsSheet(workbook, '打赏补贴回退明细', data.rows.revertedGiftRows);
  addObjectRowsSheet(workbook, '订单明细_ENDED', data.rows.orderRows);
  addObjectRowsSheet(workbook, '订单返利明细', data.rows.referralPayoutRows);
  addObjectRowsSheet(workbook, '邀请进服奖励明细', data.rows.inviteRewardRows);
  addObjectRowsSheet(workbook, '优惠返利流水', data.rows.discountRebateRows);
  addObjectRowsSheet(workbook, '刮刮乐购卡流水', data.rows.scratchPurchaseRows);
  addObjectRowsSheet(workbook, '抽奖明细_创建时间', data.rows.lotteryCreatedRows);
  addObjectRowsSheet(workbook, '抽奖明细_消耗时间', data.rows.lotteryConsumeRows);
  addObjectRowsSheet(workbook, '重铸明细_创建时间', data.rows.fusionCreatedRows);
  addObjectRowsSheet(workbook, '重铸明细_消耗时间', data.rows.fusionConsumeRows);
  addObjectRowsSheet(workbook, '刮刮乐已刮开明细', data.rows.scratchRows);
  addObjectRowsSheet(workbook, '积分商城券核销', data.rows.pointShopCouponRows);
  addObjectRowsSheet(workbook, '积分商城余额到账', data.rows.pointShopBalanceRows);
  addObjectRowsSheet(workbook, '券撤销调整明细', data.rows.voucherReversalRows);
  if (walletLedgerRows) addObjectRowsSheet(workbook, '钱包流水核对明细', walletLedgerRows);
  addObjectRowsSheet(workbook, '支出明细', data.rows.expenseRows);
  addObjectRowsSheet(
    workbook,
    '人工月度支出明细',
    data.rows.manualExpenseRows.map((row) => ({
      id: row.id,
      monthKey: row.monthKey,
      amount: row.amount.toString(),
      note: row.note,
      hasImage: Boolean(row.imageFileName),
      operatorId: row.operatorId,
      operatorName: getManualExpenseOperatorLabel(row),
      createdAt: formatDateTimeTextCentralEuropean(row.createdAt),
      updatedAt: formatDateTimeTextCentralEuropean(row.updatedAt),
    })),
  );
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

const getRecordedBankOpeningBalance = async (monthKey: string) => {
  let balance = NEW_ENTITY_OPENING_BANK_BALANCE;
  for (let year = 2026, month = 9; formatCentralEuropeanMonthKey(year, month) < monthKey;) {
    const previousMonthKey = formatCentralEuropeanMonthKey(year, month);
    const confirmed = await readConfirmedMonthlyReport(previousMonthKey);
    const range = buildCentralEuropeanMonthRange(year, month);
    const payments = await prisma.monthlyDividendPayment.findMany({
      where: { paidAt: { gte: newEntityReportStart(range.start), lt: range.end } },
      select: { amount: true },
    });
    balance = balance.sub(decimalSum(payments, 'amount'));
    if (confirmed) {
      const cashFlow = confirmed.preview.cashFlow;
      balance = balance
        .add(dec(cashFlow.rechargeInflow))
        .sub(dec(cashFlow.withdrawalOutflow))
        .sub(dec(cashFlow.manualExpenseOutflow));
    } else {
      const [recharges, withdrawals, manualExpenses] = await Promise.all([
        prisma.recharge.findMany({
          where: { createdAt: { gte: newEntityReportStart(range.start), lt: range.end }, amount: { gt: 0 } },
          select: { amount: true },
        }),
        prisma.withdraw.findMany({
          where: { createdAt: { gte: newEntityReportStart(range.start), lt: range.end } },
          select: { amount: true },
        }),
        prisma.monthlyManualExpense.findMany({
          where: { monthKey: previousMonthKey, NOT: { note: { startsWith: PRIOR_PERIOD_ADJUSTMENT_PREFIX } } },
          select: { amount: true },
        }),
      ]);
      balance = balance
        .add(decimalSum(recharges, 'amount'))
        .sub(decimalSum(withdrawals, 'amount'))
        .sub(decimalSum(manualExpenses, 'amount'));
    }
    month += 1;
    if (month > 12) { year += 1; month = 1; }
  }
  return balance;
};

export const getDividendLedgerState = async (monthKey: string) => {
  const target = parseMonthlyReportMonthKey(monthKey);
  if (!target || !isNewEntityReportMonth(monthKey)) throw new Error('无效的新主体月份');
  const [decisions, payments] = await Promise.all([
    prisma.monthlyDividendDecision.findMany({
      where: { monthKey: { lte: monthKey } },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.monthlyDividendPayment.findMany({
      where: { paidAt: { gte: NEW_ENTITY_OPERATIONS_STARTED_AT, lt: target.end } },
      orderBy: { paidAt: 'asc' },
    }),
  ]);
  const monthDecisions = decisions.filter((row) => row.monthKey === monthKey);
  const monthPayments = payments.filter((row) => row.paidAt >= target.start);
  return {
    decisions: monthDecisions,
    payments: monthPayments,
    declaredThisMonth: decimalSum(monthDecisions, 'amount'),
    paidThisMonth: decimalSum(monthPayments, 'amount'),
    payableAtMonthEnd: decimalSum(decisions, 'amount').sub(decimalSum(payments, 'amount')),
  };
};

const getOpeningOperatingCapital = async (monthKey: string) => {
  let capital = new Prisma.Decimal(0);
  const decisions = await prisma.monthlyDividendDecision.findMany({
    where: { monthKey: { lt: monthKey } }, select: { monthKey: true, amount: true },
  });
  const declaredByMonth = new Map<string, Prisma.Decimal>();
  for (const row of decisions) {
    declaredByMonth.set(row.monthKey, (declaredByMonth.get(row.monthKey) ?? dec(0)).add(row.amount));
  }
  for (let year = 2026, month = 9; formatCentralEuropeanMonthKey(year, month) < monthKey;) {
    const priorMonthKey = formatCentralEuropeanMonthKey(year, month);
    const confirmed = await readConfirmedMonthlyReport(priorMonthKey);
    let netProfit: Prisma.Decimal;
    if (confirmed) {
      netProfit = dec(confirmed.preview.netProfit);
    } else {
      const range = buildCentralEuropeanMonthRange(year, month);
      const [data, adjustments] = await Promise.all([
        loadMonthlyRevenueData({ start: range.start, end: range.end, monthKey: priorMonthKey }),
        readFinancialAdjustments(priorMonthKey),
      ]);
      const income = buildIncomeStatementRows(data, adjustments).reduce((sum, row) => sum.add(dec(row.amount)), dec(0));
      const expense = buildIncomeStatementExpenseRows(data, adjustments).reduce((sum, row) => sum.add(dec(row.amount)), dec(0));
      netProfit = income.sub(expense);
    }
    capital = capital.add(netProfit).sub(declaredByMonth.get(priorMonthKey) ?? dec(0));
    month += 1;
    if (month > 12) { year += 1; month = 1; }
  }
  return capital;
};

const loadMonthlyFinancialReportContext = async (monthKey?: string) => {
  const target = getTargetMonth(monthKey);
  if (!isNewEntityReportMonth(target.monthKey)) {
    throw new Error('旧主体期间的月报仅保留在旧主体归档中，不能在新主体后台查看或生成。');
  }
  const [adjustments, data, cashOpeningBalance, openingCapital, dividendLedger] = await Promise.all([
    readFinancialAdjustments(target.monthKey),
    loadMonthlyRevenueData({
      start: target.start,
      end: target.end,
      monthKey: target.monthKey,
    }),
    getRecordedBankOpeningBalance(target.monthKey),
    getOpeningOperatingCapital(target.monthKey),
    getDividendLedgerState(target.monthKey),
  ]);
  const walletBalances = target.end <= new Date() ? await getWalletBalancesAtMonthEnd(target.end) : null;
  if (walletBalances) {
    const balanceByDlmId = new Map(walletBalances.map((row) => [row.dlmId, row.closingBalance]));
    data.rows.memberRows = data.rows.memberRows.map((row) => ({
      ...row,
      totalBalance: balanceByDlmId.get(row.dlmId) ?? new Prisma.Decimal(0),
    }));
    data.totals.memberBalanceTotal = decimalSum(data.rows.memberRows, 'totalBalance');
  }
  return { target, adjustments, data, walletBalances, cashOpeningBalance, openingCapital, dividendLedger };
};

type FinancialReportPreviewRow = {
  item: string;
  category?: string;
  date?: string;
  note?: string;
  amount: string;
  count?: number;
};

const buildMonthlyFinancialReportPreview = ({ target, adjustments, data, cashOpeningBalance, openingCapital, dividendLedger }: Awaited<ReturnType<typeof loadMonthlyFinancialReportContext>>) => {
  const incomeRows = buildIncomeStatementRows(data, adjustments);
  const expenseRows = buildIncomeStatementExpenseRows(data, adjustments);
  const incomeTotal = incomeRows.reduce((sum, row) => sum.add(dec(row.amount)), new Prisma.Decimal(0));
  const expenseTotal = expenseRows.reduce((sum, row) => sum.add(dec(row.amount)), new Prisma.Decimal(0));
  const netProfit = incomeTotal.sub(expenseTotal);
  const recordedBankCash = calculateRecordedBankCash(
    cashOpeningBalance, data.totals.rechargeCashInflow,
    data.totals.withdrawTotal, data.totals.manualCashExpenseTotal, dividendLedger.paidThisMonth,
  );
  const balanceModel = buildMonthlyBalanceSheetModel({
    estimatedBankCash: recordedBankCash.closing,
    userBalance: data.totals.memberBalanceTotal,
    netProfit,
    openingCapital,
    dividendDeclared: dividendLedger.declaredThisMonth,
    dividendPayable: dividendLedger.payableAtMonthEnd,
    adjustments,
  });
  const toPreviewRows = (rows: BalanceSheetModelRow[]): FinancialReportPreviewRow[] => rows.map((row) => ({
    item: row.item,
    category: row.category,
    note: row.note,
    amount: row.amount.toString(),
  }));

  return {
    monthKey: target.monthKey,
    year: target.year,
    month: target.month,
    incomeRows: incomeRows.map((row) => ({ item: row.name, note: row.note, amount: dec(row.amount).toString() })),
    expenseRows: expenseRows.map((row) => ({
      item: row.description,
      date: row.date,
      note: `${row.source}${row.note ? ` · ${row.note}` : ''}`,
      amount: dec(row.amount).toString(),
      count: row.count,
    })),
    incomeTotal: incomeTotal.toString(),
    expenseTotal: expenseTotal.toString(),
    netProfit: netProfit.toString(),
    cashFlow: {
      openingBankBalance: cashOpeningBalance.toString(),
      rechargeInflow: data.totals.rechargeCashInflow.toString(),
      withdrawalOutflow: data.totals.withdrawTotal.toString(),
      manualExpenseOutflow: data.totals.manualCashExpenseTotal.toString(),
      dividendPaymentOutflow: dividendLedger.paidThisMonth.toString(),
      netRecordedCashMovement: recordedBankCash.movement.toString(),
      estimatedClosingBankBalance: recordedBankCash.closing.toString(),
      priorPeriodExpenseAdjustment: data.totals.priorPeriodExpenseAdjustmentTotal.toString(),
      negativeRechargePendingReview: data.totals.negativeRechargeAmount.toString(),
    },
    assetRows: toPreviewRows(balanceModel.assetRows),
    assetTotal: balanceModel.assetTotal.toString(),
    liabilityRows: toPreviewRows(balanceModel.liabilityRows),
    liabilityTotal: balanceModel.liabilityTotal.toString(),
    equityRows: toPreviewRows(balanceModel.equityRows),
    equityTotal: balanceModel.equityTotal.toString(),
    openingCapital: openingCapital.toString(),
    dividendDeclared: dividendLedger.declaredThisMonth.toString(),
    dividendPayable: dividendLedger.payableAtMonthEnd.toString(),
    liabilityAndEquityTotal: balanceModel.liabilityAndEquityTotal.toString(),
    reconciliationDifference: balanceModel.reconciliationDifference.toString(),
    manualExpenses: data.rows.manualExpenseRows.map((row) => ({
      id: row.id,
      monthKey: row.monthKey,
      amount: row.amount.toString(),
      note: row.note,
      hasImage: Boolean(row.imageFileName),
      operatorId: row.operatorId,
      operatorName: getManualExpenseOperatorLabel(row),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    })),
  };
};

type MonthlyFinancialReportPreview = ReturnType<typeof buildMonthlyFinancialReportPreview> & {
  walletReconciliation?: {
    openingBalance: string;
    closingBalance: string;
    netMovement: string;
    ledgerContinuous: boolean;
    movements: Array<{ type: string; count: number; amount: string }>;
  };
};
type ConfirmedMonthlyReport = {
  version: 1;
  monthKey: string;
  confirmedAt: string;
  confirmedBy: string;
  preview: MonthlyFinancialReportPreview;
  openingWalletBalanceTotal: string;
  walletBalances: Array<{ dlmId: string; discordUserId: string | null; closingBalance: string }>;
  withdrawalTotal: string;
};

const confirmedReportPath = (monthKey: string) =>
  path.join(REPORT_STORAGE_DIR, monthKey, 'confirmed-report.json');

export async function withMonthlyReportLocks<T>(monthKeys: string[], action: () => Promise<T>): Promise<T> {
  const keys = [...new Set(monthKeys)].sort();
  const locks: Array<{ file: Awaited<ReturnType<typeof fs.open>>; filePath: string }> = [];
  try {
    for (const key of keys) {
      if (!parseMonthlyReportMonthKey(key)) throw new Error('月份格式必须是 YYYY-MM');
      const targetDir = path.join(REPORT_STORAGE_DIR, key);
      await fs.mkdir(targetDir, { recursive: true });
      const filePath = path.join(targetDir, '.financial-report.lock');
      const file = await fs.open(filePath, 'wx').catch((error: NodeJS.ErrnoException) => {
        if (error.code === 'EEXIST') throw new Error('该月份正在更新或确认中，请稍后重试。');
        throw error;
      });
      locks.push({ file, filePath });
    }
    return await action();
  } finally {
    for (const lock of locks.reverse()) {
      await lock.file.close();
      await fs.unlink(lock.filePath).catch(() => {});
    }
  }
}

export const readConfirmedMonthlyReport = async (monthKey: string): Promise<ConfirmedMonthlyReport | null> => {
  if (!parseMonthlyReportMonthKey(monthKey) || !isNewEntityReportMonth(monthKey)) return null;
  try {
    const raw = await fs.readFile(confirmedReportPath(monthKey), 'utf8');
    const report = JSON.parse(raw) as ConfirmedMonthlyReport;
    if (report.version !== 1 || report.monthKey !== monthKey || !report.preview) {
      throw new Error(`月结快照格式无效：${monthKey}`);
    }
    return report;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
};

export async function getMonthlyFinancialReportPreview(monthKey: string) {
  const confirmed = await readConfirmedMonthlyReport(monthKey);
  if (confirmed) {
    const confirmedExpenseAmounts = new Map(confirmed.preview.manualExpenses.map((row) => [row.id, row.amount]));
    const latestManualExpenses = await prisma.monthlyManualExpense.findMany({
      where: { monthKey },
      orderBy: { updatedAt: 'desc' },
      include: { operator: { select: { discordUserId: true, serverDisplayName: true } } },
    });
    return {
      ...confirmed.preview,
      manualExpenses: latestManualExpenses.map((row) => ({
        id: row.id,
        monthKey: row.monthKey,
        amount: row.amount.toString(),
        confirmedAmount: confirmedExpenseAmounts.get(row.id) ?? null,
        note: row.note,
        hasImage: Boolean(row.imageFileName),
        operatorId: row.operatorId,
        operatorName: row.operator.serverDisplayName?.trim() || row.operatorId,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      })),
      confirmedAt: confirmed.confirmedAt,
      confirmedBy: confirmed.confirmedBy,
    };
  }
  return {
    ...buildMonthlyFinancialReportPreview(await loadMonthlyFinancialReportContext(monthKey)),
    walletReconciliation: undefined,
    confirmedAt: null,
    confirmedBy: null,
  };
}

export async function getMonthlyFinancialReportExcel(monthKey: string) {
  const confirmed = await readConfirmedMonthlyReport(monthKey);
  if (confirmed) {
    const target = parseMonthlyReportMonthKey(monthKey);
    if (!target) throw new Error('月份格式必须是 YYYY-MM');
    return {
      fileName: `${target.year}年${target.month}月财务报表.xlsx`,
      buffer: await fs.readFile(path.join(REPORT_STORAGE_DIR, monthKey, `${target.year}年${target.month}月财务报表.xlsx`)),
    };
  }
  const { target, adjustments, data, cashOpeningBalance, openingCapital, dividendLedger } = await loadMonthlyFinancialReportContext(monthKey);
  const workbook = buildFinancialStatementWorkbook({
    year: target.year,
    month: target.month,
    data,
    adjustments,
    cashOpeningBalance,
    openingCapital,
    dividendLedger,
  });
  return {
    fileName: `${target.year}年${target.month}月财务报表.xlsx`,
    buffer: Buffer.from(await workbook.xlsx.writeBuffer()),
  };
}

export const rewindWalletTransactionChain = (
  currentBalance: Prisma.Decimal,
  transactions: Array<{ balanceBefore: Prisma.Decimal; balanceAfter: Prisma.Decimal }>,
) => {
  const remaining = [...transactions];
  let cursor = currentBalance;
  // Concurrent transactions can have timestamps in the opposite order to
  // their wallet writes. Match balanceAfter to the current cursor instead
  // of assuming timestamp order; every row still has to be consumed.
  while (remaining.length) {
    const nextIndex = remaining.findIndex((row) => cursor.equals(row.balanceAfter));
    if (nextIndex < 0) throw new Error('钱包流水前后余额无法接续，不能确认月结。');
    const [transaction] = remaining.splice(nextIndex, 1);
    cursor = dec(transaction.balanceBefore);
  }
  return cursor;
};

const getWalletBalancesAtMonthEnd = async (end: Date) => {
  const [users, laterTransactions] = await Promise.all([
    prisma.dlmUser.findMany({
      select: {
        dlmId: true,
        discordUserId: true,
        createdAt: true,
        totalBalance: true,
        member: { select: { totalBalance: true } },
      },
    }),
    prisma.individualTransaction.findMany({
      where: { timeCreatedAt: { gte: end } },
      select: {
        dlmId: true,
        discordId: true,
        balanceBefore: true,
        balanceAfter: true,
      },
      orderBy: [{ timeCreatedAt: 'desc' }, { transactionId: 'desc' }],
    }),
  ]);
  const byDlmId = new Map(users.map((user) => [user.dlmId, user]));
  const byDiscordId = new Map(users.filter((user) => user.discordUserId).map((user) => [user.discordUserId!, user]));
  const closing = new Map(users.map((user) => [user.dlmId, dec(user.member?.totalBalance ?? user.totalBalance)]));
  const transactionsByUser = new Map<string, typeof laterTransactions>();

  for (const transaction of laterTransactions) {
    const user = (transaction.dlmId && byDlmId.get(transaction.dlmId))
      || (transaction.discordId && byDiscordId.get(transaction.discordId));
    if (!user) throw new Error('存在无法归属用户的月末后钱包流水，不能确认月结。');
    const rows = transactionsByUser.get(user.dlmId) ?? [];
    rows.push(transaction);
    transactionsByUser.set(user.dlmId, rows);
  }

  for (const [dlmId, rows] of transactionsByUser) {
    closing.set(dlmId, rewindWalletTransactionChain(closing.get(dlmId)!, rows));
  }

  for (const user of users) {
    if (user.createdAt >= end && !closing.get(user.dlmId)?.isZero()) {
      throw new Error('月末后新增用户的期初余额不为零，不能确认月结。');
    }
  }

  return users.map((user) => ({
    dlmId: user.dlmId,
    discordUserId: user.discordUserId,
    closingBalance: closing.get(user.dlmId) ?? new Prisma.Decimal(0),
  }));
};

export async function confirmMonthlyFinancialReport(monthKey: string, operatorId: string) {
  const target = parseMonthlyReportMonthKey(monthKey);
  if (!target || !isNewEntityReportMonth(monthKey)) throw new Error('月份无效或属于旧主体。');
  if (target.end > new Date()) throw new Error('本月尚未结束，不能确认月结。');
  const previousMonthKey = formatCentralEuropeanMonthKey(
    target.month === 1 ? target.year - 1 : target.year,
    target.month === 1 ? 12 : target.month - 1,
  );

  return withMonthlyReportLocks(
    isNewEntityReportMonth(previousMonthKey) ? [previousMonthKey, monthKey] : [monthKey],
    async () => {
  const targetDir = path.join(REPORT_STORAGE_DIR, monthKey);
  const temporaryPaths: string[] = [];
  try {
    if (await readConfirmedMonthlyReport(monthKey)) throw new Error('该月份已经确认，不能覆盖原报表。');
    if (isNewEntityReportMonth(previousMonthKey) && !await readConfirmedMonthlyReport(previousMonthKey)) {
      throw new Error('请先确认上一个月份，再确认本月；经营资本必须按已确认数字逐月结转。');
    }
    const context = await loadMonthlyFinancialReportContext(monthKey);
    // Rewind through the entire period, not only transactions after month-end.
    // A closing balance without a continuous opening-to-closing ledger must
    // never be presented as an audited monthly snapshot.
    const openingWalletBalances = await getWalletBalancesAtMonthEnd(context.data.start);
    const walletBalances = context.walletBalances;
    if (!walletBalances) throw new Error('本月钱包期末余额尚未形成，不能确认月结。');
    const openingByDlmId = new Map(openingWalletBalances.map((row) => [row.dlmId, row.closingBalance]));
    const openingWalletBalanceTotal = context.data.rows.memberRows.reduce(
      (sum, row) => sum.add(openingByDlmId.get(row.dlmId) ?? new Prisma.Decimal(0)),
      new Prisma.Decimal(0),
    );

    const walletLedgerRows = await prisma.individualTransaction.findMany({
      where: { timeCreatedAt: { gte: context.data.start, lt: target.end } },
      orderBy: [{ timeCreatedAt: 'asc' }, { transactionId: 'asc' }],
    });
    const includedDlmIds = new Set(context.data.rows.memberRows.map((row) => row.dlmId));
    const dlmIdByDiscord = new Map(walletBalances.filter((row) => row.discordUserId).map((row) => [row.discordUserId!, row.dlmId]));
    const includedWalletLedgerRows = walletLedgerRows.filter((row) =>
      includedDlmIds.has(row.dlmId ?? dlmIdByDiscord.get(row.discordId ?? '') ?? ''),
    );
    const movementByType = new Map<string, { count: number; amount: Prisma.Decimal }>();
    for (const row of includedWalletLedgerRows) {
      const existing = movementByType.get(row.typeOfTransaction) ?? { count: 0, amount: new Prisma.Decimal(0) };
      existing.count += 1;
      existing.amount = existing.amount.add(dec(row.balanceAfter).sub(dec(row.balanceBefore)));
      movementByType.set(row.typeOfTransaction, existing);
    }
    const walletLedgerTotal = [...movementByType.values()].reduce(
      (sum, row) => sum.add(row.amount), new Prisma.Decimal(0),
    );
    if (!walletLedgerTotal.equals(context.data.totals.memberBalanceTotal.sub(openingWalletBalanceTotal))) {
      throw new Error('本月钱包流水净额与期初、期末余额不一致，不能确认月结。');
    }
    const withdrawalLedger = walletLedgerRows.filter((row) => row.typeOfTransaction === '提现');
    const withdrawalLedgerTotal = withdrawalLedger.reduce(
      (sum, row) => sum.add(dec(row.balanceBefore).sub(dec(row.balanceAfter))),
      new Prisma.Decimal(0),
    );
    if (!withdrawalLedgerTotal.equals(context.data.totals.withdrawTotal)) {
      throw new Error('Withdraw 与钱包提现流水金额不一致，不能确认月结。');
    }

    const preview: MonthlyFinancialReportPreview = {
      ...buildMonthlyFinancialReportPreview(context),
      walletReconciliation: {
        openingBalance: openingWalletBalanceTotal.toString(),
        closingBalance: context.data.totals.memberBalanceTotal.toString(),
        netMovement: context.data.totals.memberBalanceTotal.sub(openingWalletBalanceTotal).toString(),
        ledgerContinuous: true,
        movements: [...movementByType.entries()].map(([type, value]) => ({
          type, count: value.count, amount: value.amount.toString(),
        })).sort((left, right) => left.type.localeCompare(right.type, 'zh-CN')),
      },
    };
    const financialWorkbook = buildFinancialStatementWorkbook({
      year: target.year,
      month: target.month,
      data: context.data,
      adjustments: context.adjustments,
      cashOpeningBalance: context.cashOpeningBalance,
      openingCapital: context.openingCapital,
      dividendLedger: context.dividendLedger,
      walletReconciliation: preview.walletReconciliation,
    });
    const adminDataWorkbook = buildAdminRevenueDataWorkbook(context.data, walletLedgerRows);
    const financialFileName = `${target.year}年${target.month}月财务报表.xlsx`;
    const adminDataFileName = `${target.year}年${target.month}月后台收益数据.xlsx`;
    const temporaryFinancialPath = path.join(targetDir, `${randomUUID()}.financial.tmp`);
    const temporaryAdminPath = path.join(targetDir, `${randomUUID()}.admin.tmp`);
    temporaryPaths.push(temporaryFinancialPath, temporaryAdminPath);
    await Promise.all([
      fs.writeFile(temporaryFinancialPath, Buffer.from(await financialWorkbook.xlsx.writeBuffer())),
      fs.writeFile(temporaryAdminPath, Buffer.from(await adminDataWorkbook.xlsx.writeBuffer())),
    ]);
    await fs.rename(temporaryFinancialPath, path.join(targetDir, financialFileName));
    await fs.rename(temporaryAdminPath, path.join(targetDir, adminDataFileName));
    const confirmed: ConfirmedMonthlyReport = {
      version: 1,
      monthKey,
      confirmedAt: new Date().toISOString(),
      confirmedBy: operatorId,
      preview,
      openingWalletBalanceTotal: openingWalletBalanceTotal.toString(),
      walletBalances: walletBalances.map((row) => ({
        dlmId: row.dlmId,
        discordUserId: row.discordUserId,
        closingBalance: row.closingBalance.toString(),
      })),
      withdrawalTotal: context.data.totals.withdrawTotal.toString(),
    };
    await fs.writeFile(confirmedReportPath(monthKey), JSON.stringify(confirmed), { flag: 'wx' });
    return confirmed;
  } finally {
    await Promise.all(temporaryPaths.map((filePath) => fs.unlink(filePath).catch(() => {})));
  }
  });
}

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

  const temporaryPath = `${filePath}.${randomUUID()}.tmp`;
  try {
    await workbook.xlsx.writeFile(temporaryPath);
    await fs.rename(temporaryPath, filePath);
  } finally {
    await fs.unlink(temporaryPath).catch(() => {});
  }
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
  const requestedTarget = getTargetMonth(params.monthKey);
  return withMonthlyReportLocks([requestedTarget.monthKey], async () => {
  if (await readConfirmedMonthlyReport(requestedTarget.monthKey)) {
    if (params.force) throw new Error('该月份已确认，不能重新生成或覆盖报表。');
    const targetDir = path.join(REPORT_STORAGE_DIR, requestedTarget.monthKey);
    const financialFilePath = path.join(targetDir, `${requestedTarget.year}年${requestedTarget.month}月财务报表.xlsx`);
    const adminDataFilePath = path.join(targetDir, `${requestedTarget.year}年${requestedTarget.month}月后台收益数据.xlsx`);
    return {
      monthKey: requestedTarget.monthKey,
      year: requestedTarget.year,
      month: requestedTarget.month,
      start: requestedTarget.start,
      end: requestedTarget.end,
      financialStatement: { filePath: financialFilePath, skipped: true, ...(await getFileStats(financialFilePath)) },
      adminData: { filePath: adminDataFilePath, skipped: true, ...(await getFileStats(adminDataFilePath)) },
    };
  }
  const { target, adjustments, data, cashOpeningBalance, openingCapital, dividendLedger } = await loadMonthlyFinancialReportContext(params.monthKey);
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
    cashOpeningBalance,
    openingCapital,
    dividendLedger,
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
  });
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
      if (!entry.isFile() || !entry.name.toLowerCase().endsWith('.xlsx') || !isNewEntityReportMonth(monthKey)) continue;
      const relativePath = path.relative(REPORT_STORAGE_DIR, fullPath);
      const stat = await fs.stat(fullPath);
      if (stat.mtime.getTime() <= NEW_ENTITY_OPERATIONS_STARTED_AT.getTime()) continue;
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
