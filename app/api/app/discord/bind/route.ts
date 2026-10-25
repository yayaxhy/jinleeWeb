import { NextResponse } from 'next/server';
import { getCurrentDlmUser } from '@/lib/current-dlm-user';
import { createDiscordBindToken } from '@/lib/discord-bind-token';

export async function POST(request: Request) {
  const currentUser = await getCurrentDlmUser(request);
  if (!currentUser) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  if (currentUser.sessionSource !== 'wechat_program') {
    return NextResponse.json({ ok: false, error: 'unsupported_session_source' }, { status: 400 });
  }

  const { token, expiresAt } = createDiscordBindToken(currentUser.dlmId, currentUser.dlmUser.sessionVersion);
  const origin = process.env.NEXTAUTH_URL ?? new URL(request.url).origin;
  const bindUrl = new URL('/accounts/discord/bind', origin);
  bindUrl.searchParams.set('bindToken', token);

  return NextResponse.json({
    ok: true,
    bindUrl: bindUrl.toString(),
    sourceDlmId: currentUser.dlmId,
    sourceDiscordId: currentUser.discordUserId,
    expiresAt: expiresAt.toISOString(),
  });
}
