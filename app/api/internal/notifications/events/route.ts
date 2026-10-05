import { GuildNotificationChannel, GuildNotificationEvent, Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';

import { publishGuildNotification } from '@/lib/notification-center';

const internalToken = () => process.env.WEB_INTERNAL_NOTIFY_TOKEN?.trim() || process.env.INTERNAL_API_TOKEN?.trim() || '';

const events = new Set(Object.values(GuildNotificationEvent));
const channels = new Set(Object.values(GuildNotificationChannel));

export async function POST(request: Request) {
  const token = request.headers.get('x-internal-token') ?? '';
  if (!internalToken() || token !== internalToken()) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const dlmId = typeof body?.dlmId === 'string' ? body.dlmId.trim() : '';
  const event = typeof body?.event === 'string' && events.has(body.event as GuildNotificationEvent)
    ? body.event as GuildNotificationEvent
    : null;
  const title = typeof body?.title === 'string' ? body.title : '';
  const message = typeof body?.body === 'string' ? body.body : '';
  const href = typeof body?.href === 'string' ? body.href : null;
  const dedupeKey = typeof body?.dedupeKey === 'string' ? body.dedupeKey : null;
  const deliveredChannels = Array.isArray(body?.deliveredChannels)
    ? body.deliveredChannels.filter((value): value is GuildNotificationChannel => typeof value === 'string' && channels.has(value as GuildNotificationChannel))
    : [];
  if (!dlmId || !event || !title.trim() || !message.trim()) {
    return NextResponse.json({ ok: false, error: 'invalid_notification_payload' }, { status: 400 });
  }
  try {
    const notification = await publishGuildNotification({
      dlmId,
      event,
      title,
      body: message,
      href,
      dedupeKey,
      deliveredChannels,
      details: body?.details as Prisma.InputJsonValue | undefined,
    });
    return NextResponse.json({ ok: true, notificationId: notification.id });
  } catch (error) {
    console.error('[internal.notifications] publish failed', error);
    return NextResponse.json({ ok: false, error: 'notification_publish_failed' }, { status: 500 });
  }
}
