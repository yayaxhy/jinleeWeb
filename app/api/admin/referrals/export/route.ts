import { ReferralType } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { canViewReferrals } from '@/lib/admin';
import { prisma } from '@/lib/prisma';
import { getServerSession } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ROME_TIMEZONE = 'Europe/Rome';

const normalizeId = (value?: string | null) => value?.trim() ?? '';
const DISCORD_ID_PATTERN = /^\d+$/;

const validateDiscordId = (value: string) => DISCORD_ID_PATTERN.test(value);

const parseReferralType = (value?: string | null): ReferralType | null => {
  if (!value) return null;
  const upper = value.trim().toUpperCase();
  return Object.values(ReferralType).includes(upper as ReferralType) ? (upper as ReferralType) : null;
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
  if (!session?.discordId || !canViewReferrals(session.discordId)) {
    return NextResponse.json({ error: '无权访问' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const inviteeId = normalizeId(searchParams.get('inviteeId'));
  const inviterId = normalizeId(searchParams.get('inviterId'));
  const type = parseReferralType(searchParams.get('type'));
  if ((inviteeId && !validateDiscordId(inviteeId)) || (inviterId && !validateDiscordId(inviterId))) {
    return NextResponse.json(
      { error: 'Referral 导出仅支持纯数字 Discord ID 过滤。' },
      { status: 400 },
    );
  }

  const where = {
    ...(inviteeId ? { inviteeId } : {}),
    ...(inviterId ? { inviterId } : {}),
    ...(type ? { type } : {}),
  };

  const referrals = await prisma.referral.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      invitee: { select: { serverDisplayName: true } },
      inviter: { select: { serverDisplayName: true } },
    },
  });

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'jinlee admin';
  workbook.created = new Date();
  const worksheet = workbook.addWorksheet('邀请关系');
  worksheet.columns = [
    { header: '被邀请人昵称', key: 'inviteeName', width: 18 },
    { header: '被邀请人Discord ID', key: 'inviteeId', width: 24 },
    { header: '邀请人昵称', key: 'inviterName', width: 18 },
    { header: '邀请人Discord ID', key: 'inviterId', width: 24 },
    { header: '类型', key: 'type', width: 12 },
    { header: '创建时间(罗马)', key: 'createdAt', width: 22 },
  ];
  worksheet.getRow(1).font = { bold: true };
  worksheet.views = [{ state: 'frozen', ySplit: 1 }];

  for (const row of referrals) {
    worksheet.addRow({
      inviteeName: row.invitee?.serverDisplayName ?? '未知用户',
      inviteeId: row.inviteeId,
      inviterName: row.inviter?.serverDisplayName ?? '未知用户',
      inviterId: row.inviterId,
      type: row.type,
      createdAt: formatDate(row.createdAt),
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const fileName = toExcelFileName('referrals', new Date());

  return new NextResponse(Buffer.from(buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Cache-Control': 'no-store',
    },
  });
}
