import { NextResponse } from 'next/server';
import { canManageGifts } from '@/lib/admin';
import { prisma } from '@/lib/prisma';
import { getServerSession } from '@/lib/session';
import { GiftMenuError, readDiscordGiftMenu, saveDiscordGiftMenu } from '@/lib/discord-gift-menu-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function isGiftAdmin() {
  const session = await getServerSession();
  return !!session?.discordId && canManageGifts(session.discordId);
}

function errorResponse(error: unknown) {
  if (error instanceof GiftMenuError) return NextResponse.json({ error: error.message }, { status: error.status });
  const code = (error as { code?: string })?.code;
  if (code === 'P2034') {
    return NextResponse.json({ error: '列表正在被修改，请重新加载后再保存' }, { status: 409 });
  }
  if (code === 'P2022') {
    return NextResponse.json({ error: '下拉列表管理尚未启用，请联系管理员完成更新' }, { status: 503 });
  }
  console.error('[admin/gifts/discord-menu]', error);
  return NextResponse.json({ error: '暂时无法读取或保存列表，请稍后重试' }, { status: 503 });
}

export async function GET() {
  if (!await isGiftAdmin()) return NextResponse.json({ error: '无权访问' }, { status: 403 });
  try {
    return NextResponse.json(await readDiscordGiftMenu(prisma), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return errorResponse(error); }
}

export async function PUT(request: Request) {
  if (!await isGiftAdmin()) return NextResponse.json({ error: '无权访问' }, { status: 403 });
  const body: unknown = await request.json().catch(() => null);
  try {
    return NextResponse.json(await saveDiscordGiftMenu(prisma, body));
  } catch (error) { return errorResponse(error); }
}
