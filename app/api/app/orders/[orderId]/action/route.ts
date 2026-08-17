import { NextResponse } from 'next/server';
import { getCurrentJinleeUser } from '@/lib/current-jinlee-user';
import { InternalBotError } from '@/lib/internal-bot';
import { performMiniOrderAction } from '@/lib/mini-program-account';

type Params = { orderId: string };

export async function POST(request: Request, context: { params: Promise<Params> }) {
  const currentUser = await getCurrentJinleeUser(request);
  if (!currentUser) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  const { orderId } = await context.params;

  try {
    const result = await performMiniOrderAction(currentUser, orderId, body.action);
    if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof InternalBotError) {
      return NextResponse.json({ ok: false, error: error.code }, { status: error.status });
    }
    throw error;
  }
}
