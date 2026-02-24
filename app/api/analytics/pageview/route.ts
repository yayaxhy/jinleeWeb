import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from '@/lib/session';

export const runtime = 'nodejs';

const VISITOR_COOKIE_NAME = 'jl_vid';
const MAX_PATH_LENGTH = 300;
const MAX_REFERRER_LENGTH = 300;
const MAX_USER_AGENT_LENGTH = 500;

const normalizePath = (value: unknown) => {
  if (typeof value !== 'string') return '';
  const raw = value.trim();
  if (!raw) return '';

  try {
    if (/^https?:\/\//i.test(raw)) {
      const url = new URL(raw);
      return `${url.pathname}${url.search}`.slice(0, MAX_PATH_LENGTH);
    }
  } catch {
    // Fall through to raw handling.
  }

  if (!raw.startsWith('/')) return '';
  return raw.slice(0, MAX_PATH_LENGTH);
};

const normalizeReferrer = (value: string | null) => {
  if (!value) return null;
  try {
    const url = new URL(value);
    return `${url.pathname}${url.search}`.slice(0, MAX_REFERRER_LENGTH);
  } catch {
    return value.slice(0, MAX_REFERRER_LENGTH);
  }
};

const isTrackablePath = (path: string) => {
  if (!path) return false;
  if (path.startsWith('/api/')) return false;
  if (path.startsWith('/_next/')) return false;
  return true;
};

const normalizeVisitorId = (raw: string | undefined) => {
  if (!raw) return '';
  const trimmed = raw.trim();
  if (!/^[a-zA-Z0-9_-]{8,128}$/.test(trimmed)) return '';
  return trimmed;
};

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const path = normalizePath(body?.path);
  const fullPath = path;

  if (!isTrackablePath(path)) {
    return new NextResponse(null, { status: 204 });
  }

  const existingVisitorId = normalizeVisitorId(request.cookies.get(VISITOR_COOKIE_NAME)?.value);
  const visitorId = existingVisitorId || crypto.randomUUID().replace(/-/g, '');
  const session = await getServerSession().catch(() => null);

  try {
    await prisma.pageViewEvent.create({
      data: {
        path: fullPath,
        visitorId,
        discordUserId: session?.discordId ?? null,
        referrer: normalizeReferrer(request.headers.get('referer')),
        userAgent: request.headers.get('user-agent')?.slice(0, MAX_USER_AGENT_LENGTH) ?? null,
      },
    });
  } catch (error) {
    console.error('[pageview] create failed:', error);
  }

  const response = new NextResponse(null, { status: 204 });
  if (!existingVisitorId) {
    response.cookies.set({
      name: VISITOR_COOKIE_NAME,
      value: visitorId,
      httpOnly: true,
      sameSite: 'lax',
      secure: true,
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
    });
  }

  return response;
}
