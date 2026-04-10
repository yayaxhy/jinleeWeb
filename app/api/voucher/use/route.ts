import { NextResponse } from 'next/server';
import { CouponStatus, LotteryStatus, PointShopDeliveryStatus, PointShopDeliveryType } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getCurrentJinleeUser } from '@/lib/current-jinlee-user';
import { resolveSpecialVoucher } from '@/lib/voucher';
import { SPECIAL_ACTION_COUPON_TYPE_BY_PRIZE } from '@/lib/voucherCatalog';

type UseVoucherPayload = {
  prizeName?: string;
  target?: string;
  reviewText?: string;
  lotteryId?: string;
  couponId?: string;
};

type VoucherSelectionParams = {
  currentUser: {
    jinleeId: string;
    discordUserId: string | null;
  };
  prizeName: string;
  couponId?: string;
  lotteryId?: string;
  requirePointShopOnly?: boolean;
  now: Date;
};

class InternalApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'InternalApiError';
    this.status = status;
  }
}

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
    throw new InternalApiError('内部接口未配置（INTERNAL_API_PORT/INTERNAL_API_TOKEN）', 500);
  }
  const endpoint = `http://${INTERNAL_HOST}:${INTERNAL_PORT}${path}`;
  let res: Response;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Token': INTERNAL_TOKEN,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new InternalApiError('内部接口响应超时，请稍后重试', 502);
    }
    throw new InternalApiError('内部接口暂不可用，请稍后重试', 502);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = typeof data?.error === 'string' ? data.error : `内部接口错误 (${res.status})`;
    throw new InternalApiError(msg, res.status);
  }
  return data;
}

async function selectSpecialVoucherId(params: VoucherSelectionParams): Promise<string | null> {
  const { currentUser, prizeName, couponId = '', lotteryId = '', requirePointShopOnly = false, now } = params;
  const couponType = SPECIAL_ACTION_COUPON_TYPE_BY_PRIZE[prizeName];

  if (couponType) {
    if (!requirePointShopOnly) {
      const coupon = couponId
        ? await prisma.coupon.findFirst({
            where: {
              id: couponId,
              jinleeId: currentUser.jinleeId,
              type: couponType,
              status: CouponStatus.ACTIVE,
              expiresAt: { gt: now },
            },
            select: { id: true },
          })
        : await prisma.coupon.findFirst({
            where: {
              jinleeId: currentUser.jinleeId,
              type: couponType,
              status: CouponStatus.ACTIVE,
              expiresAt: { gt: now },
            },
            orderBy: [{ expiresAt: 'asc' }, { issuedAt: 'asc' }, { id: 'asc' }],
            select: { id: true },
          });
      if (coupon) return coupon.id;
    }

    const pointShopGrant = couponId
      ? await prisma.pointShopGrant.findFirst({
          where: {
            id: couponId,
            jinleeId: currentUser.jinleeId,
            deliveryType: PointShopDeliveryType.COUPON,
            deliveryStatus: PointShopDeliveryStatus.DELIVERED,
            couponType,
            couponStatus: CouponStatus.ACTIVE,
            OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
          },
          select: { id: true },
        })
      : await prisma.pointShopGrant.findFirst({
          where: {
            jinleeId: currentUser.jinleeId,
            deliveryType: PointShopDeliveryType.COUPON,
            deliveryStatus: PointShopDeliveryStatus.DELIVERED,
            couponType,
            couponStatus: CouponStatus.ACTIVE,
            OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
          },
          orderBy: [{ expiresAt: 'asc' }, { issuedAt: 'asc' }, { id: 'asc' }],
          select: { id: true },
        });
    if (pointShopGrant) return pointShopGrant.id;
  }

  const draw = lotteryId
    ? await prisma.lotteryDraw.findFirst({
        where: {
          id: lotteryId,
          jinleeId: currentUser.jinleeId,
          status: LotteryStatus.UNUSED,
          prize: { name: prizeName },
          expiresAt: { gt: now },
        },
        select: { id: true },
      })
    : await prisma.lotteryDraw.findFirst({
        where: {
          jinleeId: currentUser.jinleeId,
          status: LotteryStatus.UNUSED,
          prize: { name: prizeName },
          expiresAt: { gt: now },
        },
        orderBy: [{ expiresAt: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
        select: { id: true },
      });

  return draw?.id ?? null;
}

export async function POST(request: Request) {
  const currentUser = await getCurrentJinleeUser(request);
  if (!currentUser) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as UseVoucherPayload;
  const prizeName = typeof body.prizeName === 'string' ? body.prizeName.trim() : '';
  const rawTarget = typeof body.target === 'string' ? body.target.trim() : '';
  const reviewText = typeof body.reviewText === 'string' ? body.reviewText.trim() : '';
  const lotteryId = typeof body.lotteryId === 'string' ? body.lotteryId.trim() : '';
  const couponId = typeof body.couponId === 'string' ? body.couponId.trim() : '';
  if (!prizeName) {
    return NextResponse.json({ error: '缺少 prizeName' }, { status: 400 });
  }
  const special = resolveSpecialVoucher(prizeName);
  if (!special) {
    return NextResponse.json({ error: '不支持的奖品' }, { status: 400 });
  }

  const now = new Date();

  try {
    const voucherId = await selectSpecialVoucherId({
      currentUser,
      prizeName,
      couponId,
      lotteryId,
      requirePointShopOnly: special.kind === 'peiwan_review',
      now,
    });
    if (!voucherId) {
      const message =
        special.kind === 'peiwan_review'
          ? '陪玩评语券不可用或已过期'
          : '礼物券不可用或已过期';
      return NextResponse.json({ error: message }, { status: 400 });
    }

    if (special.kind === 'simple') {
      if (!currentUser.discordUserId) {
        return NextResponse.json({ error: '该功能需要先绑定 Discord 账号' }, { status: 400 });
      }
      const path =
        prizeName === '自定义礼物券'
          ? '/internal/voucher/custom-gift'
          : '/internal/voucher/custom-tag';
      await callInternal(path, { userId: currentUser.discordUserId, voucherId });
      return NextResponse.json({ ok: true });
    }

    if (special.kind === 'peiwan_review') {
      if (!currentUser.discordUserId) {
        return NextResponse.json({ error: '该功能需要先绑定 Discord 账号' }, { status: 400 });
      }
      if (!reviewText) {
        return NextResponse.json({ error: '请输入评语内容' }, { status: 400 });
      }
      if (reviewText.length > 500) {
        return NextResponse.json({ error: '评语最多 500 字' }, { status: 400 });
      }

      const targetId = await resolveTargetDiscordId(rawTarget);
      if (!targetId) {
        return NextResponse.json({ error: '未找到目标陪玩' }, { status: 404 });
      }

      const targetPeiwan = await prisma.pEIWAN.findUnique({
        where: { discordUserId: targetId },
        select: { discordUserId: true, PEIWANID: true },
      });
      if (!targetPeiwan?.discordUserId) {
        return NextResponse.json({ error: '未找到目标陪玩' }, { status: 404 });
      }

      await callInternal('/internal/voucher/peiwan-review', {
        userId: currentUser.discordUserId,
        targetDiscordId: targetPeiwan.discordUserId,
        peiwanId: targetPeiwan.PEIWANID,
        content: reviewText,
        voucherId,
      });
      return NextResponse.json({ ok: true });
    }

    const targetId = await resolveTargetDiscordId(rawTarget);
    if (!targetId) {
      return NextResponse.json({ error: '未找到目标用户' }, { status: 404 });
    }
    if (!currentUser.discordUserId) {
      return NextResponse.json({ error: '该功能需要先绑定 Discord 账号' }, { status: 400 });
    }

    const numericPeiwanId = Number(rawTarget);
    const payload: Record<string, unknown> = {
      userId: currentUser.discordUserId,
      targetDiscordId: targetId,
      voucherId,
    };
    if (Number.isInteger(numericPeiwanId) && numericPeiwanId > 0) {
      payload.peiwanId = numericPeiwanId;
    }

    if (special.kind === 'commission') {
      await callInternal('/internal/voucher/commission-minus1', payload);
      return NextResponse.json({ ok: true });
    }

    if (special.kind === 'flow') {
      await callInternal('/internal/voucher/double-flow-5000', payload);
      return NextResponse.json({ ok: true });
    }

    if (special.kind === 'spend') {
      await callInternal('/internal/voucher/double-spend-5000', payload);
      return NextResponse.json({ ok: true });
    }
    
    return NextResponse.json({ error: '不支持的奖品' }, { status: 400 });
  } catch (error) {
    if (error instanceof InternalApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
