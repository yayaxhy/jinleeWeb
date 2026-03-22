import {
  PEIWAN_LEVEL_OPTIONS,
  PEIWAN_QUOTATION_FIELDS,
  PEIWAN_SEX_OPTIONS,
  PEIWAN_STATUS_OPTIONS,
  QUOTATION_CODES,
} from '@/constants/peiwan';

type NormalizedPeiwanPayload = {
  discordUserId: string;
  peiwanId?: number;
  defaultQuotationCode: (typeof QUOTATION_CODES)[number];
  commissionRate: number;
  mpUrl?: string | null;
  totalEarn?: number;
  status?: (typeof PEIWAN_STATUS_OPTIONS)[number];
  level: (typeof PEIWAN_LEVEL_OPTIONS)[number];
  sex: (typeof PEIWAN_SEX_OPTIONS)[number];
  exclusive: boolean;
  quotationValues: Partial<Record<(typeof PEIWAN_QUOTATION_FIELDS)[number], number | null>>;
};

const ensureObject = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object') return {};
  return value as Record<string, unknown>;
};

const ensureEnum = <T extends readonly string[]>(value: unknown, allowed: T, field: string): T[number] => {
  if (typeof value !== 'string' || !allowed.includes(value as T[number])) {
    throw new Error(`${field} 无效`);
  }
  return value as T[number];
};

const optionalEnum = <T extends readonly string[]>(value: unknown, allowed: T): T[number] | undefined => {
  if (typeof value !== 'string') return undefined;
  return allowed.includes(value as T[number]) ? (value as T[number]) : undefined;
};

const ensureNumber = (value: unknown, field: string): number => {
  if (value === null || value === undefined || value === '') {
    throw new Error(`${field} 不能为空`);
  }
  const numeric = Number(value);
  if (Number.isNaN(numeric)) {
    throw new Error(`${field} 必须为数字`);
  }
  return numeric;
};

function optionalNumber(value: unknown, options?: { allowNull?: false }): number | undefined;
function optionalNumber(value: unknown, options: { allowNull: true }): number | null | undefined;
function optionalNumber(value: unknown, options: { allowNull?: boolean } = {}) {
  if (value === null) return options.allowNull ? null : undefined;
  if (value === undefined || value === '') return undefined;
  const numeric = Number(value);
  if (Number.isNaN(numeric)) {
    throw new Error('报价必须为数字');
  }
  return numeric;
}

export const normalizePeiwanPayload = (
  input: unknown,
  options: { requireDiscordId?: boolean; allowPeiwanId?: boolean } = {},
): NormalizedPeiwanPayload => {
  const data = ensureObject(input);
  const discordUserIdRaw = typeof data.discordUserId === 'string' ? data.discordUserId.trim() : '';
  const requireDiscordId = options.requireDiscordId ?? true;
  if (requireDiscordId && !discordUserIdRaw) {
    throw new Error('Discord ID 不能为空');
  }

  const defaultQuotationCode = ensureEnum(data.defaultQuotationCode, QUOTATION_CODES, '默认报价档位');
  const commissionRate = ensureNumber(data.commissionRate, '抽成比例');
  if (commissionRate < 0 || commissionRate > 1) {
    throw new Error('抽成比例需在 0-1 之间');
  }

  const totalEarnRaw = optionalNumber(data.totalEarn);
  if (totalEarnRaw !== undefined && totalEarnRaw < 0) {
    throw new Error('累计流水必须为非负数字');
  }

  const mpUrlValue = typeof data.MP_url === 'string' ? data.MP_url.trim() : undefined;
  const status = optionalEnum(data.status, PEIWAN_STATUS_OPTIONS);
  const level = ensureEnum(data.level, PEIWAN_LEVEL_OPTIONS, '等级');
  const sex = ensureEnum(data.sex, PEIWAN_SEX_OPTIONS, '性别');
  const exclusive = typeof data.exclusive === 'boolean' ? data.exclusive : false;

  let peiwanId: number | undefined;
  if (options.allowPeiwanId) {
    const rawId = data.peiwanId;
    if (rawId !== undefined && rawId !== null && rawId !== '') {
      const numeric = Number(rawId);
      if (!Number.isInteger(numeric) || numeric <= 0) {
        throw new Error('陪玩ID 必须为正整数');
      }
      peiwanId = numeric;
    }
  }

  const quotationValues: NormalizedPeiwanPayload['quotationValues'] = {};
  for (const field of PEIWAN_QUOTATION_FIELDS) {
    if (!(field in data)) continue;
    const numeric = optionalNumber(data[field], { allowNull: true });
    if (numeric !== undefined) {
      quotationValues[field] = numeric;
    }
  }

  return {
    discordUserId: discordUserIdRaw,
    peiwanId,
    defaultQuotationCode,
    commissionRate,
    totalEarn: totalEarnRaw,
    mpUrl: mpUrlValue || undefined,
    status,
    level,
    sex,
    exclusive,
    quotationValues,
  };
};

export const buildPeiwanDataObject = (payload: NormalizedPeiwanPayload) => {
  const quotationData: Record<string, string | null> = {};
  for (const [field, value] of Object.entries(payload.quotationValues)) {
    if (value === undefined) continue;
    quotationData[field] = value === null ? null : value.toString();
  }

  return {
    defaultQuotationCode: payload.defaultQuotationCode,
    commissionRate: payload.commissionRate.toString(),
    MP_url: payload.mpUrl ?? null,
    ...(payload.status ? { status: payload.status } : {}),
    level: payload.level,
    sex: payload.sex,
    exclusive: payload.exclusive,
    ...(payload.totalEarn !== undefined ? { totalEarn: payload.totalEarn.toString() } : {}),
    ...quotationData,
  };
};

export type { NormalizedPeiwanPayload };
