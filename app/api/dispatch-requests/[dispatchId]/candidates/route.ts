import { NextResponse } from 'next/server';
import { getCurrentDlmUser } from '@/lib/current-dlm-user';
import { grabDispatchRequest } from '@/lib/mini-program';

type RouteParams = { dispatchId: string };

export async function POST(request: Request, context: { params: Promise<RouteParams> }) {
  const currentUser = await getCurrentDlmUser(request);
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
