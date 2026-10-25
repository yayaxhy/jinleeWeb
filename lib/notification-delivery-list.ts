import type { Prisma, PrismaClient } from "@prisma/client";

import { DELIVERY_HOLD_PREFIX, DELIVERY_MAX_AGE_MS, describeDelivery, retryableDeliveryWhere } from "./notification-delivery";

const FAILURE_WINDOW_MS = DELIVERY_MAX_AGE_MS;
const MAX_PAGE_SIZE = 100;
const MAX_OFFSET = 2_147_483_647;

export type DeliveryPagination = { page: number; pageSize: number };

export function parseDeliveryPagination(params: URLSearchParams): DeliveryPagination | null {
  const values = [params.get("page") ?? "1", params.get("pageSize") ?? "100"];
  if (values.some((value) => !/^\d+$/.test(value))) return null;
  const [page, requestedPageSize] = values.map(Number);
  if (![page, requestedPageSize].every((value) => Number.isSafeInteger(value) && value > 0)) return null;
  const pageSize = Math.min(requestedPageSize, MAX_PAGE_SIZE);
  if ((page - 1) * pageSize > MAX_OFFSET) return null;
  return { page, pageSize };
}

const notificationUser = {
  select: {
    dlmId: true,
    discordDisplayName: true,
    wechatDisplayName: true,
    member: { select: { serverDisplayName: true } },
  },
} satisfies Prisma.DlmUserDefaultArgs;

/** Read-only and injectable so paging and eligibility can be checked without a database. */
export async function listNotificationDeliveries(
  db: Pick<PrismaClient, "guildNotificationDelivery">,
  pagination: DeliveryPagination,
  now = Date.now(),
) {
  const cutoff = new Date(now - FAILURE_WINDOW_MS);
  const where: Prisma.GuildNotificationDeliveryWhereInput = {
    status: { in: ["PENDING", "FAILED"] },
    OR: [
      { updatedAt: { gte: cutoff } },
      { error: { startsWith: DELIVERY_HOLD_PREFIX } },
    ],
  };
  const [total, retryableCount] = await Promise.all([
    db.guildNotificationDelivery.count({ where }),
    // Match the worker's eligibility across all pages, including notifications
    // whose eligible channel is not on the page currently shown to staff.
    db.guildNotificationDelivery.count({
      where: retryableDeliveryWhere(now),
    }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / pagination.pageSize));
  const page = Math.min(pagination.page, totalPages);
  const rows = await db.guildNotificationDelivery.findMany({
    where,
    include: { notification: { include: { dlmUser: notificationUser } } },
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    skip: (page - 1) * pagination.pageSize,
    take: pagination.pageSize,
  });

  return {
    page,
    pageSize: pagination.pageSize,
    total,
    totalPages,
    retryableCount,
    deliveries: rows.map((row) => {
      const description = describeDelivery({ ...row, notificationCreatedAt: row.notification.createdAt }, now);
      const user = row.notification.dlmUser;
      return {
        id: row.id,
        notificationId: row.notificationId,
        title: row.notification.title,
        event: row.notification.event,
        userName: user.discordDisplayName || user.member?.serverDisplayName || user.wechatDisplayName || user.dlmId,
        userDlmId: row.notification.dlmId,
        channel: row.channel,
        attempts: row.attempts,
        ...description,
        canRetry: description.canRetry,
        updatedAt: row.updatedAt.toISOString(),
      };
    }),
  };
}
