import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import type { SessionSnapshot } from '@/types/session';
import { decodeSessionToken, encodeSessionToken, hasCurrentBrowserSessionIdentity, type SessionPayload } from './session-validation';

export type AppSession = SessionSnapshot;

const SESSION_COOKIE_NAME = 'dlm_session';
const LOGIN_REDIRECT_COOKIE = 'discord_login_next';
const LOGIN_STATE_COOKIE = 'discord_login_state';
const WECHAT_WEB_LOGIN_REDIRECT_COOKIE = 'wechat_web_login_next';
const WECHAT_WEB_LOGIN_STATE_COOKIE = 'wechat_web_login_state';
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

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

export const getServerSession = async (): Promise<AppSession | null> => {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  const payload = decodeSessionToken(token, getSecret());
  if (!payload) return null;
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

export const attachSessionToResponse = (response: NextResponse, session: AppSession) => {
  const payload: SessionPayload = {
    ...session,
    sessionVersion: session.sessionVersion ?? 1,
    issuedAt: Date.now(),
    expiresAt: Date.now() + SESSION_TTL_MS,
    version: 1,
  };
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: encodeSessionToken(payload, getSecret()),
    httpOnly: true,
    sameSite: 'lax',
    secure: true,
    path: '/',
    expires: new Date(payload.expiresAt),
  });
};

export const destroySession = (response: NextResponse) => {
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: '',
    path: '/',
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    expires: new Date(0),
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
