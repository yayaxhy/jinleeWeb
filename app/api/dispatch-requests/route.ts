import { NextResponse } from 'next/server';
import { getCurrentJinleeUser } from '@/lib/current-jinlee-user';
import { createDispatchRequest, listDispatchRequests } from '@/lib/mini-program';

async function readJson(request: Request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const currentUser = await getCurrentJinleeUser(request);
  if (!currentUser) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const scope = new URL(request.url).searchParams.get('scope');
  const dispatches = await listDispatchRequests(currentUser, scope);
  return NextResponse.json({ ok: true, dispatches });
}

export async function POST(request: Request) {
  const currentUser = await getCurrentJinleeUser(request);
  if (!currentUser) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const body = await readJson(request);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  const result = await createDispatchRequest(currentUser, body as Record<string, unknown>);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
  }

  return NextResponse.json({ ok: true, dispatch: result.dispatch });
}
