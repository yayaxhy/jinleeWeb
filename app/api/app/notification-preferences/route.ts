import { NextResponse } from 'next/server';
import { getCurrentDlmUser } from '@/lib/current-dlm-user';

/** Preserve stored preferences; these transport channels are disabled globally. */
export async function GET(request: Request) {
  const currentUser = await getCurrentDlmUser(request);
  if (!currentUser) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  return NextResponse.json({ ok: true, email: currentUser.dlmUser.notificationEmail, emailEnabled: false, pushEnabled: false, vapidPublicKey: null, availableChannels: ['DISCORD'] });
}

export async function PUT(request: Request) {
  if (!await getCurrentDlmUser(request)) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  return NextResponse.json({ ok: false, error: '通知目前仅使用 Discord 私信，邮件和网页推送已停用。' }, { status: 410 });
}
