import { NextRequest, NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getServerSession } from '@/lib/session';
import { canViewOrderRequests } from '@/lib/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ROME_TIMEZONE = 'Europe/Rome';

const formatDate = (value?: Date | string | null) => {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('zh-CN', { timeZone: ROME_TIMEZONE });
};

const toExcelFileName = (prefix: string, date: Date) => {
  const pad = (value: number) => value.toString().padStart(2, '0');
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  const seconds = pad(date.getSeconds());
  return `${prefix}_${year}${month}${day}_${hours}${minutes}${seconds}.xlsx`;
};

export async function GET(request: NextRequest) {
  const session = await getServerSession();
  if (!session?.discordId || !canViewOrderRequests(session.discordId)) {
    return NextResponse.json({ error: '无权访问' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const orderId = searchParams.get('orderId')?.trim() ?? '';
  const ownerId = searchParams.get('ownerId')?.trim() ?? '';
  const workerId = searchParams.get('workerId')?.trim() ?? '';

  const where: Prisma.OrderRequestLogWhereInput = {};
  if (orderId) where.orderId = orderId;
  if (ownerId) where.ownerId = ownerId;
  if (workerId) where.clicks = { some: { workerId } };

  const rows = await prisma.orderRequestLog.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      owner: { select: { discordUserId: true, serverDisplayName: true } },
      clicks: {
        orderBy: { clickedAt: 'asc' },
        include: { worker: { select: { discordUserId: true, serverDisplayName: true } } },
      },
    },
  });

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'jinlee admin';
  workbook.created = new Date();
  const worksheet = workbook.addWorksheet('抢单记录');
  worksheet.columns = [
    { header: '时间(罗马)', key: 'time', width: 22 },
    { header: '订单ID', key: 'orderId', width: 30 },
    { header: '老板昵称', key: 'ownerName', width: 20 },
    { header: '老板ID', key: 'ownerId', width: 24 },
    { header: '派单内容', key: 'content', width: 60 },
    { header: '抢单人数', key: 'clickCount', width: 12 },
    { header: '抢单陪玩', key: 'clickers', width: 80 },
  ];
  worksheet.getRow(1).font = { bold: true };
  worksheet.views = [{ state: 'frozen', ySplit: 1 }];

  for (const row of rows) {
    const ownerName =
      row.ownerDisplayName ?? row.owner?.serverDisplayName ?? row.owner?.discordUserId ?? row.ownerId;
    const clickers = row.clicks
      .map((click) => {
        const workerName =
          click.workerDisplayName ?? click.worker?.serverDisplayName ?? click.worker?.discordUserId ?? click.workerId;
        return `${workerName}(${click.workerId})`;
      })
      .join('；');
    worksheet.addRow({
      time: formatDate(row.createdAt),
      orderId: row.orderId,
      ownerName,
      ownerId: row.ownerId,
      content: row.content,
      clickCount: row.clicks.length,
      clickers,
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const fileName = toExcelFileName('order_requests', new Date());

  return new NextResponse(Buffer.from(buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Cache-Control': 'no-store',
    },
  });
}
