import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { canViewRevenue } from '@/lib/admin';
import { generateStoredMonthlyFinancialReports, getMonthlyReportStorageDir, readConfirmedMonthlyReport, withMonthlyReportLocks } from '@/lib/admin/monthly-financial-reports';
import {
  PRIOR_PERIOD_ADJUSTMENT_PREFIX,
  appendManualExpenseRevision,
  currentOpenFinancialMonthKey,
  priorPeriodAdjustmentNote,
} from '@/lib/admin/monthly-expense-adjustment';
import { prisma } from '@/lib/prisma';
import { getServerSession } from '@/lib/session';
import { isNewEntityReportMonth } from '@/lib/operating-entity-cutover';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
const IMAGE_DIRECTORY = path.join(getMonthlyReportStorageDir(), 'manual-expense-images');
const IMAGE_EXTENSION_BY_TYPE: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

type RouteParams = { id: string };

const getText = (formData: FormData, name: string) => {
  const value = formData.get(name);
  return typeof value === 'string' ? value.trim() : '';
};

const parseAmount = (raw: string) => {
  if (!raw) return null;
  try {
    const amount = new Prisma.Decimal(raw);
    return amount.isFinite() && amount.greaterThan(0) ? amount : null;
  } catch {
    return null;
  }
};

const getImageFile = (formData: FormData) => {
  const value = formData.get('image');
  return value instanceof File && value.size > 0 ? value : null;
};

const saveImage = async (file: File) => {
  if (file.size > MAX_IMAGE_SIZE) throw new Error('图片不能超过 10MB');
  const extension = IMAGE_EXTENSION_BY_TYPE[file.type.toLowerCase()];
  if (!extension) throw new Error('仅支持 PNG、JPG、WebP 或 GIF 图片');
  await fs.mkdir(IMAGE_DIRECTORY, { recursive: true });
  const fileName = `manual-expense-${crypto.randomUUID()}${extension}`;
  await fs.writeFile(path.join(IMAGE_DIRECTORY, fileName), Buffer.from(await file.arrayBuffer()));
  return fileName;
};

const removeImage = async (fileName?: string | null) => {
  if (!fileName || path.basename(fileName) !== fileName) return;
  await fs.unlink(path.join(IMAGE_DIRECTORY, fileName)).catch(() => {});
};

const refreshStoredReports = async (monthKey: string) => {
  try {
    await generateStoredMonthlyFinancialReports({ monthKey, force: true });
    return true;
  } catch (error) {
    console.error('Failed to refresh monthly financial reports after manual expense update', error);
    return false;
  }
};

export async function PATCH(request: NextRequest, context: { params: Promise<RouteParams> }) {
  const session = await getServerSession();
  if (!session?.discordId || !canViewRevenue(session.discordId)) {
    return NextResponse.json({ error: '无权访问' }, { status: 403 });
  }
  const operatorId = session.discordId;

  const { id } = await context.params;
  const current = await prisma.monthlyManualExpense.findUnique({ where: { id } });
  if (!current) return NextResponse.json({ error: '支出记录不存在' }, { status: 404 });
  if (!isNewEntityReportMonth(current.monthKey)) {
    return NextResponse.json({ error: '旧主体月份不能修改支出' }, { status: 400 });
  }
  if (current.note.startsWith(PRIOR_PERIOD_ADJUSTMENT_PREFIX)) {
    return NextResponse.json({ error: '自动生成的前期调整请到原月份修改原记录。' }, { status: 409 });
  }

  const formData = await request.formData();
  const note = getText(formData, 'note');
  const amount = parseAmount(getText(formData, 'amount'));
  const image = getImageFile(formData);
  if (!amount) return NextResponse.json({ error: '请输入大于 0 的金额' }, { status: 400 });
  if (!note) return NextResponse.json({ error: '请输入支出备注' }, { status: 400 });
  if (note.startsWith(PRIOR_PERIOD_ADJUSTMENT_PREFIX)) {
    return NextResponse.json({ error: '备注不能使用系统保留的“前期调整”前缀' }, { status: 400 });
  }

  let newImageFileName: string | null = null;
  let expenseCommitted = false;
  try {
    const confirmed = await readConfirmedMonthlyReport(current.monthKey);
    const bookedMonthKey = confirmed ? await currentOpenFinancialMonthKey() : current.monthKey;
    const expense = await withMonthlyReportLocks([current.monthKey, bookedMonthKey], async () => {
      if (Boolean(await readConfirmedMonthlyReport(current.monthKey)) !== Boolean(confirmed) ||
          (confirmed && await currentOpenFinancialMonthKey() !== bookedMonthKey)) {
        throw new Error('月份确认状态已变化，请刷新后重试。');
      }
      if (image) newImageFileName = await saveImage(image);
      const revisionId = crypto.randomUUID();
      if (confirmed) {
        await appendManualExpenseRevision(current.monthKey, {
          revisionId,
          phase: 'prepared',
          originalId: id,
          operatorId,
          recordedAt: new Date().toISOString(),
          before: {
            amount: current.amount.toString(), note: current.note, imageFileName: current.imageFileName,
            operatorId: current.operatorId, updatedAt: current.updatedAt.toISOString(),
          },
          after: {
            amount: amount.toString(), note, imageFileName: newImageFileName ?? current.imageFileName,
            operatorId,
          },
          bookedMonthKey,
        });
      }
      const delta = amount.sub(current.amount);
      const updatedExpense = await prisma.$transaction(async (tx) => {
        const updatedCount = await tx.monthlyManualExpense.updateMany({
          where: { id, updatedAt: current.updatedAt },
          data: {
            amount,
            note,
            operatorId,
            ...(newImageFileName ? { imageFileName: newImageFileName } : {}),
          },
        });
        if (updatedCount.count !== 1) throw new Error('记录已被其他人修改，请刷新后重试。');
        if (confirmed && !delta.isZero()) {
          await tx.monthlyManualExpense.create({
            data: {
              monthKey: bookedMonthKey,
              amount: delta,
              note: priorPeriodAdjustmentNote(current.monthKey, note, id),
              operatorId,
            },
          });
        }
        return tx.monthlyManualExpense.findUniqueOrThrow({ where: { id } });
      });
      expenseCommitted = true;
      if (confirmed) {
        try {
          await appendManualExpenseRevision(current.monthKey, {
            revisionId,
            phase: 'committed',
            originalId: id,
            operatorId,
            recordedAt: new Date().toISOString(),
            delta: delta.toString(),
            bookedMonthKey,
            updatedAt: updatedExpense.updatedAt.toISOString(),
          });
        } catch (auditError) {
          console.error('Failed to append confirmed-month expense revision audit', auditError);
        }
      } else if (newImageFileName) {
        await removeImage(current.imageFileName);
      }
      return updatedExpense;
    });
    const reportSynced = await refreshStoredReports(bookedMonthKey);
    return NextResponse.json({ ok: true, expense: { id: expense.id }, bookedMonthKey, reportSynced });
  } catch (error) {
    if (!expenseCommitted) await removeImage(newImageFileName);
    const message = error instanceof Error ? error.message : '更新人工支出失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
