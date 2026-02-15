import { NextRequest, NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getServerSession } from '@/lib/session';
import { canViewTransactions } from '@/lib/admin';

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
  if (!session?.discordId || !canViewTransactions(session.discordId)) {
    return NextResponse.json({ error: '无权访问' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const operatorId = searchParams.get('operatorId')?.trim() ?? '';
  const targetId = searchParams.get('targetId')?.trim() ?? '';
  const reasonKeyword = searchParams.get('reason')?.trim() ?? '';
  const startParam = searchParams.get('startDate');
  const endParam = searchParams.get('endDate');
  const parsedStart = startParam ? new Date(startParam) : null;
  const parsedEnd = endParam ? new Date(endParam) : null;
  const startDate = parsedStart && !Number.isNaN(parsedStart.getTime()) ? parsedStart : null;
  const endDate = parsedEnd && !Number.isNaN(parsedEnd.getTime()) ? parsedEnd : null;

  const whereClause: Prisma.ExpenseWhereInput = {};
  if (operatorId) whereClause.operatorId = operatorId;
  if (targetId) whereClause.targetId = targetId;
  if (reasonKeyword) {
    whereClause.reason = { contains: reasonKeyword, mode: 'insensitive' };
  }
  if (startDate || endDate) {
    whereClause.createdAt = {
      gte: startDate ?? undefined,
      lte: endDate ?? undefined,
    };
  }
  const hasFilters = Object.keys(whereClause).length > 0;

  const expenses = await prisma.expense.findMany({
    where: hasFilters ? whereClause : undefined,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      operatorId: true,
      targetId: true,
      amount: true,
      reason: true,
      createdAt: true,
    },
  });

  const relatedDiscordIds = Array.from(
    new Set(
      expenses
        .flatMap((row) => [row.operatorId, row.targetId ?? ''])
        .map((id) => id.trim())
        .filter((id) => /^\d+$/.test(id))
    )
  );
  const members = relatedDiscordIds.length
    ? await prisma.member.findMany({
        where: { discordUserId: { in: relatedDiscordIds } },
        select: { discordUserId: true, serverDisplayName: true },
      })
    : [];
  const displayNameMap = new Map(
    members.map((row) => [row.discordUserId, row.serverDisplayName?.trim() ?? ''])
  );
  const resolveDisplayName = (discordUserId?: string | null) => {
    if (!discordUserId) return '';
    const mapped = displayNameMap.get(discordUserId)?.trim();
    if (mapped) return mapped;
    return '未知用户';
  };

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'jinlee admin';
  workbook.created = new Date();
  const worksheet = workbook.addWorksheet('Expense');
  worksheet.columns = [
    { header: '时间(罗马)', key: 'time', width: 22 },
    { header: '操作人昵称', key: 'operatorName', width: 18 },
    { header: '操作人Discord ID', key: 'operatorId', width: 22 },
    { header: '目标昵称', key: 'targetName', width: 18 },
    { header: '目标Discord ID', key: 'targetId', width: 22 },
    { header: '金额', key: 'amount', width: 14 },
    { header: '原因', key: 'reason', width: 32 },
  ];
  worksheet.getRow(1).font = { bold: true };
  worksheet.views = [{ state: 'frozen', ySplit: 1 }];

  for (const row of expenses) {
    worksheet.addRow({
      time: formatDate(row.createdAt),
      operatorName: resolveDisplayName(row.operatorId),
      operatorId: row.operatorId,
      targetName: resolveDisplayName(row.targetId),
      targetId: row.targetId ?? '',
      amount: parseNumber(row.amount),
      reason: row.reason,
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const fileName = toExcelFileName('expenses', new Date());

  return new NextResponse(Buffer.from(buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Cache-Control': 'no-store',
    },
  });
}
