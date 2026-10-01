import fs from 'node:fs/promises';
import path from 'node:path';
import { getCentralEuropeanMonthParts, formatCentralEuropeanMonthKey } from '@/lib/centralEuropeanDateRange';
import { getMonthlyReportStorageDir, readConfirmedMonthlyReport } from '@/lib/admin/monthly-financial-reports';

export const PRIOR_PERIOD_ADJUSTMENT_PREFIX = '前期调整（';

export const currentOpenFinancialMonthKey = async () => {
  const now = getCentralEuropeanMonthParts(new Date());
  const monthKey = formatCentralEuropeanMonthKey(now.year, now.month);
  if (await readConfirmedMonthlyReport(monthKey)) {
    throw new Error('当前月份已确认，无法记录前期调整。');
  }
  return monthKey;
};

export const resolveManualExpenseBookingMonth = async (originalMonthKey: string) =>
  (await readConfirmedMonthlyReport(originalMonthKey))
    ? currentOpenFinancialMonthKey()
    : originalMonthKey;

export const priorPeriodAdjustmentNote = (originalMonthKey: string, note: string, originalId?: string) =>
  `${PRIOR_PERIOD_ADJUSTMENT_PREFIX}${originalMonthKey}${originalId ? `，原记录 ${originalId}` : ''}）：${note}`;

export const appendManualExpenseRevision = async (monthKey: string, entry: Record<string, unknown>) => {
  const directory = path.join(getMonthlyReportStorageDir(), monthKey);
  await fs.mkdir(directory, { recursive: true });
  await fs.appendFile(
    path.join(directory, 'manual-expense-revisions.jsonl'),
    `${JSON.stringify(entry)}\n`,
    { encoding: 'utf8', flag: 'a' },
  );
};
