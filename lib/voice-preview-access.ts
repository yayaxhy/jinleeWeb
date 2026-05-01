export const VOICE_PREVIEW_TEST_USER_ID = '734159747367829636';

export function canAccessVoicePreview(discordUserId: string | null | undefined) {
  return String(discordUserId ?? '').trim() === VOICE_PREVIEW_TEST_USER_ID;
}
