import { renderSiteCopy } from "@/lib/site-copy-server";
import { NextResponse } from 'next/server';
import { getServerSession } from '@/lib/session';
import { TargetConfirmationError } from '@/lib/target-confirmation';
import { targetConfirmationService } from '@/lib/target-confirmation-server';

export const runtime = 'nodejs';
const MAX_BODY_BYTES = 4096;
async function readBody(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) throw new TargetConfirmationError();
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) { await reader.cancel(); throw new TargetConfirmationError('查询参数过长', 413); }
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
  } finally { reader.releaseLock(); }
}
export async function POST(request: Request) {
  try {
    const session = await getServerSession();
    if (!session) return NextResponse.json({ error: await renderSiteCopy("site.app.api.profile.target.confirmation.route.e8041a8c9358") }, { status: 401 });
    const result = await targetConfirmationService().issue(session, await readBody(request));
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof TargetConfirmationError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    if (error instanceof SyntaxError) return NextResponse.json({ error: await renderSiteCopy("site.app.api.profile.target.confirmation.route.a4eae9f405b7") }, { status: 400 });
    console.error('[target-confirmation] lookup failed', error instanceof Error ? error.name : 'unknown');
    return NextResponse.json({ error: await renderSiteCopy("site.app.api.profile.target.confirmation.route.345ef2a8ee26") }, { status: 503 });
  }
}
