import { NextResponse } from 'next/server';
import { getCurrentJinleeUser } from '@/lib/current-jinlee-user';
import { getConversation } from '@/lib/mini-program';

type RouteParams = { conversationId: string };

export async function GET(request: Request, context: { params: Promise<RouteParams> }) {
  const currentUser = await getCurrentJinleeUser(request);
  if (!currentUser) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const params = await context.params;
  const conversation = await getConversation(currentUser, params.conversationId);
  if (!conversation) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
  }

  return NextResponse.json({ ok: true, conversation });
}
