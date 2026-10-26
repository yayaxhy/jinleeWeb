import { NextResponse } from 'next/server';

import { getCurrentDlmUser } from '@/lib/current-dlm-user';
import { listGuildNotifications, markGuildNotificationsRead } from '@/lib/notification-center';

export async function GET(request: Request) {
  const currentUser = await getCurrentDlmUser(request);
  if (!currentUser) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  const unreadOnly = new URL(request.url).searchParams.get('unread') === 'true';
  const notifications = await listGuildNotifications(currentUser.dlmId, unreadOnly);
  return NextResponse.json({
    ok: true,
    notifications: notifications.map((item) => ({
      id: item.id,
      event: item.event,
      title: item.title,
      body: item.body,
      href: item.href,
      readAt: item.readAt?.toISOString() ?? null,
      createdAt: item.createdAt.toISOString(),
      deliveries: item.deliveries.map((delivery) => ({
        channel: delivery.channel,
        status: delivery.status,
        error: delivery.error,
      })),
    })),
  });
}

export async function POST(request: Request) {
  const currentUser = await getCurrentDlmUser(request);
  if (!currentUser) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  const body = await request.json().catch(() => null) as { ids?: unknown } | null;
  const ids = Array.isArray(body?.ids) ? body?.ids.filter((value): value is string => typeof value === 'string') : undefined;
  await markGuildNotificationsRead(currentUser.dlmId, ids);
  return NextResponse.json({ ok: true });
}
