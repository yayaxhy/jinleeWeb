export type SessionSnapshot = {
  dlmId?: string | null;
  /** The identity provider that created this browser session. */
  authProvider?: 'discord' | 'wechat_web';
  /**
   * A WeChat-only account does not have a Discord ID. Keep this nullable so
   * existing back-office checks continue to require Discord explicitly.
   */
  discordId?: string | null;
  username: string;
  discriminator?: string | null;
  avatar?: string | null;
  sessionVersion?: number | null;
};
