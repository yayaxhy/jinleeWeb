import { NextResponse } from 'next/server';
import { getDiscordMigrationConfig } from '@/lib/discord-migration';
import { getServerSession } from '@/lib/session';

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

  // Discord has temporarily quarantined the Bot, so it cannot use the
  // `guilds.join` flow. Keep existing links safe by routing signed-in users
  // to the manual invite instead of requesting a scope that will fail.
  return redirectToMigrationPage(origin, 'manual_join');
}
