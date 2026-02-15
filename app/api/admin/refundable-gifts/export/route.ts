import { NextRequest, NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getServerSession } from '@/lib/session';
import { canViewRefundableGifts } from '@/lib/admin';

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
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
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
  if (!session?.discordId || !canViewRefundableGifts(session.discordId)) {
    return NextResponse.json({ error: '无权访问' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const giverId = searchParams.get('giverId')?.trim() ?? '';
  const receiverId = searchParams.get('receiverId')?.trim() ?? '';

  const where: Prisma.GiftAuditWhereInput = {};
  if (giverId) where.giverId = giverId;
  if (receiverId) where.receiverId = receiverId;

  const records = await prisma.giftAudit.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  });

  const relatedDiscordIds = Array.from(
    new Set(
      records
        .flatMap((record) => [record.giverId, record.receiverId])
        .map((id) => id.trim())
        .filter((id) => /^\d+$/.test(id))
    )
  );
  const relatedMembers = relatedDiscordIds.length
    ? await prisma.member.findMany({
        where: { discordUserId: { in: relatedDiscordIds } },
        select: { discordUserId: true, serverDisplayName: true },
      })
    : [];
  const displayNameMap = new Map(
    relatedMembers.map((row) => [row.discordUserId, row.serverDisplayName?.trim() ?? ''])
  );
  const resolveDisplayName = (discordUserId: string) => displayNameMap.get(discordUserId) || '未知用户';

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'jinlee admin';
  workbook.created = new Date();
  const worksheet = workbook.addWorksheet('可退回打赏');
  worksheet.columns = [
    { header: 'Individual', key: 'individualId', width: 24 },
    { header: '时间(罗马)', key: 'time', width: 22 },
    { header: '赠送人昵称', key: 'giverName', width: 18 },
    { header: '赠送人ID', key: 'giverId', width: 22 },
    { header: '收礼人昵称', key: 'receiverName', width: 18 },
    { header: '收礼人ID', key: 'receiverId', width: 22 },
    { header: '订单ID', key: 'orderId', width: 12 },
    { header: '礼物', key: 'giftName', width: 16 },
    { header: '数量', key: 'quantity', width: 10 },
    { header: '单价', key: 'unitPrice', width: 10 },
    { header: '总额', key: 'gross', width: 12 },
    { header: '应付', key: 'payable', width: 12 },
    { header: '抽成', key: 'feeAmount', width: 12 },
    { header: '陪玩到手', key: 'netAmount', width: 12 },
    { header: '分成比例', key: 'receiverRate', width: 12 },
    { header: '心动值', key: 'heartGain', width: 10 },
    { header: '券ID', key: 'voucherIds', width: 40 },
  ];
  worksheet.getRow(1).font = { bold: true };
  worksheet.views = [{ state: 'frozen', ySplit: 1 }];

  for (const record of records) {
    worksheet.addRow({
      individualId: record.individualTransactionId,
      time: formatDate(record.createdAt),
      giverName: resolveDisplayName(record.giverId),
      giverId: record.giverId,
      receiverName: resolveDisplayName(record.receiverId),
      receiverId: record.receiverId,
      orderId: record.orderId,
      giftName: record.giftName,
      quantity: parseNumber(record.quantity),
      unitPrice: parseNumber(record.unitPrice),
      gross: parseNumber(record.gross),
      payable: parseNumber(record.payable),
      feeAmount: parseNumber(record.feeAmount),
      netAmount: parseNumber(record.netAmount),
      receiverRate: parseNumber(record.receiverRate),
      heartGain: parseNumber(record.heartGain),
      voucherIds: stringify(record.voucherIds),
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const fileName = toExcelFileName('refundable_gifts', new Date());

  return new NextResponse(Buffer.from(buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Cache-Control': 'no-store',
    },
  });
}
