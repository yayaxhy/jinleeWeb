import { getSiteCopy, renderSiteCopy } from "@/lib/site-copy-server";
import { NextResponse } from 'next/server';
import {
  CouponStatus,
  LotteryPrizeType,
  LotteryStatus,
  PointShopDeliveryStatus,
  PointShopDeliveryType,
} from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getCurrentDlmUser } from '@/lib/current-dlm-user';
import { newEntityOnlyTime } from '@/lib/operating-entity-cutover';
import { buildVoucherIdentityPayload, VoucherRequestIdentityError } from '@/lib/voucher-request-identity';
import { postVoucherUseRequest, VoucherInternalRequestError } from '@/lib/voucher-internal-request';
import { consumeSelfUseVoucherTx } from '@/lib/self-use-voucher-transaction';
import { buildGiftIdentityPayload, GiftRequestIdentityError, GIFT_RESULT_UNCONFIRMED } from '@/lib/gift-request-identity';
import { TargetConfirmationError } from '@/lib/target-confirmation';
import { targetConfirmationService } from '@/lib/target-confirmation-server';
import { DlmWalletIdentityChangedError } from '@/lib/dlm-wallet-lock';
import { GiftForwardRejected, handleGiftExecutionForward } from '@/lib/gift-execution-forward';
import { readAdminJsonWrite } from '@/lib/admin-write-request';
import { getServerSession } from '@/lib/session';
import { readTargetConfirmationCaller } from '@/lib/target-confirmation-service';
import { assertPreparedGiftRecovery, buildGiftRecoveryPreparation, GiftRecoveryConflict } from '@/lib/gift-execution-recovery';
import {
  COUPON_VOUCHER_META,
  GIFT_NAME_BY_PRIZE_NAME,
  inferPrizeTypeByPrizeName,
  VANITY_CARD_PRIZE_NAMES,
} from '@/lib/voucherCatalog';

type UsePayload =
  | { lotteryId?: string; couponId?: string; mode: 'gift'; target: string; prizeName?: string; confirmationToken?: string; requestId?: string }
  | { lotteryId?: string; couponId?: string; mode: 'selfuse'; prizeName?: string };

const isVanityCardPrize = (name: string | undefined | null) => {
  if (!name) return false;
  return VANITY_CARD_PRIZE_NAMES.has(name.trim());
};

const callGiftWebhook = async (params: {
  identity: ReturnType<typeof buildGiftIdentityPayload>;
  giftName: string;
  quantity?: number;
  lotteryId?: string;
  couponId?: string;
  requestId?: string;
  connection: { endpoint: string; token: string };
}) => {
  const payload = {
    ...params.identity,
    giftName: params.giftName,
    quantity: params.quantity ?? 1,
    anonymous: false,
    lotteryId: params.lotteryId,
    couponId: params.couponId,
    requestId: params.requestId,
  };
  return postVoucherUseRequest({ ...params.connection, payload, unconfirmedMessage: GIFT_RESULT_UNCONFIRMED });
};

export async function POST(request: Request) {
  const parsed = await readAdminJsonWrite(request.clone());
  if (!parsed.ok) return parsed.response;
  const candidate = parsed.body;
  if (candidate?.mode === 'gift') return handleGiftExecutionForward(request, {
    prepare: async body => {
      const session = await getServerSession();
      if (!session) throw new GiftForwardRejected('未登录', 401);
      const currentUser = await readTargetConfirmationCaller(prisma, session);
      const port = process.env.INTERNAL_API_PORT;
      const token = process.env.INTERNAL_API_TOKEN;
      if (!port || !token) {
        console.error('[lottery.gift] missing INTERNAL_API_PORT/INTERNAL_API_TOKEN');
        throw new GiftForwardRejected('赠礼服务暂不可用，本次尚未提交，请稍后再试或联系客服。', 503);
      }
      const connection = { endpoint: `http://${process.env.INTERNAL_API_HOST ?? '127.0.0.1'}:${port}/internal/gift-execution/v1/gift`, token };
      try {
        const proof = await targetConfirmationService().verify(body.confirmationToken, currentUser, {
          purpose: 'gift', target: body.target, prizeName: body.prizeName, couponId: body.couponId, lotteryId: body.lotteryId,
        });
        const prepared = buildGiftRecoveryPreparation(proof, 'VOUCHER_GIFT', session.username);
        await prisma.$transaction(tx => assertPreparedGiftRecovery(tx, session, body.requestId, prepared.intent), { isolationLevel: 'RepeatableRead' });
        const selected = proof.selectedVoucher!;
        return { connection, identity: buildGiftIdentityPayload(currentUser, proof.target),
          giftName: GIFT_NAME_BY_PRIZE_NAME[selected.prizeName] ?? selected.prizeName.replace(/代金券$/, ''), quantity: 1,
          lotteryId: selected.source === 'lottery' ? selected.voucherId : undefined,
          couponId: selected.source === 'lottery' ? undefined : selected.voucherId };
      } catch (error) {
        if (error instanceof GiftRecoveryConflict) throw new GiftForwardRejected(error.message, error.status);
        if (error instanceof TargetConfirmationError) throw new GiftForwardRejected(error.message, error.status, error.code);
        if (error instanceof GiftRequestIdentityError) throw new GiftForwardRejected(error.message, 409);
        throw error;
      }
    },
    send: (payload, requestId) => callGiftWebhook({ ...payload, requestId }),
  });
  const currentUser = await getCurrentDlmUser(request);
  if (!currentUser) {
    return NextResponse.json({ error: await renderSiteCopy("site.app.api.lottery.use.route.e8041a8c9358") }, { status: 401 });
  }

  const body = candidate as Partial<UsePayload>;
  const lotteryId = typeof body.lotteryId === 'string' ? body.lotteryId : '';
  const couponId = typeof body.couponId === 'string' ? body.couponId : '';
  const mode = body.mode;

  if ((!lotteryId && !couponId) || (mode !== 'gift' && mode !== 'selfuse')) {
    return NextResponse.json({ error: await renderSiteCopy("site.app.api.lottery.use.route.3e64edf2ea33") }, { status: 400 });
  }

  const now = new Date();
  let prizeName = typeof body.prizeName === 'string' ? body.prizeName.trim() : '';
  let prizeType: LotteryPrizeType = LotteryPrizeType.COUPON;
  let source: 'coupon' | 'lottery' | 'pointshop' = 'lottery';

  if (couponId) {
    const coupon = await prisma.coupon.findFirst({
      where: {
        id: couponId,
        dlmId: currentUser.dlmId,
        status: CouponStatus.ACTIVE,
        issuedAt: newEntityOnlyTime(),
        expiresAt: { gt: now },
      },
      select: { id: true, type: true },
    });
    if (coupon) {
      const mapped = COUPON_VOUCHER_META[coupon.type];
      if (!mapped) {
        return NextResponse.json({ error: await renderSiteCopy("site.app.api.lottery.use.route.76d4b775c0a5") }, { status: 400 });
      }
      prizeName = mapped.prizeName;
      prizeType = mapped.prizeType;
      source = 'coupon';
    } else {
      const pointShopGrant = await prisma.pointShopGrant.findFirst({
        where: {
          id: couponId,
          dlmId: currentUser.dlmId,
          deliveryType: PointShopDeliveryType.COUPON,
          deliveryStatus: PointShopDeliveryStatus.DELIVERED,
          couponStatus: CouponStatus.ACTIVE,
          issuedAt: newEntityOnlyTime(),
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        },
        select: { id: true, couponType: true, itemName: true },
      });

      if (!pointShopGrant?.couponType) {
        if (!pointShopGrant?.itemName) {
          return NextResponse.json({ error: await renderSiteCopy("site.app.api.lottery.use.route.1742c6e3eea5") }, { status: 409 });
        }
        prizeName = pointShopGrant.itemName.trim();
        prizeType = inferPrizeTypeByPrizeName(prizeName);
        source = 'pointshop';
      } else {
        const mapped = COUPON_VOUCHER_META[pointShopGrant.couponType];
        if (!mapped) {
          return NextResponse.json({ error: await renderSiteCopy("site.app.api.lottery.use.route.76d4b775c0a5") }, { status: 400 });
        }
        prizeName = mapped.prizeName;
        prizeType = mapped.prizeType;
        source = 'pointshop';
      }
    }
  } else {
    const draw = await prisma.lotteryDraw.findFirst({
      where: {
        id: lotteryId,
        dlmId: currentUser.dlmId,
        createdAt: newEntityOnlyTime(),
      },
      include: {
        prize: { select: { name: true, type: true } },
      },
    });

    if (!draw) {
      return NextResponse.json({ error: await renderSiteCopy("site.app.api.lottery.use.route.4349e2c2af16") }, { status: 404 });
    }
    if (draw.status !== LotteryStatus.UNUSED) {
      return NextResponse.json({ error: await renderSiteCopy("site.app.api.lottery.use.route.280d4a373cb6") }, { status: 409 });
    }
    if (draw.consumeAt || (draw.expiresAt && draw.expiresAt.getTime() <= now.getTime())) {
      return NextResponse.json({ error: await renderSiteCopy("site.app.api.lottery.use.route.280d4a373cb6") }, { status: 409 });
    }
    prizeName = draw.prize?.name ?? prizeName;
    prizeType = draw.prize?.type ?? LotteryPrizeType.COUPON;
  }

  if (mode === 'selfuse') {
    const isVanityCard = isVanityCardPrize(prizeName);
    if (prizeType !== LotteryPrizeType.SELFUSE && !isVanityCard) {
      return NextResponse.json({ error: await renderSiteCopy("site.app.api.lottery.use.route.e8b67071c282") }, { status: 400 });
    }

    // Vanity cards: let bot consume & notify via internal API
    if (isVanityCard) {
      if (!currentUser.discordUserId) {
        return NextResponse.json({ error: await renderSiteCopy("site.app.api.lottery.use.route.137a22b366cc") }, { status: 400 });
      }
      const port = process.env.INTERNAL_API_PORT;
      const host = process.env.INTERNAL_API_HOST ?? '127.0.0.1';
      const token = process.env.INTERNAL_API_TOKEN;
      if (!port || !token) {
        console.error('[lottery.use] missing INTERNAL_API_PORT/INTERNAL_API_TOKEN');
        return NextResponse.json({ error: await renderSiteCopy("site.app.api.lottery.use.route.3f8c5a6674cc") }, { status: 500 });
      }
      try {
        await postVoucherUseRequest({
          endpoint: `http://${host}:${port}/internal/rename-card`,
          token,
          payload: { ...buildVoucherIdentityPayload(currentUser), voucherId: couponId || lotteryId },
        });
      } catch (error) {
        if (error instanceof VoucherRequestIdentityError) {
          return NextResponse.json({ error: (await getSiteCopy()).text(error.message, "site.lib.public.error.messages") }, { status: 409 });
        }
        if (error instanceof VoucherInternalRequestError) {
          return NextResponse.json({ error: error.message }, { status: error.status });
        }
        throw error;
      }
      return NextResponse.json({ ok: true });
    }

    try {
      const updateResult = await prisma.$transaction((tx) => consumeSelfUseVoucherTx(tx, {
        identity: { dlmId: currentUser.dlmId, discordUserId: currentUser.discordUserId },
        source,
        voucherId: source === 'lottery' ? lotteryId : couponId,
      }));
      if (updateResult.count !== 1) {
        return NextResponse.json({ error: await renderSiteCopy("site.app.api.lottery.use.route.280d4a373cb6") }, { status: 409 });
      }
    } catch (error) {
      if (error instanceof DlmWalletIdentityChangedError) {
        return NextResponse.json({ error: await renderSiteCopy("site.app.api.lottery.use.route.0b206884f138") }, { status: 409 });
      }
      throw error;
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: await renderSiteCopy("site.app.api.lottery.use.route.a2073de04c24") }, { status: 400 });
}
