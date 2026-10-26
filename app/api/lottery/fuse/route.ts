import { renderSiteCopy } from "@/lib/site-copy-server";
import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { CouponStatus, LotteryStatus, PointShopDeliveryStatus, PointShopDeliveryType } from '@prisma/client';
import { getCurrentDlmUser } from '@/lib/current-dlm-user';
import {
  buildLotteryFusionApiError,
  LotteryFusionApiError,
  parseLotteryFusionSourceRef,
} from '@/lib/lottery-fusion';
import { newEntityOnlyTime } from '@/lib/operating-entity-cutover';
import { prisma } from '@/lib/prisma';

type FusePayload = {
  sourceIds?: string[];
  lotteryIds?: string[];
};

const INTERNAL_HOST = process.env.INTERNAL_API_HOST ?? '127.0.0.1';
const INTERNAL_PORT = process.env.INTERNAL_API_PORT;
const INTERNAL_TOKEN = process.env.INTERNAL_API_TOKEN;
const ALLOWED_FUSION_COUNTS = new Set([3, 4, 6]);

const buildRequestId = (dlmId: string, lotteryIds: string[]) => {
  const digest = createHash('sha256').update(`${dlmId}:${lotteryIds.join(',')}`).digest('hex');
  return `WEB_FUSION:${digest.slice(0, 24)}`;
};

const hasOnlyAvailableNewEntityFusionSources = async (params: {
  dlmId: string;
  sourceIds: string[];
  now: Date;
}) => {
  const parsedSources = params.sourceIds.map(parseLotteryFusionSourceRef);
  if (parsedSources.some((source) => !source)) return false;

  const lotteryIds = parsedSources
    .filter((source) => source?.kind === 'lottery')
    .map((source) => source!.id);
  const couponIds = parsedSources
    .filter((source) => source?.kind === 'coupon')
    .map((source) => source!.id);
  const pointShopIds = parsedSources
    .filter((source) => source?.kind === 'pointshop')
    .map((source) => source!.id);
  const [lotteryCount, couponCount, pointShopCount] = await Promise.all([
    lotteryIds.length
      ? prisma.lotteryDraw.count({
          where: {
            id: { in: lotteryIds },
            dlmId: params.dlmId,
            createdAt: newEntityOnlyTime(),
            status: LotteryStatus.UNUSED,
            consumeAt: null,
            OR: [{ expiresAt: null }, { expiresAt: { gt: params.now } }],
          },
        })
      : 0,
    couponIds.length
      ? prisma.coupon.count({
          where: {
            id: { in: couponIds },
            dlmId: params.dlmId,
            issuedAt: newEntityOnlyTime(),
            status: CouponStatus.ACTIVE,
            consumedAt: null,
            expiresAt: { gt: params.now },
          },
        })
      : 0,
    pointShopIds.length
      ? prisma.pointShopGrant.count({
          where: {
            id: { in: pointShopIds },
            dlmId: params.dlmId,
            issuedAt: newEntityOnlyTime(),
            deliveryType: PointShopDeliveryType.COUPON,
            deliveryStatus: PointShopDeliveryStatus.DELIVERED,
            couponStatus: CouponStatus.ACTIVE,
            consumedAt: null,
            OR: [{ expiresAt: null }, { expiresAt: { gt: params.now } }],
          },
        })
      : 0,
  ]);

  return lotteryCount === lotteryIds.length && couponCount === couponIds.length && pointShopCount === pointShopIds.length;
};

const callInternalFusion = async (params: {
  dlmId: string;
  sourceIds: string[];
  requestId: string;
}) => {
  if (!INTERNAL_PORT || !INTERNAL_TOKEN) {
    console.error('[lottery.fuse] missing INTERNAL_API_PORT/INTERNAL_API_TOKEN');
    throw new LotteryFusionApiError('内部接口未配置（INTERNAL_API_PORT/INTERNAL_API_TOKEN）', 500);
  }

  const endpoint = `http://${INTERNAL_HOST}:${INTERNAL_PORT}/internal/lottery/fuse`;
  let response: Response;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Token': INTERNAL_TOKEN,
        },
        body: JSON.stringify(params),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }
  } catch (error) {
    console.error('[lottery.fuse] request failed', error);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new LotteryFusionApiError('暂时无法确认重铸结果，请先查看背包，勿重复提交。', 504);
    }
    throw new LotteryFusionApiError('暂时无法确认重铸结果，请先查看背包，勿重复提交。', 503);
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error('[lottery.fuse] upstream rejected', { status: response.status, error: data?.error });
    const code = typeof data?.error === 'string' ? data.error : '';
    throw buildLotteryFusionApiError({
      code,
      fallbackStatus: response.status >= 500 ? 502 : response.status,
      fallbackMessage: response.status >= 500 ? '暂时无法确认重铸结果，请先查看背包，勿重复提交。' : '重铸失败，请稍后重试',
    });
  }

  return data;
};

export async function POST(request: Request) {
  const currentUser = await getCurrentDlmUser(request);
  if (!currentUser) {
    return NextResponse.json({ error: await renderSiteCopy("site.app.api.lottery.fuse.route.e8041a8c9358") }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as FusePayload;
  const sourceIds = Array.isArray(body?.sourceIds)
    ? [...new Set(body.sourceIds.map((value) => String(value ?? '').trim()).filter(Boolean))].sort()
    : Array.isArray(body?.lotteryIds)
      ? [...new Set(body.lotteryIds.map((value) => String(value ?? '').trim()).filter(Boolean))].sort()
    : [];

  if (!ALLOWED_FUSION_COUNTS.has(sourceIds.length)) {
    return NextResponse.json({ error: await renderSiteCopy("site.app.api.lottery.fuse.route.e675865c7663") }, { status: 400 });
  }
  if (!await hasOnlyAvailableNewEntityFusionSources({
    dlmId: currentUser.dlmId,
    sourceIds,
    now: new Date(),
  })) {
    return NextResponse.json({ error: await renderSiteCopy("site.app.api.lottery.fuse.route.34247b87b596") }, { status: 409 });
  }

  try {
    const data = await callInternalFusion({
      dlmId: currentUser.dlmId,
      sourceIds,
      requestId: buildRequestId(currentUser.dlmId, sourceIds),
    });
    return NextResponse.json({ ok: true, result: data?.result ?? null });
  } catch (error) {
    console.error('[lottery.fuse] failed', error);
    const status = error instanceof LotteryFusionApiError ? error.status : 500;
    const message = error instanceof LotteryFusionApiError ? error.message : '暂时无法确认重铸结果，请先查看背包，勿重复提交。';
    const code = error instanceof LotteryFusionApiError ? error.code ?? null : null;
    return NextResponse.json(
      { error: message, code },
      { status },
    );
  }
}
