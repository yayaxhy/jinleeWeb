const ADMIN_DISCORD_IDS = (process.env.ADMIN_DISCORD_IDS ?? '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

export const getAdminDiscordIds = () => ADMIN_DISCORD_IDS;

export const isAdminDiscordId = (discordId?: string | null) => {
  if (!discordId) return false;
  return ADMIN_DISCORD_IDS.includes(discordId);
};
