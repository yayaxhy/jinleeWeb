export const DISCORD_ID_PATTERN = '\\d{17,20}';
export const DISCORD_ID_RE = new RegExp(`^${DISCORD_ID_PATTERN}$`);

export const normalizeDiscordId = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

export const isDiscordSnowflake = (value: unknown) => DISCORD_ID_RE.test(normalizeDiscordId(value));
