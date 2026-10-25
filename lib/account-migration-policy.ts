import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { QUOTATION_CODE_TO_FIELD } from '@/constants/peiwan';
import type { MigrationRow } from './account-migration-records';
export const migrationDecimal = (value: unknown) => {
  const decimal = new Prisma.Decimal(value == null ? 0 : String(value));
  if (!decimal.isFinite()) throw new Error('migration_invalid_decimal');
  return decimal;
};
export const migrationSum = (a: unknown, b: unknown) => migrationDecimal(a).add(migrationDecimal(b));
export const nonemptyMigrationValue = (value: unknown) => value !== null && value !== undefined && (typeof value !== 'string' || value.trim() !== '');
export const preferMigrationTarget = (source: unknown, target: unknown) => nonemptyMigrationValue(target) ? target : source;
export function latestMigrationExpiry(now: Date, ...values: unknown[]): Date | null {
  const dates = values.filter(value => value instanceof Date && value > now) as Date[];
  return dates.length ? new Date(Math.max(...dates.map(value => value.getTime()))) : null;
}
export function migrationCanonical(value: unknown): string {
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (value instanceof Prisma.Decimal) return JSON.stringify(value.toString());
  if (Array.isArray(value)) return `[${value.map(migrationCanonical).sort().join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, entry]) => `${JSON.stringify(key)}:${migrationCanonical(entry)}`).join(',')}}`;
  return JSON.stringify(value) ?? 'null';
}
export const migrationHash = (value: unknown) => createHash('sha256').update(migrationCanonical(value)).digest('hex');

export function mergeMigrationPeiwan(source: MigrationRow | null, target: MigrationRow | null, member: MigrationRow, balance: unknown): MigrationRow | null {
  if (!source && !target) return null;
  const original = source ?? target!;
  const preferred = target ?? source!;
  const result = { ...preferred, PEIWANID: original.PEIWANID,
    discordUserId: member.discordUserId, serverDisplayName: member.serverDisplayName,
    totalEarn: migrationSum(source?.totalEarn, target?.totalEarn), balance: migrationDecimal(balance),
    MP_url: preferMigrationTarget(source?.MP_url, target?.MP_url) ?? null,
    voicePreviewUrl: nonemptyMigrationValue(target?.voicePreviewUrl) ? target!.voicePreviewUrl : source?.voicePreviewUrl ?? null,
    voicePreviewFilename: nonemptyMigrationValue(target?.voicePreviewUrl) ? target!.voicePreviewFilename ?? null : source?.voicePreviewFilename ?? null,
    baseCommissionRate: migrationDecimal(member.baseCommissionRate ?? '0.75'),
    commissionRate: migrationDecimal(member.commissionRate ?? member.baseCommissionRate ?? '0.75'),
  } as MigrationRow;
  const levels = ['优选陪玩', '明星陪玩', '殿堂陪玩'];
  result.level = levels[Math.max(0, levels.indexOf(String(source?.level)), levels.indexOf(String(target?.level)))];
  const fields = Object.values(QUOTATION_CODE_TO_FIELD);
  for (const field of fields) {
    const price = preferMigrationTarget(source?.[field], target?.[field]);
    if (price != null && migrationDecimal(price).lte(0)) throw new Error(`报价 ${field} 不是有效正数，请修正后重新预览`);
    result[field] = price ?? null;
  }
  const codeField = (value: unknown) => QUOTATION_CODE_TO_FIELD[value as keyof typeof QUOTATION_CODE_TO_FIELD];
  const candidates = [preferred.defaultQuotationCode, original.defaultQuotationCode];
  const defaultCode = candidates.find(code => codeField(code) && result[codeField(code)] != null && migrationDecimal(result[codeField(code)]).gt(0));
  if (!defaultCode) throw new Error('陪玩缺少有效默认报价，请修正后重新预览');
  result.defaultQuotationCode = defaultCode;
  // No ongoing business is handed over. Availability stays as the chosen profile.
  return result;
}

/** Monetary balances change normally between preview and execution. Only config,
 * identity and rights affect the reviewed merge plan. */
export function migrationPlanFingerprint(rows: Record<string, MigrationRow[]>, roles: unknown) {
  const names = ['DlmUser', 'Member', 'PEIWAN', 'AccountBinding', 'DetachedDiscordAccount', 'VipBenefitProfile',
    'PeiwanGameProfile', 'PeiwanDeletion', 'CommissionBuff', 'AutoCommissionBuff', 'FlowBuff', 'SpendBuff',
    'ManualQuotaBatch', 'ManualQuotaRestoration', 'WithdrawalAccount', 'Referral', 'ReferralPolicy', 'LotteryPity', 'FarmPlot'];
  const omit = new Set(['totalBalance', 'income', 'recharge', 'totalSpent', 'loyaltyPoints', 'points', 'totalEarn', 'balance',
    'updatedAt', 'lastLoginAt', 'lastUsedAt', 'lastReminderSentAt']);
  const reduced = Object.fromEntries(names.map(name => [name, (rows[name] ?? []).filter(row => !(['FlowBuff', 'SpendBuff'].includes(name) && migrationDecimal(row.remainingExtra).isZero() && row.expiresAt instanceof Date && row.expiresAt.getTime() === 0)).map(row => Object.fromEntries(Object.entries(row).filter(([key]) => !omit.has(key))))]));
  return migrationHash({ version: 1, rows: reduced, roles });
}
