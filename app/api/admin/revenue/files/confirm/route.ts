import { NextRequest, NextResponse } from 'next/server';
import { canViewRevenue } from '@/lib/admin';
import { confirmMonthlyFinancialReport, parseMonthlyReportMonthKey } from '@/lib/admin/monthly-financial-reports';
import { getServerSession } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const session = await getServerSession();
  if (!session?.discordId || !canViewRevenue(session.discordId)) {
    return NextResponse.json({ error: '无权访问' }, { status: 403 });
  }

  const formData = await request.formData();
  const monthKey = String(formData.get('monthKey') ?? '').trim();
  if (!parseMonthlyReportMonthKey(monthKey)) {
    return NextResponse.json({ error: '月份格式必须是 YYYY-MM' }, { status: 400 });
  }

  try {
    await confirmMonthlyFinancialReport(monthKey, session.discordId);
    return NextResponse.json({ ok: true, monthKey });
  } catch (error) {
    const message = error instanceof Error ? error.message : '确认月结失败';
    return NextResponse.json({ error: message }, { status: 409 });
  }
}
