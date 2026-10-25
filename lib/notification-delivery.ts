import { randomUUID } from 'node:crypto';
import type { GuildNotificationChannel, Prisma, PrismaClient } from '@prisma/client';

export const MAX_DELIVERY_ATTEMPTS = 3;
export const DELIVERY_RETRY_DELAY_MS = 5 * 60 * 1000;
export const DELIVERY_MAX_AGE_MS = 24 * 60 * 60 * 1000;
export const DELIVERY_HOLD_PREFIX = 'delivery_hold:';

type DeliveryDescription = {
  channel: string; status: string; error: string | null; attempts: number;
  updatedAt: Date; notificationCreatedAt: Date;
};

export function describeDelivery(row: DeliveryDescription, now = Date.now()) {
  const held = row.error?.startsWith(DELIVERY_HOLD_PREFIX) ?? false;
  const disabled = row.channel !== 'DISCORD';
  const createdAt = row.notificationCreatedAt.getTime();
  const timeValid = Number.isFinite(createdAt) && createdAt <= now;
  const expired = createdAt <= now - DELIVERY_MAX_AGE_MS;
  const exhausted = row.attempts >= MAX_DELIVERY_ATTEMPTS;
  const canRetry = timeValid && !disabled && !expired && !exhausted && ['PENDING', 'FAILED'].includes(row.status)
    && (row.attempts === 0 || row.updatedAt.getTime() <= now - DELIVERY_RETRY_DELAY_MS);
  return {
    status: held ? 'UNCERTAIN' : row.status,
    error: disabled ? '此渠道已停用，仅保留历史记录' : held
      ? `发送结果未确认；${expired ? '已超过 24 小时，停止补发' : exhausted ? '已达 3 次上限，停止补发' : '满 5 分钟后有限补发，可能重复提醒'}`
      : expired && ['PENDING', 'FAILED'].includes(row.status) ? '已超过 24 小时，停止补发' : row.error,
    canRetry,
  };
}

/** Includes stale/unknown claims, never a recent in-flight claim or a sent row. */
export const retryableDeliveryWhere = (now = Date.now()): Prisma.GuildNotificationDeliveryWhereInput => ({
  channel: 'DISCORD',
  status: { in: ['PENDING', 'FAILED'] },
  attempts: { lt: MAX_DELIVERY_ATTEMPTS },
  notification: { createdAt: { gt: new Date(now - DELIVERY_MAX_AGE_MS), lte: new Date(now) } },
  OR: [{ attempts: 0 }, { updatedAt: { lte: new Date(now - DELIVERY_RETRY_DELAY_MS) } }],
});

export type DeliveryOutcome = { status: 'SENT' | 'FAILED' | 'SKIPPED'; error?: string };
type DeliveryStore = Pick<PrismaClient, 'guildNotificationDelivery'>;

/**
 * The token identifies one attempt, and updatedAt provides a five-minute lease.
 * A lost response keeps its token until the bounded retry becomes eligible.
 * Retrying messages cannot promise exactly-once delivery across a network.
 */
export async function runClaimedDelivery(
  db: DeliveryStore,
  notificationId: string,
  channel: GuildNotificationChannel,
  send: (claimToken: string) => Promise<DeliveryOutcome>,
  now: () => number = Date.now,
): Promise<'not_claimed' | 'completed' | 'uncertain'> {
  if (channel !== 'DISCORD') return 'not_claimed';
  const claim = `${DELIVERY_HOLD_PREFIX}in_flight_or_uncertain:${randomUUID()}`;
  const acquired = await db.guildNotificationDelivery.updateMany({
    where: { notificationId, ...retryableDeliveryWhere(now()) },
    data: { status: 'PENDING', attempts: { increment: 1 }, error: claim, updatedAt: new Date(now()) },
  });
  if (acquired.count !== 1) return 'not_claimed';
  try {
    const outcome = await send(claim);
    const completed = await db.guildNotificationDelivery.updateMany({
      where: { notificationId, channel, status: 'PENDING', error: claim },
      data: {
        status: outcome.status,
        error: outcome.error?.slice(0, 1000) ?? null,
        sentAt: outcome.status === 'SENT' ? new Date(now()) : null,
        updatedAt: new Date(now()),
      },
    });
    return completed.count === 1 ? 'completed' : 'uncertain';
  } catch {
    // A provider or receipt write may already have succeeded. Keep the attempt
    // token; the next bounded attempt may claim it after the five-minute lease.
    return 'uncertain';
  }
}
