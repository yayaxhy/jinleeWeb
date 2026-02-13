import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getServerSession } from '@/lib/session';
import { isAdminDiscordId } from '@/lib/admin';

export const metadata = {
  title: '查看收益',
};

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>> | Record<string, string | string[] | undefined>;
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

const pad2 = (value: number) => String(value).padStart(2, '0');

const formatDateTimeLocal = (date: Date) =>
  `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}T${pad2(date.getHours())}:${pad2(
    date.getMinutes()
  )}`;

const parseDateRange = (startRaw?: string, endRaw?: string) => {
  const now = new Date();
  const defaultStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  const defaultEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0, 0);

  const startInput = startRaw?.trim() ?? '';
  const endInput = endRaw?.trim() ?? '';
  const parsedStart = startInput ? new Date(startInput) : null;
  const parsedEnd = endInput ? new Date(endInput) : null;

  const startValid = parsedStart && !Number.isNaN(parsedStart.getTime());
  const endValid = parsedEnd && !Number.isNaN(parsedEnd.getTime());

  const start = startValid ? parsedStart : defaultStart;
  const end = endValid ? parsedEnd : defaultEnd;

  if (start.getTime() >= end.getTime()) {
    return {
      start: defaultStart,
      end: defaultEnd,
      startValue: formatDateTimeLocal(defaultStart),
      endValue: formatDateTimeLocal(defaultEnd),
    };
  }

  return {
    start,
    end,
    startValue: formatDateTimeLocal(start),
    endValue: formatDateTimeLocal(end),
  };
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
  const numeric = parseNumber(value);
  if (numeric === null) return '—';
  return numeric.toLocaleString('zh-CN', { minimumFractionDigits: 0, maximumFractionDigits });
};

const dec = (value: unknown) => {
  if (value instanceof Prisma.Decimal) return value;
  const numeric = parseNumber(value);
  return new Prisma.Decimal(numeric ?? 0);
};

export default async function AdminRevenuePage(props: PageProps = {}) {
  const session = await getServerSession();
  if (!session?.discordId || !isAdminDiscordId(session.discordId)) {
    redirect('/');
  }

  const rawParams = await Promise.resolve(props.searchParams);
  const searchParams = rawParams ?? {};
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
  const { start, end, startValue, endValue } = parseDateRange(startParam, endParam);

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
  const orderAgg = await prisma.order.aggregate({
    _sum: {
      grossAmount: true,
      netAmount: true,
    },
    where: {
      status: 'ENDED',
      endedAt: { gte: start, lt: end },
    },
  });

  const giftGross = dec(giftAgg._sum.gross);
  const giftPaid = dec(giftAgg._sum.payable);
  const giftSubsidy = giftGross.sub(giftPaid);
  const giftFee = dec(giftAgg._sum.feeAmount);
  const giftReferral = dec(giftAgg._sum.bossReferralAmount).add(dec(giftAgg._sum.workerReferralAmount));
  const orderGross = dec(orderAgg._sum.grossAmount);
  const orderNet = dec(orderAgg._sum.netAmount);
  const orderFee = orderGross.sub(orderNet);
  const totalPaidFlow = giftPaid.add(orderGross);
  const totalFaceFlow = giftGross.add(orderGross);
  const feeFromOrderAndGiftModel = giftFee.add(orderFee);
  const commissionOtherSources = commissionTotal.sub(feeFromOrderAndGiftModel);

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
          <span className="text-white/70">开始时间</span>
          <input
            type="datetime-local"
            name="startDate"
            defaultValue={startValue}
            className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white"
          />
        </label>
        <label className="space-y-2 text-sm">
          <span className="text-white/70">结束时间</span>
          <input
            type="datetime-local"
            name="endDate"
            defaultValue={endValue}
            className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white"
          />
        </label>
        <label className="space-y-2 text-sm">
          <span className="text-white/70">充值/提现排除 IDs</span>
          <textarea
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
          <button
            type="submit"
            className="inline-flex items-center justify-center rounded-full bg-white/15 px-6 py-2 text-sm text-white hover:bg-white/25"
          >
            刷新数据
          </button>
        </div>
      </form>

      

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
            <p>当月 Commission 合计：¥{formatNumber(commissionTotal)}</p>
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

        <div className="grid gap-4 md:grid-cols-2">
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

          <div className="rounded-3xl border border-white/10 bg-white/5 p-5 space-y-3">
          <h3 className="text-lg font-semibold">抽成详情</h3>
          <div className="space-y-1 text-sm text-white/70">
            <p>打赏面值流水：¥{formatNumber(giftGross, 4)}</p>
            <p>打赏实付流水：¥{formatNumber(giftPaid, 4)}</p>
            <p>打赏补贴(代金券)：¥{formatNumber(giftSubsidy, 4)}</p>
            <p>打赏抽成：¥{formatNumber(giftFee, 4)}</p>
            <p>打赏返利：¥{formatNumber(giftReferral, 4)}</p>
            <p>订单流水：¥{formatNumber(orderGross, 4)}</p>
            <p>订单结算：¥{formatNumber(orderNet, 4)}</p>
            <p>订单抽成：¥{formatNumber(orderFee, 4)}</p>
            <p>总抽成：¥{formatNumber(commissionTotal, 4)}</p>
            <p>总实付流水：¥{formatNumber(totalPaidFlow, 4)}</p>
            <p>总面值流水：¥{formatNumber(totalFaceFlow, 4)}</p>
            <p>模型抽成合计（订单+打赏）：¥{formatNumber(feeFromOrderAndGiftModel, 4)}</p>
            <p className="text-white">其他来源抽成：¥{formatNumber(commissionOtherSources, 4)}</p>
          </div>
        </div>

      </div>
    </div>
  );
}
