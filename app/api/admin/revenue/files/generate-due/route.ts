import { NextRequest, NextResponse } from 'next/server';
import { canViewRevenue } from '@/lib/admin';
import { generateStoredMonthlyFinancialReports } from '@/lib/admin/monthly-financial-reports';
import { getServerSession } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const getExpectedToken = () => process.env.ADMIN_REPORT_CRON_TOKEN || process.env.INTERNAL_API_TOKEN || '';

const isAuthorizedCronRequest = async (request: NextRequest) => {
  const expectedToken = getExpectedToken();
  const providedToken =
    request.headers.get('x-admin-report-token') ||
    request.nextUrl.searchParams.get('token') ||
    '';
  if (expectedToken && providedToken === expectedToken) return true;

  const session = await getServerSession();
  return Boolean(session?.discordId && canViewRevenue(session.discordId));
};

export async function GET(request: NextRequest) {
  if (!(await isAuthorizedCronRequest(request))) {
    return NextResponse.json({ error: '无权访问' }, { status: 403 });
  }

  try {
    const result = await generateStoredMonthlyFinancialReports({ force: false });
    return NextResponse.json({
      ok: true,
      monthKey: result.monthKey,
      financialStatement: {
        filePath: result.financialStatement.filePath,
        skipped: result.financialStatement.skipped,
        size: result.financialStatement.size,
      },
      adminData: {
        filePath: result.adminData.filePath,
        skipped: result.adminData.skipped,
        size: result.adminData.size,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '生成文件失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

