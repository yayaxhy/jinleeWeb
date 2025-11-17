import { NextResponse } from 'next/server';
import { getServerSession, summarizeSession } from '@/lib/session';

export function GET() {
  const session = getServerSession();
  return NextResponse.json({ session: summarizeSession(session) });
}

