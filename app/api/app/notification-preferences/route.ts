import { NextResponse } from 'next/server';

import { getCurrentDlmUser } from '@/lib/current-dlm-user';
import { getVapidPublicKey } from '@/lib/notification-center';
import { prisma } from '@/lib/prisma';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function GET(request: Request) {
  const currentUser = await getCurrentDlmUser(request);
  if (!currentUser) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  const user = await prisma.dlmUser.findUniqueOrThrow({
    where: { dlmId: currentUser.dlmId },
    select: { notificationEmail: true, notificationEmailEnabled: true, _count: { select: { webPushSubscriptions: true } } },
  });
  return NextResponse.json({
    ok: true,
    email: user.notificationEmail,
    emailEnabled: user.notificationEmailEnabled,
    pushEnabled: user._count.webPushSubscriptions > 0,
    vapidPublicKey: getVapidPublicKey(),
  });
}

export async function PUT(request: Request) {
  const currentUser = await getCurrentDlmUser(request);
  if (!currentUser) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  const body = await request.json().catch(() => null) as { email?: unknown; emailEnabled?: unknown } | null;
  if (!body) return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase().slice(0, 320) : '';
  const emailEnabled = body.emailEnabled === true;
  if (emailEnabled && !emailPattern.test(email)) {
    return NextResponse.json({ ok: false, error: 'invalid_email' }, { status: 400 });
  }
  const updated = await prisma.dlmUser.update({
    where: { dlmId: currentUser.dlmId },
    data: {
      notificationEmail: email || null,
      notificationEmailEnabled: emailEnabled,
    },
    select: { notificationEmail: true, notificationEmailEnabled: true },
  });
  return NextResponse.json({ ok: true, email: updated.notificationEmail, emailEnabled: updated.notificationEmailEnabled });
}
