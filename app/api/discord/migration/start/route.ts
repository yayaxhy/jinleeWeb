import { NextResponse } from 'next/server';
import { getDiscordMigrationConfig, setDiscordMigrationStateCookie } from '@/lib/discord-migration';
import { generateLoginState, getServerSession } from '@/lib/session';

const DISCORD_AUTHORIZE_URL = 'https://discord.com/oauth2/authorize';
const DISCORD_MIGRATION_SCOPE = 'identify guilds.join';

const getOrigin = (request: Request) => process.env.NEXTAUTH_URL ?? new URL(request.url).origin;

function redirectToMigrationPage(origin: string, status: string) {
  const url = new URL('/discord/migration', origin);
  url.searchParams.set('status', status);
  return NextResponse.redirect(url, { status: 302 });
}

export async function GET(request: Request) {
  const origin = getOrigin(request);
  const config = getDiscordMigrationConfig();
  if (!config.enabled) return redirectToMigrationPage(origin, 'unavailable');

  const session = await getServerSession();
  if (!session?.discordId) {
    const loginUrl = new URL('/accounts/discord/login', origin);
    loginUrl.searchParams.set('callbackUrl', '/discord/migration');
    return NextResponse.redirect(loginUrl, { status: 302 });
  }

  const clientId = process.env.DISCORD_CLIENT_ID?.trim();
  if (!clientId) return redirectToMigrationPage(origin, 'configuration_error');

  const state = generateLoginState();
  const authorizeUrl = new URL(DISCORD_AUTHORIZE_URL);
  authorizeUrl.searchParams.set('client_id', clientId);
  authorizeUrl.searchParams.set('redirect_uri', `${origin}/api/discord/migration/callback`);
  authorizeUrl.searchParams.set('response_type', 'code');
  authorizeUrl.searchParams.set('scope', DISCORD_MIGRATION_SCOPE);
  authorizeUrl.searchParams.set('prompt', 'consent');
  authorizeUrl.searchParams.set('state', state);

  const response = NextResponse.redirect(authorizeUrl, { status: 302 });
  setDiscordMigrationStateCookie(response, state);
  return response;
}
