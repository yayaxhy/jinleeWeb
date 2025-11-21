const DISCORD_API_BASE = 'https://discord.com/api';
const TOKEN_URL = `${DISCORD_API_BASE}/oauth2/token`;
const USER_URL = `${DISCORD_API_BASE}/users/@me`;
const GUILD_MEMBER_URL = (guildId: string) => `${DISCORD_API_BASE}/users/@me/guilds/${guildId}/member`;

export type DiscordTokenResponse = {
  access_token: string;
  token_type: string;
  refresh_token?: string;
  scope: string;
  expires_in: number;
};

export type DiscordUser = {
  id: string;
  username: string;
  global_name?: string | null;
  discriminator?: string | null;
  avatar?: string | null;
};

export type DiscordGuildMember = {
  nick?: string | null;
  communication_disabled_until?: string | null;
  joined_at?: string;
  avatar?: string | null;
  user?: DiscordUser;
};

const getClientCredentials = () => {
  const clientId = process.env.DISCORD_CLIENT_ID;
  const clientSecret = process.env.DISCORD_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('DISCORD_CLIENT_ID and DISCORD_CLIENT_SECRET must be configured');
  }
  return { clientId, clientSecret };
};

export const exchangeCodeForTokens = async (code: string, redirectUri: string): Promise<DiscordTokenResponse> => {
  const { clientId, clientSecret } = getClientCredentials();
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
  });

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    cache: 'no-store',
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to exchange Discord code: ${response.status} ${errorText}`);
  }

  return (await response.json()) as DiscordTokenResponse;
};

export const fetchDiscordUser = async (accessToken: string, tokenType = 'Bearer'): Promise<DiscordUser> => {
  const response = await fetch(USER_URL, {
    headers: { Authorization: `${tokenType} ${accessToken}` },
    cache: 'no-store',
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to fetch Discord user: ${response.status} ${errorText}`);
  }

  return (await response.json()) as DiscordUser;
};

export const fetchGuildMember = async (
  accessToken: string,
  guildId: string,
  tokenType = 'Bearer',
): Promise<DiscordGuildMember | null> => {
  if (!guildId) return null;
  const response = await fetch(GUILD_MEMBER_URL(guildId), {
    headers: { Authorization: `${tokenType} ${accessToken}` },
    cache: 'no-store',
  });
  if (response.status === 404 || response.status === 403) {
    return null;
  }
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to fetch Discord guild member: ${response.status} ${errorText}`);
  }
  return (await response.json()) as DiscordGuildMember;
};

