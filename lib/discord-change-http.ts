import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { DISCORD_CHANGE_COOKIE, DISCORD_CHANGE_TTL_SECONDS, decodeDiscordChangeProof, encodeDiscordChangeProof, type DiscordChangeProof } from './discord-change-proof';

export async function readDiscordChangeProof() {
  return decodeDiscordChangeProof((await cookies()).get(DISCORD_CHANGE_COOKIE)?.value);
}
export function setDiscordChangeProof(response: NextResponse, proof: DiscordChangeProof) {
  response.cookies.set(DISCORD_CHANGE_COOKIE, encodeDiscordChangeProof(proof), {
    httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: DISCORD_CHANGE_TTL_SECONDS,
  });
}
export function clearDiscordChangeProof(response: NextResponse) {
  response.cookies.set(DISCORD_CHANGE_COOKIE, '', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 0 });
}
