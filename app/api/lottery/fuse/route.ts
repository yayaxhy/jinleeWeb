import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getCurrentJinleeUser } from '@/lib/current-jinlee-user';
import { buildLotteryFusionApiError, LotteryFusionApiError } from '@/lib/lottery-fusion';

type FusePayload = {
  sourceIds?: string[];
  lotteryIds?: string[];
};

const INTERNAL_HOST = process.env.INTERNAL_API_HOST ?? '127.0.0.1';
const INTERNAL_PORT = process.env.INTERNAL_API_PORT;
const INTERNAL_TOKEN = process.env.INTERNAL_API_TOKEN;
const ALLOWED_FUSION_COUNTS = new Set([3, 4, 6]);

const buildRequestId = (jinleeId: string, lotteryIds: string[]) => {
  const digest = createHash('sha256').update(`${jinleeId}:${lotteryIds.join(',')}`).digest('hex');
  return `WEB_FUSION:${digest.slice(0, 24)}`;
};

const callInternalFusion = async (params: {
  jinleeId: string;
  sourceIds: string[];
  requestId: string;
}) => {
  if (!INTERNAL_PORT || !INTERNAL_TOKEN) {
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
    if (error instanceof Error && error.name === 'AbortError') {
      throw new LotteryFusionApiError('重铸服务超时，请稍后重试', 504);
    }
    throw new LotteryFusionApiError('重铸服务暂不可用，请稍后重试', 503);
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const code = typeof data?.error === 'string' ? data.error : '';
    throw buildLotteryFusionApiError({
      code,
      fallbackStatus: response.status >= 500 ? 502 : response.status,
      fallbackMessage: response.status >= 500 ? '重铸服务暂不可用，请稍后重试' : '重铸失败，请稍后重试',
    });
  }

  return data;
};

export async function POST(request: Request) {
  const currentUser = await getCurrentJinleeUser(request);
  if (!currentUser) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as FusePayload;
  const sourceIds = Array.isArray(body?.sourceIds)
    ? [...new Set(body.sourceIds.map((value) => String(value ?? '').trim()).filter(Boolean))].sort()
    : Array.isArray(body?.lotteryIds)
      ? [...new Set(body.lotteryIds.map((value) => String(value ?? '').trim()).filter(Boolean))].sort()
    : [];

  if (!ALLOWED_FUSION_COUNTS.has(sourceIds.length)) {
    return NextResponse.json({ error: '仅支持 3 / 4 / 6 个券或奖品融合' }, { status: 400 });
  }

  try {
    const data = await callInternalFusion({
      jinleeId: currentUser.jinleeId,
      sourceIds,
      requestId: buildRequestId(currentUser.jinleeId, sourceIds),
    });
    return NextResponse.json({ ok: true, result: data?.result ?? null });
  } catch (error) {
    const status = error instanceof LotteryFusionApiError ? error.status : 500;
    const message = error instanceof Error ? error.message : '重铸服务暂不可用，请稍后重试';
    const code = error instanceof LotteryFusionApiError ? error.code ?? null : null;
    return NextResponse.json(
      { error: message, code },
      { status },
    );
  }
}
