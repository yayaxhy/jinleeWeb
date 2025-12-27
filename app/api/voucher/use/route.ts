import { NextResponse } from 'next/server';
import { LotteryStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getServerSession } from '@/lib/session';
import { resolveSpecialVoucher } from '@/lib/voucher';

type UseVoucherPayload = {
  prizeName?: string;
  target?: string;
  lotteryId?: string;
};

const resolveTargetDiscordId = async (raw: string | undefined | null) => {
  const trimmed = typeof raw === 'string' ? raw.trim() : '';
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

const INTERNAL_HOST = process.env.INTERNAL_API_HOST ?? '127.0.0.1';
const INTERNAL_PORT = process.env.INTERNAL_API_PORT;
const INTERNAL_TOKEN = process.env.INTERNAL_API_TOKEN;

async function callInternal(path: string, payload: Record<string, unknown>) {
  if (!INTERNAL_PORT || !INTERNAL_TOKEN) {
    throw new Error('内部接口未配置（INTERNAL_API_PORT/INTERNAL_API_TOKEN）');
  }
  const endpoint = `http://${INTERNAL_HOST}:${INTERNAL_PORT}${path}`;
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Internal-Token': INTERNAL_TOKEN,
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = typeof data?.error === 'string' ? data.error : `内部接口错误 (${res.status})`;
    throw new Error(msg);
  }
  return data;
}

export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session?.discordId) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as UseVoucherPayload;
  const prizeName = typeof body.prizeName === 'string' ? body.prizeName.trim() : '';
  const rawTarget = typeof body.target === 'string' ? body.target.trim() : '';
  const lotteryId = typeof body.lotteryId === 'string' ? body.lotteryId.trim() : '';
  if (!prizeName) {
    return NextResponse.json({ error: '缺少 prizeName' }, { status: 400 });
  }
  const special = resolveSpecialVoucher(prizeName);
  if (!special) {
    return NextResponse.json({ error: '不支持的奖品' }, { status: 400 });
  }

  const now = new Date();

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 仅校验是否存在可用券，不在本地消耗，交由机器人处理
      const draw = lotteryId
        ? await tx.lotteryDraw.findFirst({
            where: {
              id: lotteryId,
              userId: session.discordId,
              status: LotteryStatus.UNUSED,
              prize: { name: prizeName },
              expiresAt: { gt: now },
            },
            select: { id: true },
          })
        : await tx.lotteryDraw.findFirst({
            where: {
              userId: session.discordId,
              status: LotteryStatus.UNUSED,
              prize: { name: prizeName },
              expiresAt: { gt: now },
            },
            orderBy: [{ expiresAt: 'asc' }, { createdAt: 'asc' }],
            select: { id: true },
          });
      if (!draw) {
        return { ok: false, code: 400, message: '礼物券不可用或已过期' };
      }

      if (special.kind === 'simple') {
        const path =
          prizeName === '自定义礼物券'
            ? '/internal/voucher/custom-gift'
            : '/internal/voucher/custom-tag';
        try {
          await callInternal(path, { userId: session.discordId, voucherId: draw.id });
          return { ok: true };
        } catch (err) {
          return { ok: false, code: 400, message: (err as Error).message };
        }
      }

      const targetId = await resolveTargetDiscordId(rawTarget);
      if (!targetId) {
        return { ok: false, code: 404, message: '未找到目标用户' };
      }

      if (special.kind === 'commission') {
        const numericPeiwanId = Number(rawTarget);
        const payload: Record<string, unknown> = {
          userId: session.discordId,
          targetDiscordId: targetId,
        };
        if (Number.isInteger(numericPeiwanId) && numericPeiwanId > 0) {
          payload.peiwanId = numericPeiwanId;
        }
        payload.voucherId = draw.id;
        try {
          await callInternal('/internal/voucher/commission-minus1', payload);
          return { ok: true };
        } catch (err) {
          return { ok: false, code: 400, message: (err as Error).message };
        }
      }

      if (special.kind === 'flow') {
        const numericPeiwanId = Number(rawTarget);
        const payload: Record<string, unknown> = {
          userId: session.discordId,
          targetDiscordId: targetId,
        };
        if (Number.isInteger(numericPeiwanId) && numericPeiwanId > 0) {
          payload.peiwanId = numericPeiwanId;
        }
        payload.voucherId = draw.id;
        try {
          await callInternal('/internal/voucher/double-flow-5000', payload);
          return { ok: true };
        } catch (err) {
          return { ok: false, code: 400, message: (err as Error).message };
        }
      }

      if (special.kind === 'spend') {
        const numericPeiwanId = Number(rawTarget);
        const payload: Record<string, unknown> = {
          userId: session.discordId,
          targetDiscordId: targetId,
        };
        if (Number.isInteger(numericPeiwanId) && numericPeiwanId > 0) {
          payload.peiwanId = numericPeiwanId;
        }
        payload.voucherId = draw.id;
        try {
          await callInternal('/internal/voucher/double-spend-5000', payload);
          return { ok: true };
        } catch (err) {
          return { ok: false, code: 400, message: (err as Error).message };
        }
      }

      return { ok: false, code: 400, message: '不支持的奖品' };
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.message }, { status: result.code });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
