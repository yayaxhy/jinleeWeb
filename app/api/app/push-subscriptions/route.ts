import { NextResponse } from 'next/server';

import { getCurrentDlmUser } from '@/lib/current-dlm-user';
import { prisma } from '@/lib/prisma';

type SubscriptionPayload = {
  endpoint?: unknown;
  expirationTime?: unknown;
  keys?: { p256dh?: unknown; auth?: unknown } | null;
};

const readPayload = async (request: Request): Promise<SubscriptionPayload | null> =>
  request.json().catch(() => null) as Promise<SubscriptionPayload | null>;

export async function POST(request: Request) {
  const currentUser = await getCurrentDlmUser(request);
  if (!currentUser) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  const body = await readPayload(request);
  const endpoint = typeof body?.endpoint === 'string' ? body.endpoint.trim() : '';
  const p256dh = typeof body?.keys?.p256dh === 'string' ? body.keys.p256dh.trim() : '';
  const auth = typeof body?.keys?.auth === 'string' ? body.keys.auth.trim() : '';
  if (!endpoint || !p256dh || !auth || endpoint.length > 4096 || p256dh.length > 1024 || auth.length > 1024) {
    return NextResponse.json({ ok: false, error: 'invalid_push_subscription' }, { status: 400 });
  }
  const expiration = typeof body?.expirationTime === 'number' && Number.isFinite(body.expirationTime)
    ? new Date(body.expirationTime)
    : null;
  await prisma.webPushSubscription.upsert({
    where: { endpoint },
    create: { dlmId: currentUser.dlmId, endpoint, p256dh, auth, expirationTime: expiration, userAgent: request.headers.get('user-agent')?.slice(0, 512) ?? null },
    update: { dlmId: currentUser.dlmId, p256dh, auth, expirationTime: expiration, userAgent: request.headers.get('user-agent')?.slice(0, 512) ?? null },
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const currentUser = await getCurrentDlmUser(request);
  if (!currentUser) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  const body = await readPayload(request);
  const endpoint = typeof body?.endpoint === 'string' ? body.endpoint.trim() : '';
  if (!endpoint) return NextResponse.json({ ok: false, error: 'invalid_push_subscription' }, { status: 400 });
  await prisma.webPushSubscription.deleteMany({ where: { dlmId: currentUser.dlmId, endpoint } });
  return NextResponse.json({ ok: true });
}
