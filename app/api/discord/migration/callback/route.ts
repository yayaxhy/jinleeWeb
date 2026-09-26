import { NextResponse } from 'next/server';
import {
  clearDiscordMigrationStateCookie,
  getDiscordMigrationConfig,
} from '@/lib/discord-migration';
import { getServerSession } from '@/lib/session';

const getOrigin = (request: Request) => process.env.NEXTAUTH_URL ?? new URL(request.url).origin;

function redirectToMigrationPage(origin: string, status?: string) {
  const url = new URL('/discord/migration', origin);
  if (status) url.searchParams.set('status', status);
  const response = NextResponse.redirect(url, { status: 302 });
  clearDiscordMigrationStateCookie(response);
  return response;
}

export async function GET(request: Request) {
  const origin = getOrigin(request);
  const config = getDiscordMigrationConfig();
  if (!config.enabled) return redirectToMigrationPage(origin, 'unavailable');

  const session = await getServerSession();
  if (!session?.discordId) return redirectToMigrationPage(origin, 'login_required');

  // A browser may return here from an authorization tab opened before the
  // quarantine. Do not invoke the Bot's automatic guild-join endpoint.
  return redirectToMigrationPage(origin, 'manual_join');
}
