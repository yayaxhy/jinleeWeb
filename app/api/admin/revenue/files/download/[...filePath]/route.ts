import fs from 'node:fs/promises';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { canViewRevenue } from '@/lib/admin';
import { resolveStoredMonthlyReportFilePath } from '@/lib/admin/monthly-financial-reports';
import { getServerSession } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteParams = {
  filePath: string[];
};

export async function GET(_request: Request, context: { params: Promise<RouteParams> }) {
  const session = await getServerSession();
  if (!session?.discordId || !canViewRevenue(session.discordId)) {
    return NextResponse.json({ error: '无权访问' }, { status: 403 });
  }

  const params = await context.params;
  const filePath = resolveStoredMonthlyReportFilePath(params.filePath ?? []);
  if (!filePath) {
    return NextResponse.json({ error: '文件不存在' }, { status: 404 });
  }

  try {
    const buffer = await fs.readFile(filePath);
    const fileName = path.basename(filePath);
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return NextResponse.json({ error: '文件不存在' }, { status: 404 });
    }
    const message = error instanceof Error ? error.message : '读取文件失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

