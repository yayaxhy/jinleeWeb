import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import type { SessionSnapshot } from '@/types/session';
import { decodeSessionToken, encodeSessionToken, hasCurrentBrowserSessionIdentity, type SessionPayload } from './session-validation';
import {
  isSessionLoggedOut,
  SESSION_COOKIE_NAME,
  SESSION_COOKIE_OPTIONS,
  SESSION_LOGOUT_COOKIE_NAME,
  SESSION_COOKIE_TTL_MS,
  shouldRenewSession,
} from './session-policy';

export type AppSession = SessionSnapshot;

const LOGIN_REDIRECT_COOKIE = 'discord_login_next';
const LOGIN_STATE_COOKIE = 'discord_login_state';
const WECHAT_WEB_LOGIN_REDIRECT_COOKIE = 'wechat_web_login_next';
const WECHAT_WEB_LOGIN_STATE_COOKIE = 'wechat_web_login_state';

const getSecret = () => {
  const secret = process.env.SESSION_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error('SESSION_SECRET (or NEXTAUTH_SECRET) must be set');
  }
  return secret;
};

const sessionIdentitySelect = {
  dlmId: true, discordUserId: true, sessionVersion: true,
  accountBindings: { select: { dlmId: true, provider: true, providerUserId: true, createdAt: true } },
} as const;

export const getSessionForToken = async (token?: string, logoutAt?: string): Promise<AppSession | null> => {
  if (!token) return null;
  const payload = decodeSessionToken(token, getSecret());
  if (!payload || isSessionLoggedOut(payload, logoutAt)) return null;
  const dlmUser = payload.dlmId
    ? await prisma.dlmUser.findUnique({ where: { dlmId: payload.dlmId }, select: sessionIdentitySelect })
    : payload.discordId && (payload.authProvider ?? 'discord') === 'discord'
      ? (await prisma.accountBinding.findUnique({
          where: { provider_providerUserId: { provider: 'DISCORD', providerUserId: payload.discordId } },
          select: { dlmUser: { select: sessionIdentitySelect } },
        }))?.dlmUser ?? null
      : null;
  if (!hasCurrentBrowserSessionIdentity(payload, dlmUser) || !dlmUser) return null;
  return {
    dlmId: dlmUser.dlmId,
    authProvider: payload.authProvider ?? 'discord',
    discordId: payload.discordId ?? null,
    username: payload.username,
    discriminator: payload.discriminator ?? null,
    avatar: payload.avatar ?? null,
    sessionVersion: dlmUser.sessionVersion,
  };
};

export const getServerSession = async (): Promise<AppSession | null> => {
  const cookieStore = await cookies();
  return getSessionForToken(
    cookieStore.get(SESSION_COOKIE_NAME)?.value,
    cookieStore.get(SESSION_LOGOUT_COOKIE_NAME)?.value,
  );
};

export const renewBrowserSession = async (token?: string, logoutAt?: string) => {
  if (!token) return null;
  const now = Date.now();
  const secret = getSecret();
  const payload = decodeSessionToken(token, secret, now);
  if (!payload || isSessionLoggedOut(payload, logoutAt) || !shouldRenewSession(payload, now)) return null;
  const session = await getSessionForToken(token, logoutAt);
  if (!session) return null;

  const renewed: SessionPayload = {
    ...session,
    // Keep the original authentication time for binding and logout checks.
    issuedAt: payload.issuedAt,
    renewedAt: now,
    version: 2,
  };
  return { token: encodeSessionToken(renewed, secret), cookieExpiresAt: now + SESSION_COOKIE_TTL_MS };
};

export const attachSessionToResponse = (response: NextResponse, session: AppSession) => {
  const now = Date.now();
  const payload: SessionPayload = {
    ...session,
    sessionVersion: session.sessionVersion ?? 1,
    issuedAt: now,
    renewedAt: now,
    version: 2,
  };
  response.cookies.set({
    ...SESSION_COOKIE_OPTIONS,
    name: SESSION_COOKIE_NAME,
    value: encodeSessionToken(payload, getSecret()),
    expires: new Date(now + SESSION_COOKIE_TTL_MS),
  });
};

export const destroySession = (response: NextResponse) => {
  response.cookies.set({
    ...SESSION_COOKIE_OPTIONS,
    name: SESSION_COOKIE_NAME,
    value: '',
    expires: new Date(0),
  });
  // A late response from a request started before logout must not log back in.
  // Renewal never clears this marker; a real login has a newer issuedAt.
  const now = Date.now();
  response.cookies.set({
    ...SESSION_COOKIE_OPTIONS,
    name: SESSION_LOGOUT_COOKIE_NAME,
    value: String(now),
    expires: new Date(now + SESSION_COOKIE_TTL_MS),
  });
};

export const setLoginRedirectCookie = (response: NextResponse, target: string) => {
  response.cookies.set({
    name: LOGIN_REDIRECT_COOKIE,
    value: target,
    httpOnly: true,
    sameSite: 'lax',
    secure: true,
    path: '/',
    maxAge: 60 * 10, // 10 minutes
  });
};

export const getLoginRedirectCookie = async () =>
  (await cookies()).get(LOGIN_REDIRECT_COOKIE)?.value ?? null;

export const clearLoginRedirectCookie = (response: NextResponse) => {
  response.cookies.set({
    name: LOGIN_REDIRECT_COOKIE,
    value: '',
    path: '/',
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    expires: new Date(0),
  });
};

export const setLoginStateCookie = (response: NextResponse, value: string) => {
  response.cookies.set({
    name: LOGIN_STATE_COOKIE,
    value,
    httpOnly: true,
    sameSite: 'lax',
    secure: true,
    path: '/',
    maxAge: 60 * 10,
  });
};

export const getLoginStateCookie = async () =>
  (await cookies()).get(LOGIN_STATE_COOKIE)?.value ?? null;

export const clearLoginStateCookie = (response: NextResponse) => {
  response.cookies.set({
    name: LOGIN_STATE_COOKIE,
    value: '',
    path: '/',
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    expires: new Date(0),
  });
};

export const setWechatWebLoginRedirectCookie = (response: NextResponse, target: string) => {
  response.cookies.set({
    name: WECHAT_WEB_LOGIN_REDIRECT_COOKIE,
    value: target,
    httpOnly: true,
    sameSite: 'lax',
    secure: true,
    path: '/',
    maxAge: 60 * 10,
  });
};

export const getWechatWebLoginRedirectCookie = async () =>
  (await cookies()).get(WECHAT_WEB_LOGIN_REDIRECT_COOKIE)?.value ?? null;

export const clearWechatWebLoginRedirectCookie = (response: NextResponse) => {
  response.cookies.set({
    name: WECHAT_WEB_LOGIN_REDIRECT_COOKIE,
    value: '',
    path: '/',
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    expires: new Date(0),
  });
};

export const setWechatWebLoginStateCookie = (response: NextResponse, value: string) => {
  response.cookies.set({
    name: WECHAT_WEB_LOGIN_STATE_COOKIE,
    value,
    httpOnly: true,
    sameSite: 'lax',
    secure: true,
    path: '/',
    maxAge: 60 * 10,
  });
};

export const getWechatWebLoginStateCookie = async () =>
  (await cookies()).get(WECHAT_WEB_LOGIN_STATE_COOKIE)?.value ?? null;

export const clearWechatWebLoginStateCookie = (response: NextResponse) => {
  response.cookies.set({
    name: WECHAT_WEB_LOGIN_STATE_COOKIE,
    value: '',
    path: '/',
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    expires: new Date(0),
  });
};

export const generateLoginState = () => crypto.randomBytes(16).toString('hex');

export const normalizeRedirectTarget = (value?: string | null, fallback = '/profile') => {
  if (!value) return fallback;
  if (value.startsWith('/') && !value.startsWith('//') && !value.startsWith('/\\')) return value;
  return fallback;
};

export const summarizeSession = (session: AppSession | null) => {
  if (!session) return null;
  const { dlmId, authProvider, discordId, username, discriminator, avatar, sessionVersion } = session;
  return {
    dlmId: dlmId ?? null,
    authProvider: authProvider ?? 'discord',
    discordId: discordId ?? null,
    username,
    discriminator,
    avatar,
    sessionVersion: sessionVersion ?? null,
  };
};
