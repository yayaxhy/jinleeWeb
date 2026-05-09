import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentJinleeUser } from '@/lib/current-jinlee-user';

export const runtime = 'nodejs';

const ensureEditablePeiwan = async (request?: Request) => {
  const currentUser = await getCurrentJinleeUser(request);
  const discordUserId = currentUser?.discordUserId?.trim();
  if (!discordUserId) {
    return { error: NextResponse.json({ error: '未登录' }, { status: 401 }) };
  }

  const member = await prisma.member.findUnique({
    where: { discordUserId },
    include: { peiwan: true },
  });
  if (!member || member.status !== 'PEIWAN' || !member.peiwan) {
    return { error: NextResponse.json({ error: '仅限陪玩设置真人试音邀请' }, { status: 403 }) };
  }

  const deletionRecord = await prisma.peiwanDeletion.findUnique({
    where: { peiwanId: member.peiwan.PEIWANID },
    select: { peiwanId: true },
  });
  if (deletionRecord) {
    return { error: NextResponse.json({ error: '你的陪玩资料当前不可编辑' }, { status: 403 }) };
  }

  return {
    discordUserId,
  };
};

export async function POST(request: Request) {
  try {
    const current = await ensureEditablePeiwan(request);
    if ('error' in current) {
      return current.error;
    }

    const body = await request.json().catch(() => ({}));
    const enabled = body?.enabled;
    if (typeof enabled !== 'boolean') {
      return NextResponse.json({ error: '缺少有效的 enabled 参数' }, { status: 400 });
    }

    await prisma.pEIWAN.update({
      where: { discordUserId: current.discordUserId },
      data: { auditionInviteEnabled: enabled },
    });

    return NextResponse.json({ ok: true, enabled });
  } catch (error) {
    const message = error instanceof Error ? error.message : '保存失败，请稍后再试';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
