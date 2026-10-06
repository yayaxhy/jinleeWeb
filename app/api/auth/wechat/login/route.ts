import { NextResponse } from 'next/server';
import {
  generateLoginState,
  normalizeRedirectTarget,
  setWechatWebLoginRedirectCookie,
  setWechatWebLoginStateCookie,
} from '@/lib/session';

const WECHAT_QR_AUTHORIZE_URL = 'https://open.weixin.qq.com/connect/qrconnect';

const getOrigin = (request: Request) => {
  const configured = process.env.SITE_ORIGIN?.trim() || process.env.NEXTAUTH_URL?.trim();
  if (!configured) return new URL(request.url).origin;

  try {
    return new URL(configured).origin;
  } catch {
    return new URL(request.url).origin;
  }
};

const isConfigured = () =>
  Boolean(process.env.WECHAT_WEB_APP_ID?.trim() && process.env.WECHAT_WEB_APP_SECRET?.trim());

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = getOrigin(request);
  const callbackUrl = normalizeRedirectTarget(url.searchParams.get('callbackUrl'));

  if (!isConfigured()) {
    const loginUrl = new URL('/accounts/login', origin);
    loginUrl.searchParams.set('callbackUrl', callbackUrl);
    loginUrl.searchParams.set('error', 'wechat_not_configured');
    return NextResponse.redirect(loginUrl, { status: 302 });
  }

  const redirectUri = `${origin}/api/auth/callback/wechat`;
  const state = generateLoginState();
  const authorizeUrl = new URL(WECHAT_QR_AUTHORIZE_URL);
  authorizeUrl.searchParams.set('appid', process.env.WECHAT_WEB_APP_ID!.trim());
  authorizeUrl.searchParams.set('redirect_uri', redirectUri);
  authorizeUrl.searchParams.set('response_type', 'code');
  authorizeUrl.searchParams.set('scope', 'snsapi_login');
  authorizeUrl.searchParams.set('state', state);
  authorizeUrl.hash = 'wechat_redirect';

  const response = NextResponse.redirect(authorizeUrl, { status: 302 });
  setWechatWebLoginRedirectCookie(response, callbackUrl);
  setWechatWebLoginStateCookie(response, state);
  return response;
}
