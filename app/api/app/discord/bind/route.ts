import { NextResponse } from 'next/server';
import { getCurrentJinleeUser } from '@/lib/current-jinlee-user';
import { createDiscordBindToken } from '@/lib/discord-bind-token';

export async function POST(request: Request) {
  const currentUser = await getCurrentJinleeUser(request);
  if (!currentUser) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  if (currentUser.sessionSource !== 'wechat_program') {
    return NextResponse.json({ ok: false, error: 'unsupported_session_source' }, { status: 400 });
  }

  if (currentUser.discordUserId) {
    return NextResponse.json({
      ok: true,
      alreadyBound: true,
      discordUserId: currentUser.discordUserId,
    });
  }

  const { token, expiresAt } = createDiscordBindToken(currentUser.jinleeId);
  const origin = process.env.NEXTAUTH_URL ?? new URL(request.url).origin;
  const bindUrl = new URL('/accounts/discord/bind', origin);
  bindUrl.searchParams.set('bindToken', token);

  return NextResponse.json({
    ok: true,
    bindUrl: bindUrl.toString(),
    expiresAt: expiresAt.toISOString(),
  });
}
