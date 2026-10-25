import { createDiscordChangeProof, type DiscordChangeProof } from './discord-change-proof';
export const WECHAT_ATTACH_COOKIE = 'wechat_account_attach';

/** Both identities are server-verified: the website session owns the target,
 * and this request's WeChat OAuth callback owns the source. No merge runs here. */
export function finishWechatAttachmentProof(
  intent: DiscordChangeProof,
  target: { dlmId: string; sessionVersion: number; discordUserId: string | null },
  wechat: { dlmId: string; sessionVersion: number },
  csrf: string | null,
  now = Date.now(),
): DiscordChangeProof {
  if (intent.csrf !== csrf || intent.expiresAt <= now || target.dlmId !== intent.sourceDlmId ||
      target.sessionVersion !== intent.sourceSessionVersion || !target.discordUserId || intent.targetDlmId) {
    throw new Error('wechat_attachment_state_changed');
  }
  return { ...createDiscordChangeProof(wechat.dlmId, wechat.sessionVersion, now), requestId: intent.requestId,
    csrf: intent.csrf, expiresAt: intent.expiresAt, targetDlmId: target.dlmId,
    targetSessionVersion: target.sessionVersion, targetDiscordId: target.discordUserId };
}
