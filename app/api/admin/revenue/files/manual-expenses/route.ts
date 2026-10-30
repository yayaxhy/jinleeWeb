import { NextResponse } from 'next/server';
import { canViewRevenue } from '@/lib/admin';
import { getServerSession } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  const session = await getServerSession();
  if (!session?.discordId || !canViewRevenue(session.discordId)) {
    return NextResponse.json({ error: '无权访问' }, { status: 403 });
  }
  return NextResponse.json({ error: '新支出请到负责人对账登记。' }, { status: 409 });
}
