import { renderSiteCopy } from "@/lib/site-copy-server";
import { NextResponse } from 'next/server';
import { getCurrentDlmUser } from '@/lib/current-dlm-user';
import { readAdminJsonWrite } from '@/lib/admin-write-request';
import { createDiscordChangeProof, encodeDiscordChangeProof, DISCORD_CHANGE_TTL_SECONDS } from '@/lib/discord-change-proof';
import { WECHAT_ATTACH_COOKIE } from '@/lib/wechat-attach-proof';
import { setWechatWebLoginStateCookie, setWechatWebLoginRedirectCookie } from '@/lib/session';

export async function POST(request: Request) {
  const parsed = await readAdminJsonWrite(request, process.env.NEXTAUTH_URL); if (!parsed.ok) return parsed.response;
  const current = await getCurrentDlmUser(request);
  if (!current?.discordUserId) return NextResponse.json({ ok: false, error: await renderSiteCopy("site.app.api.wechat.bind.start.route.752cb09403b2") }, { status: 401 });
  const appId = process.env.WECHAT_WEB_APP_ID?.trim();
  if (!appId || !process.env.WECHAT_WEB_APP_SECRET?.trim()) return NextResponse.json({ ok: false, error: await renderSiteCopy("site.app.api.wechat.bind.start.route.f60f29219179") }, { status: 503 });
  const origin = new URL(process.env.SITE_ORIGIN?.trim() || process.env.NEXTAUTH_URL?.trim() || request.url).origin;
  const intent = createDiscordChangeProof(current.dlmId, current.dlmUser.sessionVersion);
  const url = new URL('https://open.weixin.qq.com/connect/qrconnect');
  url.searchParams.set('appid', appId); url.searchParams.set('redirect_uri', `${origin}/api/auth/callback/wechat`);
  url.searchParams.set('response_type', 'code'); url.searchParams.set('scope', 'snsapi_login');
  url.searchParams.set('state', intent.csrf); url.hash = 'wechat_redirect';
  const response = NextResponse.json({ ok: true, authorizeUrl: url.toString() }, { headers: { 'Cache-Control': 'no-store' } });
  response.cookies.set(WECHAT_ATTACH_COOKIE, encodeDiscordChangeProof(intent), { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: DISCORD_CHANGE_TTL_SECONDS });
  setWechatWebLoginStateCookie(response, intent.csrf); setWechatWebLoginRedirectCookie(response, '/accounts/wechat/bind');
  return response;
}
