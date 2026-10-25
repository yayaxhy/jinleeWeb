import { Prisma } from '@prisma/client';

type Quota = { remainingExtra: Prisma.Decimal | string | number; expiresAt: Date };
export type ManualQuotaPeriod = { amount: string; expiresAt: string; restored: boolean };

/** Available quota is a sum, but its separate expiry dates are never collapsed. */
export function summarizeManualQuota(base: Quota | null | undefined, restored: readonly Quota[], now = new Date(), ordinary: readonly Quota[] = []) {
  const periods: ManualQuotaPeriod[] = [];
  for (const [rows, isRestored] of [[base ? [base] : [], false], [ordinary, false], [restored, true]] as const) {
    for (const row of rows) {
      const amount = new Prisma.Decimal(row.remainingExtra);
      if (row.expiresAt > now && amount.gt(0)) {
        periods.push({ amount: amount.toString(), expiresAt: row.expiresAt.toISOString(), restored: isRestored });
      }
    }
  }
  periods.sort((a, b) => a.expiresAt.localeCompare(b.expiresAt) || Number(a.restored) - Number(b.restored));
  return {
    remaining: periods.reduce((sum, row) => sum.add(row.amount), new Prisma.Decimal(0)).toString(),
    nextExpiresAt: periods[0]?.expiresAt ?? null,
    periods,
  };
}
