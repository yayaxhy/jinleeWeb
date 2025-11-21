import { NextResponse } from 'next/server';
import {
  attachSessionToResponse,
  clearLoginRedirectCookie,
  clearLoginStateCookie,
  getLoginRedirectCookie,
  getLoginStateCookie,
  normalizeRedirectTarget,
} from '@/lib/session';
import { exchangeCodeForTokens, fetchDiscordUser, fetchGuildMember } from '@/lib/discord';
import { prisma } from '@/lib/prisma';

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
  console.log('[discord.callback] NEXTAUTH_URL', process.env.NEXTAUTH_URL, 'origin', origin);
  const guildId = process.env.DISCORD_GUILD_ID ?? '828118159218966538';

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
    let guildMember = null;
    if (guildId) {
      try {
        guildMember = await fetchGuildMember(tokens.access_token, guildId, tokens.token_type);
      } catch (err) {
        console.error('[discord.callback] fetchGuildMember failed', err);
        guildMember = null;
      }
    }
    const serverDisplayName =
      guildMember?.nick ??
      guildMember?.user?.global_name ??
      guildMember?.user?.username ??
      discordUser.global_name ??
      discordUser.username;

    await prisma.member.upsert({
      where: { discordUserId: discordUser.id },
      update: { serverDisplayName },
      create: { discordUserId: discordUser.id, serverDisplayName },
    });

    // If this member has a PEIWAN row, sync serverDisplayName onto it as展示字段。 Not fatal if not found.
    if (serverDisplayName) {
      await prisma.pEIWAN
        .update({
          where: { discordUserId: discordUser.id },
          data: { serverDisplayName },
        })
        .catch(() => {});
    }

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
