import {
  PEIWAN_GAME_TAG_FIELDS,
  PEIWAN_LEVEL_OPTIONS,
  PEIWAN_QUOTATION_FIELDS,
  PEIWAN_SEX_OPTIONS,
  PEIWAN_STATUS_OPTIONS,
  PEIWAN_TYPE_OPTIONS,
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
  type: (typeof PEIWAN_TYPE_OPTIONS)[number];
  level: (typeof PEIWAN_LEVEL_OPTIONS)[number];
  sex: (typeof PEIWAN_SEX_OPTIONS)[number];
  techTag: boolean;
  exclusive: boolean;
  quotationValues: Partial<Record<(typeof PEIWAN_QUOTATION_FIELDS)[number], number>>;
  gameTags: Partial<Record<(typeof PEIWAN_GAME_TAG_FIELDS)[number], boolean>>;
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

const optionalNumber = (value: unknown) => {
  if (value === null || value === undefined || value === '') return undefined;
  const numeric = Number(value);
  if (Number.isNaN(numeric)) {
    throw new Error('报价必须为数字');
  }
  return numeric;
};

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

  const totalEarnRaw = optionalNumber((data as Record<string, unknown>).totalEarn);
  if (totalEarnRaw !== undefined && totalEarnRaw < 0) {
    throw new Error('累计流水必须为非负数字');
  }

  const mpUrlValue = typeof data.MP_url === 'string' ? data.MP_url.trim() : undefined;

  const status = optionalEnum(data.status, PEIWAN_STATUS_OPTIONS);
  const type = ensureEnum(data.type, PEIWAN_TYPE_OPTIONS, '类型');
  const level = ensureEnum(data.level, PEIWAN_LEVEL_OPTIONS, '等级');
  const sex = ensureEnum(data.sex, PEIWAN_SEX_OPTIONS, '性别');

  const techTag = typeof data.techTag === 'boolean' ? data.techTag : false;
  const exclusive = typeof data.exclusive === 'boolean' ? data.exclusive : false;

  let peiwanId: number | undefined;
  if (options.allowPeiwanId) {
    const rawId = (data as Record<string, unknown>).peiwanId;
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
    if (field in data) {
      const numeric = optionalNumber((data as Record<string, unknown>)[field]);
      if (numeric !== undefined) {
        quotationValues[field] = numeric;
      }
    }
  }

  const gameTags: NormalizedPeiwanPayload['gameTags'] = {};
  const tagsInput = ensureObject(data.gameTags);
  for (const tag of PEIWAN_GAME_TAG_FIELDS) {
    if (typeof tagsInput[tag] === 'boolean') {
      gameTags[tag] = tagsInput[tag] as boolean;
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
    type,
    level,
    sex,
    techTag,
    exclusive,
    quotationValues,
    gameTags,
  };
};

export const buildPeiwanDataObject = (payload: NormalizedPeiwanPayload) => {
  const quotationData: Record<string, string> = {};
  for (const [field, value] of Object.entries(payload.quotationValues)) {
    if (value !== undefined) {
      quotationData[field] = value.toString();
    }
  }

  const tagData: Record<string, boolean> = {};
  for (const tag of PEIWAN_GAME_TAG_FIELDS) {
    if (payload.gameTags[tag] !== undefined) {
      tagData[tag] = payload.gameTags[tag] as boolean;
    }
  }

  return {
    defaultQuotationCode: payload.defaultQuotationCode,
    commissionRate: payload.commissionRate.toString(),
    MP_url: payload.mpUrl ?? null,
    ...(payload.status ? { status: payload.status } : {}),
    type: payload.type,
    level: payload.level,
    sex: payload.sex,
    techTag: payload.techTag,
    exclusive: payload.exclusive,
    ...(payload.totalEarn !== undefined ? { totalEarn: payload.totalEarn.toString() } : {}),
    ...quotationData,
    ...tagData,
  };
};

export type { NormalizedPeiwanPayload };
