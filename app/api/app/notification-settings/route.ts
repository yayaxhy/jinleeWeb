import { NextResponse } from 'next/server';
import { getCurrentJinleeUser } from '@/lib/current-jinlee-user';
import { getMiniNotificationSettings, setMiniNotificationSettings } from '@/lib/mini-program-account';

export async function GET(request: Request) {
  const currentUser = await getCurrentJinleeUser(request);
  if (!currentUser) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  return NextResponse.json({ ok: true, settings: getMiniNotificationSettings(currentUser) });
}

export async function POST(request: Request) {
  const currentUser = await getCurrentJinleeUser(request);
  if (!currentUser) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  return NextResponse.json({ ok: true, settings: await setMiniNotificationSettings(currentUser, body) });
}
