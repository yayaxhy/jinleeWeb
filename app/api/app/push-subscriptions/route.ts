import { NextResponse } from 'next/server';
import { getCurrentDlmUser } from '@/lib/current-dlm-user';

/** Retained for older clients; do not create or erase stored subscriptions. */
async function disabled(request: Request) {
  if (!await getCurrentDlmUser(request)) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  return NextResponse.json({ ok: false, error: '网页推送已停用，业务提醒仅使用 Discord 私信。' }, { status: 410 });
}
export const POST = disabled;
export const DELETE = disabled;
