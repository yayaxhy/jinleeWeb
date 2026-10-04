import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { canViewRevenue } from '@/lib/admin';
import {
  generateStoredMonthlyFinancialReports,
  getDividendLedgerState,
  parseMonthlyReportMonthKey,
  readConfirmedMonthlyReport,
  withMonthlyReportLocks,
} from '@/lib/admin/monthly-financial-reports';
import { formatCentralEuropeanMonthKey, getCentralEuropeanMonthParts } from '@/lib/centralEuropeanDateRange';
import { isNewEntityReportMonth, NEW_ENTITY_OPERATIONS_STARTED_AT } from '@/lib/operating-entity-cutover';
import { prisma } from '@/lib/prisma';
import { getServerSession } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const parseAmount = (raw: unknown) => {
  if (typeof raw !== 'string') return null;
  try {
    const amount = new Prisma.Decimal(raw.trim());
    return amount.isFinite() && !amount.isZero() && amount.decimalPlaces() <= 2 ? amount : null;
  } catch { return null; }
};

const currentMonthKey = () => {
  const { year, month } = getCentralEuropeanMonthParts(new Date());
  return formatCentralEuropeanMonthKey(year, month);
};

const monthsFrom = (first: string, last: string) => {
  const result: string[] = [];
  const [firstYear, firstMonth] = first.split('-').map(Number);
  for (let year = firstYear, month = firstMonth; formatCentralEuropeanMonthKey(year, month) <= last;) {
    result.push(formatCentralEuropeanMonthKey(year, month));
    month += 1;
    if (month > 12) { year += 1; month = 1; }
  }
  return result;
};

const refreshReport = async (monthKey: string) => {
  try {
    await generateStoredMonthlyFinancialReports({ monthKey, force: true });
    return true;
  } catch (error) {
    console.error('Failed to refresh monthly report after dividend posting', error);
    return false;
  }
};

export async function POST(request: NextRequest) {
  const session = await getServerSession();
  if (!session?.discordId || !canViewRevenue(session.discordId)) {
    return NextResponse.json({ error: '无权访问' }, { status: 403 });
  }
  const body = await request.json().catch(() => null);
  const kind = body?.kind;
  const amount = parseAmount(body?.amount);
  const note = typeof body?.note === 'string' ? body.note.trim() : '';
  const monthKey = typeof body?.monthKey === 'string' ? body.monthKey : '';
  const sourceMonthKey = typeof body?.sourceMonthKey === 'string' && body.sourceMonthKey
    ? body.sourceMonthKey : null;
  if ((kind !== 'decision' && kind !== 'payment') || !amount || !note || note.length > 500) {
    return NextResponse.json({ error: '请输入有效的记录类型、金额和备注（最多 500 字）' }, { status: 400 });
  }
  if (!parseMonthlyReportMonthKey(monthKey) || !isNewEntityReportMonth(monthKey)) {
    return NextResponse.json({ error: '无效的新主体月份' }, { status: 400 });
  }
  if (sourceMonthKey && (!parseMonthlyReportMonthKey(sourceMonthKey) || !isNewEntityReportMonth(sourceMonthKey))) {
    return NextResponse.json({ error: '原属月份无效' }, { status: 400 });
  }
  const todayMonthKey = currentMonthKey();
  if (monthKey > todayMonthKey) return NextResponse.json({ error: '不能提前记录未来月份' }, { status: 400 });
  if (sourceMonthKey && sourceMonthKey > monthKey) {
    return NextResponse.json({ error: '原属月份不能晚于入账月份' }, { status: 400 });
  }
  if (kind === 'payment' && !amount.gt(0)) {
    return NextResponse.json({ error: '实际付款金额必须大于 0' }, { status: 400 });
  }

  let paidAt: Date | null = null;
  if (kind === 'payment') {
    paidAt = body?.paidAt ? new Date(body.paidAt) : new Date();
    if (!Number.isFinite(paidAt.getTime()) || paidAt > new Date() || paidAt < NEW_ENTITY_OPERATIONS_STARTED_AT) {
      return NextResponse.json({ error: '实际付款时间无效' }, { status: 400 });
    }
    const { year, month } = getCentralEuropeanMonthParts(paidAt);
    if (formatCentralEuropeanMonthKey(year, month) !== todayMonthKey) {
      return NextResponse.json({ error: '付款只允许记录在当前自然月；历史付款请先联系管理员核对月结' }, { status: 400 });
    }
  }
  const bookedMonthKey = kind === 'payment' ? todayMonthKey : monthKey;
  const affectedMonths = monthsFrom(bookedMonthKey, todayMonthKey);
  try {
    await withMonthlyReportLocks(affectedMonths, async () => {
      for (const affectedMonth of affectedMonths) {
        if (await readConfirmedMonthlyReport(affectedMonth)) {
          throw new Error('本月或后续月份已经确认；请在当前未确认月份记录调整，不要改写旧月');
        }
      }
      const currentLedger = await getDividendLedgerState(todayMonthKey);
      if (kind === 'decision') {
        if (currentLedger.payableAtMonthEnd.add(amount).lt(0)) {
          throw new Error('冲回金额不能超过尚未支付的分红');
        }
        await prisma.monthlyDividendDecision.create({
          data: { monthKey: bookedMonthKey, sourceMonthKey, amount, note, operatorId: session.discordId },
        });
      } else {
        if (amount.gt(currentLedger.payableAtMonthEnd)) {
          throw new Error('付款金额不能超过尚未支付的分红');
        }
        await prisma.monthlyDividendPayment.create({
          data: { amount, paidAt: paidAt!, note, operatorId: session.discordId },
        });
      }
    });
    const reportSynced = (await Promise.all(affectedMonths.map(refreshReport))).every(Boolean);
    return NextResponse.json({ ok: true, bookedMonthKey, reportSynced });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : '记录分红失败' }, { status: 400 });
  }
}
