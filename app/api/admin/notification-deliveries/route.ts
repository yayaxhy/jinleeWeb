import { GuildNotificationDeliveryStatus, type Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import { canViewKefuWorkspace } from "@/lib/admin";
import { retryGuildNotificationDeliveries } from "@/lib/notification-center";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "@/lib/session";

const FAILURE_WINDOW_MS = 24 * 60 * 60 * 1000;
const MAX_ROWS = 100;

const notificationUser = {
  select: {
    dlmId: true,
    discordDisplayName: true,
    wechatDisplayName: true,
    member: { select: { serverDisplayName: true } },
  },
} satisfies Prisma.DlmUserDefaultArgs;

const userName = (user: {
  dlmId: string;
  discordDisplayName: string | null;
  wechatDisplayName: string | null;
  member: { serverDisplayName: string | null } | null;
}) =>
  user.discordDisplayName ||
  user.member?.serverDisplayName ||
  user.wechatDisplayName ||
  user.dlmId;

async function requireKefuAccess() {
  const session = await getServerSession();
  return Boolean(session?.discordId && canViewKefuWorkspace(session.discordId));
}

/** Recent provider failures for the customer-service inbox; no secrets are exposed. */
export async function GET() {
  if (!(await requireKefuAccess())) {
    return NextResponse.json(
      { ok: false, error: "forbidden" },
      { status: 403 },
    );
  }

  const rows = await prisma.guildNotificationDelivery.findMany({
    where: {
      status: {
        in: [
          GuildNotificationDeliveryStatus.PENDING,
          GuildNotificationDeliveryStatus.FAILED,
        ],
      },
      updatedAt: { gte: new Date(Date.now() - FAILURE_WINDOW_MS) },
    },
    include: {
      notification: {
        include: { dlmUser: notificationUser },
      },
    },
    orderBy: { updatedAt: "desc" },
    take: MAX_ROWS,
  });

  return NextResponse.json({
    ok: true,
    deliveries: rows.map((row) => ({
      id: row.id,
      notificationId: row.notificationId,
      title: row.notification.title,
      event: row.notification.event,
      userName: userName(row.notification.dlmUser),
      userDlmId: row.notification.dlmId,
      channel: row.channel,
      status: row.status,
      attempts: row.attempts,
      error: row.error,
      updatedAt: row.updatedAt.toISOString(),
    })),
  });
}

/** Lets staff request the same bounded retry used by the protected scheduler. */
export async function POST(request: Request) {
  if (!(await requireKefuAccess())) {
    return NextResponse.json(
      { ok: false, error: "forbidden" },
      { status: 403 },
    );
  }
  const body = (await request.json().catch(() => null)) as {
    limit?: unknown;
  } | null;
  const requestedLimit =
    typeof body?.limit === "number" && Number.isFinite(body.limit)
      ? body.limit
      : 100;
  const result = await retryGuildNotificationDeliveries(requestedLimit);
  return NextResponse.json({ ok: true, ...result });
}
