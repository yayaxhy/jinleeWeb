import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

const DEFAULT_TARGET_GUILD_ID = '1551704194438922310';
const MIGRATION_STATE_COOKIE = 'discord_migration_state';
const SNOWFLAKE_RE = /^\d{17,20}$/;

export type DiscordMigrationConfig = {
  enabled: boolean;
  targetGuildId: string;
  targetGuildName: string;
};

export function getDiscordMigrationConfig(): DiscordMigrationConfig {
  const targetGuildId = (process.env.DISCORD_MIGRATION_TARGET_GUILD_ID ?? DEFAULT_TARGET_GUILD_ID).trim();
  const enabled = process.env.DISCORD_MIGRATION_ENABLED === 'true';

  if (enabled && !SNOWFLAKE_RE.test(targetGuildId)) {
    throw new Error('DISCORD_MIGRATION_TARGET_GUILD_ID must be a valid guild ID');
  }

  return {
    enabled,
    targetGuildId,
    targetGuildName: (process.env.DISCORD_MIGRATION_TARGET_GUILD_NAME ?? '新服务器').trim() || '新服务器',
  };
}

export function setDiscordMigrationStateCookie(response: NextResponse, value: string) {
  response.cookies.set({
    name: MIGRATION_STATE_COOKIE,
    value,
    httpOnly: true,
    sameSite: 'lax',
    secure: true,
    path: '/',
    maxAge: 60 * 10,
  });
}

export async function getDiscordMigrationStateCookie() {
  return (await cookies()).get(MIGRATION_STATE_COOKIE)?.value ?? null;
}

export function clearDiscordMigrationStateCookie(response: NextResponse) {
  response.cookies.set({
    name: MIGRATION_STATE_COOKIE,
    value: '',
    httpOnly: true,
    sameSite: 'lax',
    secure: true,
    path: '/',
    expires: new Date(0),
  });
}
