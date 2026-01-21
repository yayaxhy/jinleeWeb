const DEFAULT_ADMIN_IDS = ['308164614846414851', '1008032640445710447'];

const ADMIN_DISCORD_IDS = Array.from(
  new Set(
    [...DEFAULT_ADMIN_IDS, ...(process.env.ADMIN_DISCORD_IDS ?? '').split(',')]
      .map((value) => value.trim())
      .filter(Boolean),
  ),
);

export const getAdminDiscordIds = () => ADMIN_DISCORD_IDS;

export const isAdminDiscordId = (discordId?: string | null) => {
  if (!discordId) return false;
  return ADMIN_DISCORD_IDS.includes(discordId);
};
