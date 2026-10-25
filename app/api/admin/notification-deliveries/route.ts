import { listOutboxDeliveries } from '@/lib/notification-outbox-monitor';
import { postInternalBot } from '@/lib/internal-bot';
import { NextResponse } from "next/server";

import { canViewKefuWorkspace } from "@/lib/admin";
import { retryGuildNotificationDeliveries } from "@/lib/notification-center";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "@/lib/session";
import { listNotificationDeliveries, parseDeliveryPagination } from "@/lib/notification-delivery-list";
import { notificationRetryLimit, readAdminJsonWrite } from "@/lib/admin-write-request";

async function requireKefuAccess() {
  const session = await getServerSession();
  return Boolean(session?.discordId && canViewKefuWorkspace(session.discordId));
}

/** Paginated recent failures and unresolved holds; no internal claim tokens are exposed. */
export async function GET(request: Request) {
  if (!(await requireKefuAccess())) {
    return NextResponse.json(
      { ok: false, error: "forbidden" },
      { status: 403 },
    );
  }

  const pagination = parseDeliveryPagination(new URL(request.url).searchParams);
  if (!pagination) {
    return NextResponse.json({ ok: false, error: "invalid_pagination" }, { status: 400 });
  }
  const source = new URL(request.url).searchParams.get('source');
  if (source && !['center', 'outbox'].includes(source)) return NextResponse.json({ ok: false, error: 'invalid_source' }, { status: 400 });
  return NextResponse.json({ ok: true, ...await (source === 'outbox' ? listOutboxDeliveries(prisma, pagination) : listNotificationDeliveries(prisma, pagination)) });
}

/** Lets staff request the same bounded retry used by the protected scheduler. */
export async function POST(request: Request) {
  if (!(await requireKefuAccess())) {
    return NextResponse.json(
      { ok: false, error: "forbidden" },
      { status: 403 },
    );
  }
  const parsed = await readAdminJsonWrite(request);
  if (!parsed.ok) return parsed.response;
  const requestedLimit = notificationRetryLimit(parsed.body);
  if (requestedLimit === null) return NextResponse.json({ ok: false, error: "请明确填写有效的重试数量" }, { status: 400 });
  if (parsed.body.source && !['center', 'outbox'].includes(String(parsed.body.source))) return NextResponse.json({ ok: false, error: 'invalid_source' }, { status: 400 });
  if (parsed.body.source === 'outbox') {
    try {
      const result = await postInternalBot<{ ok: boolean; attempted: number; uncertain: number; processingErrors: number }>('/internal/notifications/outbox-retry', { limit: requestedLimit });
      return NextResponse.json(result, { status: result.ok ? 200 : 503 });
    } catch { return NextResponse.json({ ok: false, error: '通知任务处理暂不可用，请稍后刷新状态。' }, { status: 503 }); }
  }
  const result = await retryGuildNotificationDeliveries(requestedLimit);
  return NextResponse.json(result, { status: result.ok ? 200 : 503 });
}
