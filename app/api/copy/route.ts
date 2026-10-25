import { NextResponse } from 'next/server';
import { loadPublishedCopy } from '@/lib/editable-copy-store';

export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    const snapshot = await loadPublishedCopy('site');
    return NextResponse.json(snapshot, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    // A failed refresh must not replace an already loaded browser snapshot with defaults.
    return NextResponse.json({ error: 'copy_unavailable' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
