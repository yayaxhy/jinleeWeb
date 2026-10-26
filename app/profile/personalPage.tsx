
import { SiteText } from "@/components/SiteCopyProvider";
import { Prisma } from '@prisma/client';
import { loadAccountMigrationBenefits, inheritedAutoCommissionExpiry } from '@/lib/account-migration-benefits';
import Image from 'next/image';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { BlacklistManager } from '@/components/profile/BlacklistManager';
import { AuditionInvitePreferenceToggle } from '@/components/profile/AuditionInvitePreferenceToggle';
import { PeiwanReviewManager } from '@/components/profile/PeiwanReviewManager';
import { SentPeiwanReviewHistory } from '@/components/profile/SentPeiwanReviewHistory';
import { VipAnnouncementPreferenceToggle } from '@/components/profile/VipAnnouncementPreferenceToggle';
import { VipRoleSyncPreferenceToggle } from '@/components/profile/VipRoleSyncPreferenceToggle';
import { VoicePreviewManager } from '@/components/profile/VoicePreviewManager';
import { DlmReadonlyProfile } from '@/components/profile/DlmReadonlyProfile';
import { getCurrentDlmUser } from '@/lib/current-dlm-user';
import { getDlmPortalSession } from '@/lib/dlm-portal-session';
import { isDiscordSnowflake } from '@/lib/discord-id';
import { formatAmountDown, formatAmountDown2 } from '@/lib/numberFormat';
import { formatPeiwanGameProfile, getPeiwanGameLabel, getPeiwanTierLabel, sortPeiwanGameProfiles, type PeiwanGameProfileView } from '@/lib/peiwan/gameProfiles';
import { prisma } from '@/lib/prisma';
import { newEntityOnlyTime } from '@/lib/operating-entity-cutover';
import { formatTransactionType } from '@/lib/transaction-display';
import { VIP_LEVELS } from '@/lib/vip-levels';
import { summarizeManualQuota, type ManualQuotaPeriod } from '@/lib/manual-quota-view';

// Keep role-specific labels intact; only localize the known game/tier display names.
function PeiwanGameProfileLabel({ profile }: { profile: PeiwanGameProfileView }) {
  const label = formatPeiwanGameProfile(profile);
  const game = getPeiwanGameLabel(profile.gameCode);
  const tier = getPeiwanTierLabel(profile.tier);
  if (label === game) return <SiteText namespace="site.constants.peiwan" value={game} />;
  if (label === `${game} · ${tier}`) {
    return <><SiteText namespace="site.constants.peiwan" value={game} /> · <SiteText namespace="site.constants.peiwan" value={tier} /></>;
  }
  return label;
}

const TRANSACTIONS_PER_PAGE = 10;
const ROME_TIMEZONE = 'Europe/Rome';
const AUTO_COMMISSION_THRESHOLD = 12000;
const AUTO_COMMISSION_WINDOW_DAYS = 30;
const AUTO_COMMISSION_POSITIVE_TYPES = ['点单', '打赏', '客服代打赏', '红包收入'] as const;
const AUTO_COMMISSION_REVERT_TYPES = ['订单撤销', '打赏撤销'] as const;
const AUTO_COMMISSION_INCOME_TYPES = [
  ...AUTO_COMMISSION_POSITIVE_TYPES,
  ...AUTO_COMMISSION_REVERT_TYPES,
] as const;

const stringifyUnknown = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'bigint') return value.toString();
  if (typeof value === 'object' && value !== null && 'toString' in value) {
    const toStringFn = (value as { toString?: () => string }).toString;
    if (typeof toStringFn === 'function') {
      return toStringFn.call(value);
    }
  }
  return String(value);
};

const parseNumeric = (value: unknown): number | null => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') {
    return Number.isNaN(value) ? null : value;
  }
  if (typeof value === 'bigint') {
    return Number(value);
  }
  const numeric = Number(stringifyUnknown(value));
  return Number.isNaN(numeric) ? null : numeric;
};

const formatNumber = (value: unknown) => {
  if (value === null || value === undefined) return '—';
  const formatted = formatAmountDown2(value);
  if (formatted === '—') {
    const fallback = stringifyUnknown(value);
    return fallback.length > 0 ? fallback : '—';
  }
  return formatted;
};

const formatDate = (value?: Date | string | null) => {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('zh-CN', { timeZone: ROME_TIMEZONE });
};

const getBuffStatusMeta = (expiresAt?: Date | string | null) => {
  if (!expiresAt) {
    return { label: '未激活', badgeClass: 'bg-gray-100 text-gray-500' };
  }
  const expiry = expiresAt instanceof Date ? expiresAt : new Date(expiresAt);
  if (Number.isNaN(expiry.getTime())) {
    return { label: '时间未知', badgeClass: 'bg-gray-100 text-gray-500' };
  }
  const diffMs = expiry.getTime() - Date.now();
  if (diffMs <= 0) {
    return { label: '已过期', badgeClass: 'bg-rose-50 text-rose-600' };
  }
  const daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  return { label: `剩余 ${daysLeft} 天`, badgeClass: 'bg-emerald-50 text-emerald-600' };
};

const formatBuffValue = (value: unknown, suffix?: string) => {
  const formatted = formatNumber(value);
  if (suffix && formatted !== '—') {
    return `${formatted}${suffix}`;
  }
  return formatted;
};

const formatCommissionRateDisplay = (value: unknown) => {
  const numeric = parseNumeric(value);
  if (numeric === null) return '—';
  if (numeric >= 0 && numeric <= 1) {
    const percent = numeric * 100;
    const rounded = Number(percent.toFixed(2));
    return `${rounded}%`;
  }
  return stringifyUnknown(value);
};

const resolveAmountChange = (
  amountChange: unknown,
  balanceBefore: unknown,
  balanceAfter: unknown,
): number | null => {
  const amount = parseNumeric(amountChange);
  const before = parseNumeric(balanceBefore);
  const after = parseNumeric(balanceAfter);

  if (before !== null && after !== null) {
    const derived = after - before;
    if (amount === null) {
      return derived;
    }
    if (Math.sign(derived) !== Math.sign(amount) || Math.abs(derived - amount) > 0.0001) {
      return derived;
    }
    return amount;
  }

  return amount;
};

const getAmountChangeMeta = (value: number | null, digits = 2) => {
  if (value === null || value === undefined) {
    return { label: '—', className: 'text-gray-400' };
  }
  if (value === 0) {
    return { label: '0', className: 'text-gray-500' };
  }
  const prefix = value > 0 ? '+' : '-';
  return {
    label: `${prefix}${formatAmountDown(Math.abs(value), digits)}`,
    className: value > 0 ? 'text-emerald-500' : 'text-rose-500',
  };
};

export type ProfilePageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

type ProfileBlacklistEntry = {
  blockedId: string;
  createdAt: Date;
  blocked: {
    discordUserId: string;
    serverDisplayName: string | null;
    status: 'LAOBAN' | 'PEIWAN';
    peiwan: {
      PEIWANID: number;
      serverDisplayName: string | null;
    } | null;
  };
};

const formatUtcDate = (value?: Date | string | null) => {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toISOString().slice(0, 10);
};

const getAutoCommissionWindow = (now = new Date()) => {
  const utcStartOfToday = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0),
  );
  const windowStart = new Date(
    utcStartOfToday.getTime() - (AUTO_COMMISSION_WINDOW_DAYS - 1) * 24 * 60 * 60 * 1000,
  );
  return { windowStart, windowEnd: now };
};

const getPostQualificationStart = (value: Date) => new Date(value.getTime() + 1);

const getAutoCommissionRetentionWindow = (lastQualifiedAt: Date | null | undefined, now = new Date()) => {
  if (!lastQualifiedAt) return getAutoCommissionWindow(now);
  const qualifiedAt = lastQualifiedAt instanceof Date ? lastQualifiedAt : new Date(lastQualifiedAt);
  if (Number.isNaN(qualifiedAt.getTime())) return getAutoCommissionWindow(now);
  const windowStart = getPostQualificationStart(qualifiedAt);
  const windowEnd = new Date(qualifiedAt.getTime() + AUTO_COMMISSION_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  return { windowStart, windowEnd };
};

export default async function Profile(props: ProfilePageProps) {
  const rawSearchParams = props.searchParams;
  const resolvedSearchParams =
    ((await rawSearchParams) ?? {}) as Record<string, string | string[] | undefined>;

  const navLinks = [
    { href: '/profile', label: '个人主页' },
    { href: '/accounts/discord/change', label: '账号绑定与换号' },
    { href: '/profile/account-migrations', label: '迁移历史与归档' },
    { href: '/profile/bag', label: '我的背包' },
    { href: '/profile/lottery-fusion', label: '奖品重铸' },
    { href: '/profile/heart', label: '心动值' },
    { href: '/profile/giftwall', label: '礼物墙' },
    { href: '/profile/withdraw', label: '提现' },
    { href: '/profile/point-shop', label: '积分商城' },
    { href: '/recharge', label: '充值中心' },
  ];
  const quickEntryLinks = navLinks.filter(
    (link) => link.href !== '/profile' && link.href !== '/recharge' && link.href !== '/profile/withdraw',
  );

  const currentUser = await getCurrentDlmUser();
  if (!currentUser) {
    const dlmPortalSession = await getDlmPortalSession();
    if (dlmPortalSession) return <DlmReadonlyProfile dlmId={dlmPortalSession.dlmId} />;
    redirect('/');
  }

  const { dlmUser, dlmId, discordUserId } = currentUser;
  const member = discordUserId
      ? await prisma.member.findUnique({
        where: { discordUserId },
        include: {
          peiwan: {
            include: {
              gameProfiles: {
                orderBy: { gameCode: 'asc' },
              },
            },
          },
          vipBenefitProfile: true,
        },
      })
    : null;

  const peiwan = member?.peiwan ?? null;
  const isPeiwanMember = member?.status === 'PEIWAN';
  const isLaobanMember = !!member && member.status !== 'PEIWAN';
  const canViewSentPeiwanReviews = true;
  const canManageVoicePreview = isPeiwanMember;
  const showPersonalisationTab = isPeiwanMember || isLaobanMember;
  const vipRoleSyncEnabled = member?.vipBenefitProfile?.roleOptOut !== true;
  const vipAnnouncementBroadcastEnabled = member?.vipBenefitProfile?.announcementEnabled !== false;
  const now = new Date();
  const level = peiwan?.level ?? '—';
  const displayName =
    dlmUser.discordDisplayName ?? member?.serverDisplayName ?? dlmUser.wechatDisplayName ?? '微信用户';
  const avatarUrl = dlmUser.discordAvatarUrl ?? dlmUser.wechatAvatarUrl ?? undefined;
  const avatarLetter = displayName?.[0]?.toUpperCase?.() ?? 'M';
  const primaryIdLabel = discordUserId ? 'Discord ID' : null;
  const primaryIdValue = discordUserId ?? null;
  const pageParam = resolvedSearchParams?.page;
  const parsedPage =
    typeof pageParam === 'string' ? Number.parseInt(pageParam, 10) : Number.parseInt(pageParam?.[0] ?? '1', 10);
  const currentPage = Number.isNaN(parsedPage) || parsedPage < 1 ? 1 : parsedPage;
  const skip = (currentPage - 1) * TRANSACTIONS_PER_PAGE;

  const couponsPromise = prisma.coupon.findMany({
    where: { dlmId, issuedAt: newEntityOnlyTime() },
    orderBy: { issuedAt: 'desc' },
  });
  type CouponRecord = Awaited<typeof couponsPromise>[number];
  const totalTransactionsPromise = prisma.individualTransaction.count({
    where: { dlmId, timeCreatedAt: newEntityOnlyTime() },
  });
  const transactionsPromise = prisma.individualTransaction.findMany({
    where: { dlmId, timeCreatedAt: newEntityOnlyTime() },
    orderBy: { timeCreatedAt: 'desc' },
    skip,
    take: TRANSACTIONS_PER_PAGE,
  });
  const commissionBuffPromise = discordUserId
    ? prisma.commissionBuff.findUnique({
        where: { userId: discordUserId },
      })
    : Promise.resolve(null);
  const autoCommissionBuffPromise = discordUserId
    ? prisma.autoCommissionBuff.findUnique({
        where: { userId: discordUserId },
      })
    : Promise.resolve(null);
  const flowBuffPromise = discordUserId
    ? prisma.flowBuff.findUnique({
        where: { userId: discordUserId },
      })
    : Promise.resolve(null);
  const spendBuffPromise = discordUserId
    ? prisma.spendBuff.findUnique({
        where: { userId: discordUserId },
      })
    : Promise.resolve(null);
  const quotaRestorationsPromise = discordUserId
    ? prisma.manualQuotaRestoration.findMany({ where: { userId: discordUserId, expiresAt: { gt: now }, remainingExtra: { gt: 0 } } })
    : Promise.resolve([]);
  const ordinaryQuotaBatchesPromise = discordUserId
    ? prisma.manualQuotaBatch.findMany({ where: { userId: discordUserId, expiresAt: { gt: now }, remainingExtra: { gt: 0 } } })
    : Promise.resolve([]);
  const loyaltyPointPromise = prisma.loyaltyPoint.findFirst({
    where: { dlmId },
  });
  const peiwanReviewsPromise = isPeiwanMember && discordUserId
    ? prisma.peiwanReview.findMany({
        where: { peiwanDiscordId: discordUserId },
        orderBy: { createdAt: 'desc' },
        take: 200,
      })
    : Promise.resolve([]);
  const authoredPeiwanReviewsPromise = canViewSentPeiwanReviews && discordUserId
    ? prisma.peiwanReview.findMany({
        where: { reviewerDiscordId: discordUserId },
        orderBy: { createdAt: 'desc' },
        take: 200,
        select: {
          id: true,
          peiwanName: true,
          peiwanId: true,
          content: true,
          displayMode: true,
          peiwan: {
            select: {
              serverDisplayName: true,
              peiwan: {
                select: {
                  PEIWANID: true,
                  serverDisplayName: true,
                },
              },
            },
          },
        },
      })
    : Promise.resolve([]);
  const blacklistEntriesPromise: Promise<ProfileBlacklistEntry[]> = showPersonalisationTab && discordUserId
    ? prisma.blacklist.findMany({
        where: { blockerId: discordUserId },
        orderBy: { createdAt: 'desc' },
        select: {
          blockedId: true,
          createdAt: true,
          blocked: {
            select: {
              discordUserId: true,
              serverDisplayName: true,
              status: true,
              peiwan: {
                select: {
                  PEIWANID: true,
                  serverDisplayName: true,
                },
              },
            },
          },
        },
      })
    : Promise.resolve([]);
  type TransactionRecord = Awaited<typeof transactionsPromise>[number];

  const [
    coupons,
    totalTransactions,
    transactions,
    commissionBuff,
    autoCommissionBuff,
    flowBuff,
    spendBuff,
    quotaRestorations,
    ordinaryQuotaBatches,
    loyaltyPoint,
    peiwanReviews,
    authoredPeiwanReviews,
    blacklistEntries,
  ] = await Promise.all([
    couponsPromise,
    totalTransactionsPromise,
    transactionsPromise,
    commissionBuffPromise,
    autoCommissionBuffPromise,
    flowBuffPromise,
    spendBuffPromise,
    quotaRestorationsPromise,
    ordinaryQuotaBatchesPromise,
    loyaltyPointPromise,
    peiwanReviewsPromise,
    authoredPeiwanReviewsPromise,
    blacklistEntriesPromise,
  ]);
  const counterpartyDiscordIds = Array.from(
    new Set(
      transactions
        .map((transaction) => transaction.thirdPartydiscordId.trim())
        .filter(isDiscordSnowflake),
    ),
  );
  const counterparties = counterpartyDiscordIds.length
    ? await prisma.member.findMany({
        where: { discordUserId: { in: counterpartyDiscordIds } },
        select: { discordUserId: true, serverDisplayName: true },
      })
    : [];
  const counterpartyDisplayNames = new Map(
    counterparties
      .map((counterparty) => [counterparty.discordUserId, counterparty.serverDisplayName?.trim()] as const)
      .filter(([, displayName]) => Boolean(displayName)),
  );
  const authoredPeiwanReviewItems = authoredPeiwanReviews.map((review) => ({
    id: review.id,
    peiwanName:
      review.peiwan.peiwan?.serverDisplayName ??
      review.peiwan.serverDisplayName ??
      review.peiwanName ??
      '未知陪玩',
    peiwanId: review.peiwan.peiwan?.PEIWANID ?? review.peiwanId ?? null,
    content: review.content,
    displayMode: review.displayMode,
  }));
  const blacklistItems = blacklistEntries.map((entry) => ({
    discordUserId: entry.blockedId,
    displayName: entry.blocked.peiwan?.serverDisplayName ?? entry.blocked.serverDisplayName ?? entry.blocked.discordUserId,
    statusLabel: entry.blocked.status === 'PEIWAN' ? '陪玩' : '老板',
    peiwanId: entry.blocked.peiwan?.PEIWANID ?? null,
    createdAtLabel: formatUtcDate(entry.createdAt),
  }));
  const migrationBenefits = await loadAccountMigrationBenefits(prisma, { dlmId }, now);
  const autoCommissionActiveUntil = inheritedAutoCommissionExpiry(autoCommissionBuff?.activeUntil ?? null, migrationBenefits, now);
  // An inherited expiry does not extend the target's original qualification window.
  const ownQualificationActive = !!autoCommissionBuff?.lastQualifiedAt && new Date(autoCommissionBuff.lastQualifiedAt).getTime() + AUTO_COMMISSION_WINDOW_DAYS * 86400000 > now.getTime();
  const autoCommissionActive =
    isPeiwanMember &&
    !!autoCommissionActiveUntil &&
    new Date(autoCommissionActiveUntil).getTime() > now.getTime();
  const { windowStart: autoCommissionWindowStart, windowEnd: autoCommissionWindowEnd } =
    isPeiwanMember && ownQualificationActive
      ? getAutoCommissionRetentionWindow(autoCommissionBuff?.lastQualifiedAt, now)
      : getAutoCommissionWindow(now);
  const autoCommissionIncomeRows = isPeiwanMember
    ? await prisma.individualTransaction.findMany({
        where: {
          dlmId,
          timeCreatedAt: {
            ...newEntityOnlyTime(autoCommissionWindowStart),
            lte: autoCommissionWindowEnd,
          },
          typeOfTransaction: { in: [...AUTO_COMMISSION_INCOME_TYPES] },
        },
        select: { transactionId: true, typeOfTransaction: true, balanceBefore: true, balanceAfter: true },
      })
    : [];
  const totalPages = Math.max(1, Math.ceil(totalTransactions / TRANSACTIONS_PER_PAGE));
  const hasPrevPage = currentPage > 1;
  const hasNextPage = currentPage < totalPages;
  const prevPage = Math.max(1, currentPage - 1);
  const nextPage = Math.min(totalPages, currentPage + 1);

  const totalBalanceValue = member?.totalBalance ?? dlmUser.totalBalance;
  const balanceValue = member?.income ?? dlmUser.income;
  const totalSpentAmount = member?.totalSpent ?? dlmUser.totalSpent;
  const stats = [
    { label: '账户余额', value: totalBalanceValue },
    { label: '可提现余额', value: balanceValue },
    { label: '累计消费', value: totalSpentAmount },
    { label: '累计流水', value: peiwan?.totalEarn ?? null },
    { label: '点了么积分', value: loyaltyPoint?.points ?? dlmUser.loyaltyPoints ?? 0 },
  ];

  const totalSpentValue = parseNumeric(totalSpentAmount) ?? 0;
  const currentBossLevel = VIP_LEVELS.reduce<
    (typeof VIP_LEVELS)[number] | undefined
  >((acc, role) => (totalSpentValue >= role.threshold ? role : acc), undefined);
  const nextBossLevel = VIP_LEVELS.find((role) => totalSpentValue < role.threshold);
  const previousThreshold = currentBossLevel?.threshold ?? 0;
  const nextThreshold = nextBossLevel?.threshold ?? previousThreshold;
  const bossProgressRatio = nextBossLevel
    ? (totalSpentValue - previousThreshold) / Math.max(1, nextThreshold - previousThreshold)
    : 1;
  const bossProgressPercent = Math.min(100, Math.max(0, bossProgressRatio * 100));
  const amountToNextBossLevel = nextBossLevel ? Math.max(0, nextBossLevel.threshold - totalSpentValue) : 0;
  const currentBossLevelName = currentBossLevel
    ? `VIP ${currentBossLevel.vipLevel} · ${currentBossLevel.name}`
    : '暂未达到 VIP 等级';
  const couponStatusLabel: Record<string, string> = {
    ACTIVE: '可用',
    USED: '已使用',
    EXPIRED: '已过期',
  };
  const couponTypeLabel: Record<string, string> = {
    DISCOUNT_90: '9折券',
    DISCOUNT_80: '8折券',
    DISCOUNT_70: '7折券',
    DISCOUNT_90_LOTTERY: '特殊9折券',
    CAKE_VOUCHER: '小蛋糕代金券',
    LOLLIPOP_VOUCHER: '棒棒糖代金券',
    PERFUME_VOUCHER: '香水代金券',
    CAROUSEL_VOUCHER: '旋转木马代金券',
    PUMPKIN_CAR_VOUCHER: '南瓜车代金券',
    PHONOGRAPH_VOUCHER: '留声机代金券',
    CROWN_DAY_95_VOUCHER: '一日冠95折券',
    CROWN_DAY_92_VOUCHER: '一日冠92折券',
    CROWN_75_VOUCHER: '一日冠75折券',
    CROWN_DAY_90_VOUCHER: '一日冠9折券',
    CROWN_3DAY_92_VOUCHER: '三日冠92折券',
    CROWN_3DAY_90_VOUCHER: '三日冠9折券',
    CROWN_WEEK_92_VOUCHER: '一周冠92折券',
    CROWN_WEEK_90_VOUCHER: '一周冠9折券',
    CROWN_MONTH_92_VOUCHER: '月冠名92折券',
    CROWN_MONTH_90_VOUCHER: '月冠名9折券',
    LOTTERY_VOUCHER: '抽奖代金券',
    BLOCK_STACK_VOUCHER: '积木游戏代金券',
    CUSTOM_GIFT_VOUCHER: '自定义礼物券',
    CUSTOM_TAG_VOUCHER: '自定义tag券',
    COMMISSION_MINUS1_VOUCHER: '抽成降1%券',
    DOUBLE_FLOW_5000_VOUCHER: '双倍流水5000券',
    DOUBLE_SPEND_5000_VOUCHER: '双倍消费5000券',
    RENAME_CARD_3: '3位数靓号卡',
    RENAME_CARD: '4位数靓号卡',
    RENAME_CARD_5: '5位数靓号卡',
    PEIWAN_REVIEW_VOUCHER: '陪玩评语券',
  };

  const autoCommissionCurrentAmount = isPeiwanMember
    ? autoCommissionIncomeRows.reduce((sum, row) => {
        if (migrationBenefits.excludedIncomeIds.has(row.transactionId)) return sum;
        const rowType = String((row as { typeOfTransaction?: unknown }).typeOfTransaction ?? '');
        const before = parseNumeric(row.balanceBefore) ?? 0;
        const after = parseNumeric(row.balanceAfter) ?? 0;
        const delta = after - before;
        if (AUTO_COMMISSION_POSITIVE_TYPES.includes(rowType as (typeof AUTO_COMMISSION_POSITIVE_TYPES)[number])) {
          return delta > 0 ? sum + delta : sum;
        }
        if (AUTO_COMMISSION_REVERT_TYPES.includes(rowType as (typeof AUTO_COMMISSION_REVERT_TYPES)[number])) {
          return delta < 0 ? sum + delta : sum;
        }
        return sum;
      }, 0)
    : 0;
  const autoCommissionProgressPercent = Math.max(
    0,
    Math.min(100, (autoCommissionCurrentAmount / AUTO_COMMISSION_THRESHOLD) * 100),
  );
  const autoCommissionWindowLabel = `${formatUtcDate(autoCommissionWindowStart)} ~ ${formatUtcDate(autoCommissionWindowEnd)}`;
  const autoCommissionEligibleNow =
    isPeiwanMember && !ownQualificationActive && autoCommissionCurrentAmount >= AUTO_COMMISSION_THRESHOLD;
  const autoCommissionStatusMeta = autoCommissionEligibleNow
    ? { label: '已达标', badgeClass: 'bg-amber-50 text-amber-600' }
    : getBuffStatusMeta(autoCommissionActiveUntil);
  const autoCommissionCardTitle = ownQualificationActive ? '点了么福星陪玩保级进度' : '点了么福星陪玩进度';
  const autoCommissionDeadlineLabel = formatUtcDate(autoCommissionWindowEnd);
  const autoCommissionShortfall = Math.max(0, AUTO_COMMISSION_THRESHOLD - autoCommissionCurrentAmount);
  const autoCommissionHint = ownQualificationActive
    ? `在 ${autoCommissionDeadlineLabel} 前累计收入达到 ${formatNumber(AUTO_COMMISSION_THRESHOLD)}，当前还差 ${formatNumber(autoCommissionShortfall)} 完成保级`
    : autoCommissionEligibleNow
      ? `最近30天累计实际收入已达到 ${formatNumber(AUTO_COMMISSION_THRESHOLD)}，福星状态等待同步`
    : `最近30天累计实际收入达到 ${formatNumber(AUTO_COMMISSION_THRESHOLD)} 即可晋升点了么福星陪玩`;
  const profileCommissionBase = peiwan?.baseCommissionRate ?? member?.baseCommissionRate ?? peiwan?.commissionRate ?? member?.commissionRate ?? 0.75;
  const profileCommissionRate = autoCommissionActive
    ? Prisma.Decimal.max(profileCommissionBase, autoCommissionBuff?.targetShare ?? 0.91)
    : member?.commissionRate ?? null;

  const flowQuota = summarizeManualQuota(flowBuff, quotaRestorations.filter((row) => row.kind === 'flow'), now, ordinaryQuotaBatches.filter(row => row.kind === 'flow'));
  const spendQuota = summarizeManualQuota(spendBuff, quotaRestorations.filter((row) => row.kind === 'spend'), now, ordinaryQuotaBatches.filter(row => row.kind === 'spend'));
  const buffCards = [
    {
      key: 'commission',
      title: '抽成 Buff',
      subtitle: '抽成/返佣加成',
      valueLabel: '加成值',
      value: commissionBuff?.boost ?? null,
      expiresAt: commissionBuff?.expiresAt ?? null,
      createdAt: commissionBuff?.createdAt ?? null,
      periods: [] as ManualQuotaPeriod[],
    },
    {
      key: 'flow',
      title: '流水 Buff',
      subtitle: '额外流水额度',
      valueLabel: '剩余额度',
      value: flowBuff || flowQuota.periods.length ? flowQuota.remaining : null,
      expiresAt: flowQuota.nextExpiresAt ? new Date(flowQuota.nextExpiresAt) : flowBuff?.expiresAt ?? null,
      createdAt: flowBuff?.createdAt ?? null,
      periods: flowQuota.periods,
    },
    {
      key: 'spend',
      title: '消费 Buff',
      subtitle: '消费额外额度',
      valueLabel: '剩余额度',
      value: spendBuff || spendQuota.periods.length ? spendQuota.remaining : null,
      expiresAt: spendQuota.nextExpiresAt ? new Date(spendQuota.nextExpiresAt) : spendBuff?.expiresAt ?? null,
      createdAt: spendBuff?.createdAt ?? null,
      periods: spendQuota.periods,
    },
  ];
  const hasBuffData = buffCards.some(
    (buff) => buff.value !== null || buff.expiresAt !== null || buff.createdAt !== null,
  );
  const tabCandidates = [
    ...(isLaobanMember || isPeiwanMember ? [{ id: 'profile-level', label: '升级进度' }] : []),
    { id: 'profile-buff', label: 'Buff 状态' },
    ...(showPersonalisationTab ? [{ id: 'profile-personalisation', label: '个性化' }] : []),
    ...(canViewSentPeiwanReviews ? [{ id: 'profile-sent-reviews', label: '评语' }] : []),
    { id: 'profile-info', label: '个人信息' },
  ] as const;
  const tabParam = resolvedSearchParams?.tab;
  const requestedTab = typeof tabParam === 'string' ? tabParam : tabParam?.[0];
  const profileTabs = tabCandidates;
  const activeTab = profileTabs.some((tab) => tab.id === requestedTab)
    ? requestedTab!
    : profileTabs[0]?.id ?? 'profile-heart';
  const cardClass = 'bg-white rounded-[32px] border border-black/5 p-8 space-y-6 shadow-[0_10px_30px_rgba(17,24,39,0.04)]';
  const transactionHistory = (isPeiwanMember || isLaobanMember) ? (
    <div id="profile-tx" className={cardClass}>
      <div>
        <h2 className="text-2xl font-semibold tracking-wide text-[#8a6000]"><SiteText copyKey="site.app.profile.personalpage.7ca84917a2e1" /></h2>
        <p className="text-sm text-gray-500"><SiteText copyKey="site.app.profile.personalpage.c6cf7722be48" /></p>
      </div>
      {transactions.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-gray-400 uppercase tracking-[0.4em] border-b border-black/5">
                <th className="py-3 pr-4"><SiteText copyKey="site.app.profile.personalpage.89b4aa6364ce" /></th>
                <th className="py-3 pr-4"><SiteText copyKey="site.app.profile.personalpage.e4e46c7235d1" /></th>
                <th className="py-3 pr-4"><SiteText copyKey="site.app.profile.personalpage.90e514a4b554" /></th>
                <th className="py-3 pr-4"><SiteText copyKey="site.app.profile.personalpage.10b10e5e7f6b" /></th>
                <th className="py-3 pr-4"><SiteText copyKey="site.app.profile.personalpage.1646bf2ec192" /></th>
                <th className="py-3 pr-4"><SiteText copyKey="site.app.profile.personalpage.e0361480e3a5" /></th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx: TransactionRecord) => {
                const resolvedChange = resolveAmountChange(tx.amountChange, tx.balanceBefore, tx.balanceAfter);
                const ledgerDigits = resolvedChange !== null && resolvedChange !== 0 && Math.abs(resolvedChange) < 0.01 ? 4 : 2;
                const changeMeta = getAmountChangeMeta(resolvedChange, ledgerDigits);
                return (
                  <tr key={tx.transactionId} className="border-b border-black/5 last:border-0">
                    <td className="py-4 pr-4 font-mono">{formatDate(tx.timeCreatedAt)}</td>
                    <td className="py-4 pr-4">{tx.typeOfTransaction === 'Stripe充值' || tx.typeOfTransaction === '微信人工充值' ? <SiteText namespace="site.lib.transaction.display" value={formatTransactionType(tx.typeOfTransaction)} /> : formatTransactionType(tx.typeOfTransaction)}</td>
                    <td className="py-4 pr-4 font-mono">{formatAmountDown(tx.balanceBefore, ledgerDigits)}</td>
                    <td className={`py-4 pr-4 font-mono ${changeMeta.className}`}>{changeMeta.label}</td>
                    <td className="py-4 pr-4 font-mono">{formatAmountDown(tx.balanceAfter, ledgerDigits)}</td>
                    <td className="py-4 pr-4 text-gray-500">
                      {counterpartyDisplayNames.get(tx.thirdPartydiscordId.trim()) ?? tx.thirdPartydiscordId ?? '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-4 text-sm text-gray-500">
            <p><SiteText copyKey="site.app.profile.personalpage.f495347d6acf" />{Math.min(currentPage, totalPages)} / {totalPages}<SiteText copyKey="site.app.profile.personalpage.04a3cbd65606" />{totalTransactions}<SiteText copyKey="site.app.profile.personalpage.bce2ef61514a" /></p>
            <div className="flex gap-2">
              <Link
                href={`/profile?page=${prevPage}#profile-tx`}
                prefetch={false}
                className={`px-4 py-2 rounded-full border text-xs uppercase tracking-[0.4em] ${
                  hasPrevPage ? 'hover:bg-black/5 border-black/20' : 'border-black/5 text-gray-300 pointer-events-none'
                }`}
                aria-disabled={!hasPrevPage}
              ><SiteText copyKey="site.app.profile.personalpage.b41561d80765" /></Link>
              <Link
                href={`/profile?page=${nextPage}#profile-tx`}
                prefetch={false}
                className={`px-4 py-2 rounded-full border text-xs uppercase tracking-[0.4em] ${
                  hasNextPage ? 'hover:bg-black/5 border-black/20' : 'border-black/5 text-gray-300 pointer-events-none'
                }`}
                aria-disabled={!hasNextPage}
              ><SiteText copyKey="site.app.profile.personalpage.67a246a344ae" /></Link>
            </div>
          </div>
        </div>
      ) : (
        <p className="text-gray-500"><SiteText copyKey="site.app.profile.personalpage.96aafce775c3" /></p>
      )}
    </div>
  ) : null;
  const renderStat = (item: (typeof stats)[number]) => (
    <div
      key={item.label}
      className="rounded-2xl border border-dashed border-black/10 bg-white/70 p-5 text-center space-y-2"
    >
      <p className="text-xs tracking-[0.4em] text-gray-500"><SiteText namespace="site.app.profile.personalpage" value={item.label} /></p>
      <p className="text-2xl font-mono">{formatNumber(item.value)}</p>
      {item.label === '可提现余额' && (
        <div className="pt-2">
          <Link
            href="/profile/withdraw"
            className="px-4 py-2 rounded-full border border-black/10 text-xs uppercase tracking-[0.4em] transition inline-flex items-center justify-center hover:border-[#f8c84a] hover:bg-[#f8c84a]/12 hover:text-[#c18400]"
          ><SiteText copyKey="site.app.profile.personalpage.3e7beeb7a940" /></Link>
        </div>
      )}
      {item.label === '账户余额' && (
        <div className="pt-2">
          <Link
            href="/recharge"
            className="px-4 py-2 rounded-full border border-black/10 text-xs uppercase tracking-[0.4em] transition hover:border-[#f8c84a] hover:bg-[#f8c84a]/12 hover:text-[#c18400]"
          ><SiteText copyKey="site.app.profile.personalpage.fa03c4625313" /></Link>
        </div>
      )}
      {item.label === '点了么积分' && (
        <div className="pt-2">
          <Link
            href="/profile/point-shop"
            className="px-4 py-2 rounded-full border border-black/10 text-xs uppercase tracking-[0.4em] transition hover:border-[#f8c84a] hover:bg-[#f8c84a]/12 hover:text-[#c18400]"
          ><SiteText copyKey="site.app.profile.personalpage.6d423aa04d58" /></Link>
        </div>
      )}
    </div>
  );


  return (
    <main className="min-h-screen bg-[#f7f3ef] text-[#171717] px-6 py-16">
      <section className="max-w-7xl mx-auto">
        <div className="space-y-8">
          <div id="profile-overview" className={`${cardClass} overflow-hidden`}>
          <div className="space-y-4">
            <p className="text-xs uppercase tracking-[0.6em] text-gray-400"><SiteText copyKey="site.app.profile.personalpage.9ba8d391c59a" /></p>
            <div className="flex items-center gap-4">
              <div className="relative h-20 w-20 overflow-hidden rounded-2xl border border-[#d4b24c]/40 bg-gradient-to-br from-[#fff3cf] to-[#ead08a] text-3xl font-semibold text-[#8a6000] flex items-center justify-center">
                {avatarUrl ? (
                  <Image
                    src={avatarUrl}
                    alt={`${displayName} avatar`}
                    fill
                    sizes="80px"
                    className="object-cover"
                    priority
                  />
                ) : (
                  avatarLetter
                )}
              </div>
              <div className="space-y-1">
                <p className="text-3xl font-semibold tracking-wide">{displayName}</p>
                {primaryIdLabel && primaryIdValue ? (
                  <p className="text-xs uppercase tracking-[0.3em] text-gray-500">
                    {primaryIdLabel}: {primaryIdValue}
                  </p>
                ) : null}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href="/"
                className="rounded-full border-2 border-black/15 px-5 py-2 text-xs font-semibold tracking-[0.22em] text-gray-600 transition hover:border-[#f8c84a] hover:bg-[#f8c84a]/12 hover:text-[#c18400]"
              ><SiteText copyKey="site.app.profile.personalpage.20b6e2fcece9" /></Link>
              <Link
                href="/recharge"
                className="rounded-full border-2 border-black/15 px-5 py-2 text-xs font-semibold tracking-[0.22em] text-gray-600 transition hover:border-[#f8c84a] hover:bg-[#f8c84a]/12 hover:text-[#c18400]"
              ><SiteText copyKey="site.app.profile.personalpage.0a2dde4c65fb" /></Link>
              {quickEntryLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="rounded-full border-2 border-black/15 px-5 py-2 text-xs font-semibold tracking-[0.2em] text-gray-600 transition hover:border-[#f8c84a] hover:bg-[#f8c84a]/12 hover:text-[#c18400]"
                >
                  <SiteText namespace="site.app.profile.personalpage" value={link.label} />
                </Link>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
            {stats.map(renderStat)}
          </div>
        </div>

        {transactionHistory}

        <div className={cardClass}>
          <div className="border-b border-dashed border-black/10 pb-6 grid gap-6 lg:grid-cols-[220px_1fr]">
            <div className="space-y-3 lg:border-r lg:border-dashed lg:border-black/10 lg:pr-6">
              <nav className="space-y-2">
                {profileTabs.map((tab) => {
                  const active = tab.id === activeTab;
                  return (
                  <Link
                    key={tab.id}
                    href={`/profile?tab=${tab.id}`}
                    scroll={false}
                    prefetch={false}
                    className={`block rounded-xl border px-4 py-3 text-sm transition ${
                      active
                        ? 'border-[#f8c84a] bg-[#f8c84a]/18 text-[#c18400]'
                        : 'border-black/10 text-gray-600 hover:border-[#f8c84a] hover:text-[#c18400]'
                    }`}
                  >
                    <SiteText namespace="site.app.profile.personalpage" value={tab.label} />
                  </Link>
                  );
                })}
              </nav>
            </div>
            <div className="space-y-3">
              <div className="pt-2">
                {activeTab === 'profile-level' && (isLaobanMember || isPeiwanMember) && (
                  <div id="profile-level" className="space-y-5">
                    <div>
                      <h2 className="text-xl font-semibold tracking-wide text-[#8a6000]"><SiteText copyKey="site.app.profile.personalpage.b6a30c352fcf" /></h2>
                      <p className="text-sm text-gray-500"><SiteText copyKey="site.app.profile.personalpage.f787b08b6067" /></p>
                    </div>
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center justify-between text-sm text-gray-600 gap-2">
                        <span><SiteText copyKey="site.app.profile.personalpage.cc13fb8a957b" />{currentBossLevelName}</span>
                        {nextBossLevel ? (
                          <span><SiteText copyKey="site.app.profile.personalpage.667c954567ae" />{nextBossLevel.vipLevel} · {nextBossLevel.name}<SiteText copyKey="site.app.profile.personalpage.9e2f8bf3a735" />{formatNumber(amountToNextBossLevel)}
                          </span>
                        ) : (
                          <span><SiteText copyKey="site.app.profile.personalpage.067503a5bf3e" /></span>
                        )}
                      </div>
                      <div className="h-3 w-full rounded-full bg-gray-200 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-[#f8c84a] to-[#ffe08a]"
                          style={{ width: `${bossProgressPercent}%` }}
                          aria-hidden="true"
                        />
                      </div>
                      <div className="flex flex-wrap items-center justify-between text-xs text-gray-500 gap-2">
                        <span><SiteText copyKey="site.app.profile.personalpage.97d9a08ccd40" />{formatNumber(totalSpentValue)}</span>
                        <span><SiteText copyKey="site.app.profile.personalpage.1c5a3e03faf1" />{formatNumber(nextBossLevel?.threshold ?? currentBossLevel?.threshold ?? totalSpentValue)}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-3 text-xs">
                      {VIP_LEVELS.map((role) => {
                        const achieved = totalSpentValue >= role.threshold;
                        return (
                          <span
                            key={role.threshold}
                            className={`px-3 py-1 rounded-full border ${
                              achieved ? 'border-2 border-[#f5c04d] text-[#d69b00]' : 'border-black/10 text-gray-400'
                            }`}
                          ><SiteText copyKey="site.app.profile.personalpage.7b703872538d" />{role.vipLevel} · {role.name} · {formatNumber(role.threshold)}
                          </span>
                        );
                      })}
                    </div>
                    {isPeiwanMember && (
                      <div className="rounded-2xl border border-black/5 bg-gradient-to-br from-[#fff7e0] to-[#fff2cc] p-5 space-y-3 shadow-[0_8px_30px_rgba(17,24,39,0.05)]">
                        <div className="space-y-1">
                          <p className="text-xs uppercase tracking-[0.4em] text-[#b07d00]">{autoCommissionCardTitle}</p>
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <h3 className="text-lg font-semibold text-[#8a6000]"><SiteText copyKey="site.app.profile.personalpage.25083e17b076" /></h3>
                            <span className={`inline-flex px-3 py-1 rounded-full text-xs font-medium ${autoCommissionStatusMeta.badgeClass}`}>
                              <SiteText namespace="site.app.profile.personalpage" value={autoCommissionStatusMeta.label} />
                            </span>
                          </div>
                        </div>
                        <div className="h-3 w-full rounded-full bg-black/10 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-[#f8c84a] to-[#ffe08a]"
                            style={{ width: `${autoCommissionProgressPercent}%` }}
                            aria-hidden="true"
                          />
                        </div>
                        <div className="space-y-1 text-sm text-[#7a5b12]">
                          <p>{autoCommissionHint}</p>
                          <p><SiteText copyKey="site.app.profile.personalpage.0f1a2515abc3" />{formatNumber(autoCommissionCurrentAmount)} / {formatNumber(AUTO_COMMISSION_THRESHOLD)}
                          </p>
                          <p><SiteText copyKey="site.app.profile.personalpage.f0da1c7b4ef1" />{autoCommissionWindowLabel}</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'profile-heart' && (
                  <div id="profile-heart" className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h2 className="text-xl font-semibold tracking-wide text-[#8a6000]"><SiteText copyKey="site.app.profile.personalpage.06bbcfc46c2a" /></h2>
                      </div>
                      <div className="flex items-center gap-3">
                        <Link
                          href="/profile/heart"
                          className="px-4 py-2 rounded-full border border-[#d4b24c]/40 text-xs uppercase tracking-[0.4em] text-[#8a6000] hover:bg-[#f8c84a]/12 transition"
                        ><SiteText copyKey="site.app.profile.personalpage.b608cf1b2121" /></Link>
                        <span className="text-xs uppercase tracking-[0.4em] text-gray-400"><SiteText copyKey="site.app.profile.personalpage.343ea874e81a" /></span>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'profile-buff' && (
                  <div id="profile-buff" className="space-y-6">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h2 className="text-xl font-semibold tracking-wide text-[#8a6000]"><SiteText copyKey="site.app.profile.personalpage.9af2298dbec5" /></h2>
                        <p className="text-sm text-gray-500"><SiteText copyKey="site.app.profile.personalpage.78590270ab59" /></p>
                      </div>
                      <span className="text-xs uppercase tracking-[0.4em] text-gray-400"><SiteText copyKey="site.app.profile.personalpage.b903e2ade79b" /></span>
                    </div>
                    {hasBuffData ? (
                      <div className="space-y-4">
                        {buffCards.map((buff) => {
                          const statusMeta = buff.key === 'commission' ? getBuffStatusMeta(buff.expiresAt)
                            : buff.periods.length ? { label: '可用', badgeClass: 'bg-emerald-50 text-emerald-600' }
                            : { label: '暂无有效额度', badgeClass: 'bg-gray-100 text-gray-500' };
                          const valueDisplay = buff.key === 'commission' ? formatBuffValue(buff.value) : String(buff.value ?? '0');
                          return (
                            <div
                              key={buff.key}
                              className="rounded-2xl border border-[#d4b24c]/25 bg-gradient-to-br from-[#fff9e8] to-[#fff1c6] p-5 space-y-3 shadow-[0_8px_30px_rgba(17,24,39,0.05)]"
                            >
                              <div className="space-y-1">
                                <p className="text-xs uppercase tracking-[0.4em] text-gray-400"><SiteText namespace="site.app.profile.personalpage" value={buff.subtitle} /></p>
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <h3 className="text-lg font-semibold text-[#171717]"><SiteText namespace="site.app.profile.personalpage" value={buff.title} /></h3>
                                  <span className={`inline-flex px-3 py-1 rounded-full text-xs font-medium ${statusMeta.badgeClass}`}>
                                    <SiteText namespace="site.app.profile.personalpage" value={statusMeta.label} />
                                  </span>
                                </div>
                              </div>
                              <div className="space-y-1 text-sm text-gray-600">
                                <p className="flex flex-wrap items-center gap-2">
                                  <span className="text-gray-500"><SiteText namespace="site.app.profile.personalpage" value={buff.valueLabel} /></span>
                                  <span className="text-2xl font-semibold text-[#8a6000] leading-none">{valueDisplay}</span>
                                </p>
                                {buff.key === 'commission' ? <p><SiteText copyKey="site.app.profile.personalpage.3d7c3fd5d46e" />{formatDate(buff.expiresAt)}</p> : buff.periods.length ? (
                                  <details className="pt-1">
                                    <summary className="cursor-pointer text-[#8a6000]"><SiteText copyKey="site.app.profile.personalpage.54bc5b3c8e00" /></summary>
                                    <ul className="mt-2 space-y-1">
                                      {buff.periods.map((period, index) => (
                                        <li key={`${period.expiresAt}:${index}`}>
                                          {period.restored ? <SiteText copyKey="site.app.profile.personalpage.5973e83a84e4" /> : <SiteText copyKey="site.app.profile.personalpage.d083aba29cec" />} {period.amount}<SiteText copyKey="site.app.profile.personalpage.c09cac686059" />{new Date(period.expiresAt).toLocaleString('zh-CN', { timeZone: ROME_TIMEZONE, timeZoneName: 'short' })}
                                        </li>
                                      ))}
                                    </ul>
                                  </details>
                                ) : <p><SiteText copyKey="site.app.profile.personalpage.af526b515416" /></p>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-gray-400 text-sm"><SiteText copyKey="site.app.profile.personalpage.8b72cdeed06b" /></p>
                    )}
                  </div>
                )}

                {activeTab === 'profile-personalisation' && showPersonalisationTab && (
                  <div id="profile-personalisation" className="space-y-6">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h2 className="text-xl font-semibold tracking-wide text-[#8a6000]"><SiteText copyKey="site.app.profile.personalpage.cd4994e50397" /></h2>
                        <p className="text-sm text-gray-500"><SiteText copyKey="site.app.profile.personalpage.41de4204b04a" /></p>
                      </div>
                      <span className="text-xs uppercase tracking-[0.4em] text-gray-400"><SiteText copyKey="site.app.profile.personalpage.79799fc6ec78" /></span>
                    </div>
                    <div className="grid gap-4 xl:grid-cols-2">
                      <VipRoleSyncPreferenceToggle enabled={vipRoleSyncEnabled} />
                      <VipAnnouncementPreferenceToggle enabled={vipAnnouncementBroadcastEnabled} />
                    </div>
                    <BlacklistManager initialEntries={blacklistItems} />
                    {isPeiwanMember ? (
                      <div className="space-y-6 border-t border-dashed border-black/10 pt-6">
                        {canManageVoicePreview ? (
                          <>
                            <AuditionInvitePreferenceToggle
                              enabled={peiwan?.auditionInviteEnabled === true}
                              hasVoicePreview={Boolean(peiwan?.voicePreviewUrl)}
                            />
                            <VoicePreviewManager
                              initialUrl={peiwan?.voicePreviewUrl ?? null}
                              initialFilename={peiwan?.voicePreviewFilename ?? null}
                            />
                          </>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                )}

                {activeTab === 'profile-info' && (
                  <div id="profile-info" className="space-y-6">
                    <div className="flex justify-between items-center">
                      <h2 className="text-xl font-semibold tracking-wide"><SiteText copyKey="site.app.profile.personalpage.c241ef1b935c" /></h2>
                    </div>
                    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5 text-sm">
                      <div>
                        <dt className="text-gray-400 uppercase tracking-[0.4em] mb-1"><SiteText copyKey="site.app.profile.personalpage.ff65e0488282" /></dt>
                        <dd className="text-lg font-medium">{level}</dd>
                      </div>
                      {!isLaobanMember && (
                        <div>
                          <dt className="text-gray-400 uppercase tracking-[0.4em] mb-1"><SiteText copyKey="site.app.profile.personalpage.1d9a8790ecf5" /></dt>
                        <dd className="text-lg font-medium">{formatCommissionRateDisplay(profileCommissionRate)}</dd>
                        </div>
                      )}
                    </dl>
                    {isPeiwanMember && peiwan && (
                      <div className="border-t border-dashed border-black/10 pt-5 space-y-3">
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm uppercase tracking-[0.4em] text-gray-400"><SiteText copyKey="site.app.profile.personalpage.62c9aa371d93" /></h3>
                          <span className="text-xs uppercase tracking-[0.4em] text-gray-400"><SiteText copyKey="site.app.profile.personalpage.11ee30062d3d" /></span>
                        </div>
                        <div className="flex flex-wrap gap-3">
                          {sortPeiwanGameProfiles(peiwan.gameProfiles ?? []).length > 0 ? (
                            sortPeiwanGameProfiles(peiwan.gameProfiles ?? []).map((profile) => (
                              <span
                                key={`${profile.gameCode}-${profile.tier}-${profile.sourceRoleId ?? 'tagless'}`}
                                className="px-4 py-1 rounded-full border border-[#b07d00] text-[#8a6000] text-sm tracking-wide"
                              >
                                <PeiwanGameProfileLabel profile={profile} />
                              </span>
                            ))
                          ) : (
                            <span className="px-4 py-1 rounded-full border border-black/5 text-sm tracking-wide text-gray-300"><SiteText copyKey="site.app.profile.personalpage.c3dacb1c2a59" /></span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'profile-sent-reviews' && canViewSentPeiwanReviews && (
                  <div id="profile-sent-reviews" className="space-y-6">
                    {isPeiwanMember ? (
                      <div className="space-y-4 rounded-[32px] border border-black/5 bg-white p-6 shadow-[0_10px_30px_rgba(17,24,39,0.04)]">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <h2 className="text-xl font-semibold tracking-wide text-[#8a6000]"><SiteText copyKey="site.app.profile.personalpage.51abd6d878b8" /></h2>
                            <p className="text-sm text-gray-500"><SiteText copyKey="site.app.profile.personalpage.aaf9c9ab96b9" /></p>
                          </div>
                          <span className="text-xs uppercase tracking-[0.4em] text-gray-400"><SiteText copyKey="site.app.profile.personalpage.497064be1f41" />{peiwanReviews.length}<SiteText copyKey="site.app.profile.personalpage.bce2ef61514a" /></span>
                        </div>
                        <PeiwanReviewManager
                          reviews={peiwanReviews.map((review) => ({
                            id: review.id,
                            reviewerDiscordId: review.reviewerDiscordId,
                            reviewerName: review.reviewerName ?? null,
                            content: review.content,
                            displayMode: review.displayMode,
                            createdAtLabel: formatDate(review.createdAt),
                          }))}
                        />
                      </div>
                    ) : null}
                    <SentPeiwanReviewHistory reviews={authoredPeiwanReviewItems} />
                  </div>
                )}

                {activeTab === 'profile-coupon' && (
                  <div id="profile-coupon" className="space-y-6">
                    <div className="flex items-center justify-between">
                      <h2 className="text-xl font-semibold tracking-wide"><SiteText copyKey="site.app.profile.personalpage.e4501732e2af" /></h2>
                      <span className="text-xs uppercase tracking-[0.4em] text-gray-400"><SiteText copyKey="site.app.profile.personalpage.497064be1f41" />{coupons.length}<SiteText copyKey="site.app.profile.personalpage.9273cc90ea18" /></span>
                    </div>
                    {coupons.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {coupons.map((coupon: CouponRecord) => {
                          const statusLabel = couponStatusLabel[coupon.status] ?? coupon.status;
                          const typeLabel = couponTypeLabel[coupon.type] ?? coupon.type;
                          const isUsed = coupon.status === 'USED';
                          return (
                            <div
                              key={coupon.id}
                              className={`rounded-2xl border border-dashed p-5 space-y-3 ${
                                isUsed
                                  ? 'bg-gray-200 border-gray-200 text-gray-500'
                                  : 'bg-gradient-to-br from-[#fff9e8] to-[#fff1c6] border-[#d4b24c]/25'
                              }`}
                            >
                              <div className="flex items-center justify-between text-xs uppercase tracking-[0.4em]">
                                <span className={isUsed ? 'text-gray-500' : 'text-[#8a6000]'}><SiteText namespace="site.app.profile.personalpage" value={statusLabel} /></span>
                              </div>
                              <p className="text-3xl font-semibold text-[#171717]"><SiteText namespace="site.app.profile.personalpage" value={typeLabel} /></p>
                              <div className="text-xs text-gray-500 space-y-1">
                                <p><SiteText copyKey="site.app.profile.personalpage.9dd0d5dcd086" />{formatDate(coupon.expiresAt)}</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-gray-400 text-sm"><SiteText copyKey="site.app.profile.personalpage.154b6700190e" /></p>
                    )}
                  </div>
                )}

              </div>
            </div>
          </div>
        </div>
        </div>
      </section>
    </main>
  );
}
