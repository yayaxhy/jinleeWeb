import crypto from 'node:crypto';
import type { SessionSnapshot } from '../types/session';

export type SessionPayload = SessionSnapshot & { issuedAt: number; expiresAt: number; version: 1 };
export type SessionBinding = { dlmId: string; provider: string; providerUserId: string; createdAt: Date };
export type SessionIdentity = { dlmId: string; discordUserId: string | null; sessionVersion: number; accountBindings: SessionBinding[] };

// Keep the existing v1 JSON/base64url/HMAC format; existing valid cookies remain readable.
export function encodeSessionToken(payload: SessionPayload, secret: string) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(encoded).digest('base64url');
  return `${encoded}.${signature}`;
}

export function decodeSessionToken(token: string, secret: string, now = Date.now()): SessionPayload | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encoded, signature] = parts;
  if (!encoded || !signature) return null;
  const expected = crypto.createHmac('sha256', secret).update(encoded).digest('base64url');
  const expectedBytes = Buffer.from(expected); const signatureBytes = Buffer.from(signature);
  if (expectedBytes.length !== signatureBytes.length || !crypto.timingSafeEqual(expectedBytes, signatureBytes)) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString()) as SessionPayload;
    if (!payload || payload.version !== 1 || !Number.isFinite(payload.issuedAt) || !Number.isFinite(payload.expiresAt) || payload.expiresAt < now) return null;
    return payload;
  } catch { return null; }
}

export function hasCurrentBrowserSessionIdentity(payload: SessionPayload, identity: SessionIdentity | null): boolean {
  if (!identity || (payload.dlmId && payload.dlmId !== identity.dlmId) ||
      (payload.sessionVersion ?? 1) !== identity.sessionVersion) return false;
  // Never silently give an old browser the newly bound Discord identity.
  if ((payload.discordId ?? null) !== identity.discordUserId) return false;
  const provider = payload.authProvider ?? 'discord';
  if (provider !== 'discord' && provider !== 'wechat_web') return false;
  if (provider === 'discord' && !payload.discordId) return false;
  // Legacy Discord-only cookies are accepted only for a binding already present
  // at issuance. They must not bootstrap a new account after an unlink/deletion.
  if (!payload.dlmId && provider !== 'discord') return false;
  return identity.accountBindings.some(binding => binding.dlmId === identity.dlmId &&
    binding.provider === (provider === 'discord' ? 'DISCORD' : 'WECHAT_WEB') &&
    (provider !== 'discord' || binding.providerUserId === payload.discordId) &&
    binding.createdAt.getTime() <= payload.issuedAt);
}

export function hasCurrentWechatProgramBinding(session: {
  dlmId: string; providerAccountId: string | null;
  dlmUser: { dlmId: string };
  providerAccount: { id: string; dlmId: string; provider: string } | null;
}) {
  const binding = session.providerAccount;
  // A token with no provider proof must log in again; do not guess its owner.
  return !!binding && !!session.providerAccountId && binding.id === session.providerAccountId &&
    binding.provider === 'WECHAT_MINIPROGRAM' && binding.dlmId === session.dlmId && session.dlmUser.dlmId === session.dlmId;
}
