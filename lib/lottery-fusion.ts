export type LotteryFusionPool = 'NORMAL' | 'MEDIUM' | 'ADVANCED' | 'SPECIAL';
export type LotteryFusionCount = 3 | 4 | 6;
export type LotteryFusionStatus = 'UNUSED' | 'USED' | 'EXPIRED';
export type LotteryFusionSourceKind = 'lottery' | 'coupon' | 'pointshop';

export const LOTTERY_FUSION_DRAW_NONCE_PREFIX = 'fusion:';
const LOTTERY_FUSION_SOURCE_KINDS = ['lottery', 'coupon', 'pointshop'] as const;

export const LOTTERY_FUSION_RULES: Record<
  LotteryFusionCount,
  {
    count: LotteryFusionCount;
    title: string;
    resultLabel: string;
    eligibleRangeLabel: string;
    detail: string;
  }
> = {
  3: {
    count: 3,
    title: '3 个融合',
    resultLabel: '金色奖品',
    eligibleRangeLabel: '银色 / 金色',
    detail: '结果只会出银色或金色，最高金色',
  },
  4: {
    count: 4,
    title: '4 个融合',
    resultLabel: '高级奖品',
    eligibleRangeLabel: '银色 / 金色 / 高级',
    detail: '结果只会出银色、金色或高级，最高高级',
  },
  6: {
    count: 6,
    title: '6 个融合',
    resultLabel: '特殊奖品',
    eligibleRangeLabel: '金色 / 高级 / 特殊（不会出银色奖品）',
    detail: '结果只会出金色、高级或特殊，不会出银色',
  },
};

const LOTTERY_FUSION_INTERNAL_ERROR_META: Record<
  string,
  { message: string; status: number }
> = {
  INVALID_SOURCE_COUNT: { message: '仅支持 3 / 4 / 6 个奖品融合', status: 400 },
  INVALID_SOURCE_IDS: { message: '奖品选择无效，请重新选择', status: 400 },
  SOURCE_ITEM_UNAVAILABLE: { message: '所选奖品已使用、已过期或已被融合，请刷新后重试', status: 409 },
  NO_SOURCE_ITEM: { message: '未找到可融合的奖品', status: 400 },
  NO_FALLBACK_PRIZE: { message: '当前重铸奖池暂无可用奖品，请稍后再试', status: 409 },
  NO_PRIZE_AVAILABLE: { message: '当前重铸奖池暂无可用奖品，请稍后再试', status: 409 },
  user_not_found: { message: '用户不存在', status: 404 },
  missing_fields: { message: '参数不完整', status: 400 },
};

export class LotteryFusionApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'LotteryFusionApiError';
    this.status = status;
    this.code = code;
  }
}

export const isLotteryFusionNonce = (nonce?: string | null) =>
  typeof nonce === 'string' && nonce.startsWith(LOTTERY_FUSION_DRAW_NONCE_PREFIX);

export const buildLotteryFusionSourceRef = (kind: LotteryFusionSourceKind, id: string) =>
  `${kind}:${id}`;

export const parseLotteryFusionSourceRef = (
  value?: string | null,
): { kind: LotteryFusionSourceKind; id: string } | null => {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized) return null;
  const separatorIndex = normalized.indexOf(':');
  if (separatorIndex < 0) {
    return { kind: 'lottery', id: normalized };
  }

  const kind = normalized.slice(0, separatorIndex) as LotteryFusionSourceKind;
  const id = normalized.slice(separatorIndex + 1).trim();
  if (!LOTTERY_FUSION_SOURCE_KINDS.includes(kind) || !id) return null;
  return { kind, id };
};

export const isLotteryFusionCount = (value: number): value is LotteryFusionCount =>
  value === 3 || value === 4 || value === 6;

export const resolveLotteryFusionDisplayStatus = (
  status: LotteryFusionStatus,
  expiresAt?: Date | string | null,
  now = new Date(),
): LotteryFusionStatus => {
  if (status !== 'UNUSED') return status;
  if (!expiresAt) return status;
  const expiry = expiresAt instanceof Date ? expiresAt : new Date(expiresAt);
  if (Number.isNaN(expiry.getTime())) return status;
  return expiry.getTime() <= now.getTime() ? 'EXPIRED' : status;
};

export const buildLotteryFusionApiError = (params: {
  code?: string;
  fallbackStatus?: number;
  fallbackMessage?: string;
}) => {
  const meta = params.code ? LOTTERY_FUSION_INTERNAL_ERROR_META[params.code] : null;
  if (meta) {
    return new LotteryFusionApiError(meta.message, meta.status, params.code);
  }

  if ((params.fallbackStatus ?? 500) >= 500) {
    return new LotteryFusionApiError(
      params.fallbackMessage ?? '重铸服务暂不可用，请稍后重试',
      params.fallbackStatus ?? 500,
      params.code,
    );
  }

  return new LotteryFusionApiError(
    params.fallbackMessage ?? '重铸失败，请稍后重试',
    params.fallbackStatus ?? 400,
    params.code,
  );
};

type FusionHistoryDrawShape = {
  id: string;
  requestId: string | null;
  createdAt: Date | string;
  pool: string;
  prizeName: string;
  prizeType: string;
  imageUrl: string | null;
};

export type LotteryFusionHistoryOutputShape = FusionHistoryDrawShape & {
  nonce: string;
  status: LotteryFusionStatus;
  expiresAt: Date | string | null;
  consumeAt: Date | string | null;
};

export type LotteryFusionHistorySourceShape = FusionHistoryDrawShape & {
  sourceKind: LotteryFusionSourceKind;
  consumeAt: Date | string | null;
};

export type LotteryFusionHistoryEntry = {
  requestId: string;
  drawId: string;
  createdAt: string;
  fusionCount: number;
  rule: (typeof LOTTERY_FUSION_RULES)[LotteryFusionCount] | null;
  result: {
    drawId: string;
    prizeName: string;
    prizeType: string;
    pool: string;
    imageUrl: string | null;
    status: LotteryFusionStatus;
    createdAt: string;
    expiresAt: string | null;
    consumeAt: string | null;
  };
  sourceItems: Array<{
    id: string;
    sourceKind: LotteryFusionSourceKind;
    prizeName: string;
    prizeType: string;
    pool: string;
    imageUrl: string | null;
    createdAt: string;
    consumeAt: string | null;
  }>;
};

const toIso = (value: Date | string | null | undefined) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

const toMillis = (value: Date | string | null | undefined) => {
  if (!value) return 0;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
};

export const buildLotteryFusionHistoryEntries = (
  outputs: LotteryFusionHistoryOutputShape[],
  sources: LotteryFusionHistorySourceShape[],
  now = new Date(),
): LotteryFusionHistoryEntry[] => {
  const sourcesByRequestId = new Map<string, LotteryFusionHistorySourceShape[]>();

  for (const source of sources) {
    if (!source.requestId) continue;
    const current = sourcesByRequestId.get(source.requestId) ?? [];
    current.push(source);
    sourcesByRequestId.set(source.requestId, current);
  }

  return [...outputs]
    .sort((left, right) => toMillis(right.createdAt) - toMillis(left.createdAt))
    .map((output) => {
      const requestId = output.requestId ?? output.id;
      const sourceItems = [...(sourcesByRequestId.get(requestId) ?? [])].sort(
        (left, right) => toMillis(left.consumeAt ?? left.createdAt) - toMillis(right.consumeAt ?? right.createdAt),
      );
      const fusionCount = sourceItems.length;
      const rule = isLotteryFusionCount(fusionCount) ? LOTTERY_FUSION_RULES[fusionCount] : null;

      return {
        requestId,
        drawId: output.id,
        createdAt: toIso(output.createdAt) ?? new Date(0).toISOString(),
        fusionCount,
        rule,
        result: {
          drawId: output.id,
          prizeName: output.prizeName,
          prizeType: output.prizeType,
          pool: output.pool,
          imageUrl: output.imageUrl,
          status: resolveLotteryFusionDisplayStatus(output.status, output.expiresAt, now),
          createdAt: toIso(output.createdAt) ?? new Date(0).toISOString(),
          expiresAt: toIso(output.expiresAt),
          consumeAt: toIso(output.consumeAt),
        },
        sourceItems: sourceItems.map((source) => ({
          id: source.id,
          sourceKind: source.sourceKind,
          prizeName: source.prizeName,
          prizeType: source.prizeType,
          pool: source.pool,
          imageUrl: source.imageUrl,
          createdAt: toIso(source.createdAt) ?? new Date(0).toISOString(),
          consumeAt: toIso(source.consumeAt),
        })),
      };
    });
};

export const LOTTERY_FUSION_FALLBACK_POOL_BY_PRIZE_NAME: Partial<
  Record<string, LotteryFusionPool>
> = {
  '9折券': 'NORMAL',
  一日冠75折券: 'ADVANCED',
  月冠名92折券: 'SPECIAL',
  月冠名9折券: 'SPECIAL',
  刮刮乐代金券: 'NORMAL',
  陪玩评语券: 'NORMAL',
  '5位数靓号卡': 'ADVANCED',
  '抽成降1%券': 'SPECIAL',
};

export const resolveLotteryFusionPoolFallback = (prizeName?: string | null): LotteryFusionPool => {
  const normalized = prizeName?.trim() ?? '';
  if (normalized && LOTTERY_FUSION_FALLBACK_POOL_BY_PRIZE_NAME[normalized]) {
    return LOTTERY_FUSION_FALLBACK_POOL_BY_PRIZE_NAME[normalized] as LotteryFusionPool;
  }
  return 'NORMAL';
};
