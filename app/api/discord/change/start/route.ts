import { renderSiteCopy } from "@/lib/site-copy-server";
import { NextResponse } from 'next/server';
import { getCurrentDlmUser } from '@/lib/current-dlm-user';
import { prisma } from '@/lib/prisma';
import { createDiscordChangeProof } from '@/lib/discord-change-proof';
import { setDiscordChangeProof } from '@/lib/discord-change-http';
import { setLoginStateCookie } from '@/lib/session';
import { verifyDiscordBindToken } from '@/lib/discord-bind-token';
import { readAdminJsonWrite } from '@/lib/admin-write-request';

function start(request: Request, source: { dlmId: string; sessionVersion: number }) {
  const origin = process.env.NEXTAUTH_URL ?? new URL(request.url).origin;
  const clientId = process.env.DISCORD_CLIENT_ID;
  if (!clientId) return NextResponse.json({ ok: false, error: 'Discord 登录暂未配置' }, { status: 503 });
  const proof = createDiscordChangeProof(source.dlmId, source.sessionVersion);
  const authorize = new URL('https://discord.com/oauth2/authorize');
  authorize.searchParams.set('client_id', clientId);
  authorize.searchParams.set('redirect_uri', `${origin}/api/auth/callback/discord`);
  authorize.searchParams.set('response_type', 'code');
  authorize.searchParams.set('scope', 'identify');
  authorize.searchParams.set('prompt', 'consent');
  authorize.searchParams.set('state', `csrf:${proof.csrf}`);
  const response = NextResponse.json({ ok: true, authorizeUrl: authorize.toString() });
  setDiscordChangeProof(response, proof); setLoginStateCookie(response, proof.csrf);
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

export async function POST(request: Request) {
  const parsed = await readAdminJsonWrite(request, process.env.NEXTAUTH_URL);
  if (!parsed.ok) return parsed.response;
  const user = await getCurrentDlmUser(request);
  if (!user) return NextResponse.json({ ok: false, error: await renderSiteCopy("site.app.api.discord.change.start.route.55b34029d5e0") }, { status: 401 });
  return start(request, user.dlmUser);
}

// The mini-program link is a short-lived proof of the source session. It only
// starts target OAuth; neither GET nor its callback transfers any assets.
export async function GET(request: Request) {
  const token = verifyDiscordBindToken(new URL(request.url).searchParams.get('bindToken'));
  if (!token) return NextResponse.json({ ok: false, error: await renderSiteCopy("site.app.api.discord.change.start.route.b5ca2b95697a") }, { status: 401 });
  const user = await prisma.dlmUser.findUnique({ where: { dlmId: token.dlmId }, select: { dlmId: true, sessionVersion: true } });
  if (!user || user.sessionVersion !== token.sessionVersion) return NextResponse.json({ ok: false, error: await renderSiteCopy("site.app.api.discord.change.start.route.e736df8ea9a7") }, { status: 401 });
  return start(request, user);
}
