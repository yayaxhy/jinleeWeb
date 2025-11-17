import { NextResponse } from 'next/server';
import {
  attachSessionToResponse,
  clearLoginRedirectCookie,
  clearLoginStateCookie,
  getLoginRedirectCookie,
  getLoginStateCookie,
  normalizeRedirectTarget,
} from '@/lib/session';
import { exchangeCodeForTokens, fetchDiscordUser } from '@/lib/discord';

type ParsedState = {
  csrf?: string;
  next?: string;
};

const parseStateParam = (value?: string | null): ParsedState => {
  if (!value) return {};
  const segments = value.split('|');
  const data: ParsedState = {};
  for (const segment of segments) {
    if (segment.startsWith('csrf:')) {
      data.csrf = segment.slice(5);
    } else if (segment.startsWith('next:')) {
      data.next = segment.slice(5);
    } else if (segment.startsWith('/')) {
      data.next = segment;
    }
  }
  return data;
};

const buildErrorRedirect = (origin: string, code: string) => {
  const response = NextResponse.redirect(`${origin}/accounts/discord/login?error=${encodeURIComponent(code)}`, {
    status: 302,
  });
  clearLoginRedirectCookie(response);
  clearLoginStateCookie(response);
  return response;
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = process.env.NEXTAUTH_URL ?? url.origin;

  if (url.searchParams.get('error')) {
    return buildErrorRedirect(origin, url.searchParams.get('error_description') ?? 'access_denied');
  }

  const code = url.searchParams.get('code');
  if (!code) {
    return buildErrorRedirect(origin, 'missing_code');
  }

  const state = parseStateParam(url.searchParams.get('state'));
  const expectedState = await getLoginStateCookie();
  if (expectedState) {
    if (!state.csrf || state.csrf !== expectedState) {
      return buildErrorRedirect(origin, 'invalid_state');
    }
  }

  try {
    const redirectUri = `${origin}/api/auth/callback/discord`;
    const tokens = await exchangeCodeForTokens(code, redirectUri);
    const discordUser = await fetchDiscordUser(tokens.access_token, tokens.token_type);

    const cookieTarget = await getLoginRedirectCookie();
    const redirectTarget = normalizeRedirectTarget(cookieTarget ?? state.next ?? undefined, '/profile');
    const absoluteRedirect = new URL(redirectTarget, origin);
    const response = NextResponse.redirect(absoluteRedirect, { status: 302 });

    attachSessionToResponse(response, {
      discordId: discordUser.id,
      username: discordUser.global_name ?? discordUser.username,
      discriminator: discordUser.discriminator && discordUser.discriminator !== '0' ? discordUser.discriminator : null,
      avatar: discordUser.avatar ?? null,
    });

    clearLoginRedirectCookie(response);
    clearLoginStateCookie(response);
    return response;
  } catch (error) {
    console.error('Discord OAuth callback failed', error);
    return buildErrorRedirect(origin, 'discord_oauth');
  }
}
