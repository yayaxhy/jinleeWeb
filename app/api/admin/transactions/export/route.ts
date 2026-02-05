import { NextRequest, NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getServerSession } from '@/lib/session';
import { isAdminDiscordId } from '@/lib/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ROME_TIMEZONE = 'Europe/Rome';

const stringify = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'bigint') return value.toString();
  if (typeof value === 'object' && value !== null && 'toString' in value) {
    const fn = (value as { toString?: () => string }).toString;
    if (typeof fn === 'function') return fn.call(value);
  }
  return String(value);
};

const parseNumber = (value: unknown): number | null => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return Number.isNaN(value) ? null : value;
  if (typeof value === 'bigint') return Number(value);
  const numeric = Number(stringify(value));
  return Number.isNaN(numeric) ? null : numeric;
};

const formatDate = (value?: Date | string | null) => {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('zh-CN', { timeZone: ROME_TIMEZONE });
};

const resolveAmountChange = (amountChange: unknown, balanceBefore: unknown, balanceAfter: unknown): number | null => {
  const amount = parseNumber(amountChange);
  const before = parseNumber(balanceBefore);
  const after = parseNumber(balanceAfter);

  if (before !== null && after !== null) {
    const derived = after - before;
    if (amount === null) return derived;
    if (Math.sign(derived) !== Math.sign(amount) || Math.abs(derived - amount) > 0.0001) {
      return derived;
    }
    return amount;
  }

  return amount;
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
  if (!session?.discordId || !isAdminDiscordId(session.discordId)) {
    return NextResponse.json({ error: '无权访问' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const discordId = searchParams.get('discordId')?.trim() ?? '';
  const startParam = searchParams.get('startDate');
  const endParam = searchParams.get('endDate');
  const parsedStart = startParam ? new Date(startParam) : null;
  const parsedEnd = endParam ? new Date(endParam) : null;
  const startDate = parsedStart && !Number.isNaN(parsedStart.getTime()) ? parsedStart : null;
  const endDate = parsedEnd && !Number.isNaN(parsedEnd.getTime()) ? parsedEnd : null;

  const whereClause: Prisma.IndividualTransactionWhereInput = {};
  if (discordId) {
    whereClause.discordId = discordId;
  }
  if (startDate || endDate) {
    whereClause.timeCreatedAt = {
      gte: startDate ?? undefined,
      lte: endDate ?? undefined,
    };
  }
  const hasFilters = Object.keys(whereClause).length > 0;

  const transactions = await prisma.individualTransaction.findMany({
    where: hasFilters ? whereClause : undefined,
    orderBy: { timeCreatedAt: 'desc' },
  });

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'jinlee admin';
  workbook.created = new Date();
  const worksheet = workbook.addWorksheet('查询流水');
  worksheet.columns = [
    { header: '时间(罗马)', key: 'time', width: 22 },
    { header: 'Discord ID', key: 'discordId', width: 22 },
    { header: '类型', key: 'type', width: 16 },
    { header: '变动前余额', key: 'before', width: 16 },
    { header: '金额变动', key: 'change', width: 14 },
    { header: '变动后余额', key: 'after', width: 16 },
    { header: '备注', key: 'note', width: 24 },
  ];
  worksheet.getRow(1).font = { bold: true };
  worksheet.views = [{ state: 'frozen', ySplit: 1 }];

  for (const tx of transactions) {
    worksheet.addRow({
      time: formatDate(tx.timeCreatedAt),
      discordId: tx.discordId,
      type: tx.typeOfTransaction,
      before: parseNumber(tx.balanceBefore),
      change: resolveAmountChange(tx.amountChange, tx.balanceBefore, tx.balanceAfter),
      after: parseNumber(tx.balanceAfter),
      note: tx.thirdPartydiscordId ?? '',
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const fileName = toExcelFileName('transactions', new Date());

  return new NextResponse(Buffer.from(buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Cache-Control': 'no-store',
    },
  });
}
