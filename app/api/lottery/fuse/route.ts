import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getCurrentJinleeUser } from '@/lib/current-jinlee-user';

type FusePayload = {
  lotteryIds?: string[];
};

const INTERNAL_HOST = process.env.INTERNAL_API_HOST ?? '127.0.0.1';
const INTERNAL_PORT = process.env.INTERNAL_API_PORT;
const INTERNAL_TOKEN = process.env.INTERNAL_API_TOKEN;
const ALLOWED_FUSION_COUNTS = new Set([3, 4, 6]);

const ERROR_MESSAGE_BY_CODE: Record<string, string> = {
  INVALID_SOURCE_COUNT: '仅支持 3 / 4 / 6 个抽奖奖品融合',
  INVALID_SOURCE_IDS: '奖品选择无效，请重新选择',
  SOURCE_ITEM_UNAVAILABLE: '所选奖品已使用、已过期或已被融合，请刷新后重试',
  NO_SOURCE_ITEM: '未找到可融合的抽奖奖品',
  NO_FALLBACK_PRIZE: '当前融合奖池暂无可用奖品，请稍后再试',
  NO_PRIZE_AVAILABLE: '当前融合奖池暂无可用奖品，请稍后再试',
  user_not_found: '用户不存在',
  missing_fields: '参数不完整',
};

const buildRequestId = (jinleeId: string, lotteryIds: string[]) => {
  const digest = createHash('sha256').update(`${jinleeId}:${lotteryIds.join(',')}`).digest('hex');
  return `WEB_FUSION:${digest.slice(0, 24)}`;
};

const callInternalFusion = async (params: {
  jinleeId: string;
  lotteryIds: string[];
  requestId: string;
}) => {
  if (!INTERNAL_PORT || !INTERNAL_TOKEN) {
    throw new Error('内部接口未配置（INTERNAL_API_PORT/INTERNAL_API_TOKEN）');
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
      throw new Error('融合服务超时，请稍后重试');
    }
    throw new Error('融合服务暂不可用，请稍后重试');
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const code = typeof data?.error === 'string' ? data.error : '';
    throw new Error(ERROR_MESSAGE_BY_CODE[code] ?? '融合失败，请稍后重试');
  }

  return data;
};

export async function POST(request: Request) {
  const currentUser = await getCurrentJinleeUser(request);
  if (!currentUser) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as FusePayload;
  const lotteryIds = Array.isArray(body?.lotteryIds)
    ? [...new Set(body.lotteryIds.map((value) => String(value ?? '').trim()).filter(Boolean))].sort()
    : [];

  if (!ALLOWED_FUSION_COUNTS.has(lotteryIds.length)) {
    return NextResponse.json({ error: '仅支持 3 / 4 / 6 个抽奖奖品融合' }, { status: 400 });
  }

  try {
    const data = await callInternalFusion({
      jinleeId: currentUser.jinleeId,
      lotteryIds,
      requestId: buildRequestId(currentUser.jinleeId, lotteryIds),
    });
    return NextResponse.json({ ok: true, result: data?.result ?? null });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '融合失败，请稍后重试' },
      { status: 400 },
    );
  }
}
