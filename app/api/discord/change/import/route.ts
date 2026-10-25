import { renderSiteCopy } from "@/lib/site-copy-server";
import { NextResponse } from 'next/server';
import { decodeDiscordChangeProof } from '@/lib/discord-change-proof';
import { setDiscordChangeProof } from '@/lib/discord-change-http';
export async function GET(request: Request) {
 const url=new URL(request.url);const proof=decodeDiscordChangeProof(url.searchParams.get('proof'));
 if(!proof?.targetDlmId) return NextResponse.json({ok:false,error:await renderSiteCopy("site.app.api.discord.change.import.route.0432549bfdd4")}, {status:401});
 const response=NextResponse.redirect(new URL('/accounts/discord/change',process.env.NEXTAUTH_URL??url.origin),{status:302});
 setDiscordChangeProof(response,proof);response.headers.set('Cache-Control','no-store');response.headers.set('Referrer-Policy','no-referrer');return response;
}
