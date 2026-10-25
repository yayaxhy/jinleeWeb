import { getSiteCopy, renderSiteCopy } from "@/lib/site-copy-server";
import { NextResponse } from 'next/server';
import { CouponStatus, LotteryStatus, PointShopDeliveryStatus, PointShopDeliveryType } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getCurrentDlmUser } from '@/lib/current-dlm-user';
import { newEntityOnlyTime } from '@/lib/operating-entity-cutover';
import { resolveSpecialVoucher } from '@/lib/voucher';
import { SPECIAL_ACTION_COUPON_TYPE_BY_PRIZE } from '@/lib/voucherCatalog';
import { postVoucherUseRequest, VoucherInternalRequestError } from '@/lib/voucher-internal-request';
import { buildVoucherIdentityPayload, VoucherRequestIdentityError } from '@/lib/voucher-request-identity';
import { TargetConfirmationError } from '@/lib/target-confirmation';
import { targetConfirmationService } from '@/lib/target-confirmation-server';

type UseVoucherPayload = {
  prizeName?: string;
  target?: string;
  reviewText?: string;
  lotteryId?: string;
  couponId?: string;
  confirmationToken?: string;
};

type VoucherSelectionParams = {
  currentUser: {
    dlmId: string;
    discordUserId: string | null;
  };
  prizeName: string;
  couponId?: string;
  lotteryId?: string;
  now: Date;
};

const INTERNAL_HOST = process.env.INTERNAL_API_HOST ?? '127.0.0.1';
const INTERNAL_PORT = process.env.INTERNAL_API_PORT;
const INTERNAL_TOKEN = process.env.INTERNAL_API_TOKEN;

async function callInternal(path: string, payload: Record<string, unknown>) {
  if (!INTERNAL_PORT || !INTERNAL_TOKEN) {
    console.error('[voucher.use] missing INTERNAL_API_PORT/INTERNAL_API_TOKEN');
    throw new VoucherInternalRequestError('用券服务暂不可用，请稍后再试或联系客服。', 500);
  }
  return postVoucherUseRequest({
    endpoint: `http://${INTERNAL_HOST}:${INTERNAL_PORT}${path}`,
    token: INTERNAL_TOKEN,
    payload,
  });
}

async function selectSpecialVoucherId(params: VoucherSelectionParams): Promise<string | null> {
  const { currentUser, prizeName, couponId = '', lotteryId = '', now } = params;
  const couponType = SPECIAL_ACTION_COUPON_TYPE_BY_PRIZE[prizeName];

  if (couponType) {
    const coupon = couponId
      ? await prisma.coupon.findFirst({
          where: {
            id: couponId,
            dlmId: currentUser.dlmId,
            type: couponType,
            status: CouponStatus.ACTIVE,
            consumedAt: null,
            orderId: null,
            issuedAt: newEntityOnlyTime(),
            expiresAt: { gt: now },
          },
          select: { id: true },
        })
      : await prisma.coupon.findFirst({
          where: {
            dlmId: currentUser.dlmId,
            type: couponType,
            status: CouponStatus.ACTIVE,
            consumedAt: null,
            orderId: null,
            issuedAt: newEntityOnlyTime(),
            expiresAt: { gt: now },
          },
          orderBy: [{ expiresAt: 'asc' }, { issuedAt: 'asc' }, { id: 'asc' }],
          select: { id: true },
        });
    if (coupon) return coupon.id;

    const pointShopGrant = couponId
      ? await prisma.pointShopGrant.findFirst({
          where: {
            id: couponId,
            dlmId: currentUser.dlmId,
            deliveryType: PointShopDeliveryType.COUPON,
            deliveryStatus: PointShopDeliveryStatus.DELIVERED,
            couponType,
            couponStatus: CouponStatus.ACTIVE,
            consumedAt: null,
            consumeOrderId: null,
            issuedAt: newEntityOnlyTime(),
            OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
          },
          select: { id: true },
        })
      : await prisma.pointShopGrant.findFirst({
          where: {
            dlmId: currentUser.dlmId,
            deliveryType: PointShopDeliveryType.COUPON,
            deliveryStatus: PointShopDeliveryStatus.DELIVERED,
            couponType,
            couponStatus: CouponStatus.ACTIVE,
            consumedAt: null,
            consumeOrderId: null,
            issuedAt: newEntityOnlyTime(),
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
          dlmId: currentUser.dlmId,
          status: LotteryStatus.UNUSED,
          consumeAt: null,
          createdAt: newEntityOnlyTime(),
          prize: { name: prizeName },
          expiresAt: { gt: now },
        },
        select: { id: true },
      })
    : await prisma.lotteryDraw.findFirst({
        where: {
          dlmId: currentUser.dlmId,
          status: LotteryStatus.UNUSED,
          consumeAt: null,
          createdAt: newEntityOnlyTime(),
          prize: { name: prizeName },
          expiresAt: { gt: now },
        },
        orderBy: [{ expiresAt: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
        select: { id: true },
      });

  return draw?.id ?? null;
}

export async function POST(request: Request) {
  const currentUser = await getCurrentDlmUser(request);
  if (!currentUser) {
    return NextResponse.json({ error: await renderSiteCopy("site.app.api.voucher.use.route.e8041a8c9358") }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as UseVoucherPayload;
  const prizeName = typeof body.prizeName === 'string' ? body.prizeName.trim() : '';
  const rawTarget = typeof body.target === 'string' ? body.target.trim() : '';
  const reviewText = typeof body.reviewText === 'string' ? body.reviewText.trim() : '';
  const lotteryId = typeof body.lotteryId === 'string' ? body.lotteryId.trim() : '';
  const couponId = typeof body.couponId === 'string' ? body.couponId.trim() : '';
  if (!prizeName) {
    return NextResponse.json({ error: await renderSiteCopy("site.app.api.voucher.use.route.01f259fd1b8e") }, { status: 400 });
  }
  const special = resolveSpecialVoucher(prizeName);
  if (!special) {
    return NextResponse.json({ error: await renderSiteCopy("site.app.api.voucher.use.route.6354babc49ae") }, { status: 400 });
  }

  const now = new Date();

  try {
    const confirmed = special.kind === 'simple' ? null : await targetConfirmationService().verify(body.confirmationToken, currentUser, {
      purpose: 'voucher', target: rawTarget, prizeName, couponId, lotteryId,
    });
    const voucherId = confirmed ? confirmed.selectedVoucher!.voucherId : await selectSpecialVoucherId({ currentUser, prizeName, couponId, lotteryId, now });
    if (!voucherId) {
      const message =
        special.kind === 'peiwan_review'
          ? '陪玩评语券不可用或已过期'
          : '礼物券不可用或已过期';
      return NextResponse.json({ error: message }, { status: 400 });
    }

    if (special.kind === 'simple') {
      if (!currentUser.discordUserId) {
        return NextResponse.json({ error: await renderSiteCopy("site.app.api.voucher.use.route.137a22b366cc") }, { status: 400 });
      }
      const path =
        prizeName === '自定义礼物券'
          ? '/internal/voucher/custom-gift'
          : '/internal/voucher/custom-tag';
      await callInternal(path, { ...buildVoucherIdentityPayload(currentUser), voucherId });
      return NextResponse.json({ ok: true });
    }

    if (special.kind === 'peiwan_review') {
      if (!currentUser.discordUserId) {
        return NextResponse.json({ error: await renderSiteCopy("site.app.api.voucher.use.route.137a22b366cc") }, { status: 400 });
      }
      if (!reviewText) {
        return NextResponse.json({ error: await renderSiteCopy("site.app.api.voucher.use.route.00a68abb0983") }, { status: 400 });
      }
      if (reviewText.length > 500) {
        return NextResponse.json({ error: await renderSiteCopy("site.app.api.voucher.use.route.1cb97fdd4512") }, { status: 400 });
      }

      const targetIdentity = confirmed!.target;
      await callInternal('/internal/voucher/peiwan-review', {
        ...buildVoucherIdentityPayload(currentUser, targetIdentity),
        content: reviewText,
        voucherId,
      });
      return NextResponse.json({ ok: true });
    }

    const targetIdentity = confirmed!.target;
    if (!currentUser.discordUserId) {
      return NextResponse.json({ error: await renderSiteCopy("site.app.api.voucher.use.route.137a22b366cc") }, { status: 400 });
    }
    const payload = { ...buildVoucherIdentityPayload(currentUser, targetIdentity), voucherId };

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

    return NextResponse.json({ error: await renderSiteCopy("site.app.api.voucher.use.route.6354babc49ae") }, { status: 400 });
  } catch (error) {
    console.error('[voucher.use] failed', error);
    if (error instanceof TargetConfirmationError) {
      return NextResponse.json({ error: (await getSiteCopy()).text(error.message, "site.lib.public.error.messages"), code: error.code }, { status: error.status });
    }
    if (error instanceof VoucherRequestIdentityError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    if (error instanceof VoucherInternalRequestError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: await renderSiteCopy("site.app.api.voucher.use.route.900ddd191d99") }, { status: 500 });
  }
}
