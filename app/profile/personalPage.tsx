import Image from 'next/image';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { PeiwanReviewManager } from '@/components/profile/PeiwanReviewManager';
import { VipAnnouncementPreferenceToggle } from '@/components/profile/VipAnnouncementPreferenceToggle';
import { getCurrentJinleeUser } from '@/lib/current-jinlee-user';
import { formatAmountDown2 } from '@/lib/numberFormat';
import { formatPeiwanGameProfile, sortPeiwanGameProfiles } from '@/lib/peiwan/gameProfiles';
import { prisma } from '@/lib/prisma';

const BOSS_LEVELS = [
  { threshold: 500, label: '锦鲤' },
  { threshold: 1500, label: '金锦' },
  { threshold: 3000, label: '玉锦' },
  { threshold: 5000, label: '瑞锦' },
  { threshold: 10000, label: '祥锦' },
  { threshold: 20000, label: '福锦' },
  { threshold: 50000, label: '跃锦' },
  { threshold: 120000, label: '龙门锦' },
  { threshold: 300000, label: '龙锦' },
] as const;

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

const getAmountChangeMeta = (value: number | null) => {
  if (value === null || value === undefined) {
    return { label: '—', className: 'text-gray-400' };
  }
  if (value === 0) {
    return { label: '0', className: 'text-gray-500' };
  }
  const prefix = value > 0 ? '+' : '-';
  return {
    label: `${prefix}${formatNumber(Math.abs(value))}`,
    className: value > 0 ? 'text-emerald-500' : 'text-rose-500',
  };
};

export type ProfilePageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
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

const getUtcStartOfNextDay = (value: Date) =>
  new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate() + 1, 0, 0, 0, 0));

const getAutoCommissionRetentionWindow = (lastQualifiedAt: Date | null | undefined, now = new Date()) => {
  if (!lastQualifiedAt) return getAutoCommissionWindow(now);
  const qualifiedAt = lastQualifiedAt instanceof Date ? lastQualifiedAt : new Date(lastQualifiedAt);
  if (Number.isNaN(qualifiedAt.getTime())) return getAutoCommissionWindow(now);
  const windowStart = getUtcStartOfNextDay(qualifiedAt);
  const windowEnd = new Date(windowStart.getTime() + AUTO_COMMISSION_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  return { windowStart, windowEnd };
};

export default async function Profile(props: ProfilePageProps) {
  const rawSearchParams = props.searchParams;
  const resolvedSearchParams =
    ((await rawSearchParams) ?? {}) as Record<string, string | string[] | undefined>;

  const navLinks = [
    { href: '/profile', label: '个人主页' },
    { href: '/profile/bag', label: '我的背包' },
    { href: '/profile/heart', label: '心动值' },
    { href: '/profile/giftwall', label: '礼物墙' },
    { href: '/profile/withdraw', label: '提现' },
    { href: '/profile/point-shop', label: '积分商城' },
    { href: '/recharge', label: '充值中心' },
    { href: '/accounts/wechat/bind', label: '绑定微信' },
  ];
  const quickEntryLinks = navLinks.filter(
    (link) => link.href !== '/profile' && link.href !== '/recharge' && link.href !== '/profile/withdraw',
  );

  const currentUser = await getCurrentJinleeUser();
  if (!currentUser) {
    redirect('/');
  }

  const { jinleeUser, jinleeId, discordUserId } = currentUser;
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
  const isLaobanMember = Boolean(member) && member.status !== 'PEIWAN';
  const showPersonalisationTab = isPeiwanMember || isLaobanMember;
  const vipAnnouncementBroadcastEnabled = member?.vipBenefitProfile?.announcementEnabled !== false;
  const now = new Date();
  const level = peiwan?.level ?? '—';
  const displayName =
    jinleeUser.discordDisplayName ?? member?.serverDisplayName ?? jinleeUser.wechatDisplayName ?? '微信用户';
  const avatarUrl = jinleeUser.discordAvatarUrl ?? jinleeUser.wechatAvatarUrl ?? undefined;
  const avatarLetter = displayName?.[0]?.toUpperCase?.() ?? 'M';
  const primaryIdLabel = discordUserId ? 'Discord ID' : null;
  const primaryIdValue = discordUserId ?? null;
  const pageParam = resolvedSearchParams?.page;
  const parsedPage =
    typeof pageParam === 'string' ? Number.parseInt(pageParam, 10) : Number.parseInt(pageParam?.[0] ?? '1', 10);
  const currentPage = Number.isNaN(parsedPage) || parsedPage < 1 ? 1 : parsedPage;
  const skip = (currentPage - 1) * TRANSACTIONS_PER_PAGE;

  const couponsPromise = prisma.coupon.findMany({
    where: { jinleeId },
    orderBy: { issuedAt: 'desc' },
  });
  type CouponRecord = Awaited<typeof couponsPromise>[number];
  const totalTransactionsPromise = prisma.individualTransaction.count({
    where: { jinleeId },
  });
  const transactionsPromise = prisma.individualTransaction.findMany({
    where: { jinleeId },
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
  const loyaltyPointPromise = prisma.loyaltyPoint.findFirst({
    where: { jinleeId },
  });
  const peiwanReviewsPromise = isPeiwanMember && discordUserId
    ? prisma.peiwanReview.findMany({
        where: { peiwanDiscordId: discordUserId },
        orderBy: { createdAt: 'desc' },
        take: 200,
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
    loyaltyPoint,
    peiwanReviews,
  ] = await Promise.all([
    couponsPromise,
    totalTransactionsPromise,
    transactionsPromise,
    commissionBuffPromise,
    autoCommissionBuffPromise,
    flowBuffPromise,
    spendBuffPromise,
    loyaltyPointPromise,
    peiwanReviewsPromise,
  ]);
  const autoCommissionActiveUntil = autoCommissionBuff?.activeUntil ?? null;
  const autoCommissionActive =
    isPeiwanMember &&
    !!autoCommissionActiveUntil &&
    new Date(autoCommissionActiveUntil).getTime() > now.getTime();
  const { windowStart: autoCommissionWindowStart, windowEnd: autoCommissionWindowEnd } =
    isPeiwanMember && autoCommissionActive
      ? getAutoCommissionRetentionWindow(autoCommissionBuff?.lastQualifiedAt, now)
      : getAutoCommissionWindow(now);
  const autoCommissionIncomeRows = isPeiwanMember
    ? await prisma.individualTransaction.findMany({
        where: {
          jinleeId,
          timeCreatedAt: {
            gte: autoCommissionWindowStart,
            lte: autoCommissionWindowEnd,
          },
          typeOfTransaction: { in: [...AUTO_COMMISSION_INCOME_TYPES] },
        },
        select: { typeOfTransaction: true, balanceBefore: true, balanceAfter: true },
      })
    : [];
  const totalPages = Math.max(1, Math.ceil(totalTransactions / TRANSACTIONS_PER_PAGE));
  const hasPrevPage = currentPage > 1;
  const hasNextPage = currentPage < totalPages;
  const prevPage = Math.max(1, currentPage - 1);
  const nextPage = Math.min(totalPages, currentPage + 1);

  const totalBalanceValue = member?.totalBalance ?? jinleeUser.totalBalance;
  const balanceValue = member?.income ?? jinleeUser.income;
  const totalSpentAmount = member?.totalSpent ?? jinleeUser.totalSpent;
  const stats = [
    { label: '账户余额', value: totalBalanceValue },
    { label: '可提现余额', value: balanceValue },
    { label: '累计消费', value: totalSpentAmount },
    { label: '累计流水', value: peiwan?.totalEarn ?? null },
    { label: '锦鲤积分', value: loyaltyPoint?.points ?? jinleeUser.loyaltyPoints ?? 0 },
  ];

  const totalSpentValue = parseNumeric(totalSpentAmount) ?? 0;
  const currentBossLevel = BOSS_LEVELS.reduce<
    (typeof BOSS_LEVELS)[number] | undefined
  >((acc, role) => (totalSpentValue >= role.threshold ? role : acc), undefined);
  const nextBossLevel = BOSS_LEVELS.find((role) => totalSpentValue < role.threshold);
  const previousThreshold = currentBossLevel?.threshold ?? 0;
  const nextThreshold = nextBossLevel?.threshold ?? previousThreshold;
  const bossProgressRatio = nextBossLevel
    ? (totalSpentValue - previousThreshold) / Math.max(1, nextThreshold - previousThreshold)
    : 1;
  const bossProgressPercent = Math.min(100, Math.max(0, bossProgressRatio * 100));
  const amountToNextBossLevel = nextBossLevel ? Math.max(0, nextBossLevel.threshold - totalSpentValue) : 0;
  const currentBossLevelName = currentBossLevel?.label ?? '锦鲤创始成员';
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
    CROWN_75_VOUCHER: '一日冠75折券',
    CROWN_DAY_90_VOUCHER: '一日冠9折券',
    CROWN_3DAY_90_VOUCHER: '三日冠9折券',
    CROWN_WEEK_90_VOUCHER: '一周冠9折券',
    CROWN_MONTH_90_VOUCHER: '月冠名9折券',
    LOTTERY_VOUCHER: '抽奖代金券',
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
  const autoCommissionStatusMeta = getBuffStatusMeta(autoCommissionActiveUntil);
  const autoCommissionCardTitle = autoCommissionActive ? '锦鲤福星陪玩保级进度' : '锦鲤福星陪玩进度';
  const autoCommissionDeadlineLabel = formatUtcDate(autoCommissionWindowEnd);
  const autoCommissionShortfall = Math.max(0, AUTO_COMMISSION_THRESHOLD - autoCommissionCurrentAmount);
  const autoCommissionHint = autoCommissionActive
    ? `在 ${autoCommissionDeadlineLabel} 前累计收入达到 ${formatNumber(AUTO_COMMISSION_THRESHOLD)}，当前还差 ${formatNumber(autoCommissionShortfall)} 完成保级`
    : `最近30天累计实际收入达到 ${formatNumber(AUTO_COMMISSION_THRESHOLD)} 即可晋升锦鲤福星陪玩`;
  const profileCommissionRate =
    autoCommissionActive && autoCommissionBuff?.targetShare != null
      ? autoCommissionBuff.targetShare
      : member?.commissionRate ?? null;

  const buffCards = [
    {
      key: 'commission',
      title: '抽成 Buff',
      subtitle: '抽成/返佣加成',
      valueLabel: '加成值',
      value: commissionBuff?.boost ?? null,
      expiresAt: commissionBuff?.expiresAt ?? null,
      createdAt: commissionBuff?.createdAt ?? null,
    },
    {
      key: 'flow',
      title: '流水 Buff',
      subtitle: '额外流水额度',
      valueLabel: '剩余额度',
      value: flowBuff?.remainingExtra ?? null,
      expiresAt: flowBuff?.expiresAt ?? null,
      createdAt: flowBuff?.createdAt ?? null,
    },
    {
      key: 'spend',
      title: '消费 Buff',
      subtitle: '消费额外额度',
      valueLabel: '剩余额度',
      value: spendBuff?.remainingExtra ?? null,
      expiresAt: spendBuff?.expiresAt ?? null,
      createdAt: spendBuff?.createdAt ?? null,
    },
  ];
  const hasBuffData = buffCards.some(
    (buff) => buff.value !== null || buff.expiresAt !== null || buff.createdAt !== null,
  );
  const tabCandidates = [
    ...(isLaobanMember || isPeiwanMember ? [{ id: 'profile-level', label: '升级进度' }] : []),
    { id: 'profile-buff', label: 'Buff 状态' },
    ...(showPersonalisationTab ? [{ id: 'profile-personalisation', label: '个性化' }] : []),
    { id: 'profile-info', label: '个人信息' },
    ...(isLaobanMember || isPeiwanMember ? [{ id: 'profile-tx', label: '流水记录' }] : []),
  ] as const;
  const tabParam = resolvedSearchParams?.tab;
  const requestedTab = typeof tabParam === 'string' ? tabParam : tabParam?.[0];
  const profileTabs = tabCandidates;
  const activeTab = profileTabs.some((tab) => tab.id === requestedTab)
    ? requestedTab!
    : profileTabs[0]?.id ?? 'profile-heart';
  const cardClass = 'bg-white rounded-[32px] border border-black/5 p-8 space-y-6 shadow-[0_10px_30px_rgba(17,24,39,0.04)]';


  return (
    <main className="min-h-screen bg-[#f7f3ef] text-[#171717] px-6 py-16">
      <section className="max-w-7xl mx-auto">
        <div className="space-y-8">
          <div id="profile-overview" className={`${cardClass} overflow-hidden`}>
          <div className="space-y-4">
            <p className="text-xs uppercase tracking-[0.6em] text-gray-400">My Profile</p>
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
              >
                返回主页
              </Link>
              <Link
                href="/recharge"
                className="rounded-full border-2 border-black/15 px-5 py-2 text-xs font-semibold tracking-[0.22em] text-gray-600 transition hover:border-[#f8c84a] hover:bg-[#f8c84a]/12 hover:text-[#c18400]"
              >
                充值中心
              </Link>
              {quickEntryLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="rounded-full border-2 border-black/15 px-5 py-2 text-xs font-semibold tracking-[0.2em] text-gray-600 transition hover:border-[#f8c84a] hover:bg-[#f8c84a]/12 hover:text-[#c18400]"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
              {stats.map((item) => (
                <div
                  key={item.label}
                  className="rounded-2xl border border-dashed border-black/10 bg-white/70 p-5 text-center space-y-2"
                >
                  <p className="text-xs tracking-[0.4em] text-gray-500">{item.label}</p>
                  <p className="text-2xl font-mono">{formatNumber(item.value)}</p>
                  {item.label === '可提现余额' && (
                    <div className="pt-2">
                      <Link
                        href="/profile/withdraw"
                        className="px-4 py-2 rounded-full border border-black/10 text-xs uppercase tracking-[0.4em] transition inline-flex items-center justify-center hover:border-[#f8c84a] hover:bg-[#f8c84a]/12 hover:text-[#c18400]"
                      >
                        去提现
                      </Link>
                    </div>
                  )}
                  {item.label === '账户余额' && (
                    <div className="pt-2">
                      <Link
                        href="/recharge"
                        className="px-4 py-2 rounded-full border border-black/10 text-xs uppercase tracking-[0.4em] transition hover:border-[#f8c84a] hover:bg-[#f8c84a]/12 hover:text-[#c18400]"
                      >
                        充值
                      </Link>
                    </div>
                  )}
                  {item.label === '锦鲤积分' && (
                    <div className="pt-2">
                      <Link
                        href="/profile/point-shop"
                        className="px-4 py-2 rounded-full border border-black/10 text-xs uppercase tracking-[0.4em] transition hover:border-[#f8c84a] hover:bg-[#f8c84a]/12 hover:text-[#c18400]"
                      >
                        使用积分
                      </Link>
                    </div>
                  )}
                </div>
              ))}
          </div>
        </div>

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
                    {tab.label}
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
                      <h2 className="text-xl font-semibold tracking-wide text-[#8a6000]">升级进度</h2>
                      <p className="text-sm text-gray-500">累计消费越多，等级越高</p>
                    </div>
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center justify-between text-sm text-gray-600 gap-2">
                        <span>当前等级：{currentBossLevelName}</span>
                        {nextBossLevel ? (
                          <span>
                            距离 {nextBossLevel.label} 还差 {formatNumber(amountToNextBossLevel)}
                          </span>
                        ) : (
                          <span>已达到最高等级</span>
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
                        <span>累计消费：{formatNumber(totalSpentValue)}</span>
                        <span>
                          下一门槛：{formatNumber(nextBossLevel?.threshold ?? currentBossLevel?.threshold ?? totalSpentValue)}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-3 text-xs">
                      {BOSS_LEVELS.map((role) => {
                        const achieved = totalSpentValue >= role.threshold;
                        return (
                          <span
                            key={role.threshold}
                            className={`px-3 py-1 rounded-full border ${
                              achieved ? 'border-2 border-[#f5c04d] text-[#d69b00]' : 'border-black/10 text-gray-400'
                            }`}
                          >
                            {role.label} · {formatNumber(role.threshold)}
                          </span>
                        );
                      })}
                    </div>
                    {isPeiwanMember && (
                      <div className="rounded-2xl border border-black/5 bg-gradient-to-br from-[#fff7e0] to-[#fff2cc] p-5 space-y-3 shadow-[0_8px_30px_rgba(17,24,39,0.05)]">
                        <div className="space-y-1">
                          <p className="text-xs uppercase tracking-[0.4em] text-[#b07d00]">{autoCommissionCardTitle}</p>
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <h3 className="text-lg font-semibold text-[#8a6000]">30天累计实际收入</h3>
                            <span className={`inline-flex px-3 py-1 rounded-full text-xs font-medium ${autoCommissionStatusMeta.badgeClass}`}>
                              {autoCommissionStatusMeta.label}
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
                          <p>
                            当前累计：{formatNumber(autoCommissionCurrentAmount)} / {formatNumber(AUTO_COMMISSION_THRESHOLD)}
                          </p>
                          <p>统计时间：{autoCommissionWindowLabel}</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'profile-heart' && (
                  <div id="profile-heart" className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h2 className="text-xl font-semibold tracking-wide text-[#8a6000]">心动值</h2>
                      </div>
                      <div className="flex items-center gap-3">
                        <Link
                          href="/profile/heart"
                          className="px-4 py-2 rounded-full border border-[#d4b24c]/40 text-xs uppercase tracking-[0.4em] text-[#8a6000] hover:bg-[#f8c84a]/12 transition"
                        >
                          查看心动值
                        </Link>
                        <span className="text-xs uppercase tracking-[0.4em] text-gray-400">点击进入页面</span>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'profile-buff' && (
                  <div id="profile-buff" className="space-y-6">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h2 className="text-xl font-semibold tracking-wide text-[#8a6000]">Buff 状态</h2>
                        <p className="text-sm text-gray-500">查看额度与到期时间</p>
                      </div>
                      <span className="text-xs uppercase tracking-[0.4em] text-gray-400">实时同步</span>
                    </div>
                    {hasBuffData ? (
                      <div className="space-y-4">
                        {buffCards.map((buff) => {
                          const statusMeta = getBuffStatusMeta(buff.expiresAt);
                          const valueDisplay = formatBuffValue(buff.value);
                          return (
                            <div
                              key={buff.key}
                              className="rounded-2xl border border-[#d4b24c]/25 bg-gradient-to-br from-[#fff9e8] to-[#fff1c6] p-5 space-y-3 shadow-[0_8px_30px_rgba(17,24,39,0.05)]"
                            >
                              <div className="space-y-1">
                                <p className="text-xs uppercase tracking-[0.4em] text-gray-400">{buff.subtitle}</p>
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <h3 className="text-lg font-semibold text-[#171717]">{buff.title}</h3>
                                  <span className={`inline-flex px-3 py-1 rounded-full text-xs font-medium ${statusMeta.badgeClass}`}>
                                    {statusMeta.label}
                                  </span>
                                </div>
                              </div>
                              <div className="space-y-1 text-sm text-gray-600">
                                <p className="flex flex-wrap items-center gap-2">
                                  <span className="text-gray-500">{buff.valueLabel}</span>
                                  <span className="text-2xl font-semibold text-[#8a6000] leading-none">{valueDisplay}</span>
                                </p>
                                <p>到期：{formatDate(buff.expiresAt)}</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-gray-400 text-sm">暂无 Buff 信息。</p>
                    )}
                  </div>
                )}

                {activeTab === 'profile-personalisation' && showPersonalisationTab && (
                  <div id="profile-personalisation" className="space-y-6">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h2 className="text-xl font-semibold tracking-wide text-[#8a6000]">个性化</h2>
                        <p className="text-sm text-gray-500">管理播报偏好与名片展示内容</p>
                      </div>
                      <span className="text-xs uppercase tracking-[0.4em] text-gray-400">PROFILE</span>
                    </div>
                    <VipAnnouncementPreferenceToggle enabled={vipAnnouncementBroadcastEnabled} />
                    {isPeiwanMember ? (
                      <div className="space-y-6 border-t border-dashed border-black/10 pt-6">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <h3 className="text-xl font-semibold tracking-wide text-[#8a6000]">老板评语</h3>
                            <p className="text-sm text-gray-500">选择是否展示到你的名片中</p>
                          </div>
                          <span className="text-xs uppercase tracking-[0.4em] text-gray-400">共 {peiwanReviews.length} 条</span>
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
                  </div>
                )}

                {activeTab === 'profile-info' && (
                  <div id="profile-info" className="space-y-6">
                    <div className="flex justify-between items-center">
                      <h2 className="text-xl font-semibold tracking-wide">个人信息</h2>
                    </div>
                    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5 text-sm">
                      <div>
                        <dt className="text-gray-400 uppercase tracking-[0.4em] mb-1">陪玩等级</dt>
                        <dd className="text-lg font-medium">{level}</dd>
                      </div>
                      {!isLaobanMember && (
                        <div>
                          <dt className="text-gray-400 uppercase tracking-[0.4em] mb-1">抽成比例</dt>
                        <dd className="text-lg font-medium">{formatCommissionRateDisplay(profileCommissionRate)}</dd>
                        </div>
                      )}
                    </dl>
                    {isPeiwanMember && peiwan && (
                      <div className="border-t border-dashed border-black/10 pt-5 space-y-3">
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm uppercase tracking-[0.4em] text-gray-400">游戏档位</h3>
                          <span className="text-xs uppercase tracking-[0.4em] text-gray-400">PEIWAN</span>
                        </div>
                        <div className="flex flex-wrap gap-3">
                          {sortPeiwanGameProfiles(peiwan.gameProfiles ?? []).length > 0 ? (
                            sortPeiwanGameProfiles(peiwan.gameProfiles ?? []).map((profile) => (
                              <span
                                key={`${profile.gameCode}-${profile.tier}-${profile.sourceRoleId ?? 'tagless'}`}
                                className="px-4 py-1 rounded-full border border-[#b07d00] text-[#8a6000] text-sm tracking-wide"
                              >
                                {formatPeiwanGameProfile(profile)}
                              </span>
                            ))
                          ) : (
                            <span className="px-4 py-1 rounded-full border border-black/5 text-sm tracking-wide text-gray-300">
                              暂无游戏档位
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'profile-coupon' && (
                  <div id="profile-coupon" className="space-y-6">
                    <div className="flex items-center justify-between">
                      <h2 className="text-xl font-semibold tracking-wide">我的优惠券</h2>
                      <span className="text-xs uppercase tracking-[0.4em] text-gray-400">共 {coupons.length} 张</span>
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
                                <span className={isUsed ? 'text-gray-500' : 'text-[#8a6000]'}>{statusLabel}</span>
                              </div>
                              <p className="text-3xl font-semibold text-[#171717]">{typeLabel}</p>
                              <div className="text-xs text-gray-500 space-y-1">
                                <p>有效期至 {formatDate(coupon.expiresAt)}</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-gray-400 text-sm">暂无优惠券。</p>
                    )}
                  </div>
                )}

                {activeTab === 'profile-tx' && (isPeiwanMember || isLaobanMember) && (
                  <div id="profile-tx" className="space-y-6">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div>
                        <h2 className="text-2xl font-semibold tracking-wide text-[#8a6000]">流水记录</h2>
                        <p className="text-sm text-gray-500">与账户关联的收支流水</p>
                      </div>
                    </div>
                    {transactions.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                          <thead>
                            <tr className="text-left text-gray-400 uppercase tracking-[0.4em] border-b border-black/5">
                              <th className="py-3 pr-4">时间</th>
                              <th className="py-3 pr-4">类型</th>
                              <th className="py-3 pr-4">变动前余额</th>
                              <th className="py-3 pr-4">金额变动</th>
                              <th className="py-3 pr-4">变动后余额</th>
                              <th className="py-3 pr-4">备注</th>
                            </tr>
                          </thead>
                          <tbody>
                            {transactions.map((tx: TransactionRecord) => {
                              const resolvedChange = resolveAmountChange(tx.amountChange, tx.balanceBefore, tx.balanceAfter);
                              const changeMeta = getAmountChangeMeta(resolvedChange);
                              return (
                                <tr key={tx.transactionId} className="border-b border-black/5 last:border-0">
                                  <td className="py-4 pr-4 font-mono">{formatDate(tx.timeCreatedAt)}</td>
                                  <td className="py-4 pr-4">{tx.typeOfTransaction}</td>
                                  <td className="py-4 pr-4 font-mono">{formatNumber(tx.balanceBefore)}</td>
                                  <td className={`py-4 pr-4 font-mono ${changeMeta.className}`}>{changeMeta.label}</td>
                                  <td className="py-4 pr-4 font-mono">{formatNumber(tx.balanceAfter)}</td>
                                  <td className="py-4 pr-4 text-gray-500">{tx.thirdPartydiscordId ?? '—'}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-4 text-sm text-gray-500">
                          <p>
                            第 {Math.min(currentPage, totalPages)} / {totalPages} 页 · 共 {totalTransactions} 条
                          </p>
                          <div className="flex gap-2">
                            <Link
                              href={`/profile?tab=profile-tx&page=${prevPage}`}
                              scroll={false}
                              prefetch={false}
                              className={`px-4 py-2 rounded-full border text-xs uppercase tracking-[0.4em] ${
                                hasPrevPage ? 'hover:bg-black/5 border-black/20' : 'border-black/5 text-gray-300 pointer-events-none'
                              }`}
                              aria-disabled={!hasPrevPage}
                            >
                              上一页
                            </Link>
                            <Link
                              href={`/profile?tab=profile-tx&page=${nextPage}`}
                              scroll={false}
                              prefetch={false}
                              className={`px-4 py-2 rounded-full border text-xs uppercase tracking-[0.4em] ${
                                hasNextPage ? 'hover:bg-black/5 border-black/20' : 'border-black/5 text-gray-300 pointer-events-none'
                              }`}
                              aria-disabled={!hasNextPage}
                            >
                              下一页
                            </Link>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <p className="text-gray-500">暂时没有流水记录。</p>
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
