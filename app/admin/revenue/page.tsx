import Link from 'next/link';
import { redirect } from 'next/navigation';
import { CouponStatus, Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getServerSession } from '@/lib/session';
import { canViewRevenue } from '@/lib/admin';
import { formatAmountDown2 } from '@/lib/numberFormat';
import { RevenueTimeRangeActions } from '@/components/admin/RevenueTimeRangeActions';
import { parseCentralEuropeanDateRange } from '@/lib/centralEuropeanDateRange';

export const metadata = {
  title: '查看收益',
};

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const normalizeId = (raw: string) => {
  const cleaned = raw.trim().replace(/^<@!?/, '').replace(/>$/, '');
  return /^\d+$/.test(cleaned) ? cleaned : '';
};

const parseExcludeIds = (value: string) => {
  return value
    .split(/[\s,]+/)
    .map(normalizeId)
    .filter(Boolean);
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

  const excludeRechargeIds = excludeRechargeInput ? parseExcludeIds(excludeRechargeInput) : [];
  const excludeMemberIds = excludeMemberInput ? parseExcludeIds(excludeMemberInput) : [];
  const excludePreviewIds = Array.from(new Set([...excludeRechargeIds, ...excludeMemberIds]));
  const excludeMembers = excludePreviewIds.length
    ? await prisma.member.findMany({
        where: { discordUserId: { in: excludePreviewIds } },
        select: { discordUserId: true, serverDisplayName: true },
      })
    : [];
  const excludeDisplayMap = new Map(
    excludeMembers.map((row) => [row.discordUserId, row.serverDisplayName?.trim() ?? ''])
  );
  const resolveDisplayName = (discordId: string) => excludeDisplayMap.get(discordId) || '未知用户';
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
  };
  if (excludeRechargeIds.length) {
    rechargeWhere.toWhom = { notIn: excludeRechargeIds };
  }
  const rechargeAgg = await prisma.recharge.aggregate({
    _sum: { amount: true },
    where: rechargeWhere,
  });

  const withdrawWhere: Prisma.WithdrawWhereInput = { createdAt: { gte: start, lt: end } };
  if (excludeRechargeIds.length) {
    withdrawWhere.discordId = { notIn: excludeRechargeIds };
  }
  const withdrawAgg = await prisma.withdraw.aggregate({
    _sum: { amount: true },
    where: withdrawWhere,
  });

  const zpayWhere: Prisma.ZPayRechargeOrderWhereInput = {
    status: 'PAID',
    createdAt: { gte: start, lt: end },
  };
  if (excludeRechargeIds.length) {
    zpayWhere.discordUserId = { notIn: excludeRechargeIds };
  }
  const zpayAgg = await prisma.zPayRechargeOrder.aggregate({
    _sum: { amount: true },
    where: zpayWhere,
  });

  const rechargeTotal = dec(rechargeAgg._sum.amount);
  const withdrawTotal = dec(withdrawAgg._sum.amount);
  const netRecharge = rechargeTotal.sub(withdrawTotal);
  const zpayTotal = dec(zpayAgg._sum.amount);

  const memberWhere: Prisma.MemberWhereInput = {};
  if (excludeMemberIds.length) {
    memberWhere.discordUserId = { notIn: excludeMemberIds };
  }

  const memberAgg = await prisma.member.aggregate({
    _sum: {
      recharge: true,
      income: true,
      totalBalance: true,
    },
    where: memberWhere,
  });

  const commissionWhere: Prisma.CommissionWhereInput = {
    createdAt: { gte: start, lt: end },
  };
  if (excludeMemberIds.length) {
    commissionWhere.toId = { notIn: excludeMemberIds };
  }
  const commissionAgg = await prisma.commission.aggregate({
    _sum: { feeAmount: true },
    where: commissionWhere,
  });
  const commissionTotal = dec(commissionAgg._sum.feeAmount);

  const giftAgg = await prisma.giftAudit.aggregate({
    _sum: {
      gross: true,
      payable: true,
      feeAmount: true,
      bossReferralAmount: true,
      workerReferralAmount: true,
    },
    where: {
      createdAt: { gte: start, lt: end },
    },
  });
  const orderReferralRows = await prisma.$queryRaw<{ order_referral: Prisma.Decimal | null }[]>(
    Prisma.sql`
      SELECT COALESCE(SUM(rp."amount"), 0) AS order_referral
      FROM "ReferralPayout" rp
      JOIN "Order" o
        ON o."id" = rp."orderId"
      WHERE rp."createdAt" >= ${start}
        AND rp."createdAt" < ${end}
        AND o."status" = 'ENDED'
    `,
  );
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
      reverted_boss_referral: Prisma.Decimal | null;
      reverted_worker_referral: Prisma.Decimal | null;
    }[]
  >(
    Prisma.sql`
      SELECT
        COALESCE(SUM(ga."gross"), 0) AS reverted_gross,
        COALESCE(SUM(ga."payable"), 0) AS reverted_payable,
        COALESCE(SUM(ga."feeAmount"), 0) AS reverted_fee,
        COALESCE(SUM(ga."bossReferralAmount"), 0) AS reverted_boss_referral,
        COALESCE(SUM(ga."workerReferralAmount"), 0) AS reverted_worker_referral
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
  const revertedGiftReferral = dec(revertedGiftAgg.reverted_boss_referral).add(
    dec(revertedGiftAgg.reverted_worker_referral),
  );
  const revertedOrderGross = dec(revertedOrderRows[0]?.reverted_order_gross);
  const giftGrossNet = giftGross.sub(revertedGiftGross);
  const giftPaidNet = giftPaid.sub(revertedGiftPaid);
  const giftSubsidyNet = giftSubsidy.sub(revertedGiftSubsidy);
  const giftFee = dec(giftAgg._sum.feeAmount);
  const giftFeeNet = giftFee.sub(revertedGiftFee);
  const giftReferral = dec(giftAgg._sum.bossReferralAmount).add(dec(giftAgg._sum.workerReferralAmount));
  const giftReferralNet = giftReferral.sub(revertedGiftReferral);
  const orderReferral = dec(orderReferralRows[0]?.order_referral);
  const orderGross = dec(orderAgg._sum.grossAmount);
  const orderNet = dec(orderAgg._sum.netAmount);
  const orderFee = orderGross.sub(orderNet);
  const totalPaidFlow = giftPaidNet.add(orderGross);
  const totalFaceFlow = giftGrossNet.add(orderGross);
  const rawFeeFromOrderAndGiftModel = giftFee.add(orderFee);
  const commissionOtherSources = commissionTotal.sub(rawFeeFromOrderAndGiftModel);
  const feeFromOrderAndGiftModel = giftFeeNet.add(orderFee);
  const commissionTotalNet = feeFromOrderAndGiftModel.add(commissionOtherSources);
  const discountRebateWhere: Prisma.IndividualTransactionWhereInput = {
    typeOfTransaction: '优惠返利',
    timeCreatedAt: { gte: start, lt: end },
  };
  if (excludeMemberIds.length) {
    discountRebateWhere.discordId = { notIn: excludeMemberIds };
  }
  const discountRebateAgg = await prisma.individualTransaction.aggregate({
    _sum: { amountChange: true },
    where: discountRebateWhere,
  });
  const discountDeductionTotal = dec(discountRebateAgg._sum.amountChange);

  const drawCount = await prisma.lotteryDraw.count({
    where: { createdAt: { gte: start, lt: end } },
  });
  const consumeAgg = await prisma.lotteryDraw.aggregate({
    _sum: { consumeAmount: true },
    where: { consumeAt: { gte: start, lt: end } },
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
  const [
    expenseAgg,
    pureProfitAgg,
    expenseByReason,
    couponConsumedAgg,
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
    prisma.coupon.aggregate({
      _sum: { consumeAmount: true },
      _count: { id: true },
      where: {
        status: CouponStatus.USED,
        consumedAt: { gte: start, lt: end },
        consumeAmount: { not: null },
        ...(excludeMemberIds.length ? { discordId: { notIn: excludeMemberIds } } : {}),
      },
    }),
  ]);
  const expenseByReasonSorted = [...expenseByReason].sort(
    (a, b) => (parseNumber(b._sum.amount) ?? 0) - (parseNumber(a._sum.amount) ?? 0)
  );
  const couponTableAmount = dec(couponConsumedAgg._sum.consumeAmount);
  const couponTableCount = couponConsumedAgg._count.id;

  const pointShopOrderWhere: Prisma.PointShopOrderWhereInput = {
    createdAt: { gte: start, lt: end },
  };
  if (excludeMemberIds.length) {
    pointShopOrderWhere.discordUserId = { notIn: excludeMemberIds };
  }

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
          ...(excludeMemberIds.length ? { discordUserId: { notIn: excludeMemberIds } } : {}),
        },
      }),
      prisma.pointShopGrant.aggregate({
        _sum: { consumeAmount: true },
        where: {
          deliveryType: 'BALANCE',
          issuedAt: { gte: start, lt: end },
          ...(excludeMemberIds.length ? { discordUserId: { notIn: excludeMemberIds } } : {}),
        },
      }),
    ]);

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
          {excludeRechargeIds.length ? (
            <div className="space-y-1">
              {excludeRechargeIds.map((id) => (
                <div key={`recharge-${id}`} className="text-xs text-white/60">
                  <span className="text-white/80">{resolveDisplayName(id)}</span>
                  <span className="mx-1">·</span>
                  <span className="font-mono">{id}</span>
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
          {excludeMemberIds.length ? (
            <div className="space-y-1">
              {excludeMemberIds.map((id) => (
                <div key={`member-${id}`} className="text-xs text-white/60">
                  <span className="text-white/80">{resolveDisplayName(id)}</span>
                  <span className="mx-1">·</span>
                  <span className="font-mono">{id}</span>
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
            <p>Member.recharge 合计：¥{formatNumber(memberAgg._sum.recharge)}</p>
            <p>Member.income 合计：¥{formatNumber(memberAgg._sum.income)}</p>
            <p>Member.totalBalance 合计：¥{formatNumber(memberAgg._sum.totalBalance)}</p>
            <p>当月 Commission 合计：¥{formatNumber(commissionTotalNet)}</p>
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
            <h3 className="text-lg font-semibold">支出记录（Expense）</h3>
            <Link
              href="/admin/expenses"
              className="inline-flex items-center justify-center rounded-full border border-white/20 px-3 py-1 text-xs text-white hover:bg-white/10"
            >
              查看全部
            </Link>
          </div>
          <div className="space-y-1 text-sm text-white/70">
            <p>笔数：{expenseAgg._count.id}</p>
            <p>总额：¥{formatNumber(expenseAgg._sum.amount, 4)}</p>
            <p>Coupon表格金额（送券，彩蛋）：¥{formatNumber(couponTableAmount, 4)}</p>
            <p>Coupon表格笔数（送券，彩蛋）：{couponTableCount}</p>
            <p>总扣款金额(收入）：¥{formatNumber(pureProfitAgg._sum.amount, 4)}</p>
          </div>
          <div className="space-y-1 text-sm text-white/70">
            <p className="text-white/90">按原因分类：</p>
            {expenseByReasonSorted.length ? (
              expenseByReasonSorted.map((row) => (
                <p key={row.reason}>
                  {row.reason}：{row._count.id} 笔 · ¥{formatNumber(row._sum.amount, 4)}
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
      </div>

    </div>
  );
}
