import crypto from 'node:crypto';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const COOKIE_NAME = 'dlm_readonly_portal';
const TTL_MS = 1000 * 60 * 60 * 24 * 7;

type PortalPayload = {
  dlmId: string;
  sessionVersion: number;
  issuedAt: number;
  expiresAt: number;
  version: 1;
};

const getSecret = () => {
  const secret = process.env.DLM_PORTAL_SESSION_SECRET ?? process.env.SESSION_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error('DLM_PORTAL_SESSION_SECRET (or SESSION_SECRET) must be set');
  return secret;
};

const sign = (encoded: string) => crypto.createHmac('sha256', getSecret()).update(encoded).digest('base64url');

const decode = (token?: string | null): PortalPayload | null => {
  if (!token) return null;
  const [encoded, signature] = token.split('.');
  if (!encoded || !signature) return null;
  const expected = sign(encoded);
  if (expected.length !== signature.length || !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) {
    return null;
  }
  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString()) as PortalPayload;
    if (payload.version !== 1 || !payload.dlmId || payload.expiresAt <= Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
};

const encode = (payload: PortalPayload) => {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${encoded}.${sign(encoded)}`;
};

export const getDlmPortalSession = async () => {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  const payload = decode(token);
  if (!payload) return null;
  const user = await prisma.dlmUser.findUnique({
    where: { dlmId: payload.dlmId },
    select: { dlmId: true, sessionVersion: true },
  });
  if (!user || user.sessionVersion !== payload.sessionVersion) return null;
  return { dlmId: user.dlmId };
};

export const attachDlmPortalSession = (
  response: NextResponse,
  session: { dlmId: string; sessionVersion: number },
) => {
  const payload: PortalPayload = {
    dlmId: session.dlmId,
    sessionVersion: session.sessionVersion,
    issuedAt: Date.now(),
    expiresAt: Date.now() + TTL_MS,
    version: 1,
  };
  response.cookies.set({
    name: COOKIE_NAME,
    value: encode(payload),
    httpOnly: true,
    sameSite: 'lax',
    secure: true,
    path: '/dlm',
    expires: new Date(payload.expiresAt),
  });
};

export const destroyDlmPortalSession = (response: NextResponse) => {
  response.cookies.set({
    name: COOKIE_NAME,
    value: '',
    httpOnly: true,
    sameSite: 'lax',
    secure: true,
    path: '/dlm',
    expires: new Date(0),
  });
};
