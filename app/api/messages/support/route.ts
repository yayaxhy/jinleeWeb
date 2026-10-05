import { NextResponse } from 'next/server';

import { getCurrentDlmUser } from '@/lib/current-dlm-user';
import { startSupportConversation } from '@/lib/mini-program';

export async function POST(request: Request) {
  const currentUser = await getCurrentDlmUser(request);
  if (!currentUser) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  return NextResponse.json(await startSupportConversation(currentUser));
}
