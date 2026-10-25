type NotificationKind = 'critical' | 'message' | 'dispatch';

/**
 * The guild currently uses Discord DMs only. Keep this callable boundary for
 * existing order/chat callers, without reading user data or contacting WeChat.
 * In-app conversations and system notifications are created by their callers.
 */
export async function notifyMiniProgramUser(
  dlmId: string | null | undefined,
  kind: NotificationKind,
  title: string,
  body: string,
  page: string,
) {
  void [dlmId, kind, title, body, page];
  return { sent: false, reason: 'channel_disabled' as const };
}

export async function notifyDispatchSubscribers(title: string, body: string) {
  void [title, body];
  return { sent: false, reason: 'channel_disabled' as const };
}
