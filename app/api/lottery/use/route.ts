import { NextResponse } from 'next/server';
import { LotteryPrizeType, LotteryStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getServerSession } from '@/lib/session';

type UsePayload =
  | { lotteryId: string; mode: 'gift'; target: string }
  | { lotteryId: string; mode: 'selfuse' };

const toDecimalString = (value: unknown) => {
  if (value === null || value === undefined) return '';
  try {
    return value.toString();
  } catch {
    return '';
  }
};

const resolveTargetDiscordId = async (raw: string) => {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  // Try discord id first
  const member = await prisma.member.findUnique({
    where: { discordUserId: trimmed },
    select: { discordUserId: true },
  });
  if (member) return member.discordUserId;

  // Try peiwanId numeric lookup
  const numeric = Number(trimmed);
  if (Number.isInteger(numeric) && numeric > 0) {
    const peiwan = await prisma.pEIWAN.findUnique({
      where: { PEIWANID: numeric },
      select: { discordUserId: true },
    });
    if (peiwan?.discordUserId) return peiwan.discordUserId;
  }

  return null;
};

const callGiftWebhook = async (params: {
  giverId: string;
  receiverId: string;
  giftName: string;
  quantity?: number;
}) => {
  const port = process.env.INTERNAL_API_PORT;
  const token = process.env.INTERNAL_API_TOKEN;
  if (!port || !token) {
    throw new Error('内部礼物接口未配置（INTERNAL_API_PORT/INTERNAL_API_TOKEN）');
  }
  const endpoint = `http://127.0.0.1:${port}/internal/gift`;
  const payload = {
    giverId: params.giverId,
    receiverId: params.receiverId,
    giftName: params.giftName,
    quantity: params.quantity ?? 1,
    anonymous: false,
  };
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Internal-Token': token,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    let message = `礼物接口错误 (${res.status})`;
    try {
      const data = await res.json();
      if (typeof data?.error === 'string') {
        message = data.error;
      }
    } catch {
      // ignore
    }
    throw new Error(message);
  }
};

export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session?.discordId) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as Partial<UsePayload>;
  const lotteryId = typeof body.lotteryId === 'string' ? body.lotteryId : '';
  const mode = body.mode;

  if (!lotteryId || (mode !== 'gift' && mode !== 'selfuse')) {
    return NextResponse.json({ error: '参数错误' }, { status: 400 });
  }

  const draw = await prisma.lotteryDraw.findUnique({
    where: { id: lotteryId },
    include: {
      prize: { select: { name: true, type: true } },
    },
  });

  if (!draw || draw.userId !== session.discordId) {
    return NextResponse.json({ error: '记录不存在' }, { status: 404 });
  }
  if (draw.status !== LotteryStatus.UNUSED) {
    return NextResponse.json({ error: '已使用或已过期' }, { status: 409 });
  }
  const prizeType = draw.prize?.type ?? LotteryPrizeType.COUPON;

  if (mode === 'gift') {
    if (prizeType !== LotteryPrizeType.GIFT) {
      return NextResponse.json({ error: '非礼物代金券，无法赠送' }, { status: 400 });
    }
    const target = typeof body.target === 'string' ? body.target : '';
    const receiverId = await resolveTargetDiscordId(target);
    if (!receiverId) {
      return NextResponse.json({ error: '未找到目标用户' }, { status: 404 });
    }
    try {
      await callGiftWebhook({
        giverId: session.discordId,
        receiverId,
        giftName: draw.prize?.name ?? '礼物',
        quantity: 1,
      });
    } catch (error) {
      return NextResponse.json({ error: (error as Error).message }, { status: 400 });
    }
    await prisma.lotteryDraw.update({
      where: { id: lotteryId },
      data: {
        status: LotteryStatus.USED,
        consumeAt: new Date(),
        requestId: `GIFT:${receiverId}`,
      },
    });
    return NextResponse.json({ ok: true });
  }

  if (mode === 'selfuse') {
    if (prizeType !== LotteryPrizeType.SELFUSE) {
      return NextResponse.json({ error: '非自用券，无法自用' }, { status: 400 });
    }
    await prisma.lotteryDraw.update({
      where: { id: lotteryId },
      data: {
        status: LotteryStatus.USED,
        consumeAt: new Date(),
        requestId: 'SELFUSE',
      },
    });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: '不支持的操作' }, { status: 400 });
}
