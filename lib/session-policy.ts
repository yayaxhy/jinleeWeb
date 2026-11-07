import type { SessionPayload } from './session-validation';

export const SESSION_COOKIE_NAME = 'dlm_session';
export const SESSION_LOGOUT_COOKIE_NAME = 'dlm_session_logout_at';
// Browser storage limit only: the v2 server session has no time-based expiry.
// Page visits refresh cookie persistence within the browser's allowed window.
export const SESSION_COOKIE_TTL_MS = 1000 * 60 * 60 * 24 * 400;
const SESSION_RENEW_INTERVAL_MS = 1000 * 60 * 60 * 24;

export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: true,
  path: '/',
};

export function isSessionLoggedOut(payload: SessionPayload, logoutAt?: string) {
  if (!logoutAt || !/^\d+$/.test(logoutAt)) return false;
  const cutoff = Number(logoutAt);
  return Number.isSafeInteger(cutoff) && payload.issuedAt <= cutoff;
}

export function shouldRenewSession(payload: SessionPayload, now = Date.now()) {
  if (payload.version === 1) return payload.expiresAt > now;
  return now - payload.renewedAt >= SESSION_RENEW_INTERVAL_MS;
}
