import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';

export type DiscordChangeProof = {
  version: 1; requestId: string; sourceDlmId: string; sourceSessionVersion: number;
  csrf: string; expiresAt: number; targetDlmId?: string; targetSessionVersion?: number;
  targetDiscordId?: string;
};
export const DISCORD_CHANGE_COOKIE = 'discord_account_change';
export const DISCORD_CHANGE_TTL_SECONDS = 600;
export const discordChangeSecret = () => {
  const secret = process.env.SESSION_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error('SESSION_SECRET (or NEXTAUTH_SECRET) must be set');
  return secret;
};
export function createDiscordChangeProof(sourceDlmId: string, sourceSessionVersion: number, now = Date.now()): DiscordChangeProof {
  return { version: 1, requestId: randomUUID(), sourceDlmId, sourceSessionVersion, csrf: randomUUID(), expiresAt: now + DISCORD_CHANGE_TTL_SECONDS * 1000 };
}
export function encodeDiscordChangeProof(proof: DiscordChangeProof, secret = discordChangeSecret()) {
  const body = Buffer.from(JSON.stringify(proof)).toString('base64url');
  return `${body}.${createHmac('sha256', secret).update(body).digest('base64url')}`;
}
export function decodeDiscordChangeProof(token: string | undefined | null, secret = discordChangeSecret(), now = Date.now()): DiscordChangeProof | null {
  if (!token || token.length > 4096) return null;
  const parts = token.split('.'); if (parts.length !== 2) return null;
  const [body, signature] = parts;
  const expected = Buffer.from(createHmac('sha256', secret).update(body).digest('base64url'));
  const supplied = Buffer.from(signature);
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, 'base64url').toString()) as DiscordChangeProof;
    if (p.version !== 1 || !p.requestId || !p.sourceDlmId || !p.csrf || !Number.isSafeInteger(p.sourceSessionVersion) || p.sourceSessionVersion < 1 ||
      !Number.isFinite(p.expiresAt) || p.expiresAt <= now || p.expiresAt > now + DISCORD_CHANGE_TTL_SECONDS * 1000) return null;
    const targetFields = [p.targetDlmId, p.targetSessionVersion, p.targetDiscordId];
    if (targetFields.some(v => v !== undefined) && (!p.targetDlmId || !Number.isSafeInteger(p.targetSessionVersion) || (p.targetSessionVersion ?? 0) < 1 || !p.targetDiscordId || !/^\d{15,22}$/.test(p.targetDiscordId))) return null;
    return p;
  } catch { return null; }
}
