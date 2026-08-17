import { NextResponse } from 'next/server';
import { getCurrentJinleeUser } from '@/lib/current-jinlee-user';
import { listMiniOrders } from '@/lib/mini-program-account';

export async function GET(request: Request) {
  const currentUser = await getCurrentJinleeUser(request);
  if (!currentUser) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  return NextResponse.json({ ok: true, orders: await listMiniOrders(currentUser) });
}
