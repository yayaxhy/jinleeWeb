import { NextResponse } from 'next/server';
import { getServerSession, summarizeSession } from '@/lib/session';

export async function GET() {
  const session = await getServerSession();
  return NextResponse.json({ session: summarizeSession(session) });
}

