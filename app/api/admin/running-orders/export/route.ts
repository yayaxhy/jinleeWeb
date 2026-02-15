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
  const hostId = searchParams.get('hostId')?.trim() ?? '';
  const workerId = searchParams.get('workerId')?.trim() ?? '';
  const peiwanIdRaw = searchParams.get('peiwanId')?.trim() ?? '';

  const whereClause: Prisma.OrderWhereInput = { status: 'RUNNING' };
  if (orderId) {
    const numeric = Number(orderId);
    if (Number.isInteger(numeric) && numeric > 0) {
      whereClause.OR = [{ displayNo: numeric }, { id: orderId }];
    } else {
      whereClause.id = orderId;
    }
  }
  if (hostId) whereClause.hostId = hostId;
  if (workerId) whereClause.workerId = workerId;
  if (peiwanIdRaw) {
    const numericPeiwan = Number(peiwanIdRaw);
    if (Number.isInteger(numericPeiwan) && numericPeiwan > 0) {
      whereClause.peiwanId = numericPeiwan;
    }
  }

  const rows = await prisma.order.findMany({
    where: whereClause,
    orderBy: [{ acceptedAt: 'desc' }, { createdAt: 'desc' }],
    select: {
      id: true,
      displayNo: true,
      hostId: true,
      workerId: true,
      peiwanId: true,
      unitPrice: true,
      chargedMinutes: true,
      chargedGross: true,
      createdAt: true,
      acceptedAt: true,
      stopwatchStartAt: true,
      cutoffAt: true,
      host: { select: { discordUserId: true, serverDisplayName: true } },
      worker: { select: { discordUserId: true, serverDisplayName: true } },
    },
  });

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'jinlee admin';
  workbook.created = new Date();
  const worksheet = workbook.addWorksheet('正在进行的订单');
  worksheet.columns = [
    { header: '接单时间(罗马)', key: 'acceptedAt', width: 22 },
    { header: '订单编号', key: 'displayNo', width: 12 },
    { header: '订单ID', key: 'id', width: 30 },
    { header: '老板昵称', key: 'hostName', width: 18 },
    { header: '老板ID', key: 'hostId', width: 24 },
    { header: '陪玩昵称', key: 'workerName', width: 18 },
    { header: '陪玩ID', key: 'workerId', width: 24 },
    { header: '陪玩编号', key: 'peiwanId', width: 12 },
    { header: '单价', key: 'unitPrice', width: 12 },
    { header: '已计费分钟', key: 'chargedMinutes', width: 12 },
    { header: '已计费金额', key: 'chargedGross', width: 14 },
    { header: '计费开始(罗马)', key: 'stopwatchStartAt', width: 22 },
    { header: '自动截止(罗马)', key: 'cutoffAt', width: 22 },
  ];
  worksheet.getRow(1).font = { bold: true };
  worksheet.views = [{ state: 'frozen', ySplit: 1 }];

  for (const row of rows) {
    const hostName = row.host?.serverDisplayName ?? row.host?.discordUserId ?? row.hostId;
    const workerName = row.worker?.serverDisplayName ?? row.worker?.discordUserId ?? row.workerId;
    worksheet.addRow({
      acceptedAt: formatDate(row.acceptedAt ?? row.createdAt),
      displayNo: row.displayNo,
      id: row.id,
      hostName,
      hostId: row.hostId,
      workerName,
      workerId: row.workerId,
      peiwanId: row.peiwanId,
      unitPrice: parseNumber(row.unitPrice),
      chargedMinutes: parseNumber(row.chargedMinutes),
      chargedGross: parseNumber(row.chargedGross),
      stopwatchStartAt: formatDate(row.stopwatchStartAt),
      cutoffAt: formatDate(row.cutoffAt),
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const fileName = toExcelFileName('running_orders', new Date());

  return new NextResponse(Buffer.from(buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Cache-Control': 'no-store',
    },
  });
}
