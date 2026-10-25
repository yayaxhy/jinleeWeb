import type { GuildNotificationChannel, Prisma, PrismaClient } from '@prisma/client';

/** Prisma predicate subset used by the production notification policy. No DB. */
export function matches(value: unknown, condition: unknown): boolean {
  if (condition === null || typeof condition !== 'object') return value === condition;
  if (condition instanceof Date) return value instanceof Date && value.getTime() === condition.getTime();
  const rule = condition as Record<string, unknown>;
  return Object.entries(rule).every(([key, expected]) => {
    if (key === 'in') return (expected as unknown[]).includes(value);
    if (key === 'lt') return Number(value) < Number(expected);
    if (key === 'lte') return Number(value) <= Number(expected);
    if (key === 'gt') return Number(value) > Number(expected);
    if (key === 'gte') return Number(value) >= Number(expected);
    if (key === 'startsWith') return typeof value === 'string' && value.startsWith(String(expected));
    if (key === 'OR') return (expected as unknown[]).some(part => matches(value, part));
    if (key === 'AND') return (expected as unknown[]).every(part => matches(value, part));
    if (key === 'NOT') return !matches(value, expected);
    if (key === 'some') return Array.isArray(value) && value.some(part => matches(part, expected));
    return value !== null && typeof value === 'object' && matches((value as Record<string, unknown>)[key], expected);
  });
}

export type TestDelivery = {
  id: string; notificationId: string; channel: GuildNotificationChannel; status: string;
  attempts: number; error: string | null; sentAt: Date | null; updatedAt: Date;
  notification: { createdAt: Date };
};
export const TEST_NOW = Date.parse('2026-10-24T12:00:00Z');
export function deliveryRow(patch: Partial<TestDelivery> = {}): TestDelivery {
  return { id: 'delivery', notificationId: 'notice', channel: 'DISCORD', status: 'PENDING', attempts: 0, error: null, sentAt: null,
    updatedAt: new Date(TEST_NOW), notification: { createdAt: new Date(TEST_NOW) }, ...patch };
}
export function deliveryStore(rows: TestDelivery[]) {
  let failReceipt = false;
  return {
    failReceipt: (value = true) => { failReceipt = value; },
    db: { guildNotificationDelivery: {
      updateMany: async ({ where, data }: Prisma.GuildNotificationDeliveryUpdateManyArgs) => {
        if (failReceipt && data.status !== 'PENDING') throw new Error('receipt unavailable');
        const selected = rows.filter(entry => matches(entry, where));
        for (const entry of selected) {
          if (typeof data.status === 'string') entry.status = data.status;
          if (data.error === null || typeof data.error === 'string') entry.error = data.error;
          if (data.sentAt === null || data.sentAt instanceof Date) entry.sentAt = data.sentAt;
          if (data.updatedAt instanceof Date) entry.updatedAt = data.updatedAt;
          if (data.attempts && typeof data.attempts === 'object') entry.attempts += Number(data.attempts.increment ?? 0);
        }
        return { count: selected.length };
      },
    } } as unknown as Pick<PrismaClient, 'guildNotificationDelivery'>,
  };
}
