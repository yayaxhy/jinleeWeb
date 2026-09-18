import fs from 'node:fs/promises';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { canViewRevenue } from '@/lib/admin';
import { getMonthlyReportStorageDir } from '@/lib/admin/monthly-financial-reports';
import { prisma } from '@/lib/prisma';
import { getServerSession } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const IMAGE_DIRECTORY = path.join(getMonthlyReportStorageDir(), 'manual-expense-images');
const CONTENT_TYPE_BY_EXTENSION: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
};

type RouteParams = { id: string };

export async function GET(_request: Request, context: { params: Promise<RouteParams> }) {
  const session = await getServerSession();
  if (!session?.discordId || !canViewRevenue(session.discordId)) {
    return NextResponse.json({ error: '无权访问' }, { status: 403 });
  }

  const { id } = await context.params;
  const expense = await prisma.monthlyManualExpense.findUnique({
    where: { id },
    select: { imageFileName: true },
  });
  const fileName = expense?.imageFileName;
  if (!fileName || path.basename(fileName) !== fileName) {
    return NextResponse.json({ error: '图片不存在' }, { status: 404 });
  }

  try {
    const buffer = await fs.readFile(path.join(IMAGE_DIRECTORY, fileName));
    const contentType = CONTENT_TYPE_BY_EXTENSION[path.extname(fileName).toLowerCase()] ?? 'application/octet-stream';
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return NextResponse.json({ error: '图片不存在' }, { status: 404 });
    }
    const message = error instanceof Error ? error.message : '读取图片失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
