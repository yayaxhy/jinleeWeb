import { NextRequest, NextResponse } from 'next/server';
import { reconcileExpiredWechatNativePayments } from '@/lib/wechat-native-reconciliation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const getExpectedToken = () =>
  process.env.WECHAT_NATIVE_RECONCILE_TOKEN || process.env.INTERNAL_API_TOKEN || '';

export async function POST(request: NextRequest) {
  const expectedToken = getExpectedToken();
  const providedToken = request.headers.get('x-wechat-native-reconcile-token') || '';
  if (!expectedToken || providedToken !== expectedToken) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const rawLimit = Number(request.nextUrl.searchParams.get('limit') ?? '100');
  const result = await reconcileExpiredWechatNativePayments(rawLimit);
  return NextResponse.json({ ok: true, ...result });
}
