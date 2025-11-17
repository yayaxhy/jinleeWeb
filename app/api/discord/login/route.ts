import { NextResponse } from 'next/server';
import {
  generateLoginState,
  normalizeRedirectTarget,
  setLoginRedirectCookie,
  setLoginStateCookie,
} from '@/lib/session';

const DISCORD_AUTHORIZE_URL = 'https://discord.com/oauth2/authorize';
const DISCORD_SCOPE = 'identify guilds.members.read';

const requireClientId = () => {
  const value = process.env.DISCORD_CLIENT_ID;
  if (!value) {
    throw new Error('DISCORD_CLIENT_ID is not configured');
  }
  return value;
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = process.env.NEXTAUTH_URL ?? url.origin;
  const redirectUri = `${origin}/api/auth/callback/discord`;
  const callbackUrlParam = url.searchParams.get('callbackUrl');
  const callbackUrl = normalizeRedirectTarget(callbackUrlParam);

  const stateValue = generateLoginState();
  const authorizeUrl = new URL(DISCORD_AUTHORIZE_URL);
  authorizeUrl.searchParams.set('client_id', requireClientId());
  authorizeUrl.searchParams.set('redirect_uri', redirectUri);
  authorizeUrl.searchParams.set('response_type', 'code');
  authorizeUrl.searchParams.set('scope', DISCORD_SCOPE);
  authorizeUrl.searchParams.set('state', `csrf:${stateValue}`);

  const response = NextResponse.redirect(authorizeUrl.toString(), { status: 302 });
  setLoginRedirectCookie(response, callbackUrl);
  setLoginStateCookie(response, stateValue);
  return response;
}

