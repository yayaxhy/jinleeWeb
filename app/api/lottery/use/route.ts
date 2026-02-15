import { NextResponse } from 'next/server';
import {
  CouponStatus,
  LotteryPrizeType,
  LotteryStatus,
  PointShopDeliveryStatus,
  PointShopDeliveryType,
} from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getServerSession } from '@/lib/session';
import { COUPON_VOUCHER_META, GIFT_NAME_BY_PRIZE_NAME, VANITY_CARD_PRIZE_NAMES } from '@/lib/voucherCatalog';

type UsePayload =
  | { lotteryId?: string; couponId?: string; mode: 'gift'; target: string; prizeName?: string }
  | { lotteryId?: string; couponId?: string; mode: 'selfuse'; prizeName?: string };

const isVanityCardPrize = (name: string | undefined | null) => {
  if (!name) return false;
  return VANITY_CARD_PRIZE_NAMES.has(name.trim());
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
  lotteryId?: string;
  couponId?: string;
  requestId?: string;
}) => {
  const port = process.env.INTERNAL_API_PORT;
  const host = process.env.INTERNAL_API_HOST ?? '127.0.0.1';
  const token = process.env.INTERNAL_API_TOKEN;
  if (!port || !token) {
    throw new Error('内部礼物接口未配置（INTERNAL_API_PORT/INTERNAL_API_TOKEN）');
  }
  const endpoint = `http://${host}:${port}/internal/gift`;
  const payload = {
    giverId: params.giverId,
    receiverId: params.receiverId,
    giftName: params.giftName,
    quantity: params.quantity ?? 1,
    anonymous: false,
    lotteryId: params.lotteryId,
    couponId: params.couponId,
    requestId: params.requestId,
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
  const couponId = typeof body.couponId === 'string' ? body.couponId : '';
  const mode = body.mode;

  if ((!lotteryId && !couponId) || (mode !== 'gift' && mode !== 'selfuse')) {
    return NextResponse.json({ error: '参数错误' }, { status: 400 });
  }

  const now = new Date();
  let prizeName = typeof body.prizeName === 'string' ? body.prizeName.trim() : '';
  let prizeType: LotteryPrizeType = LotteryPrizeType.COUPON;
  let source: 'coupon' | 'lottery' | 'pointshop' = 'lottery';

  if (couponId) {
    const coupon = await prisma.coupon.findFirst({
      where: {
        id: couponId,
        discordId: session.discordId,
        status: CouponStatus.ACTIVE,
        expiresAt: { gt: now },
      },
      select: { id: true, type: true },
    });
    if (coupon) {
      const mapped = COUPON_VOUCHER_META[coupon.type];
      if (!mapped) {
        return NextResponse.json({ error: '该券不支持在此处使用' }, { status: 400 });
      }
      prizeName = mapped.prizeName;
      prizeType = mapped.prizeType;
      source = 'coupon';
    } else {
      const pointShopGrant = await prisma.pointShopGrant.findFirst({
        where: {
          id: couponId,
          discordUserId: session.discordId,
          deliveryType: PointShopDeliveryType.COUPON,
          deliveryStatus: PointShopDeliveryStatus.DELIVERED,
          couponStatus: CouponStatus.ACTIVE,
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
          couponType: { not: null },
        },
        select: { id: true, couponType: true },
      });

      if (!pointShopGrant?.couponType) {
        return NextResponse.json({ error: '券已使用或已过期' }, { status: 409 });
      }

      const mapped = COUPON_VOUCHER_META[pointShopGrant.couponType];
      if (!mapped) {
        return NextResponse.json({ error: '该券不支持在此处使用' }, { status: 400 });
      }
      prizeName = mapped.prizeName;
      prizeType = mapped.prizeType;
      source = 'pointshop';
    }
  } else {
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
    prizeName = draw.prize?.name ?? prizeName;
    prizeType = draw.prize?.type ?? LotteryPrizeType.COUPON;
  }

  if (mode === 'gift') {
    if (prizeType !== LotteryPrizeType.GIFT) {
      return NextResponse.json({ error: '非礼物代金券，无法赠送' }, { status: 400 });
    }
    const target = typeof body.target === 'string' ? body.target : '';
    const receiverId = await resolveTargetDiscordId(target);
    if (!receiverId) {
      return NextResponse.json({ error: '未找到目标用户' }, { status: 404 });
    }
    const giftNameForBot = GIFT_NAME_BY_PRIZE_NAME[prizeName] ?? prizeName.replace(/代金券$/, '') ?? '礼物';
    const requestId = `GIFT:${receiverId}`;
    try {
      await callGiftWebhook({
        giverId: session.discordId,
        receiverId,
        giftName: giftNameForBot,
        quantity: 1,
        lotteryId: source === 'lottery' ? lotteryId : undefined,
        couponId: source === 'lottery' ? undefined : couponId,
        requestId,
      });
    } catch (error) {
      return NextResponse.json({ error: (error as Error).message }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  }

  if (mode === 'selfuse') {
    const isVanityCard = isVanityCardPrize(prizeName);
    if (prizeType !== LotteryPrizeType.SELFUSE && !isVanityCard) {
      return NextResponse.json({ error: '非自用券，无法自用' }, { status: 400 });
    }

    // Vanity cards: let bot consume & notify via internal API
    if (isVanityCard) {
      const port = process.env.INTERNAL_API_PORT;
      const host = process.env.INTERNAL_API_HOST ?? '127.0.0.1';
      const token = process.env.INTERNAL_API_TOKEN;
      if (!port || !token) {
        return NextResponse.json({ error: '内部接口未配置' }, { status: 500 });
      }
      const endpoint = `http://${host}:${port}/internal/rename-card`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Token': token,
        },
        body: JSON.stringify({ userId: session.discordId, voucherId: couponId || lotteryId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = typeof data?.error === 'string' ? data.error : '内部接口错误';
        return NextResponse.json({ error: msg }, { status: res.status });
      }
      return NextResponse.json({ ok: true });
    }

    if (source === 'coupon') {
      const updateResult = await prisma.coupon.updateMany({
        where: { id: couponId, status: CouponStatus.ACTIVE },
        data: {
          status: CouponStatus.USED,
          consumedAt: now,
          consumeAmount: 0,
          consumeTargetId: session.discordId,
        },
      });
      if (updateResult.count !== 1) {
        return NextResponse.json({ error: '已使用或已过期' }, { status: 409 });
      }
    } else if (source === 'pointshop') {
      const updateResult = await prisma.pointShopGrant.updateMany({
        where: {
          id: couponId,
          discordUserId: session.discordId,
          deliveryType: PointShopDeliveryType.COUPON,
          deliveryStatus: PointShopDeliveryStatus.DELIVERED,
          couponStatus: CouponStatus.ACTIVE,
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        },
        data: {
          couponStatus: CouponStatus.USED,
          consumedAt: now,
          consumeAmount: 0,
          consumeTargetId: session.discordId,
        },
      });
      if (updateResult.count !== 1) {
        return NextResponse.json({ error: '已使用或已过期' }, { status: 409 });
      }
    } else {
      const updateResult = await prisma.lotteryDraw.updateMany({
        where: { id: lotteryId, status: LotteryStatus.UNUSED },
        data: {
          status: LotteryStatus.USED,
          consumeAt: now,
          requestId: 'SELFUSE',
        },
      });
      if (updateResult.count !== 1) {
        return NextResponse.json({ error: '已使用或已过期' }, { status: 409 });
      }
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: '不支持的操作' }, { status: 400 });
}
