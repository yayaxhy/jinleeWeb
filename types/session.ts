export type SessionSnapshot = {
  dlmId?: string | null;
  discordId: string;
  username: string;
  discriminator?: string | null;
  avatar?: string | null;
  sessionVersion?: number | null;
};
