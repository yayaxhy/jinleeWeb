import { NextResponse } from 'next/server';
import { getCurrentJinleeUser } from '@/lib/current-jinlee-user';
import { getMiniAvailability, setMiniAvailability } from '@/lib/mini-program-account';

export async function GET(request: Request) {
  const currentUser = await getCurrentJinleeUser(request);
  if (!currentUser) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  return NextResponse.json({ ok: true, availability: await getMiniAvailability(currentUser) });
}

export async function POST(request: Request) {
  const currentUser = await getCurrentJinleeUser(request);
  if (!currentUser) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  const result = await setMiniAvailability(currentUser, body.status);
  if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
  return NextResponse.json(result);
}
