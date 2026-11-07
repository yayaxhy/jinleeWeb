import { NextRequest, NextResponse } from 'next/server';
import { renewBrowserSession } from '@/lib/session';
import { SESSION_COOKIE_NAME, SESSION_COOKIE_OPTIONS, SESSION_LOGOUT_COOKIE_NAME } from '@/lib/session-policy';

export async function proxy(request: NextRequest) {
  if (request.method !== 'GET') return NextResponse.next();

  try {
    const renewed = await renewBrowserSession(
      request.cookies.get(SESSION_COOKIE_NAME)?.value,
      request.cookies.get(SESSION_LOGOUT_COOKIE_NAME)?.value,
    );
    if (!renewed) return NextResponse.next();

    // SSR must see the renewed token too, including visits just before expiry.
    request.cookies.set(SESSION_COOKIE_NAME, renewed.token);
    const response = NextResponse.next({ request: { headers: request.headers } });
    response.cookies.set({
      ...SESSION_COOKIE_OPTIONS,
      name: SESSION_COOKIE_NAME,
      value: renewed.token,
      expires: new Date(renewed.cookieExpiresAt),
    });
    response.headers.set('Cache-Control', 'private, no-store');
    return response;
  } catch {
    // A failed renewal must not clear the user's still-valid login cookie.
    console.warn('[session] Browser session renewal unavailable');
    return NextResponse.next();
  }
}

export const config = {
  matcher: [{
    source: '/((?!api(?:/|$)|accounts(?:/|$)|_next(?:/|$)|.*\\.).*)',
    has: [{ type: 'cookie', key: 'dlm_session' }],
    missing: [
      { type: 'header', key: 'next-router-prefetch' },
      { type: 'header', key: 'purpose', value: 'prefetch' },
    ],
  }],
};
