import { NextRequest, NextResponse } from 'next/server';
import { canViewRevenue } from '@/lib/admin';
import { getMonthlyFinancialReportExcel, parseMonthlyReportMonthKey } from '@/lib/admin/monthly-financial-reports';
import { getServerSession } from '@/lib/session';
import { isNewEntityReportMonth } from '@/lib/operating-entity-cutover';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const session = await getServerSession();
  if (!session?.discordId || !canViewRevenue(session.discordId)) {
    return NextResponse.json({ error: '无权访问' }, { status: 403 });
  }

  const monthKey = request.nextUrl.searchParams.get('month')?.trim() ?? '';
  if (!parseMonthlyReportMonthKey(monthKey) || !isNewEntityReportMonth(monthKey)) {
    return NextResponse.json({ error: '月份格式必须是 YYYY-MM' }, { status: 400 });
  }

  try {
    const { fileName, buffer } = await getMonthlyFinancialReportExcel(monthKey);
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '导出财务报表失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
