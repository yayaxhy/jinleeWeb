import { NextResponse } from 'next/server';
/** Old callback links only restart verification; GET no longer merges wallets. */
export async function GET(request: Request) {
  const incoming = new URL(request.url);
  const target = new URL('/accounts/discord/bind', process.env.NEXTAUTH_URL ?? incoming.origin);
  const token = incoming.searchParams.get('bindToken');
  if (token) target.searchParams.set('bindToken', token);
  return NextResponse.redirect(target, { status: 302 });
}
