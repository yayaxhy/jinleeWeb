import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { prisma } from './prisma';
import { decodeDiscordChangeProof } from './discord-change-proof';
import { setDiscordChangeProof } from './discord-change-http';
import { WECHAT_ATTACH_COOKIE, finishWechatAttachmentProof } from './wechat-attach-proof';
import { clearWechatWebLoginStateCookie, clearWechatWebLoginRedirectCookie } from './session';

export async function completeWechatAttachmentOAuth(origin: string, csrf: string | null,
  source: { dlmId: string; sessionVersion: number }) {
  const token = (await cookies()).get(WECHAT_ATTACH_COOKIE)?.value;
  const intent = decodeDiscordChangeProof(token);
  if (!intent || intent.csrf !== csrf) return null;
  const target = await prisma.dlmUser.findUnique({ where: { dlmId: intent.sourceDlmId },
    select: { dlmId: true, sessionVersion: true, discordUserId: true } });
  if (!target) throw new Error('wechat_attachment_state_changed');
  const proof = finishWechatAttachmentProof(intent, target, source, csrf);
  const response = NextResponse.redirect(new URL('/accounts/discord/change', origin));
  setDiscordChangeProof(response, proof);
  response.cookies.set(WECHAT_ATTACH_COOKIE, '', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 0 });
  clearWechatWebLoginStateCookie(response); clearWechatWebLoginRedirectCookie(response);
  return response;
}
