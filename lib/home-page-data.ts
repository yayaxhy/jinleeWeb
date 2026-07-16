import fs from 'fs/promises';
import path from 'path';

import {
  QUOTATION_CODE_TO_FIELD,
  QUOTATION_CODE_LABEL,
  type PeiwanGameCodeValue,
  type PeiwanGameTierValue,
  type QuotationCodeValue,
} from '@/constants/peiwan';
import { formatPeiwanGameProfile, sortPeiwanGameProfiles } from '@/lib/peiwan/gameProfiles';
import { formatAmountDown2, parseNumeric } from '@/lib/numberFormat';
import { prisma } from '@/lib/prisma';
import { getHighestVipLevelByTotalSpent } from '@/lib/vip-levels';

export type PeriodKey = '日榜' | '周榜' | '月榜';

export type RankingItem = {
  name: string;
  tag: string;
  tone: string;
  avatarUrl: string | null;
  anonymous?: boolean;
  vipLevel?: number;
};

export type RankingData = Record<PeriodKey, RankingItem[]>;

export type RecommendedCompanion = {
  id: number;
  name: string;
  game: string;
  price: string;
  image: string | null;
  highlight: string;
  description: string;
  tags: string[];
  tone: string;
  missing: string[];
};

export type RecentDispatchItem = {
  id: string;
  title: string;
  detail: string;
  timeLabel: string;
  statusLabel: string;
};

export type DataAuditItem = {
  label: string;
  value: string;
  status: 'ok' | 'warn';
};

export type HomePageData = {
  companionRankings: RankingData;
  bossRankings: RankingData;
  recommendedCompanions: RecommendedCompanion[];
  recentDispatches: RecentDispatchItem[];
  audit: DataAuditItem[];
  issues: string[];
};

const periodKeys: PeriodKey[] = ['日榜', '周榜', '月榜'];

const companionTones = [
  'from-[#ff6542] to-[#ff3d7f]',
  'from-[#6c63ff] to-[#38bdf8]',
  'from-[#facc15] to-[#fb7185]',
  'from-[#10b981] to-[#14b8a6]',
];

const bossTones = [
  'from-[#111827] to-[#6d28d9]',
  'from-[#b45309] to-[#ef4444]',
  'from-[#0f766e] to-[#22c55e]',
  'from-[#7f1d1d] to-[#be123c]',
];

const recommendationTones = [
  'from-[#ff6542] via-[#b83d2d] to-[#140807]',
  'from-[#2f7dff] via-[#2252b7] to-[#061126]',
  'from-[#e5a647] via-[#b45f64] to-[#130a0b]',
  'from-[#16a085] via-[#08785e] to-[#031512]',
  'from-[#8b5cf6] via-[#6d28d9] to-[#120821]',
];

const emptyRanking = (): RankingData => ({
  日榜: [],
  周榜: [],
  月榜: [],
});

const LEADERBOARD_TIME_ZONE = 'Europe/Rome';
const HOME_RANK_LIMIT = 10;
const EXCLUDED_USER_IDS = new Set(['1421651539247894549', '525770714574225408']);
const ANON_SPEND_USER_IDS = new Set(['525770714574225408']);
const SPEND_POSITIVE_TYPES = new Set(['点单', '打赏', '客服代打赏', '抽奖消费', '红包发出', '试音花费']);
const INCOME_POSITIVE_TYPES = new Set(['点单', '打赏', '客服代打赏', '红包收入', '试音收入']);
const REVERT_TYPES = new Set(['订单撤销', '打赏撤销']);

const parseTimeZoneOffsetMs = (raw: string) => {
  if (raw === 'GMT' || raw === 'UTC') return 0;

  const match = raw.match(/^GMT([+-])(\d{1,2})(?::?(\d{2}))?$/);
  if (!match) throw new Error(`Unsupported timezone offset: ${raw}`);

  const sign = match[1] === '-' ? -1 : 1;
  const hours = Number(match[2]);
  const minutes = Number(match[3] ?? 0);
  return sign * ((hours * 60 + minutes) * 60 * 1000);
};

const getTimeZoneOffsetMs = (date: Date) => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: LEADERBOARD_TIME_ZONE,
    timeZoneName: 'shortOffset',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const raw = parts.find((part) => part.type === 'timeZoneName')?.value ?? 'GMT';
  return parseTimeZoneOffsetMs(raw);
};

const formatZonedDateParts = (date: Date) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: LEADERBOARD_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
    .formatToParts(date)
    .reduce<Record<string, string>>((acc, part) => {
      if (part.type !== 'literal') acc[part.type] = part.value;
      return acc;
    }, {});

  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
  };
};

const zonedDateFromParts = (
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0,
  millisecond = 0,
) => {
  let instant = new Date(Date.UTC(year, month - 1, day, hour, minute, second, millisecond));
  for (let i = 0; i < 3; i += 1) {
    const offsetMs = getTimeZoneOffsetMs(instant);
    const next = new Date(Date.UTC(year, month - 1, day, hour, minute, second, millisecond) - offsetMs);
    if (next.getTime() === instant.getTime()) return next;
    instant = next;
  }
  return instant;
};

const addDaysUtc = (date: Date, days: number) => {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
};

const zonedDateStart = (date: Date) => {
  const { year, month, day } = formatZonedDateParts(date);
  return zonedDateFromParts(year, month, day);
};

const zonedWeekStart = (date: Date) => {
  const { year, month, day } = formatZonedDateParts(date);
  const dayOfWeek = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  const daysSinceMonday = (dayOfWeek + 6) % 7;
  return addDaysUtc(zonedDateFromParts(year, month, day), -daysSinceMonday);
};

const zonedMonthStart = (date: Date) => {
  const { year, month } = formatZonedDateParts(date);
  return zonedDateFromParts(year, month, 1);
};

const getLeaderboardRange = (period: PeriodKey, now = new Date()) => {
  if (period === '日榜') {
    const todayStart = zonedDateStart(now);
    const start = addDaysUtc(todayStart, -1);
    return { start, end: todayStart };
  }

  if (period === '周榜') {
    const thisWeekStart = zonedWeekStart(now);
    const start = addDaysUtc(thisWeekStart, -7);
    return { start, end: thisWeekStart };
  }

  const thisMonthStart = zonedMonthStart(now);
  const { year, month } = formatZonedDateParts(thisMonthStart);
  const lastMonthYear = month === 1 ? year - 1 : year;
  const lastMonth = month === 1 ? 12 : month - 1;
  const start = zonedDateFromParts(lastMonthYear, lastMonth, 1);
  return { start, end: thisMonthStart };
};

const formatPrice = (value: unknown) => {
  const formatted = formatAmountDown2(value);
  return formatted === '—' ? '价格待定' : `${formatted} 币/H 起`;
};

type PeiwanPriceField = (typeof QUOTATION_CODE_TO_FIELD)[QuotationCodeValue];
type PeiwanPriceRow = {
  defaultQuotationCode: QuotationCodeValue;
} & Partial<Record<PeiwanPriceField, unknown>>;

const getPeiwanPrice = (row: PeiwanPriceRow) => {
  const field = QUOTATION_CODE_TO_FIELD[row.defaultQuotationCode];
  return formatPrice(row[field]);
};

const getPeiwanName = (row: {
  PEIWANID: number;
  serverDisplayName?: string | null;
  discordUserId: string;
  member?: { serverDisplayName?: string | null } | null;
}) => row.serverDisplayName ?? row.member?.serverDisplayName ?? `陪玩 #${row.PEIWANID}`;

const getPeiwanGameLabels = (row: {
  type?: string | null;
  gameProfiles?: Array<{
    gameCode: PeiwanGameCodeValue;
    tier: PeiwanGameTierValue;
    sourceRoleId?: string | null;
  }>;
}) => {
  const labels = sortPeiwanGameProfiles(row.gameProfiles ?? [])
    .map((profile) => formatPeiwanGameProfile(profile))
    .slice(0, 3);
  return labels.length > 0 ? labels : [row.type ?? '陪玩'];
};

type AvatarSource = {
  discordAvatarUrl?: string | null;
  wechatAvatarUrl?: string | null;
};

const getMemberAvatarUrl = (member?: { jinleeUser?: AvatarSource | null } | null) =>
  member?.jinleeUser?.discordAvatarUrl ?? member?.jinleeUser?.wechatAvatarUrl ?? null;

const addToAmountMap = (map: Map<string, number>, discordId: string | null, delta: number) => {
  if (!discordId || EXCLUDED_USER_IDS.has(discordId) || delta === 0) return;
  map.set(discordId, (map.get(discordId) ?? 0) + delta);
};

async function loadActualSpend(start: Date, end: Date) {
  const rows = await prisma.individualTransaction.findMany({
    where: {
      timeCreatedAt: { gte: start, lt: end },
      typeOfTransaction: { in: Array.from(new Set([...SPEND_POSITIVE_TYPES, ...REVERT_TYPES])) },
    },
    select: { discordId: true, balanceBefore: true, balanceAfter: true, typeOfTransaction: true },
  });

  const spendMap = new Map<string, number>();
  rows.forEach((row) => {
    const before = parseNumeric(row.balanceBefore) ?? 0;
    const after = parseNumeric(row.balanceAfter) ?? 0;
    const delta = before - after;
    const txType = String(row.typeOfTransaction ?? '');

    if (SPEND_POSITIVE_TYPES.has(txType)) {
      if (delta <= 0) return;
    } else if (REVERT_TYPES.has(txType)) {
      if (delta >= 0) return;
    } else {
      return;
    }

    addToAmountMap(spendMap, row.discordId, delta);
  });

  return spendMap;
}

async function loadActualIncome(start: Date, end: Date) {
  const rows = await prisma.individualTransaction.findMany({
    where: {
      timeCreatedAt: { gte: start, lt: end },
      typeOfTransaction: { in: Array.from(new Set([...INCOME_POSITIVE_TYPES, ...REVERT_TYPES])) },
    },
    select: { discordId: true, balanceBefore: true, balanceAfter: true, typeOfTransaction: true },
  });

  const incomeMap = new Map<string, number>();
  rows.forEach((row) => {
    const before = parseNumeric(row.balanceBefore) ?? 0;
    const after = parseNumeric(row.balanceAfter) ?? 0;
    const delta = after - before;
    const txType = String(row.typeOfTransaction ?? '');

    if (INCOME_POSITIVE_TYPES.has(txType)) {
      if (delta <= 0) return;
    } else if (REVERT_TYPES.has(txType)) {
      if (delta >= 0) return;
    } else {
      return;
    }

    addToAmountMap(incomeMap, row.discordId, delta);
  });

  return incomeMap;
}

const topRankingAmounts = (amountMap: Map<string, number>) =>
  [...amountMap.entries()]
    .filter(([, amount]) => amount > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, HOME_RANK_LIMIT);

async function readRecommendationImages(issues: string[]) {
  const dir = path.join(process.cwd(), 'public', 'peiwanRecommend');

  try {
    const files = await fs.readdir(dir);
    const images = files
      .map((name) => {
        const match = name.match(/^(\d+)\.(png|jpg|jpeg|gif)$/i);
        if (!match) return null;
        const id = Number(match[1]);
        if (!Number.isInteger(id)) return null;
        return { id, src: `/peiwanRecommend/${name}` };
      })
      .filter((item): item is { id: number; src: string } => Boolean(item))
      .sort((a, b) => a.id - b.id);

    if (images.length === 0) {
      issues.push('推荐陪玩：public/peiwanRecommend 目录里没有可用图片。');
    }

    return images;
  } catch {
    issues.push('推荐陪玩：无法读取 public/peiwanRecommend 目录。');
    return [];
  }
}

async function loadRecommendedCompanions(issues: string[]) {
  const images = await readRecommendationImages(issues);
  const imageIds = images.map((item) => item.id);

  const rows = imageIds.length
    ? await prisma.pEIWAN.findMany({
        where: { PEIWANID: { in: imageIds } },
        include: {
          member: { select: { serverDisplayName: true } },
          gameProfiles: {
            select: { gameCode: true, tier: true, sourceRoleId: true },
            orderBy: { gameCode: 'asc' },
          },
        },
      })
    : [];

  const rowById = new Map(rows.map((row) => [row.PEIWANID, row]));
  const recommended = images.map((image, index): RecommendedCompanion => {
    const row = rowById.get(image.id);

    if (!row) {
      issues.push(`推荐陪玩：图片 ${image.id} 有文件，但 PEIWAN 表没有对应资料。`);
      return {
        id: image.id,
        name: `陪玩 #${image.id}`,
        game: '未配置游戏',
        price: '资料缺失',
        image: image.src,
        highlight: '推荐图存在 · 资料缺失',
        description: '这张推荐图存在，但后台陪玩资料没有匹配到。',
        tags: ['缺少陪玩资料'],
        tone: recommendationTones[index % recommendationTones.length],
        missing: ['PEIWAN 资料'],
      };
    }

    const missing: string[] = [];
    const labels = getPeiwanGameLabels(row);
    const name = getPeiwanName(row);
    const price = getPeiwanPrice(row as PeiwanPriceRow);

    if (!row.serverDisplayName && !row.member?.serverDisplayName) missing.push('展示名');
    if (labels.length === 0 || labels[0] === row.type) missing.push('游戏标签');
    if (price === '价格待定') missing.push('价格');

    return {
      id: row.PEIWANID,
      name,
      game: labels[0] ?? row.type,
      price,
      image: image.src,
      highlight: `${row.level} · ${row.status === 'free' ? '当前空闲' : '当前忙碌'}`,
      description: `${name} 当前配置了 ${labels.join('、')}。`,
      tags: [row.sex, row.type, ...labels].slice(0, 4),
      tone: recommendationTones[index % recommendationTones.length],
      missing,
    };
  });

  if (recommended.length < 4) {
    issues.push(`推荐陪玩：首页推荐位建议至少 4 位，目前只有 ${recommended.length} 位。`);
  }

  return recommended;
}

async function buildCompanionRanking(period: PeriodKey, issues: string[]) {
  const { start, end } = getLeaderboardRange(period);
  const incomeMap = await loadActualIncome(start, end);
  const top = topRankingAmounts(incomeMap);

  if (top.length === 0) {
    issues.push(`陪玩${period}：Discord 榜单周期内暂无收入流水。`);
    return [];
  }

  const members = await prisma.member.findMany({
    where: { discordUserId: { in: top.map(([discordUserId]) => discordUserId) } },
    select: {
      discordUserId: true,
      serverDisplayName: true,
      jinleeUser: { select: { discordAvatarUrl: true, wechatAvatarUrl: true } },
      peiwan: {
        select: {
          PEIWANID: true,
          discordUserId: true,
          serverDisplayName: true,
          type: true,
          gameProfiles: {
            select: { gameCode: true, tier: true, sourceRoleId: true },
            orderBy: { gameCode: 'asc' },
          },
        },
      },
    },
  });
  const memberMap = new Map(members.map((member) => [member.discordUserId, member]));

  return top.map(([discordUserId], index): RankingItem => {
    const member = memberMap.get(discordUserId);
    const peiwan = member?.peiwan;
    const labels = peiwan ? getPeiwanGameLabels(peiwan) : [];
    const name = peiwan
      ? getPeiwanName({ ...peiwan, member: { serverDisplayName: member.serverDisplayName } })
      : (member?.serverDisplayName ?? discordUserId);

    return {
      name,
      tag: labels[0] ?? '锦鲤陪玩',
      tone: companionTones[index % companionTones.length],
      avatarUrl: getMemberAvatarUrl(member),
    };
  });
}

async function buildBossRanking(period: PeriodKey, issues: string[]) {
  const { start, end } = getLeaderboardRange(period);
  const spendMap = await loadActualSpend(start, end);
  const top = topRankingAmounts(spendMap);

  if (top.length === 0) {
    issues.push(`老板${period}：Discord 榜单周期内暂无消费流水。`);
    return [];
  }

  const members = await prisma.member.findMany({
    where: { discordUserId: { in: top.map(([discordUserId]) => discordUserId) } },
    select: {
      discordUserId: true,
      serverDisplayName: true,
      jinleeUser: { select: { discordAvatarUrl: true, wechatAvatarUrl: true, totalSpent: true } },
      bossProfile: {
        select: {
          displayName: true,
          rankLabel: true,
          spendLevelLabel: true,
        },
      },
    },
  });
  const memberMap = new Map(members.map((member) => [member.discordUserId, member]));

  return top.map(([discordUserId], index): RankingItem => {
    const member = memberMap.get(discordUserId);
    const profile = member?.bossProfile;
    const anonymous = ANON_SPEND_USER_IDS.has(discordUserId);
    const publicName = profile?.displayName?.trim() || member?.serverDisplayName?.trim() || null;
    const vipLevel = getHighestVipLevelByTotalSpent(member?.jinleeUser?.totalSpent?.toString());

    return {
      name: anonymous ? '匿名老板' : (publicName ?? `神秘老板 ${index + 1}`),
      tag: profile?.rankLabel ?? profile?.spendLevelLabel ?? (anonymous ? '匿名老板' : '老板'),
      tone: bossTones[index % bossTones.length],
      avatarUrl: getMemberAvatarUrl(member),
      anonymous,
      vipLevel: anonymous ? undefined : vipLevel,
    };
  });
}

const formatRelativeTime = (date: Date) => {
  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.max(0, Math.floor(diffMs / 60000));
  if (diffMinutes < 1) return '刚刚';
  if (diffMinutes < 60) return `${diffMinutes} 分钟前`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} 小时前`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} 天前`;
};

const formatOrderGame = (quotationCode: QuotationCodeValue) => {
  const label = QUOTATION_CODE_LABEL[quotationCode];
  return label === 'Q1' ? '游戏' : label;
};

const sanitizeOrderRequestContent = (value: string | null | undefined) => {
  const normalized = String(value ?? '')
    .replace(/<@!?\d+>/g, '')
    .replace(/陪玩\s*ID\s*[:：]?\s*\d+/gi, '')
    .replace(/点单给/g, '')
    .replace(/https?:\/\/\S+/gi, '[链接已隐藏]')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[联系方式已隐藏]')
    .replace(/(?:\+?\d[\s-]?){8,}\d/g, '[联系方式已隐藏]')
    .replace(/\b\d{9,}\b/g, '[联系方式已隐藏]')
    .replace(/\s+/g, ' ')
    .trim();

  if (!normalized) return '需求已提交，等待陪玩确认。';
  const summary = normalized.slice(0, 72);
  return `需求：${summary}${normalized.length > summary.length ? '…' : ''}`;
};

async function loadRecentCommunityActivity(): Promise<RecentDispatchItem[]> {
  try {
    const now = Date.now();
    const [rows, dispatchLogs, highValueGifts] = await Promise.all([
      prisma.order.findMany({
        where: {
          createdAt: {
            gte: new Date(now - 14 * 24 * 60 * 60 * 1000),
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 8,
        select: {
          id: true,
          status: true,
          quotationCode: true,
          createdAt: true,
          acceptedAt: true,
          endedAt: true,
        },
      }),
      prisma.orderRequestLog.findMany({
        where: {
          createdAt: {
            gte: new Date(now - 2 * 60 * 60 * 1000),
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 8,
        select: {
          orderId: true,
          content: true,
          createdAt: true,
          _count: { select: { clicks: true } },
        },
      }),
      prisma.giftAudit.findMany({
        where: {
          gross: { gt: 100 },
          createdAt: {
            gte: new Date(now - 14 * 24 * 60 * 60 * 1000),
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 6,
        select: {
          id: true,
          gross: true,
          createdAt: true,
        },
      }),
    ]);

    const pendingOrderIds = rows.filter((row) => row.status === 'PENDING').map((row) => row.id);
    const trackedOrderIds = dispatchLogs.map((row) => row.orderId);
    const [requestLogs, directOrderRows] = await Promise.all([
      pendingOrderIds.length
        ? prisma.orderRequestLog.findMany({
            where: { orderId: { in: pendingOrderIds } },
            select: { orderId: true, content: true },
          })
        : [],
      trackedOrderIds.length
        ? prisma.order.findMany({
            where: { id: { in: trackedOrderIds } },
            select: { id: true },
          })
        : [],
    ]);
    const requestContentByOrderId = new Map(requestLogs.map((row) => [row.orderId, row.content]));
    const directOrderIds = new Set(directOrderRows.map((row) => row.id));

    const orderActivities = rows.map((row) => {
      const game = formatOrderGame(row.quotationCode);
      const requestContent = sanitizeOrderRequestContent(requestContentByOrderId.get(row.id));

      switch (row.status) {
        case 'PENDING':
          return {
            occurredAt: row.createdAt,
            item: {
              id: row.id,
              title: `${game}陪玩需求待确认`,
              detail: requestContent,
              timeLabel: formatRelativeTime(row.createdAt),
              statusLabel: '新需求',
            },
          };
        case 'RUNNING':
          return {
            occurredAt: row.acceptedAt ?? row.createdAt,
            item: {
              id: row.id,
              title: `${game}陪玩服务进行中`,
              detail: '已由锦鲤公会安排，正在进行服务。',
              timeLabel: formatRelativeTime(row.acceptedAt ?? row.createdAt),
              statusLabel: '服务中',
            },
          };
        case 'ENDED':
          return {
            occurredAt: row.endedAt ?? row.createdAt,
            item: {
              id: row.id,
              title: `${game}陪玩服务已完成`,
              detail: '本次服务已顺利结束，感谢板板选择锦鲤公会。',
              timeLabel: formatRelativeTime(row.endedAt ?? row.createdAt),
              statusLabel: '已完成',
            },
          };
        case 'DECLINED':
          return {
            occurredAt: row.createdAt,
            item: {
              id: row.id,
              title: `${game}陪玩订单暂未接单`,
              detail: '匿名订单已关闭，客服可协助重新安排。',
              timeLabel: formatRelativeTime(row.createdAt),
              statusLabel: '匿名订单',
            },
          };
        case 'CANCELED':
          return {
            occurredAt: row.createdAt,
            item: {
              id: row.id,
              title: `${game}陪玩订单已取消`,
              detail: '匿名订单已取消，如有需要可重新联系锦鲤客服。',
              timeLabel: formatRelativeTime(row.createdAt),
              statusLabel: '匿名订单',
            },
          };
        case 'EXPIRED':
          return {
            occurredAt: row.createdAt,
            item: {
              id: row.id,
              title: `${game}陪玩订单已过期`,
              detail: '匿名订单已过期，客服可协助发起新的需求。',
              timeLabel: formatRelativeTime(row.createdAt),
              statusLabel: '匿名订单',
            },
          };
        default:
          return {
            occurredAt: row.createdAt,
            item: {
              id: row.id,
              title: '锦鲤陪玩订单动态',
              detail: '订单状态已更新，客服会继续协助处理。',
              timeLabel: formatRelativeTime(row.createdAt),
              statusLabel: '订单动态',
            },
          };
      }
    });

    const dispatchActivities = dispatchLogs
      .filter((row) => !directOrderIds.has(row.orderId))
      .map((row) => ({
        occurredAt: row.createdAt,
        item: {
          id: `dispatch-${row.orderId}`,
          title: '新的陪玩需求已发布',
          detail: sanitizeOrderRequestContent(row.content),
          timeLabel: formatRelativeTime(row.createdAt),
          statusLabel: row._count.clicks > 0 ? `已有 ${row._count.clicks} 位陪玩抢单` : '新需求',
        },
      }));

    const giftActivities = highValueGifts.map((gift) => ({
      occurredAt: gift.createdAt,
      item: {
        id: `gift-${gift.id}`,
        title: `陪陪收到了价值 ¥${formatAmountDown2(gift.gross)} 的打赏`,
        detail: '感谢板板对锦鲤陪玩的支持。',
        timeLabel: formatRelativeTime(gift.createdAt),
        statusLabel: '高价值打赏',
      },
    }));

    return [...dispatchActivities, ...giftActivities, ...orderActivities]
      .sort((left, right) => right.occurredAt.getTime() - left.occurredAt.getTime())
      .slice(0, 8)
      .map((activity) => activity.item);
  } catch (error) {
    console.warn('Failed to load recent community activity for homepage', error);
    return [];
  }
}

export async function loadHomePageData(): Promise<HomePageData> {
  const issues: string[] = [
    '老板榜：官网当前复用 Discord 榜单的固定匿名 ID；正式后台可追加“是否匿名上榜”偏好字段。',
    '陪玩推荐：推荐理由、主推文案、展示顺序目前不是后台字段，当前从推荐图、游戏标签和状态自动生成。',
    '头像：榜单会优先读取 JinleeUser 的 Discord/微信头像；没有头像时回退为首字母占位。',
    '榜单：官网日榜/周榜/月榜已按 Discord 榜单口径读取实际流水，并使用 Europe/Rome 时区。',
  ];

  try {
    const [recommendedCompanions, companionEntries, bossEntries, recentDispatches] = await Promise.all([
      loadRecommendedCompanions(issues),
      Promise.all(periodKeys.map(async (period) => [period, await buildCompanionRanking(period, issues)] as const)),
      Promise.all(periodKeys.map(async (period) => [period, await buildBossRanking(period, issues)] as const)),
      loadRecentCommunityActivity(),
    ]);

    const companionRankings = Object.fromEntries(companionEntries) as RankingData;
    const bossRankings = Object.fromEntries(bossEntries) as RankingData;
    const rankingItems = [
      ...periodKeys.flatMap((period) => companionRankings[period]),
      ...periodKeys.flatMap((period) => bossRankings[period]),
    ];
    const realAvatarCount = rankingItems.filter((item) => item.avatarUrl && !item.anonymous).length;
    const anonymousAvatarCount = rankingItems.filter((item) => item.anonymous).length;

    const audit: DataAuditItem[] = [
      {
        label: '推荐陪玩',
        value: `${recommendedCompanions.filter((item) => item.image).length} 张图 / ${recommendedCompanions.length} 个推荐位`,
        status: recommendedCompanions.length >= 4 ? 'ok' : 'warn',
      },
      {
        label: '陪玩榜单',
        value: periodKeys.every((period) => companionRankings[period].length > 0)
          ? '日榜 / 周榜 / 月榜可展示'
          : '部分周期无数据',
        status: periodKeys.every((period) => companionRankings[period].length > 0) ? 'ok' : 'warn',
      },
      {
        label: '老板榜单',
        value: periodKeys.every((period) => bossRankings[period].length > 0)
          ? '日榜 / 周榜 / 月榜可展示'
          : '部分周期无数据',
        status: periodKeys.every((period) => bossRankings[period].length > 0) ? 'ok' : 'warn',
      },
      {
        label: '榜单头像',
        value: `${realAvatarCount} 个真实头像 / ${anonymousAvatarCount} 个匿名默认头像`,
        status: realAvatarCount > 0 || anonymousAvatarCount > 0 ? 'ok' : 'warn',
      },
      {
        label: '公会动态',
        value: `${recentDispatches.length} 条近期订单/派单`,
        status: recentDispatches.length > 0 ? 'ok' : 'warn',
      },
      {
        label: '缺口提示',
        value: `${issues.length} 项`,
        status: issues.length > 0 ? 'warn' : 'ok',
      },
    ];

    return {
      companionRankings,
      bossRankings,
      recommendedCompanions,
      recentDispatches,
      audit,
      issues: [...new Set(issues)],
    };
  } catch (error) {
    console.error('Failed to load homepage data', error);
    return {
      companionRankings: emptyRanking(),
      bossRankings: emptyRanking(),
      recommendedCompanions: [],
      recentDispatches: [],
      audit: [
        { label: '数据读取', value: '失败', status: 'warn' },
        { label: '缺口提示', value: '1 项', status: 'warn' },
      ],
      issues: ['数据读取失败：请确认本地 DATABASE_URL 可用，且 Prisma Client 已生成。'],
    };
  }
}
