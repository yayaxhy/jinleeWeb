import { NextResponse } from 'next/server';
import {
  attachSessionToResponse,
  clearLoginRedirectCookie,
  clearLoginStateCookie,
  getLoginRedirectCookie,
  getLoginStateCookie,
  normalizeRedirectTarget,
} from '@/lib/session';
import { ensureJinleeUserForDiscordMember } from '@/lib/jinlee-user';
import { exchangeCodeForTokens, fetchDiscordUser, fetchGuildMember } from '@/lib/discord';
import { resolveDiscordLoginDisplayName } from '@/lib/discord-login-display-name';
import { prisma } from '@/lib/prisma';
import { recordAuthLoginEvent } from '@/lib/auth-login-audit';
import { AccountProvider } from '@prisma/client';

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
  const guildId = process.env.DISCORD_GUILD_ID?.trim()
    || process.env.DISCORD_MIGRATION_TARGET_GUILD_ID?.trim()
    || '1551704194438922310';

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
    const [savedMember, savedJinleeUser, savedPeiwan] = await Promise.all([
      prisma.member.findUnique({
        where: { discordUserId: discordUser.id },
        select: { serverDisplayName: true },
      }),
      prisma.jinleeUser.findUnique({
        where: { discordUserId: discordUser.id },
        select: { discordDisplayName: true },
      }),
      prisma.pEIWAN.findUnique({
        where: { discordUserId: discordUser.id },
        select: { serverDisplayName: true },
      }),
    ]);
    const serverDisplayName = resolveDiscordLoginDisplayName({
      guildNickname: guildMember?.nick,
      memberDisplayName: savedMember?.serverDisplayName,
      jinleeDisplayName: savedJinleeUser?.discordDisplayName,
      peiwanDisplayName: savedPeiwan?.serverDisplayName,
      globalName: discordUser.global_name,
      username: discordUser.username,
    });
    const avatarUrl = discordUser.avatar
      ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.${
          discordUser.avatar.startsWith('a_') ? 'gif' : 'png'
        }`
      : null;

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

    const jinleeUser = await ensureJinleeUserForDiscordMember({
      discordUserId: discordUser.id,
      displayName: serverDisplayName,
      avatarUrl,
      profile: {
        username: discordUser.username,
        globalName: discordUser.global_name ?? null,
        discriminator: discordUser.discriminator ?? null,
      },
    });
    await recordAuthLoginEvent({
      request,
      jinleeId: jinleeUser.jinleeId,
      discordUserId: discordUser.id,
      provider: AccountProvider.DISCORD,
    }).catch((error) => console.error('[discord.callback] login audit failed', error));

    const cookieTarget = await getLoginRedirectCookie();
    const redirectTarget = normalizeRedirectTarget(cookieTarget ?? state.next ?? undefined, '/profile');
    const absoluteRedirect = new URL(redirectTarget, origin);
    const response = NextResponse.redirect(absoluteRedirect, { status: 302 });

    attachSessionToResponse(response, {
      jinleeId: jinleeUser.jinleeId,
      discordId: discordUser.id,
      username: discordUser.global_name ?? discordUser.username,
      discriminator: discordUser.discriminator && discordUser.discriminator !== '0' ? discordUser.discriminator : null,
      avatar: discordUser.avatar ?? null,
      sessionVersion: jinleeUser.sessionVersion,
    });

    clearLoginRedirectCookie(response);
    clearLoginStateCookie(response);
    return response;
  } catch (error) {
    console.error('Discord OAuth callback failed', error);
    return buildErrorRedirect(origin, 'discord_oauth');
  }
}
