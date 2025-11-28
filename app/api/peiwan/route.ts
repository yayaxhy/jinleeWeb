import { NextResponse } from 'next/server';
import {
  PEIWAN_GAME_TAG_FIELDS,
  PEIWAN_LEVEL_OPTIONS,
  PEIWAN_SEX_OPTIONS,
  QUOTATION_CODE_TO_FIELD,
} from '@/constants/peiwan';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

const MAX_PAGE_SIZE = 50;
const BLOCKED_DISCORD_IDS = [
  '734159747367829636',
  '525770714574225408',
  '1439777142899474433',
  '1440688775129862189',
];

const normalizePage = (value: string | null, fallback: number) => {
  const parsed = value ? Number.parseInt(value, 10) : fallback;
  return Number.isNaN(parsed) || parsed < 1 ? fallback : parsed;
};

const normalizePageSize = (value: string | null, fallback: number) => {
  const parsed = value ? Number.parseInt(value, 10) : fallback;
  if (Number.isNaN(parsed) || parsed < 1) return fallback;
  return Math.min(MAX_PAGE_SIZE, parsed);
};

const normalizeEnum = (value: string | null, allowed: readonly string[]) =>
  value && allowed.includes(value) ? value : null;

const parseGames = (value: string | null) => {
  if (!value) return [];
  return value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => PEIWAN_GAME_TAG_FIELDS.includes(item as (typeof PEIWAN_GAME_TAG_FIELDS)[number]));
};

const parseBoolean = (value: string | null) => value === 'true' || value === '1';

const hashSeed = (seed: string) => {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i += 1) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return (h ^ (h >>> 16)) >>> 0;
};

const mulberry32 = (a: number) => {
  return () => {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const shuffleWithSeed = <T>(arr: T[], seed: string) => {
  const rng = mulberry32(hashSeed(seed) || 1);
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const searchParams = url.searchParams;

  const page = normalizePage(searchParams.get('page'), 1);
  const pageSize = normalizePageSize(searchParams.get('pageSize'), 12);
  const seed = searchParams.get('seed') ?? Math.random().toString(36).slice(2, 10);

  const rawId = searchParams.get('id');
  const peiwanId = rawId ? Number.parseInt(rawId, 10) : null;

  const level = normalizeEnum(searchParams.get('level'), PEIWAN_LEVEL_OPTIONS) as
    | (typeof PEIWAN_LEVEL_OPTIONS)[number]
    | null;
  const sexParam = searchParams.get('gender');
  const sex =
    sexParam === 'female'
      ? ('小姐姐' as (typeof PEIWAN_SEX_OPTIONS)[number])
      : sexParam === 'male'
        ? ('小哥哥' as (typeof PEIWAN_SEX_OPTIONS)[number])
        : null;

  const games = parseGames(searchParams.get('games'));
  const techTag = parseBoolean(searchParams.get('techTag'));

  const where: Prisma.PEIWANWhereInput = {};

  if (BLOCKED_DISCORD_IDS.length > 0) {
    where.discordUserId = { notIn: BLOCKED_DISCORD_IDS };
  }
  if (peiwanId !== null && !Number.isNaN(peiwanId)) {
    where.PEIWANID = peiwanId;
  }
  if (level) {
    where.level = level;
  }
  if (sex) {
    where.sex = sex;
  }
  if (techTag) {
    where.techTag = true;
  }
  if (games.length > 0) {
    where.OR = games.map((game) => ({ [game]: true }));
  }

  const skip = (page - 1) * pageSize;

  const [total, rows] = await Promise.all([
    prisma.pEIWAN.count({ where }),
    prisma.pEIWAN.findMany({
      where,
      include: { member: { select: { serverDisplayName: true, discordUserId: true } } },
      orderBy: { PEIWANID: 'asc' },
    }),
  ]);

  const shuffledRows = shuffleWithSeed([...rows], seed).slice(skip, skip + pageSize);

  const data = shuffledRows.map((row) => {
    const priceField = QUOTATION_CODE_TO_FIELD[row.defaultQuotationCode] as keyof typeof row;
    const rawPrice = (row as Record<string, unknown>)[priceField] as unknown;
    let normalizedPrice: string | number | null = null;
    if (rawPrice instanceof Prisma.Decimal) {
      normalizedPrice = rawPrice.toNumber();
    } else if (typeof rawPrice === 'bigint' || typeof rawPrice === 'number') {
      normalizedPrice = Number(rawPrice);
    } else if (typeof rawPrice === 'string') {
      const num = Number(rawPrice);
      normalizedPrice = Number.isNaN(num) ? rawPrice : num;
    }
    const gameTags: Record<string, boolean> = {};
    for (const tag of PEIWAN_GAME_TAG_FIELDS) {
      gameTags[tag] = Boolean((row as Record<string, unknown>)[tag]);
    }
    const displayName =
      row.serverDisplayName ?? row.member?.serverDisplayName ?? row.discordUserId;

    return {
      id: row.PEIWANID,
      discordUserId: row.discordUserId,
      serverDisplayName: displayName,
      quotationCode: row.defaultQuotationCode,
      price: normalizedPrice,
      level: row.level,
      sex: row.sex,
      techTag: row.techTag,
      mpUrl: row.MP_url,
      gameTags,
    };
  });

  return NextResponse.json({ data, total, page, pageSize, seed });
}
