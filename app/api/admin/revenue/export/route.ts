import ExcelJS from 'exceljs';
import { CouponStatus, Prisma } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { canViewRevenue } from '@/lib/admin';
import { prisma } from '@/lib/prisma';
import { getServerSession } from '@/lib/session';
import {
  formatDateTimeTextCentralEuropean,
  formatFileTimestampCentralEuropean,
  parseCentralEuropeanDateRange,
} from '@/lib/centralEuropeanDateRange';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const normalizeId = (raw: string) => {
  const cleaned = raw.trim().replace(/^<@!?/, '').replace(/>$/, '');
  return /^\d+$/.test(cleaned) ? cleaned : '';
};

const parseExcludeIds = (value: string) =>
  value
    .split(/[\s,]+/)
    .map(normalizeId)
    .filter(Boolean);

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

const dec = (value: unknown) => {
  if (value instanceof Prisma.Decimal) return value;
  const numeric = parseNumber(value);
  return new Prisma.Decimal(numeric ?? 0);
};

const decimalSum = (rows: any[], field: string) =>
  rows.reduce((sum, row) => sum.add(dec(row?.[field])), new Prisma.Decimal(0));

const safeSheetName = (name: string) =>
  name.replace(/[\\/*?:[\]]/g, '_').slice(0, 31) || 'Sheet';

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

type OrderReferralRow = {
  id: string;
  referralId: string;
  orderId: string;
  amount: Prisma.Decimal | null;
  createdAt: Date;
  orderEndedAt: Date | null;
  hostId: string | null;
  workerId: string | null;
};

function addObjectRowsSheet(workbook: ExcelJS.Workbook, title: string, rows: any[]) {
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

const toFileName = (prefix: string, date = new Date()) => `${prefix}_${formatFileTimestampCentralEuropean(date)}.xlsx`;

export async function GET(request: NextRequest) {
  const session = await getServerSession();
  if (!session?.discordId || !canViewRevenue(session.discordId)) {
    return NextResponse.json({ error: '无权访问' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const excludeRechargeInput = (searchParams.get('excludeRecharge') ?? '').trim();
  const excludeMemberInput = (searchParams.get('excludeMember') ?? '1441310169492361268').trim();
  const excludeRechargeIds = excludeRechargeInput ? parseExcludeIds(excludeRechargeInput) : [];
  const excludeMemberIds = excludeMemberInput ? parseExcludeIds(excludeMemberInput) : [];
  const { start, end } = parseCentralEuropeanDateRange(
    searchParams.get('startDate') ?? undefined,
    searchParams.get('endDate') ?? undefined,
  );

  const excludePreviewIds = Array.from(new Set([...excludeRechargeIds, ...excludeMemberIds]));
  const excludeMembers = excludePreviewIds.length
    ? await prisma.member.findMany({
        where: { discordUserId: { in: excludePreviewIds } },
        select: { discordUserId: true, serverDisplayName: true },
        orderBy: { discordUserId: 'asc' },
      })
    : [];

  const rechargeWhere: Prisma.RechargeWhereInput = { createdAt: { gte: start, lt: end } };
  if (excludeRechargeIds.length) rechargeWhere.toWhom = { notIn: excludeRechargeIds };

  const withdrawWhere: Prisma.WithdrawWhereInput = { createdAt: { gte: start, lt: end } };
  if (excludeRechargeIds.length) withdrawWhere.discordId = { notIn: excludeRechargeIds };

  const zpayWhere: Prisma.ZPayRechargeOrderWhereInput = {
    status: 'PAID',
    createdAt: { gte: start, lt: end },
  };
  if (excludeRechargeIds.length) zpayWhere.discordUserId = { notIn: excludeRechargeIds };

  const memberWhere: Prisma.MemberWhereInput = {};
  if (excludeMemberIds.length) memberWhere.discordUserId = { notIn: excludeMemberIds };

  const commissionWhere: Prisma.CommissionWhereInput = { createdAt: { gte: start, lt: end } };
  if (excludeMemberIds.length) commissionWhere.toId = { notIn: excludeMemberIds };

  const discountRebateWhere: Prisma.IndividualTransactionWhereInput = {
    typeOfTransaction: '优惠返利',
    timeCreatedAt: { gte: start, lt: end },
  };
  if (excludeMemberIds.length) discountRebateWhere.discordId = { notIn: excludeMemberIds };

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
    discountRebateRows,
    lotteryCreatedRows,
    lotteryConsumeRows,
    scratchRows,
    expenseRows,
    revertedGiftRows,
    couponConsumedAgg,
  ] = await Promise.all([
    prisma.blockStackGame.findMany({
      where: { createdAt: { gte: start, lt: end } },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.recharge.findMany({ where: rechargeWhere, orderBy: { createdAt: 'desc' } }),
    prisma.withdraw.findMany({ where: withdrawWhere, orderBy: { createdAt: 'desc' } }),
    prisma.zPayRechargeOrder.findMany({ where: zpayWhere, orderBy: { createdAt: 'desc' } }),
    prisma.member.findMany({
      where: memberWhere,
      orderBy: { discordUserId: 'asc' },
      select: {
        discordUserId: true,
        serverDisplayName: true,
        status: true,
        recharge: true,
        income: true,
        totalBalance: true,
        totalSpent: true,
      },
    }),
    prisma.commission.findMany({ where: commissionWhere, orderBy: { createdAt: 'desc' } }),
    prisma.giftAudit.findMany({ where: { createdAt: { gte: start, lt: end } }, orderBy: { createdAt: 'desc' } }),
    prisma.order.findMany({
      where: { status: 'ENDED', endedAt: { gte: start, lt: end } },
      orderBy: { endedAt: 'desc' },
    }),
    prisma.$queryRaw<OrderReferralRow[]>(Prisma.sql`
      SELECT
        rp."id",
        rp."referralId",
        rp."orderId",
        rp."amount",
        rp."createdAt",
        o."endedAt" AS "orderEndedAt",
        o."hostId",
        o."workerId"
      FROM "ReferralPayout" rp
      JOIN "Order" o
        ON o."id" = rp."orderId"
      WHERE rp."createdAt" >= ${start}
        AND rp."createdAt" < ${end}
        AND o."status" = 'ENDED'
      ORDER BY rp."createdAt" DESC
    `),
    prisma.individualTransaction.findMany({
      where: discountRebateWhere,
      orderBy: { timeCreatedAt: 'desc' },
    }),
    prisma.lotteryDraw.findMany({ where: { createdAt: { gte: start, lt: end } }, orderBy: { createdAt: 'desc' } }),
    prisma.lotteryDraw.findMany({ where: { consumeAt: { gte: start, lt: end } }, orderBy: { consumeAt: 'desc' } }),
    prisma.scratchTicket.findMany({
      where: { status: 'REVEALED', revealedAt: { gte: start, lt: end } },
      orderBy: { revealedAt: 'desc' },
    }),
    prisma.expense.findMany({ where: { createdAt: { gte: start, lt: end } }, orderBy: { createdAt: 'desc' } }),
    prisma.$queryRaw<any[]>(Prisma.sql`
      SELECT
        r.id AS "revertId",
        r."originalTransactionId",
        r."createdAt" AS "revertCreatedAt",
        r."status" AS "revertStatus",
        ga."createdAt" AS "giftAuditCreatedAt",
        ga."individualTransactionId",
        ga."gross",
        ga."payable",
        (ga."gross" - ga."payable") AS "subsidyAmount"
      FROM "gift_audit" ga
      JOIN "revert" r
        ON r."originalTransactionId" = ga."individualTransactionId"
      WHERE r."status" = 'SUCCESS'
        AND ga."createdAt" >= ${start}
        AND ga."createdAt" < ${end}
      ORDER BY ga."createdAt" DESC
    `),
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
  const revertedGiftSubsidy = decimalSum(revertedGiftRows, 'subsidyAmount');
  const giftSubsidyNet = giftSubsidy.sub(revertedGiftSubsidy);
  const giftFee = decimalSum(giftAuditRows, 'feeAmount');
  const giftReferral = decimalSum(giftAuditRows, 'bossReferralAmount').add(decimalSum(giftAuditRows, 'workerReferralAmount'));
  const orderReferral = decimalSum(referralPayoutRows, 'amount');
  const orderGross = decimalSum(orderRows, 'grossAmount');
  const orderNet = decimalSum(orderRows, 'netAmount');
  const orderFee = orderGross.sub(orderNet);
  const totalPaidFlow = giftPaid.add(orderGross);
  const totalFaceFlow = giftGross.add(orderGross);
  const feeFromOrderAndGiftModel = giftFee.add(orderFee);
  const commissionOtherSources = commissionTotal.sub(feeFromOrderAndGiftModel);
  const discountDeductionTotal = decimalSum(discountRebateRows, 'amountChange');

  const drawCount = lotteryCreatedRows.length;
  const grossIncome = new Prisma.Decimal(drawCount).mul(29);
  const consumeTotal = decimalSum(lotteryConsumeRows, 'consumeAmount');
  const netProfit = grossIncome.sub(consumeTotal);

  const scratchRevealedCount = scratchRows.length;
  const scratchGross = new Prisma.Decimal(scratchRevealedCount).mul(19);
  const scratchReward = decimalSum(scratchRows, 'prizeAmount');
  const scratchNet = scratchGross.sub(scratchReward);

  const expenseTotal = decimalSum(expenseRows, 'amount');
  const couponTableAmount = dec(couponConsumedAgg._sum.consumeAmount);
  const couponTableCount = couponConsumedAgg._count.id;
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

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'jinlee admin';
  workbook.created = new Date();

  addKeyValueSheet(workbook, '导出参数', [
    { section: 'filters', key: 'start', value: formatDateTimeTextCentralEuropean(start) },
    { section: 'filters', key: 'end(exclusive)', value: formatDateTimeTextCentralEuropean(end) },
    { section: 'filters', key: 'excludeRecharge(raw)', value: excludeRechargeInput },
    { section: 'filters', key: 'excludeMember(raw)', value: excludeMemberInput },
    { section: 'filters', key: 'excludeRechargeIds', value: excludeRechargeIds.join(', ') },
    { section: 'filters', key: 'excludeMemberIds', value: excludeMemberIds.join(', ') },
    { section: 'rows', key: 'BlockStackGame', value: blockStackRows.length },
    { section: 'rows', key: 'Recharge', value: rechargeRows.length },
    { section: 'rows', key: 'Withdraw', value: withdrawRows.length },
    { section: 'rows', key: 'ZPayRechargeOrder(PAID)', value: zpayRows.length },
    { section: 'rows', key: 'Member(filtered)', value: memberRows.length },
    { section: 'rows', key: 'Commission(filtered)', value: commissionRows.length },
    { section: 'rows', key: 'GiftAudit', value: giftAuditRows.length },
    { section: 'rows', key: 'Order(ENDED)', value: orderRows.length },
    { section: 'rows', key: 'ReferralPayout', value: referralPayoutRows.length },
    { section: 'rows', key: 'IndividualTransaction(优惠返利)', value: discountRebateRows.length },
    { section: 'rows', key: 'LotteryDraw(createdAt window)', value: lotteryCreatedRows.length },
    { section: 'rows', key: 'LotteryDraw(consumeAt window)', value: lotteryConsumeRows.length },
    { section: 'rows', key: 'ScratchTicket(REVEALED)', value: scratchRows.length },
    { section: 'rows', key: 'Expense', value: expenseRows.length },
    { section: 'rows', key: 'RevertedGiftSubsidy(join)', value: revertedGiftRows.length },
    { section: 'rows', key: 'Coupon(used with consumeAmount)', value: couponTableCount },
  ]);

  addKeyValueSheet(workbook, '收益汇总', [
    { section: '当月充值提现', key: 'Recharge 充值总额', value: rechargeTotal.toString() },
    { section: '当月充值提现', key: 'ZPay 已支付', value: zpayTotal.toString() },
    { section: '当月充值提现', key: '提现总额', value: withdrawTotal.toString() },
    { section: '当月充值提现', key: '净充值', value: netRecharge.toString() },

    { section: '会员余额汇总', key: 'Member.recharge 合计', value: memberRechargeTotal.toString() },
    { section: '会员余额汇总', key: 'Member.income 合计', value: memberIncomeTotal.toString() },
    { section: '会员余额汇总', key: 'Member.totalBalance 合计', value: memberBalanceTotal.toString() },
    { section: '会员余额汇总', key: '当月 Commission 合计', value: commissionTotal.toString() },

    { section: '抽奖收益', key: '抽奖次数', value: drawCount },
    { section: '抽奖收益', key: '毛收入（次数×29）', value: grossIncome.toString() },
    { section: '抽奖收益', key: '券抵扣消耗', value: consumeTotal.toString() },
    { section: '抽奖收益', key: '净收益', value: netProfit.toString() },

    { section: '刮刮乐收益', key: '已刮开数量', value: scratchRevealedCount },
    { section: '刮刮乐收益', key: '毛收入（数量×19）', value: scratchGross.toString() },
    { section: '刮刮乐收益', key: '中奖支出', value: scratchReward.toString() },
    { section: '刮刮乐收益', key: '净收益', value: scratchNet.toString() },

    { section: '积木游戏收益', key: '总收入', value: blockTotalRevenue.toString() },
    { section: '积木游戏收益', key: '结算支出', value: blockSettled.toString() },
    { section: '积木游戏收益', key: '塌方红包', value: blockEnvelope.toString() },
    { section: '积木游戏收益', key: '捣蛋奖励', value: blockReward.toString() },
    { section: '积木游戏收益', key: '净收益', value: blockEarning.toString() },

    { section: '支出记录(Expense)', key: '笔数', value: expenseRows.length },
    { section: '支出记录(Expense)', key: '总额', value: expenseTotal.toString() },
    { section: '支出记录(Expense)', key: 'Coupon表格金额（送券，彩蛋）', value: couponTableAmount.toString() },
    { section: '支出记录(Expense)', key: 'Coupon表格笔数（送券，彩蛋）', value: couponTableCount },

    { section: '抽成详情', key: '打赏面值流水', value: giftGross.toString() },
    { section: '抽成详情', key: '打赏实付流水', value: giftPaid.toString() },
    { section: '抽成详情', key: '打赏抽成', value: giftFee.toString() },
    { section: '抽成详情', key: '打赏返利', value: giftReferral.toString() },
    { section: '抽成详情', key: '订单返利', value: orderReferral.toString() },
    { section: '抽成详情', key: '打赏补贴(代金券原始)', value: giftSubsidy.toString() },
    { section: '抽成详情', key: '打赏补贴回退(打赏撤销)', value: revertedGiftSubsidy.toString() },
    { section: '抽成详情', key: '打赏补贴(代金券净额)', value: giftSubsidyNet.toString() },
    { section: '抽成详情', key: '打折券抵扣金额', value: discountDeductionTotal.toString() },
    { section: '抽成详情', key: '单子总数', value: orderRows.length },
    { section: '抽成详情', key: '订单流水', value: orderGross.toString() },
    { section: '抽成详情', key: '订单结算', value: orderNet.toString() },
    { section: '抽成详情', key: '订单抽成', value: orderFee.toString() },
    { section: '抽成详情', key: '总抽成', value: commissionTotal.toString() },
    { section: '抽成详情', key: '总面值原价流水', value: totalFaceFlow.toString() },
    { section: '抽成详情', key: '总实付流水', value: totalPaidFlow.toString() },
    { section: '抽成详情', key: '模型抽成合计（订单+打赏）', value: feeFromOrderAndGiftModel.toString() },
    { section: '抽成详情', key: '其他来源抽成', value: commissionOtherSources.toString() },
  ]);

  addObjectRowsSheet(workbook, '排除ID映射', excludeMembers);
  addObjectRowsSheet(workbook, '积木游戏明细', blockStackRows);
  addObjectRowsSheet(workbook, '充值明细', rechargeRows);
  addObjectRowsSheet(workbook, '提现明细', withdrawRows);
  addObjectRowsSheet(workbook, 'ZPay已支付明细', zpayRows);
  addObjectRowsSheet(workbook, '会员汇总明细', memberRows);
  addObjectRowsSheet(workbook, '抽成明细_Commission', commissionRows);
  addObjectRowsSheet(workbook, '打赏审计明细', giftAuditRows);
  addObjectRowsSheet(workbook, '打赏补贴回退明细', revertedGiftRows);
  addObjectRowsSheet(workbook, '订单明细_ENDED', orderRows);
  addObjectRowsSheet(workbook, '订单返利明细', referralPayoutRows);
  addObjectRowsSheet(workbook, '优惠返利流水', discountRebateRows);
  addObjectRowsSheet(workbook, '抽奖明细_创建时间', lotteryCreatedRows);
  addObjectRowsSheet(workbook, '抽奖明细_消耗时间', lotteryConsumeRows);
  addObjectRowsSheet(workbook, '刮刮乐已刮开明细', scratchRows);
  addObjectRowsSheet(workbook, '支出明细', expenseRows);
  addObjectRowsSheet(
    workbook,
    '支出分类汇总',
    expenseByReasonSorted.map((row) => ({ reason: row.reason, count: row.count, amount: row.amount.toString() })),
  );
  const buffer = await workbook.xlsx.writeBuffer();
  const fileName = toFileName('admin_revenue_data');

  return new NextResponse(Buffer.from(buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Cache-Control': 'no-store',
    },
  });
}
