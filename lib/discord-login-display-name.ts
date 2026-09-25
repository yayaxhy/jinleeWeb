type DiscordLoginDisplayNames = {
  guildNickname?: string | null;
  memberDisplayName?: string | null;
  jinleeDisplayName?: string | null;
  peiwanDisplayName?: string | null;
  globalName?: string | null;
  username: string;
};

/** A missing guild nickname must not replace a saved business name with a username. */
export function resolveDiscordLoginDisplayName(names: DiscordLoginDisplayNames): string {
  return names.guildNickname?.trim()
    || names.memberDisplayName?.trim()
    || names.jinleeDisplayName?.trim()
    || names.peiwanDisplayName?.trim()
    || names.globalName?.trim()
    || names.username;
}
