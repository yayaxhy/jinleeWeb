import webPush from "web-push";
import {
  GuildNotificationChannel,
  GuildNotificationDeliveryStatus,
  GuildNotificationEvent,
  Prisma,
} from "@prisma/client";

import { postInternalBot } from "@/lib/internal-bot";
import { prisma } from "@/lib/prisma";

const MAX_TITLE_LENGTH = 160;
const MAX_BODY_LENGTH = 1000;
const MAX_HREF_LENGTH = 512;

type DeliveryChannel = GuildNotificationChannel;

export type GuildNotificationInput = {
  dlmId: string;
  event: GuildNotificationEvent;
  title: string;
  body: string;
  href?: string | null;
  details?: Prisma.InputJsonValue;
  dedupeKey?: string | null;
  /** A source which has already delivered (usually a rich Discord Bot DM). */
  deliveredChannels?: DeliveryChannel[];
};

const clean = (value: string | null | undefined, maxLength: number) =>
  String(value ?? "")
    .trim()
    .slice(0, maxLength);

const safeNotificationHref = (value: string | null | undefined) => {
  const raw = clean(value, MAX_HREF_LENGTH);
  if (!raw) return null;
  try {
    const origin = new URL(
      process.env.SITE_ORIGIN?.trim() || "https://dlmclub.com",
    ).origin;
    const target = new URL(raw, origin);
    if (target.origin !== origin) return null;
    return `${target.pathname}${target.search}${target.hash}`;
  } catch {
    return null;
  }
};

const safeErrorMessage = (error: unknown) =>
  (error instanceof Error ? error.message : String(error)).slice(0, 1000);

const allChannels = [
  GuildNotificationChannel.DISCORD,
  GuildNotificationChannel.WEB_PUSH,
  GuildNotificationChannel.EMAIL,
] as const;

const makeDeliveryRows = (delivered: ReadonlySet<DeliveryChannel>) =>
  allChannels.map((channel) => ({
    channel,
    status: delivered.has(channel)
      ? GuildNotificationDeliveryStatus.SENT
      : GuildNotificationDeliveryStatus.PENDING,
    attempts: delivered.has(channel) ? 1 : 0,
    sentAt: delivered.has(channel) ? new Date() : null,
  }));

async function updateDelivery(
  notificationId: string,
  channel: DeliveryChannel,
  status: GuildNotificationDeliveryStatus,
  error?: string | null,
) {
  await prisma.guildNotificationDelivery.upsert({
    where: {
      notificationId_channel: { notificationId, channel },
    },
    create: {
      notificationId,
      channel,
      status,
      attempts: 1,
      error: error ?? null,
      sentAt:
        status === GuildNotificationDeliveryStatus.SENT ? new Date() : null,
    },
    update: {
      status,
      attempts: { increment: 1 },
      error: error ?? null,
      sentAt:
        status === GuildNotificationDeliveryStatus.SENT
          ? new Date()
          : undefined,
    },
  });
}

function configureWebPush() {
  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  const subject =
    process.env.VAPID_SUBJECT?.trim() || "mailto:security@dlmclub.com";
  if (!publicKey || !privateKey) return false;
  webPush.setVapidDetails(subject, publicKey, privateKey);
  return true;
}

async function deliverDiscord(
  notificationId: string,
  recipient: { discordUserId: string | null },
  notification: { title: string; body: string; href: string | null },
) {
  if (!recipient.discordUserId) {
    await updateDelivery(
      notificationId,
      GuildNotificationChannel.DISCORD,
      GuildNotificationDeliveryStatus.SKIPPED,
      "discord_not_bound",
    );
    return;
  }

  try {
    await postInternalBot("/internal/notifications/discord-dm", {
      notificationId,
      discordUserId: recipient.discordUserId,
      title: notification.title,
      body: notification.body,
      href: notification.href,
    });
    await updateDelivery(
      notificationId,
      GuildNotificationChannel.DISCORD,
      GuildNotificationDeliveryStatus.SENT,
    );
  } catch (error) {
    await updateDelivery(
      notificationId,
      GuildNotificationChannel.DISCORD,
      GuildNotificationDeliveryStatus.FAILED,
      safeErrorMessage(error),
    );
  }
}

async function deliverEmail(
  notificationId: string,
  recipient: {
    notificationEmail: string | null;
    notificationEmailEnabled: boolean;
  },
  notification: { title: string; body: string; href: string | null },
) {
  if (!recipient.notificationEmailEnabled || !recipient.notificationEmail) {
    await updateDelivery(
      notificationId,
      GuildNotificationChannel.EMAIL,
      GuildNotificationDeliveryStatus.SKIPPED,
      "email_not_enabled",
    );
    return;
  }

  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.NOTIFICATION_FROM_EMAIL?.trim();
  if (!apiKey || !from) {
    await updateDelivery(
      notificationId,
      GuildNotificationChannel.EMAIL,
      GuildNotificationDeliveryStatus.SKIPPED,
      "email_provider_not_configured",
    );
    return;
  }

  const destination = recipient.notificationEmail;
  const origin =
    process.env.SITE_ORIGIN?.replace(/\/$/, "") || "https://dlmclub.com";
  const href = notification.href
    ? new URL(notification.href, origin).toString()
    : origin;
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [destination],
        subject: notification.title,
        text: `${notification.title}\n\n${notification.body}\n\n查看详情：${href}`,
      }),
    });
    if (!response.ok) {
      throw new Error(`resend_http_${response.status}`);
    }
    await updateDelivery(
      notificationId,
      GuildNotificationChannel.EMAIL,
      GuildNotificationDeliveryStatus.SENT,
    );
  } catch (error) {
    await updateDelivery(
      notificationId,
      GuildNotificationChannel.EMAIL,
      GuildNotificationDeliveryStatus.FAILED,
      safeErrorMessage(error),
    );
  }
}

async function deliverWebPush(
  notificationId: string,
  dlmId: string,
  notification: { title: string; body: string; href: string | null },
) {
  if (!configureWebPush()) {
    await updateDelivery(
      notificationId,
      GuildNotificationChannel.WEB_PUSH,
      GuildNotificationDeliveryStatus.SKIPPED,
      "vapid_not_configured",
    );
    return;
  }

  const subscriptions = await prisma.webPushSubscription.findMany({
    where: { dlmId },
  });
  if (!subscriptions.length) {
    await updateDelivery(
      notificationId,
      GuildNotificationChannel.WEB_PUSH,
      GuildNotificationDeliveryStatus.SKIPPED,
      "no_push_subscription",
    );
    return;
  }

  const payload = JSON.stringify({
    title: notification.title,
    body: notification.body,
    url: notification.href || "/console?notifications=1",
    notificationId,
  });
  let sent = false;
  let lastError: string | null = null;

  for (const subscription of subscriptions) {
    try {
      await webPush.sendNotification(
        {
          endpoint: subscription.endpoint,
          expirationTime: subscription.expirationTime?.getTime() ?? null,
          keys: { p256dh: subscription.p256dh, auth: subscription.auth },
        },
        payload,
      );
      sent = true;
    } catch (error) {
      const statusCode =
        typeof error === "object" && error && "statusCode" in error
          ? Number((error as { statusCode?: unknown }).statusCode)
          : null;
      lastError = safeErrorMessage(error);
      if (statusCode === 404 || statusCode === 410) {
        await prisma.webPushSubscription
          .delete({ where: { id: subscription.id } })
          .catch(() => undefined);
      }
    }
  }

  await updateDelivery(
    notificationId,
    GuildNotificationChannel.WEB_PUSH,
    sent
      ? GuildNotificationDeliveryStatus.SENT
      : GuildNotificationDeliveryStatus.FAILED,
    sent ? null : (lastError ?? "push_delivery_failed"),
  );
}

async function deliverNotification(notificationId: string) {
  const notification = await prisma.guildNotification.findUnique({
    where: { id: notificationId },
    include: {
      dlmUser: {
        select: {
          discordUserId: true,
          notificationEmail: true,
          notificationEmailEnabled: true,
        },
      },
      deliveries: true,
    },
  });
  if (!notification) return;

  const completed = new Set(
    notification.deliveries
      ?.filter((item) => item.status === GuildNotificationDeliveryStatus.SENT)
      .map((item) => item.channel) ?? [],
  );
  const payload = {
    title: notification.title,
    body: notification.body,
    href: notification.href,
  };
  const jobs: Promise<unknown>[] = [];
  if (!completed.has(GuildNotificationChannel.DISCORD))
    jobs.push(deliverDiscord(notification.id, notification.dlmUser, payload));
  if (!completed.has(GuildNotificationChannel.WEB_PUSH))
    jobs.push(deliverWebPush(notification.id, notification.dlmId, payload));
  if (!completed.has(GuildNotificationChannel.EMAIL))
    jobs.push(deliverEmail(notification.id, notification.dlmUser, payload));
  await Promise.allSettled(jobs);
}

export async function publishGuildNotification(input: GuildNotificationInput) {
  const title = clean(input.title, MAX_TITLE_LENGTH);
  const body = clean(input.body, MAX_BODY_LENGTH);
  if (!input.dlmId || !title || !body) {
    throw new Error("invalid_notification_payload");
  }

  const delivered = new Set(input.deliveredChannels ?? []);
  const dedupeKey = clean(input.dedupeKey, 255) || null;
  const data = {
    dlmId: input.dlmId,
    event: input.event,
    title,
    body,
    href: safeNotificationHref(input.href),
    details: input.details,
  } satisfies Prisma.GuildNotificationUncheckedCreateInput;

  const notification = dedupeKey
    ? await prisma.guildNotification.upsert({
        where: { dedupeKey },
        create: {
          ...data,
          dedupeKey,
          deliveries: { create: makeDeliveryRows(delivered) },
        },
        update: {},
        include: { deliveries: true },
      })
    : await prisma.guildNotification.create({
        data: {
          ...data,
          deliveries: { create: makeDeliveryRows(delivered) },
        },
        include: { deliveries: true },
      });

  // Delivery is deliberately best-effort. The durable notification is always
  // visible in the center even if a provider is unavailable during this call.
  await deliverNotification(notification.id);
  return notification;
}

export async function listGuildNotifications(
  dlmId: string,
  unreadOnly = false,
) {
  return prisma.guildNotification.findMany({
    where: { dlmId, ...(unreadOnly ? { readAt: null } : {}) },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { deliveries: true },
  });
}

export async function markGuildNotificationsRead(
  dlmId: string,
  ids?: string[],
) {
  const normalizedIds = (ids ?? [])
    .map((value) => String(value).trim())
    .filter(Boolean)
    .slice(0, 100);
  return prisma.guildNotification.updateMany({
    where: {
      dlmId,
      readAt: null,
      ...(normalizedIds.length ? { id: { in: normalizedIds } } : {}),
    },
    data: { readAt: new Date() },
  });
}

/**
 * Best-effort retry worker for transient provider failures. It is invoked by a
 * protected scheduler endpoint; business transactions never wait for retries.
 */
export async function retryGuildNotificationDeliveries(limit = 100) {
  const normalizedLimit = Number.isFinite(limit)
    ? Math.max(1, Math.min(Math.floor(limit), 250))
    : 100;
  const notifications = await prisma.guildNotification.findMany({
    where: {
      createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      deliveries: {
        some: {
          status: {
            in: [
              GuildNotificationDeliveryStatus.PENDING,
              GuildNotificationDeliveryStatus.FAILED,
            ],
          },
          attempts: { lt: 3 },
        },
      },
    },
    orderBy: { createdAt: "asc" },
    take: normalizedLimit,
    select: { id: true },
  });
  await Promise.allSettled(
    notifications.map((notification) => deliverNotification(notification.id)),
  );
  return { attempted: notifications.length };
}

export function getVapidPublicKey() {
  return (
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim() ||
    process.env.VAPID_PUBLIC_KEY?.trim() ||
    null
  );
}
