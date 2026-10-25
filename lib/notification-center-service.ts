import { GuildNotificationChannel, GuildNotificationDeliveryStatus, GuildNotificationEvent, Prisma, type PrismaClient } from '@prisma/client';
import { DELIVERY_MAX_AGE_MS, retryableDeliveryWhere, runClaimedDelivery, type DeliveryOutcome } from './notification-delivery';
import { reportRetryFailure, runNotificationRetryBatch, summarizeDeliveryResults } from './notification-retry-batch';

// Matches Bot orderInteractionManager.INVITATION_EXPIRE_MS and its restart
// recovery rule (Order.createdAt + ten minutes). Order has no expiry column.
export const ORDER_INVITATION_EXPIRE_MS = 10 * 60 * 1000;
export type GuildNotificationInput = {
  dlmId: string; event: GuildNotificationEvent; title: string; body: string;
  href?: string | null; details?: Prisma.InputJsonValue; dedupeKey?: string | null;
  deliveredChannels?: GuildNotificationChannel[];
};
export type DiscordNotificationPayload = {
  notificationId: string; claimToken: string; recipientDlmId: string; discordUserId: string; title: string; body: string; href: string | null;
};
type NotificationStore = Pick<PrismaClient, 'guildNotification' | 'guildNotificationDelivery' | 'order'>;
const clean = (value: string | null | undefined, maximum: number) => String(value ?? '').trim().slice(0, maximum);

export function pendingOrderNotificationId(notification: { details: unknown; dedupeKey: string | null; dlmId: string }): string | null {
  const details = notification.details && typeof notification.details === 'object' && !Array.isArray(notification.details)
    ? notification.details as Record<string, unknown> : {};
  const explicit = typeof details.orderId === 'string' ? details.orderId.trim() : '';
  const suffix = `:${notification.dlmId}`;
  const legacy = notification.dedupeKey?.startsWith('order-created:') && notification.dedupeKey.endsWith(suffix)
    ? notification.dedupeKey.slice('order-created:'.length, -suffix.length) : '';
  if (explicit && legacy && explicit !== legacy) return null;
  const id = explicit || legacy;
  return id && id.length <= 128 && !/[\s:]/.test(id) ? id : null;
}

export function createGuildNotificationService(deps: {
  db: NotificationStore;
  sendDiscord: (payload: DiscordNotificationPayload) => Promise<DeliveryOutcome>;
  now?: () => number;
  siteOrigin?: () => string;
}) {
  const { db } = deps;
  const now = deps.now ?? Date.now;
  const safeHref = (value: string | null | undefined) => {
    const raw = clean(value, 512);
    if (!raw) return null;
    try {
      const origin = new URL(deps.siteOrigin?.() || 'https://dlmclub.com').origin;
      const target = new URL(raw, origin);
      return target.origin === origin ? `${target.pathname}${target.search}${target.hash}` : null;
    } catch { return null; }
  };

  async function deliverNotification(notificationId: string) {
    const notification = await db.guildNotification.findUnique({
      where: { id: notificationId }, include: { dlmUser: { select: { discordUserId: true } } },
    });
    if (!notification) return;
    return Promise.allSettled([
      runClaimedDelivery(db, notification.id, 'DISCORD', async claimToken => {
        const discordUserId = notification.dlmUser.discordUserId;
        if (!discordUserId) return { status: 'SKIPPED', error: 'discord_not_bound' };
        // Check immediately before each provider call, including the first.
        // Acceptance/cancellation notices report completed facts, so only the
        // pending invitation reminder uses this live-state gate.
        if (notification.event === 'ORDER_CREATED') {
          const orderId = pendingOrderNotificationId(notification);
          if (!orderId) return { status: 'SKIPPED', error: 'pending_order_reference_missing' };
          const order = await db.order.findUnique({
            where: { id: orderId },
            select: { status: true, createdAt: true, workerId: true, worker: { select: { dlmUser: { select: { dlmId: true } } } } },
          });
          if (!order || order.status !== 'PENDING') return { status: 'SKIPPED', error: 'order_no_longer_pending' };
          if (order.workerId !== discordUserId || order.worker.dlmUser?.dlmId !== notification.dlmId) return { status: 'SKIPPED', error: 'order_recipient_changed' };
          if (order.createdAt.getTime() + ORDER_INVITATION_EXPIRE_MS <= now()) return { status: 'SKIPPED', error: 'order_invitation_expired' };
        }
        if (notification.createdAt.getTime() + DELIVERY_MAX_AGE_MS <= now()) return { status: 'SKIPPED', error: 'notification_expired' };
        return deps.sendDiscord({ notificationId: notification.id, claimToken, recipientDlmId: notification.dlmId, discordUserId, title: notification.title, body: notification.body, href: notification.href });
      }, now),
    ]);
  }

  async function publishGuildNotification(input: GuildNotificationInput) {
    const title = clean(input.title, 160);
    const body = clean(input.body, 1000);
    if (!input.dlmId || !title || !body) throw new Error('invalid_notification_payload');
    const delivered = input.deliveredChannels?.includes('DISCORD') ?? false;
    const deliveries = { create: [{
      channel: GuildNotificationChannel.DISCORD,
      status: delivered ? GuildNotificationDeliveryStatus.SENT : GuildNotificationDeliveryStatus.PENDING,
      attempts: delivered ? 1 : 0, sentAt: delivered ? new Date(now()) : null,
    }] };
    const dedupeKey = clean(input.dedupeKey, 255) || null;
    const data = { dlmId: input.dlmId, event: input.event, title, body, href: safeHref(input.href), details: input.details } satisfies Prisma.GuildNotificationUncheckedCreateInput;
    const notification = dedupeKey
      ? await db.guildNotification.upsert({ where: { dedupeKey }, create: { ...data, dedupeKey, deliveries }, update: {}, include: { deliveries: true } })
      : await db.guildNotification.create({ data: { ...data, deliveries }, include: { deliveries: true } });
    // Only delivery is best-effort. The durable in-app event remains visible,
    // and no retry path re-executes the originating order or wallet operation.
    reportRetryFailure(summarizeDeliveryResults(await Promise.allSettled([deliverNotification(notification.id)])));
    return notification;
  }

  async function retryGuildNotificationDeliveries(limit = 100) {
    const normalizedLimit = Number.isFinite(limit) ? Math.max(1, Math.min(Math.floor(limit), 250)) : 100;
    return runNotificationRetryBatch({
      list: () => db.guildNotification.findMany({
        where: { deliveries: { some: retryableDeliveryWhere(now()) } },
        orderBy: { createdAt: 'asc' }, take: normalizedLimit, select: { id: true },
      }),
      deliver: deliverNotification,
    });
  }

  const listGuildNotifications = (dlmId: string, unreadOnly = false) => db.guildNotification.findMany({
    where: { dlmId, ...(unreadOnly ? { readAt: null } : {}) }, orderBy: { createdAt: 'desc' }, take: 100, include: { deliveries: true },
  });
  const markGuildNotificationsRead = (dlmId: string, ids?: string[]) => {
    const normalized = (ids ?? []).map(value => String(value).trim()).filter(Boolean).slice(0, 100);
    return db.guildNotification.updateMany({ where: { dlmId, readAt: null, ...(normalized.length ? { id: { in: normalized } } : {}) }, data: { readAt: new Date(now()) } });
  };
  return { publishGuildNotification, retryGuildNotificationDeliveries, listGuildNotifications, markGuildNotificationsRead, deliverNotification };
}
