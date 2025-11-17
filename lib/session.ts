import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import crypto from 'crypto';
import type { SessionSnapshot } from '@/types/session';

export type AppSession = SessionSnapshot;

type SessionPayload = AppSession & {
  issuedAt: number;
  expiresAt: number;
  version: 1;
};

const SESSION_COOKIE_NAME = 'jinlee_session';
const LOGIN_REDIRECT_COOKIE = 'discord_login_next';
const LOGIN_STATE_COOKIE = 'discord_login_state';
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

const getSecret = () => {
  const secret = process.env.SESSION_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error('SESSION_SECRET (or NEXTAUTH_SECRET) must be set');
  }
  return secret;
};

const base64UrlEncode = (data: Buffer) => data.toString('base64url');
const base64UrlDecode = (value: string) => Buffer.from(value, 'base64url');

const signPayload = (payload: string) => {
  return crypto.createHmac('sha256', getSecret()).update(payload).digest('base64url');
};

const encodeSessionToken = (payload: SessionPayload) => {
  const json = Buffer.from(JSON.stringify(payload));
  const encoded = base64UrlEncode(json);
  const signature = signPayload(encoded);
  return `${encoded}.${signature}`;
};

const decodeSessionToken = (token?: string | null): SessionPayload | null => {
  if (!token) return null;
  const [encoded, signature] = token.split('.');
  if (!encoded || !signature) return null;
  const expected = signPayload(encoded);
  // Prevent subtle timing attacks when possible
  const valid =
    expected.length === signature.length &&
    crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  if (!valid) return null;
  try {
    const payload = JSON.parse(base64UrlDecode(encoded).toString()) as SessionPayload;
    if (payload.expiresAt < Date.now()) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
};

export const getServerSession = (): AppSession | null => {
  const token = cookies().get(SESSION_COOKIE_NAME)?.value;
  const payload = decodeSessionToken(token);
  if (!payload) return null;
  return {
    discordId: payload.discordId,
    username: payload.username,
    discriminator: payload.discriminator ?? null,
    avatar: payload.avatar ?? null,
  };
};

export const attachSessionToResponse = (response: NextResponse, session: AppSession) => {
  const payload: SessionPayload = {
    ...session,
    issuedAt: Date.now(),
    expiresAt: Date.now() + SESSION_TTL_MS,
    version: 1,
  };
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: encodeSessionToken(payload),
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

export const getLoginRedirectCookie = () => cookies().get(LOGIN_REDIRECT_COOKIE)?.value ?? null;

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

export const getLoginStateCookie = () => cookies().get(LOGIN_STATE_COOKIE)?.value ?? null;

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

export const generateLoginState = () => crypto.randomBytes(16).toString('hex');

export const normalizeRedirectTarget = (value?: string | null, fallback = '/profile') => {
  if (!value) return fallback;
  if (value.startsWith('/')) return value;
  return fallback;
};

export const summarizeSession = (session: AppSession | null) => {
  if (!session) return null;
  const { discordId, username, discriminator, avatar } = session;
  return { discordId, username, discriminator, avatar };
};
