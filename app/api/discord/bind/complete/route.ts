import { NextResponse } from 'next/server';
import { getServerSession, normalizeRedirectTarget } from '@/lib/session';
import { getCurrentJinleeUser } from '@/lib/current-jinlee-user';
import { mergeWechatProgramJinleeUserIntoDiscordJinleeUser, isDiscordBindingError } from '@/lib/discord-binding';
import { verifyDiscordBindToken } from '@/lib/discord-bind-token';

const buildResultUrl = (origin: string, status: string, code?: string) => {
  const target = new URL('/accounts/discord/bind/result', origin);
  target.searchParams.set('status', status);
  if (code) {
    target.searchParams.set('code', code);
  }
  return target;
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = process.env.NEXTAUTH_URL ?? url.origin;
  const bindToken = url.searchParams.get('bindToken');
  const tokenPayload = verifyDiscordBindToken(bindToken);

  if (!tokenPayload) {
    return NextResponse.redirect(buildResultUrl(origin, 'error', 'invalid_bind_token'), { status: 302 });
  }

  const session = await getServerSession();
  if (!session?.discordId) {
    const loginUrl = new URL('/accounts/discord/login', origin);
    loginUrl.searchParams.set(
      'callbackUrl',
      normalizeRedirectTarget(`/api/discord/bind/complete?bindToken=${encodeURIComponent(bindToken ?? '')}`),
    );
    return NextResponse.redirect(loginUrl, { status: 302 });
  }

  try {
    const currentDiscordUser = await getCurrentJinleeUser();
    if (!currentDiscordUser || !currentDiscordUser.discordUserId) {
      return NextResponse.redirect(buildResultUrl(origin, 'error', 'discord_session_missing'), { status: 302 });
    }

    if (currentDiscordUser.jinleeId === tokenPayload.jinleeId) {
      return NextResponse.redirect(buildResultUrl(origin, 'success', 'already_bound'), { status: 302 });
    }

    await mergeWechatProgramJinleeUserIntoDiscordJinleeUser({
      sourceJinleeId: currentDiscordUser.jinleeId,
      targetWechatJinleeId: tokenPayload.jinleeId,
      discordUserId: currentDiscordUser.discordUserId,
      discordDisplayName:
        currentDiscordUser.jinleeUser.discordDisplayName ??
        currentDiscordUser.jinleeUser.member?.serverDisplayName ??
        session.username,
      discordAvatarUrl: currentDiscordUser.jinleeUser.discordAvatarUrl ?? null,
      discordProfile: {
        username: session.username,
        discriminator: session.discriminator ?? null,
        avatar: session.avatar ?? null,
      },
    });

    return NextResponse.redirect(buildResultUrl(origin, 'success'), { status: 302 });
  } catch (error) {
    console.error('[discord.bind.complete] failed', error);
    const code = isDiscordBindingError(error) ? error.code : 'bind_failed';
    return NextResponse.redirect(buildResultUrl(origin, 'error', code), { status: 302 });
  }
}
