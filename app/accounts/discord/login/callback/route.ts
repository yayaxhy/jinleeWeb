import { NextResponse } from 'next/server';

const buildRedirect = (request: Request) => {
  const incomingUrl = new URL(request.url);
  const target = new URL('/api/auth/callback/discord', incomingUrl.origin);
  target.search = incomingUrl.search;
  return NextResponse.redirect(target, { status: 307 });
};

export function GET(request: Request) {
  return buildRedirect(request);
}

export function POST(request: Request) {
  return buildRedirect(request);
}

