import Link from 'next/link';
import { redirect } from 'next/navigation';
import { CouponSource, CouponStatus, Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getServerSession } from '@/lib/session';
import { canViewRevenue } from '@/lib/admin';
import { formatAmountDown2 } from '@/lib/numberFormat';
import { RevenueTimeRangeActions } from '@/components/admin/RevenueTimeRangeActions';
import { parseCentralEuropeanDateRange } from '@/lib/centralEuropeanDateRange';
import { parseRevenueIdentityList, resolveRevenueExclusions } from '@/lib/admin/revenue-exclusion';
import {
  buildRevenueExpenseBreakdown,
  getGiftReferralExpenseSummary,
  getRevenueInviteRewardRows,
  getRevenueOrderReferralRows,
  normalizeExpenseGroupRows,
  summarizeInviteRewardExpenseRows,
  summarizeOrderReferralExpenseRows,
} from '@/lib/admin/revenue-expense';
import {
  getLotteryFusionRevenueSummary,
  LOTTERY_FUSION_COUNT_BUCKET_LABEL,
  LOTTERY_FUSION_SOURCE_KIND_LABEL,
  type LotteryFusionCountBucket,
} from '@/lib/admin/lottery-fusion-revenue';

export const metadata = {
  title: '查看收益',
};

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
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

const formatNumber = (value: unknown, maximumFractionDigits = 2) => {
  void maximumFractionDigits;
  return formatAmountDown2(value);
};

const dec = (value: unknown) => {
  if (value instanceof Prisma.Decimal) return value;
  const numeric = parseNumber(value);
  return new Prisma.Decimal(numeric ?? 0);
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

const FUSION_POOL_LABEL: Record<string, string> = {
  NORMAL: '银色',
  MEDIUM: '金色',
  ADVANCED: '高级',
  SPECIAL: '特殊',
};

const FUSION_COUNT_BUCKET_ORDER: LotteryFusionCountBucket[] = ['3', '4', '6', 'other'];
const FUSION_SOURCE_KIND_ORDER = ['lottery', 'coupon', 'pointshop'] as const;

const formatBreakdownText = (
  breakdown: Record<string, number>,
  labelMap: Record<string, string>,
  fallback = '当前区间暂无数据',
) => {
  const parts = Object.entries(breakdown)
    .filter(([, count]) => count > 0)
    .sort((left, right) => right[1] - left[1])
    .map(([key, count]) => `${labelMap[key] ?? key} ${count}`);
  return parts.join(' / ') || fallback;
};

export default async function AdminRevenuePage(props: PageProps) {
  const session = await getServerSession();
  if (!session?.discordId || !canViewRevenue(session.discordId)) {
    redirect('/');
  }

  const searchParams = (await props.searchParams) ?? {};
  const excludeRechargeParam = Array.isArray(searchParams.excludeRecharge)
    ? searchParams.excludeRecharge[0]
    : searchParams.excludeRecharge;
  const excludeMemberParam = Array.isArray(searchParams.excludeMember)
    ? searchParams.excludeMember[0]
    : searchParams.excludeMember;

  const excludeRechargeInput = (excludeRechargeParam ?? '').trim();
  const excludeMemberDefault = ['1441310169492361268'].join(', ');
  const excludeMemberInput = (excludeMemberParam ?? excludeMemberDefault).trim();

  const excludeRechargeRawIds = excludeRechargeInput ? parseRevenueIdentityList(excludeRechargeInput) : [];
  const excludeMemberRawIds = excludeMemberInput ? parseRevenueIdentityList(excludeMemberInput) : [];
  const [excludeRechargeResolved, excludeMemberResolved] = await Promise.all([
    resolveRevenueExclusions(excludeRechargeRawIds),
    resolveRevenueExclusions(excludeMemberRawIds),
  ]);
  const startParam = Array.isArray(searchParams.startDate) ? searchParams.startDate[0] : searchParams.startDate;
  const endParam = Array.isArray(searchParams.endDate) ? searchParams.endDate[0] : searchParams.endDate;
  const { start, end, startValue, endValue } = parseCentralEuropeanDateRange(startParam, endParam);

  const blockStackAgg = await prisma.blockStackGame.aggregate({
    _sum: {
      totalRevenue: true,
      settledAmount: true,
      collapseEnvelopeAmount: true,
      collapseRewardNet: true,
    },
    where: {
      createdAt: { gte: start, lt: end },
    },
  });

  const blockTotalRevenue = dec(blockStackAgg._sum.totalRevenue);
  const blockSettled = dec(blockStackAgg._sum.settledAmount);
  const blockEnvelope = dec(blockStackAgg._sum.collapseEnvelopeAmount);
  const blockReward = dec(blockStackAgg._sum.collapseRewardNet);
  const blockEarning = blockTotalRevenue.sub(blockSettled).sub(blockEnvelope).sub(blockReward);

  const rechargeWhere: Prisma.RechargeWhereInput = {
    createdAt: { gte: start, lt: end },
    ...(buildIdentityExclusion(
      'jinleeId',
      'toWhom',
      excludeRechargeResolved.excludeJinleeIds,
      excludeRechargeResolved.excludeDiscordIds,
    ) as Prisma.RechargeWhereInput),
  };
  const rechargeAgg = await prisma.recharge.aggregate({
    _sum: { amount: true },
    where: rechargeWhere,
  });

  const withdrawWhere: Prisma.WithdrawWhereInput = {
    createdAt: { gte: start, lt: end },
    ...(buildIdentityExclusion(
      'jinleeId',
      'discordId',
      excludeRechargeResolved.excludeJinleeIds,
      excludeRechargeResolved.excludeDiscordIds,
    ) as Prisma.WithdrawWhereInput),
  };
  const withdrawAgg = await prisma.withdraw.aggregate({
    _sum: { amount: true },
    where: withdrawWhere,
  });

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
  const zpayAgg = await prisma.zPayRechargeOrder.aggregate({
    _sum: { amount: true },
    where: zpayWhere,
  });

  const rechargeTotal = dec(rechargeAgg._sum.amount);
  const withdrawTotal = dec(withdrawAgg._sum.amount);
  const netRecharge = rechargeTotal.sub(withdrawTotal);
  const zpayTotal = dec(zpayAgg._sum.amount);

  const jinleeWhere: Prisma.JinleeUserWhereInput = buildIdentityExclusion(
    'jinleeId',
    'discordUserId',
    excludeMemberResolved.excludeJinleeIds,
    excludeMemberResolved.excludeDiscordIds,
  ) as Prisma.JinleeUserWhereInput;

  const jinleeAgg = await prisma.jinleeUser.aggregate({
    _sum: {
      recharge: true,
      income: true,
      totalBalance: true,
    },
    where: jinleeWhere,
  });

  const commissionAggAll = await prisma.commission.aggregate({
    _sum: { feeAmount: true },
    where: { createdAt: { gte: start, lt: end } },
  });
  const commissionTotalAll = dec(commissionAggAll._sum.feeAmount);

  const giftAgg = await prisma.giftAudit.aggregate({
    _sum: {
      gross: true,
      payable: true,
      feeAmount: true,
    },
    where: {
      createdAt: { gte: start, lt: end },
    },
  });
  const orderWhere: Prisma.OrderWhereInput = {
    status: 'ENDED',
    endedAt: { gte: start, lt: end },
  };
  const orderAgg = await prisma.order.aggregate({
    _sum: {
      grossAmount: true,
      netAmount: true,
    },
    where: orderWhere,
  });
  const orderCount = await prisma.order.count({ where: orderWhere });

  const giftGross = dec(giftAgg._sum.gross);
  const giftPaid = dec(giftAgg._sum.payable);
  const giftSubsidy = giftGross.sub(giftPaid);
  const revertedGiftRows = await prisma.$queryRaw<{ reverted_subsidy: Prisma.Decimal | null }[]>(
    Prisma.sql`
      SELECT COALESCE(SUM(ga."gross" - ga."payable"), 0) AS reverted_subsidy
      FROM "gift_audit" ga
      JOIN "revert" r
        ON r."originalTransactionId" = ga."individualTransactionId"
      WHERE r."status" = 'SUCCESS'
        AND ga."createdAt" >= ${start}
        AND ga."createdAt" < ${end}
    `,
  );
  const revertedGiftAggRows = await prisma.$queryRaw<
    {
      reverted_gross: Prisma.Decimal | null;
      reverted_payable: Prisma.Decimal | null;
      reverted_fee: Prisma.Decimal | null;
    }[]
  >(
    Prisma.sql`
      SELECT
        COALESCE(SUM(ga."gross"), 0) AS reverted_gross,
        COALESCE(SUM(ga."payable"), 0) AS reverted_payable,
        COALESCE(SUM(ga."feeAmount"), 0) AS reverted_fee
      FROM "gift_audit" ga
      JOIN "revert" r
        ON r."originalTransactionId" = ga."individualTransactionId"
      WHERE r."status" = 'SUCCESS'
        AND ga."createdAt" >= ${start}
        AND ga."createdAt" < ${end}
    `,
  );
  const revertedOrderRows = await prisma.$queryRaw<{ reverted_order_gross: Prisma.Decimal | null }[]>(
    Prisma.sql`
      SELECT COALESCE(SUM(oa."gross"), 0) AS reverted_order_gross
      FROM "order_audit" oa
      JOIN "Order" o
        ON o."id" = oa."orderId"
      JOIN "revert" r
        ON r."originalTransactionId" = CONCAT('ORDER:', oa."orderId")
      WHERE r."status" = 'SUCCESS'
        AND o."endedAt" >= ${start}
        AND o."endedAt" < ${end}
    `,
  );
  const revertedGiftSubsidy = dec(revertedGiftRows[0]?.reverted_subsidy);
  const revertedGiftAgg = revertedGiftAggRows[0] ?? {};
  const revertedGiftGross = dec(revertedGiftAgg.reverted_gross);
  const revertedGiftPaid = dec(revertedGiftAgg.reverted_payable);
  const revertedGiftFee = dec(revertedGiftAgg.reverted_fee);
  const revertedOrderGross = dec(revertedOrderRows[0]?.reverted_order_gross);
  const giftGrossNet = giftGross.sub(revertedGiftGross);
  const giftPaidNet = giftPaid.sub(revertedGiftPaid);
  const giftSubsidyNet = giftSubsidy.sub(revertedGiftSubsidy);
  const giftFee = dec(giftAgg._sum.feeAmount);
  const giftFeeNet = giftFee.sub(revertedGiftFee);
  const orderGross = dec(orderAgg._sum.grossAmount);
  const orderNet = dec(orderAgg._sum.netAmount);
  const orderFee = orderGross.sub(orderNet);
  const totalPaidFlow = giftPaidNet.add(orderGross);
  const totalFaceFlow = giftGrossNet.add(orderGross);
  const rawFeeFromOrderAndGiftModel = giftFee.add(orderFee);
  const commissionOtherSources = commissionTotalAll.sub(rawFeeFromOrderAndGiftModel);
  const feeFromOrderAndGiftModel = giftFeeNet.add(orderFee);
  const commissionTotalNet = commissionTotalAll.sub(revertedGiftFee);
  const commissionTotalNetAll = commissionTotalAll.sub(revertedGiftFee);
  const discountRebateWhere: Prisma.IndividualTransactionWhereInput = {
    typeOfTransaction: '优惠返利',
    timeCreatedAt: { gte: start, lt: end },
  };
  const discountRebateAgg = await prisma.individualTransaction.aggregate({
    _sum: { amountChange: true },
    where: discountRebateWhere,
  });
  const discountDeductionTotal = dec(discountRebateAgg._sum.amountChange);

  const lotteryWhere: Prisma.LotteryDrawWhereInput = {
    createdAt: { gte: start, lt: end },
    ...(buildIdentityExclusion(
      'jinleeId',
      'userId',
      excludeMemberResolved.excludeJinleeIds,
      excludeMemberResolved.excludeDiscordIds,
    ) as Prisma.LotteryDrawWhereInput),
  };
  const drawCount = await prisma.lotteryDraw.count({ where: lotteryWhere });
  const consumeAgg = await prisma.lotteryDraw.aggregate({
    _sum: { consumeAmount: true },
    where: {
      consumeAt: { gte: start, lt: end },
      ...(buildIdentityExclusion(
        'jinleeId',
        'userId',
        excludeMemberResolved.excludeJinleeIds,
        excludeMemberResolved.excludeDiscordIds,
      ) as Prisma.LotteryDrawWhereInput),
    },
  });

  const grossIncome = new Prisma.Decimal(drawCount).mul(29);
  const consumeTotal = dec(consumeAgg._sum.consumeAmount);
  const netProfit = grossIncome.sub(consumeTotal);

  const scratchAggRows = await prisma.$queryRaw<{ revealed_count: bigint | number; prize_sum: Prisma.Decimal | null }[]>(
    Prisma.sql`
      SELECT
        COUNT(*) AS revealed_count,
        COALESCE(SUM("prizeAmount"), 0) AS prize_sum
      FROM "ScratchTicket"
      WHERE "status" = 'REVEALED'
        AND "revealedAt" >= ${start}
        AND "revealedAt" < ${end}
    `,
  );
  const scratchAgg = scratchAggRows[0] ?? { revealed_count: 0, prize_sum: new Prisma.Decimal(0) };
  const scratchRevealedCount = Number(scratchAgg.revealed_count ?? 0);
  const scratchGross = new Prisma.Decimal(scratchRevealedCount).mul(19);
  const scratchReward = dec(scratchAgg.prize_sum);
  const scratchNet = scratchGross.sub(scratchReward);

  const expenseWhere: Prisma.ExpenseWhereInput = {
    createdAt: { gte: start, lt: end },
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
    expenseAgg,
    pureProfitAgg,
    expenseByReason,
    couponConsumedBySource,
    orderReferralRows,
    inviteRewardRows,
    giftReferralExpenseRow,
  ] = await Promise.all([
    prisma.expense.aggregate({
      _sum: { amount: true },
      _count: { id: true },
      where: expenseWhere,
    }),
    prisma.pureProfit.aggregate({
      _sum: { amount: true },
      where: { createdAt: { gte: start, lt: end } },
    }),
    prisma.expense.groupBy({
      by: ['reason'],
      _sum: { amount: true },
      _count: { id: true },
      where: expenseWhere,
    }),
    prisma.coupon.groupBy({
      by: ['source'],
      _sum: { consumeAmount: true },
      _count: { id: true },
      where: couponWhere,
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
    getGiftReferralExpenseSummary({
      start,
      end,
      excludeDiscordIds: excludeMemberResolved.excludeDiscordIds,
    }),
  ]);
  const orderReferralExpenseRow = summarizeOrderReferralExpenseRows(orderReferralRows);
  const inviteRewardExpenseRow = summarizeInviteRewardExpenseRows(inviteRewardRows);
  const expenseBreakdown = buildRevenueExpenseBreakdown({
    expenseCount: expenseAgg._count.id,
    expenseAmount: expenseAgg._sum.amount,
    expenseByReasonRows: normalizeExpenseGroupRows(expenseByReason),
    syntheticRows: [giftReferralExpenseRow, orderReferralExpenseRow, inviteRewardExpenseRow],
  });
  const expenseByReasonSorted = expenseBreakdown.byReasonRows;
  const giftReferralNet = giftReferralExpenseRow.amount;
  const orderReferral = orderReferralExpenseRow.amount;
  const manualGrantCouponRow = couponConsumedBySource.find((row) => row.source === CouponSource.MANUAL_GRANT);
  const vipBenefitCouponRow = couponConsumedBySource.find((row) => row.source === CouponSource.VIP_BENEFIT);
  const chatDropCouponRow = couponConsumedBySource.find((row) => row.source === CouponSource.CHAT_DROP);
  const manualGrantCouponAmount = dec(manualGrantCouponRow?._sum.consumeAmount);
  const manualGrantCouponCount = manualGrantCouponRow?._count.id ?? 0;
  const vipBenefitCouponAmount = dec(vipBenefitCouponRow?._sum.consumeAmount);
  const vipBenefitCouponCount = vipBenefitCouponRow?._count.id ?? 0;
  const chatDropCouponAmount = dec(chatDropCouponRow?._sum.consumeAmount);
  const chatDropCouponCount = chatDropCouponRow?._count.id ?? 0;

  const pointShopOrderWhere: Prisma.PointShopOrderWhereInput = {
    createdAt: { gte: start, lt: end },
    ...(buildIdentityExclusion(
      'jinleeId',
      'discordUserId',
      excludeMemberResolved.excludeJinleeIds,
      excludeMemberResolved.excludeDiscordIds,
    ) as Prisma.PointShopOrderWhereInput),
  };

  const [pointShopOrderAgg, pointShopCouponConsumedAgg, pointShopBalanceAgg] =
    await Promise.all([
      prisma.pointShopOrder.aggregate({
        _sum: { totalPoints: true },
        where: pointShopOrderWhere,
      }),
      prisma.pointShopGrant.aggregate({
        _sum: { consumeAmount: true },
        where: {
          deliveryType: 'COUPON',
          consumedAt: { gte: start, lt: end },
          ...(buildIdentityExclusion(
            'jinleeId',
            'discordUserId',
            excludeMemberResolved.excludeJinleeIds,
            excludeMemberResolved.excludeDiscordIds,
          ) as Prisma.PointShopGrantWhereInput),
        },
      }),
      prisma.pointShopGrant.aggregate({
        _sum: { consumeAmount: true },
        where: {
          deliveryType: 'BALANCE',
          issuedAt: { gte: start, lt: end },
          ...(buildIdentityExclusion(
            'jinleeId',
            'discordUserId',
            excludeMemberResolved.excludeJinleeIds,
            excludeMemberResolved.excludeDiscordIds,
          ) as Prisma.PointShopGrantWhereInput),
        },
      }),
    ]);

  const fusionRevenue = await getLotteryFusionRevenueSummary({
    start,
    end,
    excludeJinleeIds: excludeMemberResolved.excludeJinleeIds,
    excludeDiscordIds: excludeMemberResolved.excludeDiscordIds,
  });
  const fusionPoolBreakdownText = formatBreakdownText(
    fusionRevenue.createdPoolBreakdown,
    FUSION_POOL_LABEL,
    '当前区间暂无产出',
  );
  const fusionOutstandingPoolBreakdownText = formatBreakdownText(
    fusionRevenue.activeOutstandingPoolBreakdown,
    FUSION_POOL_LABEL,
    '当前暂无待核销奖品',
  );
  const fusionRuleBreakdownText =
    FUSION_COUNT_BUCKET_ORDER.map(
      (bucket) => `${LOTTERY_FUSION_COUNT_BUCKET_LABEL[bucket]} ${fusionRevenue.fusionCountBreakdown[bucket]}`,
    ).join(' / ');
  const fusionSourceKindBreakdownText = FUSION_SOURCE_KIND_ORDER.map(
    (kind) => `${LOTTERY_FUSION_SOURCE_KIND_LABEL[kind]} ${fusionRevenue.sourceKindBreakdown[kind]}`,
  ).join(' / ');
  const fusionSourcePoolBreakdownText = formatBreakdownText(
    fusionRevenue.sourcePoolBreakdown,
    FUSION_POOL_LABEL,
    '当前区间暂无来源数据',
  );
  const fusionRuleResultBreakdownText = FUSION_COUNT_BUCKET_ORDER.map((bucket) => {
    const poolText = formatBreakdownText(
      fusionRevenue.resultPoolByFusionCount[bucket],
      FUSION_POOL_LABEL,
      '无',
    );
    return `${LOTTERY_FUSION_COUNT_BUCKET_LABEL[bucket]}：${poolText}`;
  }).join(' / ');

  return (
    <div className="space-y-8 text-white">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.6em] text-white/60">ADMIN</p>
          <h2 className="text-2xl font-semibold">查看收益</h2>
        </div>
        <Link
          href="/admin"
          className="inline-flex items-center justify-center rounded-full border border-white/20 px-5 py-2 text-sm text-white hover:bg-white/10"
        >
          返回管理首页
        </Link>
      </div>

      <form className="grid gap-4 rounded-3xl border border-white/10 bg-white/5 p-5 md:grid-cols-2" method="get">
        <label className="space-y-2 text-sm">
          <span className="text-white/70">开始时间 (中欧时区 CET/CEST)</span>
          <input
            id="admin-revenue-startDate"
            type="datetime-local"
            name="startDate"
            defaultValue={startValue}
            className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white"
          />
        </label>
        <label className="space-y-2 text-sm">
          <span className="text-white/70">结束时间 (中欧时区 CET/CEST)</span>
          <input
            id="admin-revenue-endDate"
            type="datetime-local"
            name="endDate"
            defaultValue={endValue}
            className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white"
          />
        </label>
        <label className="space-y-2 text-sm">
          <span className="text-white/70">充值/提现排除 IDs</span>
          <textarea
            id="admin-revenue-excludeRecharge"
            name="excludeRecharge"
            defaultValue={excludeRechargeInput}
            rows={2}
            className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white"
          />
          {excludeRechargeResolved.preview.length ? (
            <div className="space-y-1">
              {excludeRechargeResolved.preview.map((row) => (
                <div key={`recharge-${row.input}`} className="text-xs text-white/60">
                  <span className="text-white/80">{row.displayName}</span>
                  <span className="mx-1">·</span>
                  <span className="font-mono">{row.input}</span>
                </div>
              ))}
            </div>
          ) : null}
        </label>
        <label className="space-y-2 text-sm">
          <span className="text-white/70">会员余额排除 IDs</span>
          <textarea
            id="admin-revenue-excludeMember"
            name="excludeMember"
            defaultValue={excludeMemberInput}
            rows={2}
            className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white"
          />
          {excludeMemberResolved.preview.length ? (
            <div className="space-y-1">
              {excludeMemberResolved.preview.map((row) => (
                <div key={`member-${row.input}`} className="text-xs text-white/60">
                  <span className="text-white/80">{row.displayName}</span>
                  <span className="mx-1">·</span>
                  <span className="font-mono">{row.input}</span>
                </div>
              ))}
            </div>
          ) : null}
        </label>
        <div className="md:col-span-2">
          <div className="flex flex-col items-start gap-3">
            <RevenueTimeRangeActions
              fallbackStartValue={startValue}
              fallbackEndValue={endValue}
            />
          </div>
        </div>
      </form>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-5 space-y-3">
          <h3 className="text-lg font-semibold">当月充值/提现</h3>
          <div className="space-y-1 text-sm text-white/70">
            <p>Recharge 充值总额：¥{formatNumber(rechargeTotal)}</p>
            <p>ZPay 已支付：¥{formatNumber(zpayTotal)}</p>
            <p>提现总额：¥{formatNumber(withdrawTotal)}</p>
            <p className="text-white">净充值：¥{formatNumber(netRecharge)}</p>
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-5 space-y-3">
          <h3 className="text-lg font-semibold">会员余额汇总</h3>
          <div className="space-y-1 text-sm text-white/70">
            <p>JinleeUser.recharge 合计：¥{formatNumber(jinleeAgg._sum.recharge)}</p>
            <p>JinleeUser.income 合计：¥{formatNumber(jinleeAgg._sum.income)}</p>
            <p>JinleeUser.totalBalance 合计：¥{formatNumber(jinleeAgg._sum.totalBalance)}</p>
            <p>当月 Commission 合计：¥{formatNumber(commissionTotalNetAll)}</p>
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-5 space-y-3">
          <h3 className="text-lg font-semibold">抽奖收益</h3>
          <div className="space-y-1 text-sm text-white/70">
            <p>抽奖次数：{drawCount}</p>
            <p>毛收入 (次数 × 29)：¥{formatNumber(grossIncome)}</p>
            <p>券抵扣消耗：¥{formatNumber(consumeTotal)}</p>
            <p className="text-white">净收益：¥{formatNumber(netProfit)}</p>
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-5 space-y-3">
          <h3 className="text-lg font-semibold">刮刮乐收益</h3>
          <div className="space-y-1 text-sm text-white/70">
            <p>已刮开数量：{scratchRevealedCount}</p>
            <p>毛收入（已刮开数量 × 19）：¥{formatNumber(scratchGross)}</p>
            <p>中奖支出：¥{formatNumber(scratchReward)}</p>
            <p className="text-white">净收益：¥{formatNumber(scratchNet)}</p>
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-5 space-y-3">
          <h3 className="text-lg font-semibold">积分商城</h3>
          <div className="space-y-1 text-sm text-white/70">
            <p>累计消耗积分：{formatNumber(pointShopOrderAgg._sum.totalPoints, 4)}</p>
            <p>券已使用抵扣金额：¥{formatNumber(pointShopCouponConsumedAgg._sum.consumeAmount, 4)}</p>
            <p>余额到账金额：¥{formatNumber(pointShopBalanceAgg._sum.consumeAmount, 4)}</p>
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-5 space-y-3">
          <h3 className="text-lg font-semibold">积木游戏收益</h3>
          <div className="space-y-1 text-sm text-white/70">
            <p>总收入：¥{formatNumber(blockTotalRevenue)}</p>
            <p>结算支出：¥{formatNumber(blockSettled)}</p>
            <p>塌方红包：¥{formatNumber(blockEnvelope)}</p>
            <p>捣蛋奖励：¥{formatNumber(blockReward)}</p>
            <p className="text-white">净收益：¥{formatNumber(blockEarning)}</p>
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-5 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-lg font-semibold">支出记录（Expense + 邀请）</h3>
            <Link
              href="/admin/expenses"
              className="inline-flex items-center justify-center rounded-full border border-white/20 px-3 py-1 text-xs text-white hover:bg-white/10"
            >
              查看全部
            </Link>
          </div>
          <div className="space-y-1 text-sm text-white/70">
            <p>Expense 表笔数：{expenseAgg._count.id}</p>
            <p>Expense 表总额：¥{formatNumber(expenseAgg._sum.amount, 4)}</p>
            <p>{giftReferralExpenseRow.reason}：{giftReferralExpenseRow.count}笔，¥{formatNumber(giftReferralExpenseRow.amount, 4)}</p>
            <p>{orderReferralExpenseRow.reason}：{orderReferralExpenseRow.count}笔，¥{formatNumber(orderReferralExpenseRow.amount, 4)}</p>
            <p>{inviteRewardExpenseRow.reason}：{inviteRewardExpenseRow.count}笔，¥{formatNumber(inviteRewardExpenseRow.amount, 4)}</p>
            <p className="text-white">扩展总支出：{expenseBreakdown.totalCount}笔，¥{formatNumber(expenseBreakdown.totalAmount, 4)}</p>
            <p>Coupon表格金额（手动送券）：{manualGrantCouponCount}笔，¥{formatNumber(manualGrantCouponAmount, 4)}</p>
            <p>Coupon表格金额（VIP福利）：{vipBenefitCouponCount}笔，¥{formatNumber(vipBenefitCouponAmount, 4)}</p>
            <p>Coupon表格金额（彩蛋）：{chatDropCouponCount}笔，¥{formatNumber(chatDropCouponAmount, 4)}</p>
            <p>总扣款金额(收入）：¥{formatNumber(pureProfitAgg._sum.amount, 4)}</p>
          </div>
          <div className="space-y-1 text-sm text-white/70">
            <p className="text-white/90">按原因分类：</p>
            {expenseByReasonSorted.length ? (
              expenseByReasonSorted.map((row) => (
                <p key={row.reason}>
                  {row.reason}：{row.count} 笔 · ¥{formatNumber(row.amount, 4)}
                </p>
              ))
            ) : (
              <p>当前区间暂无分类数据</p>
            )}
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-5 space-y-3">
          <h3 className="text-lg font-semibold">抽成详情</h3>
          <div className="space-y-1 text-sm text-white/70">
            <p>打赏面值流水：¥{formatNumber(giftGrossNet, 4)}</p>
            <p>打赏实付流水：¥{formatNumber(giftPaidNet, 4)}</p>
            <p>打赏抽成：¥{formatNumber(giftFeeNet, 4)}</p>
            <p>打赏返利：¥{formatNumber(giftReferralNet, 4)}</p>
            <p>总撤回打赏金额：¥{formatNumber(revertedGiftGross, 4)}</p>
            <p>总撤回单子金额：¥{formatNumber(revertedOrderGross, 4)}</p>
            <p>订单返利：¥{formatNumber(orderReferral, 4)}</p>
            <p>打赏补贴(代金券原始)：¥{formatNumber(giftSubsidy, 4)}</p>
            <p>打赏补贴回退(打赏撤销)：¥{formatNumber(revertedGiftSubsidy, 4)}</p>
            <p>打赏补贴(代金券净额)：¥{formatNumber(giftSubsidyNet, 4)}</p>
            <p>打折券抵扣金额：¥{formatNumber(discountDeductionTotal, 4)}</p>
            <p>单子总数：{orderCount}</p>
            <p>订单流水：¥{formatNumber(orderGross, 4)}</p>
            <p>订单结算：¥{formatNumber(orderNet, 4)}</p>
            <p>订单抽成：¥{formatNumber(orderFee, 4)}</p>
            <p>总抽成：¥{formatNumber(commissionTotalNet, 4)}</p>
            <p>总面值原价流水：¥{formatNumber(totalFaceFlow, 4)}</p>
            <p>总实付流水：¥{formatNumber(totalPaidFlow, 4)}</p>
            <p>模型抽成合计（订单+打赏）：¥{formatNumber(feeFromOrderAndGiftModel, 4)}</p>
            <p className="text-white">其他来源抽成：¥{formatNumber(commissionOtherSources, 4)}</p>
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-5 space-y-4 sm:col-span-2">
          <h3 className="text-lg font-semibold">重铸分析</h3>
          <div className="grid gap-5 xl:grid-cols-3">
            <div className="space-y-1 text-sm text-white/70">
              <p className="text-sm font-medium text-white">成本</p>
              <p>本期重铸产出：{fusionRevenue.createdCount}</p>
              <p>本期已核销：{fusionRevenue.consumedCount}</p>
              <p>本期已核销成本：¥{formatNumber(fusionRevenue.realizedCost)}</p>
              <p>当前待核销：{fusionRevenue.activeOutstandingCount}</p>
              <p>当前待核销池：{fusionOutstandingPoolBreakdownText}</p>
              <p>再次投入的重铸产物：{fusionRevenue.rerolledLotteryInputCount} 个来源 / {fusionRevenue.rerolledRequestCount} 次重铸</p>
              <p className="text-white">本期产出池分布：{fusionPoolBreakdownText}</p>
            </div>

            <div className="space-y-1 text-sm text-white/70">
              <p className="text-sm font-medium text-white">规则分布</p>
              <p>{fusionRuleBreakdownText}</p>
              <p className="text-white">各规则产出池：{fusionRuleResultBreakdownText}</p>
            </div>

            <div className="space-y-1 text-sm text-white/70">
              <p className="text-sm font-medium text-white">来源结构</p>
              <p>来源类型：{fusionSourceKindBreakdownText}</p>
              <p className="text-white">来源池分布：{fusionSourcePoolBreakdownText}</p>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
