import { NextResponse } from 'next/server';
import {
  clearDiscordMigrationStateCookie,
  getDiscordMigrationConfig,
  getDiscordMigrationStateCookie,
} from '@/lib/discord-migration';
import { exchangeCodeForTokens, fetchDiscordUser } from '@/lib/discord';
import { InternalBotError, postInternalBot } from '@/lib/internal-bot';
import { getServerSession } from '@/lib/session';

type JoinMigrationResponse = {
  ok: true;
  joined: boolean;
  alreadyMember: boolean;
  nicknameSync: 'synced' | 'not_available' | 'failed';
};

const getOrigin = (request: Request) => process.env.NEXTAUTH_URL ?? new URL(request.url).origin;

function redirectToMigrationPage(origin: string, status?: string) {
  const url = new URL('/discord/migration', origin);
  if (status) url.searchParams.set('status', status);
  const response = NextResponse.redirect(url, { status: 302 });
  clearDiscordMigrationStateCookie(response);
  return response;
}

function redirectToProfile(origin: string) {
  const response = NextResponse.redirect(new URL('/profile', origin), { status: 302 });
  clearDiscordMigrationStateCookie(response);
  return response;
}

export async function GET(request: Request) {
  const origin = getOrigin(request);
  const url = new URL(request.url);
  const config = getDiscordMigrationConfig();
  if (!config.enabled) return redirectToMigrationPage(origin, 'unavailable');

  if (url.searchParams.get('error')) {
    return redirectToMigrationPage(origin, 'authorization_declined');
  }

  const code = url.searchParams.get('code');
  const returnedState = url.searchParams.get('state');
  const expectedState = await getDiscordMigrationStateCookie();
  if (!code || !returnedState || !expectedState || returnedState !== expectedState) {
    // An older authorization tab may return after the user has already begun
    // a newer authorization flow. Keep the state validation, but return the
    // user quietly to a fresh migration page instead of showing an error.
    return redirectToMigrationPage(origin);
  }

  const session = await getServerSession();
  if (!session?.discordId) return redirectToMigrationPage(origin, 'login_required');

  try {
    const redirectUri = `${origin}/api/discord/migration/callback`;
    const tokens = await exchangeCodeForTokens(code, redirectUri);
    const scopes = new Set(tokens.scope.split(/\s+/).filter(Boolean));
    if (!scopes.has('guilds.join')) {
      return redirectToMigrationPage(origin, 'missing_authorization');
    }

    const discordUser = await fetchDiscordUser(tokens.access_token, tokens.token_type);
    // Do not allow a browser session for account A to authorize account B into
    // the target guild. The user can log out and sign in with the intended account.
    if (discordUser.id !== session.discordId) {
      return redirectToMigrationPage(origin, 'account_mismatch');
    }

    const result = await postInternalBot<JoinMigrationResponse>('/internal/discord/migration/join', {
      discordId: discordUser.id,
      accessToken: tokens.access_token,
    });
    if (result.alreadyMember) {
      return redirectToProfile(origin);
    }
    if (result.nicknameSync === 'failed') {
      return redirectToMigrationPage(origin, 'joined_nickname_pending');
    }
    return redirectToMigrationPage(origin, 'joined');
  } catch (error) {
    const code = error instanceof InternalBotError ? error.code : 'unexpected_error';
    console.error('[discord-migration] join failed', { code });
    return redirectToMigrationPage(origin, code);
  }
}
