import { NextResponse } from 'next/server';
import type { DiscordUser } from './discord';
import { prisma } from './prisma';
import { ensureVerifiedDiscordLogin } from './dlm-user';
import { readDiscordChangeProof, setDiscordChangeProof, clearDiscordChangeProof } from './discord-change-http';
import { clearLoginStateCookie, clearLoginRedirectCookie } from './session';

/** Returns null for ordinary login. Target OAuth verifies identity but never executes a merge. */
export async function completeDiscordChangeOAuth(origin: string, csrf: string | undefined, user: DiscordUser) {
  const proof = await readDiscordChangeProof();
  if (!proof || proof.csrf !== csrf || proof.targetDlmId) return null;
  const source = await prisma.dlmUser.findUnique({ where: { dlmId: proof.sourceDlmId }, select: { sessionVersion: true } });
  if (!source || source.sessionVersion !== proof.sourceSessionVersion) {
    const response = NextResponse.redirect(new URL('/accounts/discord/change?error=session_changed', origin));
    clearDiscordChangeProof(response); clearLoginStateCookie(response); return response;
  }
  const displayName = user.global_name ?? user.username;
  const avatarUrl = user.avatar ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.${user.avatar.startsWith('a_') ? 'gif' : 'png'}` : null;
  // This is the same authenticated identity initialization as ordinary login.
  // An old detached Member key is internal, so this creates an empty new wallet.
  const target = await ensureVerifiedDiscordLogin({ discordUserId: user.id, displayName, avatarUrl,
    profile: { username: user.username, globalName: user.global_name ?? null, discriminator: user.discriminator ?? null },
  });
  const response = NextResponse.redirect(new URL('/accounts/discord/change', origin));
  setDiscordChangeProof(response, { ...proof, targetDlmId: target.dlmId, targetSessionVersion: target.sessionVersion, targetDiscordId: user.id });
  clearLoginStateCookie(response); clearLoginRedirectCookie(response);
  return response;
}
