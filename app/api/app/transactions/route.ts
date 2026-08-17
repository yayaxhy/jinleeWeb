import { NextResponse } from 'next/server';
import { getCurrentJinleeUser } from '@/lib/current-jinlee-user';
import { listMiniTransactions } from '@/lib/mini-program-account';

export async function GET(request: Request) {
  const currentUser = await getCurrentJinleeUser(request);
  if (!currentUser) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  return NextResponse.json({ ok: true, transactions: await listMiniTransactions(currentUser) });
}
