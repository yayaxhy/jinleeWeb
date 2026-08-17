import { NextResponse } from 'next/server';
import { getCurrentJinleeUser } from '@/lib/current-jinlee-user';
import { grabDispatchRequest } from '@/lib/mini-program';

type RouteParams = { dispatchId: string };

export async function POST(request: Request, context: { params: Promise<RouteParams> }) {
  const currentUser = await getCurrentJinleeUser(request);
  if (!currentUser) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const params = await context.params;
  const result = await grabDispatchRequest(currentUser, params.dispatchId);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
  }

  return NextResponse.json({ ok: true, candidate: result.candidate });
}
