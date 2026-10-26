import { NextResponse } from 'next/server';

import { retryGuildNotificationDeliveries } from '@/lib/notification-center';

const internalToken = () => process.env.WEB_INTERNAL_NOTIFY_TOKEN?.trim() || process.env.INTERNAL_API_TOKEN?.trim() || '';

export async function POST(request: Request) {
  const token = request.headers.get('x-internal-token') ?? '';
  if (!internalToken() || token !== internalToken()) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }
  const body = await request.json().catch(() => null) as { limit?: unknown } | null;
  const limit = typeof body?.limit === 'number' && Number.isFinite(body.limit) ? body.limit : 100;
  const result = await retryGuildNotificationDeliveries(limit);
  return NextResponse.json({ ok: true, ...result });
}
