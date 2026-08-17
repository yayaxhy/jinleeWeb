import { NextRequest, NextResponse } from 'next/server';
import { purgeExpiredAuthLoginEvents } from '@/lib/auth-login-audit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const getExpectedToken = () => process.env.AUTH_LOGIN_AUDIT_CRON_TOKEN || process.env.INTERNAL_API_TOKEN || '';

export async function POST(request: NextRequest) {
  const expectedToken = getExpectedToken();
  const providedToken = request.headers.get('x-auth-login-audit-token') || '';
  if (!expectedToken || providedToken !== expectedToken) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const result = await purgeExpiredAuthLoginEvents();
  return NextResponse.json({ ok: true, ...result, cutoff: result.cutoff.toISOString() });
}
