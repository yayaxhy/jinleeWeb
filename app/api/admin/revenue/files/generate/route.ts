import { NextRequest, NextResponse } from 'next/server';
import { canViewRevenue } from '@/lib/admin';
import {
  generateStoredMonthlyFinancialReports,
  parseMonthlyReportMonthKey,
} from '@/lib/admin/monthly-financial-reports';
import { getServerSession } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const session = await getServerSession();
  if (!session?.discordId || !canViewRevenue(session.discordId)) {
    return NextResponse.json({ error: '无权访问' }, { status: 403 });
  }

  const formData = await request.formData();
  const monthValue = String(formData.get('month') ?? '').trim();
  const force = formData.get('force') === '1';
  if (monthValue && !parseMonthlyReportMonthKey(monthValue)) {
    return NextResponse.json({ error: '月份格式必须是 YYYY-MM' }, { status: 400 });
  }

  try {
    await generateStoredMonthlyFinancialReports({
      monthKey: monthValue || undefined,
      force,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '生成文件失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const redirectUrl = new URLSearchParams({ generated: monthValue || 'previous' });
  return new NextResponse(null, {
    status: 303,
    // Use a relative Location header so reverse-proxy requests never redirect the browser to localhost.
    headers: { Location: `/admin/revenue/files?${redirectUrl.toString()}` },
  });
}
