import { NextResponse } from 'next/server';
import { getServerSession } from '@/lib/session';
import { isAdminDiscordId } from '@/lib/admin';

export async function POST() {
  const session = await getServerSession();
  if (!session?.discordId || !isAdminDiscordId(session.discordId)) return NextResponse.json({ error: '无权访问' }, { status: 403 });
  return NextResponse.json({ error: '旧换号写入已停止，请到账号合并页面预览完整迁移方案。', url: '/admin/asset-transfer' }, { status: 410 });
}
