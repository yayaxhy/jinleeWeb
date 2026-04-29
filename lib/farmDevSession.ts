import { prisma } from '@/lib/prisma';
import type { AppSession } from '@/lib/session';

const LOCAL_HOST_PREFIXES = ['localhost', '127.0.0.1'];

const isLocalFarmHost = (host?: string | null) => {
  if (!host) return false;
  return LOCAL_HOST_PREFIXES.some((prefix) => host === prefix || host.startsWith(`${prefix}:`));
};

export async function resolveFarmSession(session: AppSession | null, host?: string | null): Promise<AppSession | null> {
  if (session?.discordId) return session;
  if (!isLocalFarmHost(host)) return null;

  const preferredDiscordId = process.env.LOCAL_FARM_DEV_DISCORD_ID?.trim();

  const member = preferredDiscordId
    ? await prisma.member.findUnique({
        where: { discordUserId: preferredDiscordId },
        select: {
          discordUserId: true,
          serverDisplayName: true,
        },
      })
    : await prisma.member.findFirst({
        orderBy: [{ discordUserId: 'asc' }],
        select: {
          discordUserId: true,
          serverDisplayName: true,
        },
      });

  if (!member) return null;

  return {
    discordId: member.discordUserId,
    username: member.serverDisplayName ?? 'Local Farm Dev',
    discriminator: null,
    avatar: null,
  };
}
