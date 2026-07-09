'use client';

/* eslint-disable @next/next/no-img-element */
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArchiveBoxIcon,
  ArrowRightOnRectangleIcon,
  ClockIcon,
  Cog6ToothIcon,
  DocumentTextIcon,
  GiftIcon,
  HomeIcon,
  QuestionMarkCircleIcon,
  SparklesIcon,
  UserCircleIcon,
  WalletIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { CheckIcon } from '@heroicons/react/24/solid';
import { startTransition, useEffect, useRef, useState } from 'react';
import {
  buildLotteryFusionSourceRef,
  LOTTERY_FUSION_RULES,
  type LotteryFusionSourceKind,
} from '@/lib/lottery-fusion';

export type FusionItemView = {
  id: string;
  sourceKind?: LotteryFusionSourceKind;
  prizeName: string;
  prizeType: string;
  pool: string;
  expiresAt: string | null;
  createdAt: string;
  imageUrl?: string | null;
};

export type FusionResultView = {
  drawId: string;
  prizeName: string;
  prizeType: string;
  pool: string;
  poolLabel: string;
  imageUrl: string | null;
  expiresAt: string | null;
  sourceIds: string[];
};

export type FusionMembershipView = {
  level: number;
  currentValue: number;
  nextValue: number;
  progressPercent: number;
};

type LotteryFusionClientProps = {
  initialItems: FusionItemView[];
  initialSelectedIds?: string[];
  membership: FusionMembershipView;
  embeddedInProfile?: boolean;
};

type Notice = {
  level: 'success' | 'error';
  text: string;
} | null;

type BlockingDialog = {
  title: string;
  text: string;
} | null;

type AnimationPhase = 'charging' | 'complete';

type AnimationPayload = {
  result: FusionResultView;
  sourceItems: FusionItemView[];
};

type AnimationState = {
  phase: AnimationPhase;
  payload: AnimationPayload;
} | null;

type SortKey = 'created-asc' | 'created-desc' | 'expires-asc' | 'pool-asc';
type InventoryView = 'grid' | 'compact';
type FilterPool = 'ALL' | 'NORMAL' | 'MEDIUM' | 'ADVANCED' | 'SPECIAL';

const ROME_TIMEZONE = 'Europe/Rome';
const ANIMATION_TIMINGS = {
  charging: 880,
} as const;

const NAV_ITEMS: ReadonlyArray<{
  href: string;
  label: string;
  icon: typeof HomeIcon;
  active?: boolean;
}> = [
  { href: '/', label: '首页', icon: HomeIcon },
  { href: '/profile', label: '个人中心', icon: UserCircleIcon },
  { href: '/profile/withdraw', label: '钱包', icon: WalletIcon },
  { href: '/profile/bag', label: '背包', icon: ArchiveBoxIcon },
  { href: '/profile', label: '订单记录', icon: DocumentTextIcon },
  { href: '/profile/lottery-fusion', label: '奖品重铸', icon: SparklesIcon, active: true },
  { href: '/profile/heart', label: '邀请奖励', icon: GiftIcon },
  { href: '/profile', label: '设置', icon: Cog6ToothIcon },
];

const RULE_OPTIONS = [LOTTERY_FUSION_RULES[3], LOTTERY_FUSION_RULES[4], LOTTERY_FUSION_RULES[6]] as const;

const FILTER_OPTIONS = [
  { value: 'ALL' as const, label: '全部' },
  { value: 'NORMAL' as const, label: '银色' },
  { value: 'MEDIUM' as const, label: '金色' },
  { value: 'ADVANCED' as const, label: '高级' },
  { value: 'SPECIAL' as const, label: '特殊' },
] as const;

const PRIZE_ARTWORK_BY_NAME: Record<string, string> = {
  香槟代金券: '/lottery-fusion/business/香槟代金券.png',
  棒棒糖代金券: '/lottery-fusion/business/棒棒糖代金券.png',
  蝴蝶代金券: '/lottery-fusion/business/蝴蝶代金券.png',
  抽奖代金券: '/lottery-fusion/business/抽奖代金券.PNG',
  特殊9折券: '/lottery-fusion/business/抽奖特殊9折券.PNG',
  积木游戏代金券: '/lottery-fusion/business/抽积木代金券.png',
  双倍消费5000券: '/lottery-fusion/business/双倍消费5000.PNG',
  双倍流水5000券: '/lottery-fusion/business/双倍流水5000.PNG',
  钢琴代金券: '/lottery-fusion/business/钢琴代金券.png',
  深海宝箱代金券: '/lottery-fusion/business/深海宝箱代金券.png',
  飞机代金券: '/lottery-fusion/business/飞机代金券.png',
  '7折券': '/lottery-fusion/business/7折券.PNG',
  '8折券': '/lottery-fusion/business/八折券.PNG',
  一日冠95折券: '/lottery-fusion/business/一日冠95折.PNG',
  一日冠92折券: '/lottery-fusion/business/一日冠92折.PNG',
  一日冠9折券: '/lottery-fusion/business/一日冠9折券.PNG',
  三日冠92折券: '/lottery-fusion/business/三日冠92折.PNG',
  三日冠9折券: '/lottery-fusion/business/三日冠9折券.PNG',
  一周冠92折券: '/lottery-fusion/business/一周冠92折.PNG',
  一周冠9折券: '/lottery-fusion/business/一周冠9折.PNG',
  '4位数靓号卡': '/lottery-fusion/business/4位数靓号.PNG',
  '3位数靓号卡': '/lottery-fusion/business/3位数靓号.PNG',
  自定义tag券: '/lottery-fusion/business/自定义tag.PNG',
  自定义礼物券: '/lottery-fusion/business/自定义礼物.PNG',
  绝白羽翼: '/lottery-fusion/reference/demo-butterfly.png',
  蝴蝶: '/lottery-fusion/reference/demo-butterfly.png',
  蝶光之翼: '/lottery-fusion/reference/demo-butterfly.png',
  星夜来信: '/lottery-fusion/reference/demo-letter.png',
  琥珀香氛: '/lottery-fusion/reference/demo-perfume.png',
  香水代金券: '/lottery-fusion/reference/demo-perfume.png',
  月光发冠: '/lottery-fusion/reference/demo-tiara.png',
  皇冠: '/lottery-fusion/reference/demo-tiara.png',
  心愿钥匙: '/lottery-fusion/reference/demo-key.png',
  星穹水晶球: '/lottery-fusion/reference/demo-orb.png',
  高级水晶: '/lottery-fusion/reference/demo-orb.png',
  定制礼物券: '/lottery-fusion/reference/demo-letter.png',
  小蛋糕代金券: '/lottery-fusion/business/小蛋糕.png',
};

const POOL_LABEL: Record<string, string> = {
  NORMAL: '银色',
  MEDIUM: '金色',
  ADVANCED: '高级',
  SPECIAL: '特殊',
};

const RESULT_POOL_LABEL: Record<string, string> = {
  NORMAL: '银色',
  MEDIUM: '金色',
  ADVANCED: '高级',
  SPECIAL: '特殊',
};

const SOURCE_KIND_LABEL: Record<LotteryFusionSourceKind, string> = {
  lottery: '抽奖',
  coupon: '券',
  pointshop: '积分商城',
};

const POOL_WEIGHT: Record<string, number> = {
  NORMAL: 1,
  MEDIUM: 2,
  ADVANCED: 3,
  SPECIAL: 4,
};

const formatDateOnly = (value?: string | null) => {
  if (!value) return '长期有效';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '长期有效';
  return date.toLocaleDateString('en-CA', { timeZone: ROME_TIMEZONE });
};

const toMillis = (value?: string | null) => {
  if (!value) return 0;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
};

const isExpiredDiscordAttachment = (value?: string | null) => {
  if (!value) return false;
  try {
    const url = new URL(value);
    if (url.hostname !== 'cdn.discordapp.com') return false;
    const expiresAt = url.searchParams.get('ex');
    if (!expiresAt) return false;

    const expiresAtMillis = Number.parseInt(expiresAt, 16) * 1000;
    return Number.isFinite(expiresAtMillis) && expiresAtMillis <= Date.now();
  } catch {
    return false;
  }
};

const resolvePrizeFallbackArt = (prizeName: string) => {
  if (PRIZE_ARTWORK_BY_NAME[prizeName]) {
    return PRIZE_ARTWORK_BY_NAME[prizeName];
  }
  if (prizeName.includes('蝴蝶') || prizeName.includes('羽翼')) {
    return '/lottery-fusion/reference/demo-butterfly.png';
  }
  if (prizeName.includes('冠')) {
    return '/lottery-fusion/reference/demo-tiara.png';
  }
  if (prizeName.includes('香槟') || prizeName.includes('香水')) {
    return '/lottery-fusion/reference/demo-perfume.png';
  }
  if (prizeName.includes('宝箱') || prizeName.includes('水晶') || prizeName.includes('海')) {
    return '/lottery-fusion/reference/demo-orb.png';
  }
  if (prizeName.includes('钥匙') || prizeName.includes('飞机')) {
    return '/lottery-fusion/reference/demo-key.png';
  }
  if (prizeName.includes('卡') || prizeName.includes('券') || prizeName.includes('tag')) {
    return '/lottery-fusion/reference/demo-letter.png';
  }
  return null;
};

const getPrizeArt = (item: Pick<FusionItemView, 'prizeName' | 'imageUrl'> | Pick<FusionResultView, 'prizeName' | 'imageUrl'>) => {
  const imageUrl = item.imageUrl?.trim();
  if (imageUrl && !isExpiredDiscordAttachment(imageUrl)) {
    return imageUrl;
  }
  return resolvePrizeFallbackArt(item.prizeName);
};

const getPoolText = (value?: string | null) => {
  if (!value) return '银色';
  return POOL_LABEL[value] ?? value;
};

const getResultPoolText = (value?: string | null) => {
  if (!value) return '银色';
  return RESULT_POOL_LABEL[value] ?? value;
};

const sortItems = (items: FusionItemView[], sortKey: SortKey) => {
  return [...items].sort((left, right) => {
    if (sortKey === 'created-asc') {
      return toMillis(left.createdAt) - toMillis(right.createdAt);
    }
    if (sortKey === 'expires-asc') {
      return toMillis(left.expiresAt) - toMillis(right.expiresAt);
    }
    if (sortKey === 'pool-asc') {
      const poolDiff = (POOL_WEIGHT[left.pool] ?? 0) - (POOL_WEIGHT[right.pool] ?? 0);
      if (poolDiff !== 0) return poolDiff;
    }
    return toMillis(right.createdAt) - toMillis(left.createdAt);
  });
};

export function LotteryFusionClient({
  initialItems,
  initialSelectedIds = [],
  membership,
  embeddedInProfile = false,
}: LotteryFusionClientProps) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [selectedIds, setSelectedIds] = useState<string[]>(
    initialSelectedIds.filter((id) => initialItems.some((item) => item.id === id)),
  );
  const [targetFusionCount, setTargetFusionCount] = useState<3 | 4 | 6>(4);
  const [sortKey, setSortKey] = useState<SortKey>('created-desc');
  const [filterPool, setFilterPool] = useState<FilterPool>('ALL');
  const [inventoryView, setInventoryView] = useState<InventoryView>('grid');
  const [notice, setNotice] = useState<Notice>(null);
  const [blockingDialog, setBlockingDialog] = useState<BlockingDialog>(null);
  const [loading, setLoading] = useState(false);
  const [animationState, setAnimationState] = useState<AnimationState>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const animationTimersRef = useRef<Array<ReturnType<typeof setTimeout>>>([]);
  const appliedAnimationRef = useRef<string | null>(null);

  const selectedItems = selectedIds
    .map((id) => items.find((item) => item.id === id) ?? null)
    .filter((item): item is FusionItemView => item !== null);
  const selectedCount = selectedItems.length;
  const filteredItems = sortItems(
    items.filter((item) => (filterPool === 'ALL' ? true : item.pool === filterPool)),
    sortKey,
  );
  const canFuse = selectedCount === targetFusionCount && !loading;
  const isAnimating = animationState?.phase === 'charging';
  const completedResult = animationState?.phase === 'complete' ? animationState.payload.result : null;
  const interactionLocked = loading || isAnimating || Boolean(blockingDialog);

  const clearAnimationTimers = () => {
    for (const timer of animationTimersRef.current) {
      clearTimeout(timer);
    }
    animationTimersRef.current = [];
  };

  const applyFusionResult = (payload: AnimationPayload) => {
    if (appliedAnimationRef.current === payload.result.drawId) return;
    appliedAnimationRef.current = payload.result.drawId;

    const usedIds = new Set(payload.result.sourceIds);
    setItems((current) => [
      {
        id: buildLotteryFusionSourceRef('lottery', payload.result.drawId),
        sourceKind: 'lottery',
        prizeName: payload.result.prizeName,
        prizeType: payload.result.prizeType,
        pool: payload.result.pool,
        expiresAt: payload.result.expiresAt,
        createdAt: new Date().toISOString(),
        imageUrl: payload.result.imageUrl,
      },
      ...current.filter((item) => !usedIds.has(item.id)),
    ]);
    setSelectedIds([]);
    setNotice(null);
  };

  const completeAnimation = (payload: AnimationPayload) => {
    clearAnimationTimers();
    applyFusionResult(payload);
    setAnimationState({ phase: 'complete', payload });
  };

  const startAnimation = (payload: AnimationPayload) => {
    clearAnimationTimers();
    appliedAnimationRef.current = null;
    setAnimationState({ phase: 'charging', payload });

    animationTimersRef.current.push(
      setTimeout(() => {
        completeAnimation(payload);
      }, ANIMATION_TIMINGS.charging),
    );
  };

  useEffect(() => {
    return () => {
      clearAnimationTimers();
    };
  }, []);

  useEffect(() => {
    setItems(initialItems);
    setSelectedIds((current) => current.filter((id) => initialItems.some((item) => item.id === id)));
  }, [initialItems]);

  const toggleSelection = (itemId: string) => {
    if (interactionLocked) return;
    setNotice(null);

    setSelectedIds((current) => {
      if (current.includes(itemId)) {
        return current.filter((value) => value !== itemId);
      }
      if (current.length >= targetFusionCount) {
        setNotice({
          level: 'error',
          text: `当前档位最多选择 ${targetFusionCount} 个券或奖品`,
        });
        return current;
      }
      return [...current, itemId];
    });
  };

  const handleFusionRuleChange = (count: 3 | 4 | 6) => {
    if (interactionLocked) return;
    setTargetFusionCount(count);
    setNotice(null);

    setSelectedIds((current) => {
      if (current.length <= count) return current;
      setNotice({
        level: 'error',
        text: `已切换到 ${count} 个融合，超出的券或奖品已取消选择`,
      });
      return current.slice(0, count);
    });
  };

  const handleFuse = async () => {
    if (!canFuse) {
      setNotice({
        level: 'error',
        text: `请先选择 ${targetFusionCount} 个券或奖品`,
      });
      return;
    }

    const selectedSnapshot = selectedItems;
    setLoading(true);
    setNotice(null);

    try {
      const response = await fetch('/api/lottery/fuse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceIds: selectedIds }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const errorCode = typeof data?.code === 'string' ? data.code : '';
        const errorMessage = typeof data?.error === 'string' ? data.error : '重铸失败';

        if (errorCode === 'SOURCE_ITEM_UNAVAILABLE' || errorCode === 'NO_SOURCE_ITEM') {
          setSelectedIds([]);
          setAnimationState(null);
          setNotice(null);
          setBlockingDialog({
            title: '提示',
            text: '所选券或奖品状态已变化，列表已自动刷新，请重新选择',
          });
          startTransition(() => {
            router.refresh();
          });
          return;
        }

        throw new Error(errorMessage);
      }

      const fusionResult = data?.result as FusionResultView | undefined;
      if (!fusionResult?.drawId || !fusionResult?.prizeName) {
        throw new Error('重铸结果异常，请稍后再试');
      }

      startAnimation({
        result: fusionResult,
        sourceItems: selectedSnapshot,
      });
    } catch (error) {
      setNotice({
        level: 'error',
        text: error instanceof Error ? error.message : '重铸失败',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await fetch('/api/logout', { method: 'POST', credentials: 'include' });
      window.location.href = '/';
    } catch {
      window.location.href = '/';
    }
  };

  const resetPrepareCard = () => {
    clearAnimationTimers();
    setAnimationState(null);
    setNotice(null);
  };

  const overviewMessage =
    selectedCount === targetFusionCount
      ? `已满足 ${targetFusionCount} 个融合条件`
      : `请先选择 ${targetFusionCount} 个券或奖品`;

  const showFusionStage = isAnimating || Boolean(completedResult);
  const selectedPanelTitle = completedResult
    ? '重铸结果'
    : isAnimating
      ? '重铸进行中'
      : `已选券/奖品 ${selectedCount}/${targetFusionCount}`;
  const selectedPanelDescription = completedResult
    ? `恭喜🎉抽到了${completedResult.prizeName}`
    : isAnimating
      ? '新的奖品正在生成中'
      : '确认无误后将消耗这些券或奖品';
  const selectedSlots = Array.from({ length: targetFusionCount }, (_, index) => selectedItems[index] ?? null);
  const selectedGridClassName =
    targetFusionCount === 3
      ? 'grid-cols-2 md:grid-cols-3'
      : targetFusionCount === 4
        ? 'grid-cols-2 md:grid-cols-4'
        : 'grid-cols-3 xl:grid-cols-6';
  const shellWrapperClassName = embeddedInProfile
    ? 'min-h-screen bg-[#f7f3ef] text-[#171717] px-4 py-10 sm:px-6 sm:py-12 lg:px-6 lg:py-16'
    : 'min-h-screen bg-[radial-gradient(circle_at_top,_rgba(255,240,230,0.96),_#fff9f4_36%,_#fffaf7_100%)] text-[#85533f]';
  const rootGridClassName = embeddedInProfile
    ? 'mx-auto grid min-h-screen max-w-[1487px] grid-cols-1'
    : 'mx-auto grid min-h-screen max-w-[1487px] grid-cols-1 lg:grid-cols-[168px_minmax(0,1fr)]';
  const primaryActionButtonClassName =
    'flex w-full items-center justify-center rounded-[999px] border border-[#f0d3b7] bg-[linear-gradient(180deg,_#fffdfb,_#fdf0e3)] px-6 py-4 text-[20px] font-semibold text-[#8c5140] shadow-[0_18px_30px_rgba(83,32,26,0.18)] transition hover:translate-y-[-1px]';
  const secondaryActionButtonClassName =
    'w-full rounded-[999px] border border-[#f4d7c0]/65 bg-transparent px-6 py-4 text-[18px] font-medium text-[#ffe5d2] transition hover:bg-white/8';
  const mobileActionButtonLabel = completedResult
    ? '再来一次'
    : isAnimating
      ? '跳过动画'
      : loading
        ? '正在生成...'
        : '开始重铸';
  const mobileActionDisabled = completedResult ? false : isAnimating ? false : !canFuse || loading;

  return (
    <div className={shellWrapperClassName}>
      <style jsx global>{`
        nextjs-portal,
        [data-next-badge-root],
        [data-nextjs-toast],
        [data-next-mark] {
          display: none !important;
        }
      `}</style>

      <div className={rootGridClassName}>
        {!embeddedInProfile ? (
        <aside className="border-b border-[#f0dfd2] bg-[linear-gradient(180deg,_rgba(255,251,248,0.98),_rgba(255,247,242,0.98))] px-4 py-5 lg:border-b-0 lg:border-r lg:px-6 lg:py-8">
          <div className="flex flex-col justify-between gap-8 h-full">
            <div className="space-y-6 lg:space-y-10">
              <div className="flex justify-center lg:justify-center">
                <img
                  src="/lottery-fusion/reference/scheme3-logo.png"
                  alt="Jinlee Club"
                  className="h-[72px] w-auto object-contain lg:h-[108px]"
                />
              </div>

              <nav className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-1 lg:space-y-3">
                {NAV_ITEMS.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.label}
                      href={item.href}
                      className={`flex items-center gap-3 rounded-[18px] px-3 py-3 text-[14px] transition lg:px-4 lg:text-[15px] ${
                        item.active
                          ? 'border border-[#efc89d] bg-[linear-gradient(180deg,_rgba(255,248,239,0.98),_rgba(255,243,230,0.98))] text-[#b36f4d] shadow-[0_12px_24px_rgba(233,195,154,0.22)]'
                          : 'text-[#8b8179] hover:bg-white/70 hover:text-[#a56345]'
                      }`}
                    >
                      <Icon className="h-5 w-5 shrink-0" />
                      <span className="whitespace-nowrap">{item.label}</span>
                    </Link>
                  );
                })}

                <button
                  type="button"
                  onClick={() => void handleLogout()}
                  className="flex w-full items-center gap-3 rounded-[18px] px-3 py-3 text-[14px] text-[#8b8179] transition hover:bg-white/70 hover:text-[#a56345] lg:px-4 lg:text-[15px]"
                >
                  <ArrowRightOnRectangleIcon className="h-5 w-5 shrink-0" />
                  <span className="whitespace-nowrap">{loggingOut ? '退出中...' : '登出'}</span>
                </button>
              </nav>
            </div>

            <div className="rounded-[24px] border border-[#f1ddd0] bg-white/90 p-4 shadow-[0_16px_36px_rgba(226,205,187,0.35)] lg:p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[linear-gradient(180deg,_#f7dac2,_#f2b98d)] text-white shadow-[0_8px_16px_rgba(220,164,120,0.34)]">
                  <SparklesIcon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[12px] uppercase tracking-[0.24em] text-[#9e8c7f]">JINLEE CLUB</p>
                  <p className="text-[15px] font-semibold tracking-[0.14em] text-[#7f5b49]">DIAMOND</p>
                </div>
              </div>

              <div className="mt-5 space-y-2">
                <p className="text-xs text-[#b3a093]">会员等级</p>
                <p className="text-[34px] font-semibold leading-none text-[#85533f]" style={{ fontFamily: 'Noto Serif SC, Songti SC, serif' }}>
                  Lv. {membership.level}
                </p>
              </div>

              <div className="mt-5">
                <div className="h-2 overflow-hidden rounded-full bg-[#f4e4d7]">
                  <div
                    className="h-full rounded-full bg-[linear-gradient(90deg,_#efc17f,_#c98352)]"
                    style={{ width: `${membership.progressPercent}%` }}
                  />
                </div>
                <p className="mt-3 text-sm text-[#9c8879]">
                  {Math.round(membership.currentValue)} / {Math.round(membership.nextValue)}
                </p>
              </div>
            </div>
          </div>
        </aside>
        ) : null}

        <main className="relative overflow-hidden px-4 pb-32 pt-6 sm:px-6 sm:pb-36 lg:px-8 lg:pb-10 lg:pt-10">
          {embeddedInProfile ? (
            <div className="relative mb-6 flex flex-col gap-3 sm:mb-8 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-3">
                <Link
                  href="/profile"
                  className="rounded-full border border-black/10 bg-white px-4 py-2 text-xs uppercase tracking-[0.3em] text-gray-600 transition hover:bg-black/5"
                >
                  返回个人主页
                </Link>
                <Link
                  href="/profile/bag"
                  className="rounded-full border border-black/10 bg-white px-4 py-2 text-xs uppercase tracking-[0.3em] text-gray-600 transition hover:bg-black/5"
                >
                  我的背包
                </Link>
              </div>
            </div>
          ) : null}

          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
            <div>
              <div className="flex items-center gap-2">
                <h1
                  className="text-[34px] font-semibold leading-none tracking-[0.03em] text-[#73452f] sm:text-[44px] lg:text-[56px]"
                  style={{ fontFamily: 'Noto Serif SC, Songti SC, serif' }}
                >
                  奖品重铸
                </h1>
                <QuestionMarkCircleIcon className="h-5 w-5 text-[#d7af8f] lg:h-6 lg:w-6" />
              </div>
              <p className="mt-3 max-w-[680px] text-[14px] text-[#8c6a59] sm:mt-4 sm:text-[16px] lg:mt-5 lg:text-[17px]">
                消耗背包中可重铸的未使用券或奖品，随机获得一个新的抽奖奖品
              </p>
            </div>

            <Link
              href="/profile/lottery-fusion/history"
              className="inline-flex w-fit items-center gap-2 self-start rounded-full border border-[#efdbc9] bg-white/92 px-4 py-2.5 text-[15px] font-medium text-[#7d5745] shadow-[0_12px_24px_rgba(234,214,196,0.36)] transition hover:translate-y-[-1px] sm:px-5 sm:py-3 sm:text-[18px]"
            >
              <ClockIcon className="h-5 w-5" />
              <span>重铸记录</span>
            </Link>
          </div>

          <div className="relative mt-6 grid gap-5 xl:mt-8 xl:grid-cols-[minmax(0,1fr)_318px]">
            <section className="space-y-5">
              <div className="rounded-[28px] border border-[#f0ddd0] bg-[linear-gradient(180deg,_rgba(255,255,255,0.95),_rgba(255,249,245,0.96))] p-5 shadow-[0_18px_46px_rgba(238,221,206,0.44)] lg:rounded-[34px] lg:p-7">
                <div className="grid gap-6 xl:grid-cols-[238px_minmax(0,1fr)]">
                  <div>
                    <h2
                      className="text-[28px] font-semibold text-[#74452f] lg:text-[36px]"
                      style={{ fontFamily: 'Noto Serif SC, Songti SC, serif' }}
                    >
                      选择重铸数量
                    </h2>
                    <p className="mt-3 max-w-[280px] text-[14px] leading-7 text-[#9d7967] lg:mt-5 lg:max-w-[220px] lg:text-[15px] lg:leading-8">
                      投入的券或奖品越多，越有机会获得更稀有的结果
                    </p>
                  </div>

                  <div className="grid gap-3 md:grid-cols-3 lg:gap-4">
                    {RULE_OPTIONS.map((option) => {
                      const active = targetFusionCount === option.count;
                      return (
                        <button
                          key={option.count}
                          type="button"
                          onClick={() => handleFusionRuleChange(option.count)}
                          aria-pressed={active}
                          aria-label={`切换到 ${option.count} 个融合`}
                          className={`rounded-[22px] border px-4 py-5 text-center transition sm:px-6 sm:py-7 lg:rounded-[28px] ${
                            active
                              ? 'border-[#d7a18c] bg-[linear-gradient(180deg,_#a95a5c,_#8b444a)] text-white shadow-[0_20px_34px_rgba(166,92,95,0.32)]'
                              : 'border-[#efddd0] bg-white text-[#8f654e] shadow-[0_12px_28px_rgba(239,226,214,0.34)] hover:border-[#e5c5b1]'
                          }`}
                        >
                          <p
                            className={`text-[26px] font-semibold sm:text-[32px] lg:text-[36px] ${active ? 'text-white' : 'text-[#a2613f]'}`}
                            style={{ fontFamily: 'Noto Serif SC, Songti SC, serif' }}
                          >
                            {option.title}
                          </p>
                          <p className={`mt-5 text-sm ${active ? 'text-[#f8ddcf]' : 'text-[#9f7c69]'}`}>最高可出</p>
                          <p className={`mt-2 text-[20px] font-medium ${active ? 'text-white' : 'text-[#70472f]'}`}>
                            {option.resultLabel}
                          </p>
                          <p className={`mt-3 text-xs leading-6 ${active ? 'text-[#ffe7da]' : 'text-[#9f7c69]'}`}>
                            {option.eligibleRangeLabel}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="rounded-[28px] border border-[#f0ddd0] bg-[linear-gradient(180deg,_rgba(255,255,255,0.95),_rgba(255,249,245,0.96))] p-5 shadow-[0_18px_46px_rgba(238,221,206,0.44)] lg:rounded-[34px] lg:p-7">
                <div className="text-center">
                  <h2
                    className="text-[28px] font-semibold text-[#74452f] lg:text-[38px]"
                    style={{ fontFamily: 'Noto Serif SC, Songti SC, serif' }}
                  >
                    {selectedPanelTitle}
                  </h2>
                  <p className="mt-3 text-[15px] text-[#9d7967]">{selectedPanelDescription}</p>
                </div>

                <div className="mt-6 rounded-[28px] border border-[#dca578] bg-[linear-gradient(180deg,_#944349,_#6b2028)] px-3 pb-2 pt-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_18px_36px_rgba(151,89,81,0.28)] lg:rounded-[34px] lg:px-4 lg:pb-3 lg:pt-4">
                  <div className="relative">
                    <div
                      aria-hidden={showFusionStage}
                      className={`${selectedGridClassName} grid gap-3 ${
                        showFusionStage ? 'pointer-events-none select-none opacity-0' : ''
                      }`}
                    >
                      {selectedSlots.map((item, index) => {
                        const art = item ? getPrizeArt(item) : null;

                        return (
                          <div
                            key={item?.id ?? `slot-${index}`}
                            className="relative rounded-[18px] border border-[#f0d5c0]/80 bg-[linear-gradient(180deg,_rgba(255,249,246,0.98),_rgba(255,243,236,0.96))] p-2.5 shadow-[0_14px_30px_rgba(67,20,25,0.18)] sm:rounded-[24px] sm:p-3"
                          >
                            {item ? (
                              <button
                                type="button"
                                onClick={() => toggleSelection(item.id)}
                                aria-label={`移除 ${item.prizeName}`}
                                className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full border border-[#e3b48b] bg-[rgba(220,173,120,0.88)] text-white shadow-[0_8px_18px_rgba(170,118,69,0.34)]"
                              >
                                <XMarkIcon className="h-4 w-4" />
                              </button>
                            ) : null}

                            <div className="flex min-h-[170px] flex-col items-center justify-between sm:min-h-[220px]">
                              <div className="w-full">
                                <div className="inline-flex rounded-full border border-[#efdbc9] bg-[#fff7f1] px-3 py-1 text-[11px] font-semibold text-[#b27b58]">
                                  {item ? SOURCE_KIND_LABEL[item.sourceKind ?? 'lottery'] : '待选'}
                                </div>
                              </div>

                              <div className="flex min-h-[76px] items-center justify-center sm:min-h-[110px]">
                                {art ? (
                                  <img src={art} alt={item?.prizeName ?? '奖品'} className="max-h-[88px] object-contain sm:max-h-[116px]" />
                                ) : (
                                  <div className="flex h-[84px] w-[84px] items-center justify-center rounded-full border border-dashed border-[#efcfb7] bg-[#fff8f3] text-xs text-[#c39d83] sm:h-[108px] sm:w-[108px] sm:text-sm">
                                    等待选择
                                  </div>
                                )}
                              </div>

                              {item ? (
                                <div className="mt-3 text-center">
                                  <p
                                    className="max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-[13px] font-semibold leading-[1.3] text-[#73452f] sm:text-[18px]"
                                    style={{ fontFamily: 'Noto Serif SC, Songti SC, serif' }}
                                    title={item.prizeName}
                                  >
                                    {item.prizeName}
                                  </p>
                                  <p className="mt-1 text-xs text-[#aa826e] sm:mt-2 sm:text-sm">{getPoolText(item.pool)}</p>
                                  <p className="mt-1 text-[11px] text-[#9f8a7c] sm:text-sm">到期：{formatDateOnly(item.expiresAt)}</p>
                                </div>
                              ) : (
                                <div className="mt-3 text-center">
                                  <p className="text-[16px] font-semibold text-[#c3a391] sm:text-[22px]" style={{ fontFamily: 'Noto Serif SC, Songti SC, serif' }}>
                                    空位 {index + 1}
                                  </p>
                                  <p className="mt-1 text-[11px] text-[#cfb7a9] sm:mt-2 sm:text-sm">从下方选择一个券或奖品</p>
                                </div>
                              )}
                            </div>

                            <div className="absolute bottom-[-12px] left-1/2 flex h-8 w-8 -translate-x-1/2 items-center justify-center rounded-full border border-[#f0d5c0] bg-[linear-gradient(180deg,_#c48d63,_#a96943)] text-sm font-semibold text-white shadow-[0_10px_18px_rgba(78,24,30,0.24)] sm:bottom-[-14px] sm:h-9 sm:w-9 sm:text-base">
                              {index + 1}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {showFusionStage ? (
                      <div className="absolute inset-0">
                        {completedResult ? (
                          <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-[24px] border border-[#f0c9a2]/55 bg-[linear-gradient(180deg,_rgba(124,54,40,0.56),_rgba(83,32,26,0.42))] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] sm:rounded-[28px] sm:p-4">
                            <div className="flex h-full w-full max-w-[400px] flex-col overflow-hidden rounded-[22px] border border-[#f2d0b0]/45 bg-[radial-gradient(circle_at_top,_rgba(95,45,34,0.84),_rgba(69,30,23,0.98)_68%)] px-3 py-3 sm:rounded-[24px] sm:px-4 sm:py-4">
                              <div className="flex min-h-[118px] flex-1 items-center justify-center sm:min-h-[146px]">
                                <div className="flex h-full w-full items-center justify-center overflow-hidden">
                                  {getPrizeArt(completedResult) ? (
                                    <img
                                      src={getPrizeArt(completedResult) ?? undefined}
                                      alt={completedResult.prizeName}
                                      className="max-h-[94px] object-contain drop-shadow-[0_0_20px_rgba(255,226,186,0.46)] sm:max-h-[122px]"
                                    />
                                  ) : null}
                                </div>
                              </div>

                              <div className="flex min-h-[62px] flex-col items-center justify-center px-2 pt-2 sm:min-h-[72px] sm:pt-2">
                                <p
                                  className="max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-[16px] font-semibold leading-[1.18] text-white sm:text-[20px]"
                                  style={{ fontFamily: 'Noto Serif SC, Songti SC, serif' }}
                                >
                                  {completedResult.prizeName}
                                </p>
                                <p className="mt-2 max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-[11px] leading-none tracking-[0.02em] text-[#ffdcbf] sm:text-[12px]">
                                  {getResultPoolText(completedResult.pool)} · 有效期到 {formatDateOnly(completedResult.expiresAt)}
                                </p>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="flex h-full w-full flex-col items-center justify-center rounded-[24px] border border-[#f0c9a2]/55 bg-[linear-gradient(180deg,_rgba(124,54,40,0.56),_rgba(83,32,26,0.42))] p-4 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] sm:rounded-[28px] sm:p-5">
                            <div className="relative mx-auto mt-5 flex h-[148px] w-[148px] items-center justify-center sm:mt-6 sm:h-[168px] sm:w-[168px]">
                              <div className="absolute inset-0 rounded-full border border-[#ffd8a7]/45 animate-pulse" />
                              <div className="absolute inset-[18px] rounded-full border border-[#ffd8a7]/35" />
                              <div className="absolute inset-[36px] rounded-full bg-[radial-gradient(circle,_rgba(255,252,243,0.98),_rgba(255,233,190,0.86),_rgba(248,193,121,0.25))] shadow-[0_0_40px_rgba(255,229,184,0.36)]" />
                              <div className="relative h-8 w-8 rounded-full bg-[radial-gradient(circle,_rgba(216,146,84,0.92),_rgba(188,108,55,0.52))]" />
                            </div>

                            <p className="mx-auto mt-4 max-w-[320px] text-[14px] leading-6 text-[#ffe3d0] sm:mt-5 sm:text-[15px] sm:leading-7">
                              重新抽奖中...
                            </p>
                          </div>
                        )}
                      </div>
                    ) : null}
                  </div>

                  <div className="mt-6 hidden min-h-[104px] flex-col items-center gap-3 px-1 pb-1 sm:mt-8 sm:min-h-[116px] lg:flex">
                    {!completedResult ? (
                      <button
                        type="button"
                        onClick={isAnimating ? () => completeAnimation(animationState.payload) : () => void handleFuse()}
                        disabled={isAnimating ? false : !canFuse || loading}
                        className={`${primaryActionButtonClassName} max-w-[420px] ${!isAnimating && (!canFuse || loading) ? 'cursor-not-allowed opacity-55' : ''}`}
                      >
                        {isAnimating ? '跳过动画' : loading ? '正在生成...' : '开始重铸'}
                      </button>
                    ) : null}

                    {completedResult ? (
                      <div className="flex w-full max-w-[640px] flex-col gap-3">
                        <button type="button" onClick={resetPrepareCard} className={secondaryActionButtonClassName}>
                          再来一次
                        </button>
                      </div>
                    ) : !showFusionStage ? (
                      <p className="text-sm text-[#ffd7c3]">重铸后，原券或奖品将被消耗</p>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="relative rounded-[28px] border border-[#f0ddd0] bg-[linear-gradient(180deg,_rgba(255,255,255,0.96),_rgba(255,249,245,0.96))] p-5 shadow-[0_18px_46px_rgba(238,221,206,0.44)] lg:rounded-[34px] lg:p-7">
                <div className="flex flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-start lg:justify-between">
                  <div>
                    <div className="flex items-center gap-3">
                      <h2
                        className="text-[28px] font-semibold text-[#74452f] lg:text-[38px]"
                        style={{ fontFamily: 'Noto Serif SC, Songti SC, serif' }}
                      >
                        可选择的未使用券/奖品
                      </h2>
                      <span className="rounded-full bg-[#fff1e5] px-3 py-1 text-sm font-semibold text-[#c07d55]">
                        {items.length}
                      </span>
                    </div>

                    <div className="mt-5 flex flex-wrap gap-3">
                      {FILTER_OPTIONS.map((option) => {
                        const active = filterPool === option.value;
                        return (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => setFilterPool(option.value)}
                            aria-pressed={active}
                            aria-label={`筛选 ${option.label}`}
                            className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                              active
                                ? 'border-[#d89c79] bg-[linear-gradient(180deg,_#fff8f1,_#fff0e1)] text-[#b56d49] shadow-[0_10px_18px_rgba(231,195,161,0.24)]'
                                : 'border-[#efe0d2] bg-white text-[#9d7a68] hover:border-[#e5c5b1]'
                            }`}
                          >
                            {option.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <label className="relative">
                      <span className="sr-only">排序方式</span>
                      <select
                        value={sortKey}
                        onChange={(event) => setSortKey(event.target.value as SortKey)}
                        className="rounded-[16px] border border-[#efddd0] bg-white px-4 py-3 text-sm text-[#8b6857] shadow-[0_10px_18px_rgba(238,221,206,0.22)] outline-none"
                      >
                        <option value="created-asc">最早获得</option>
                        <option value="created-desc">最新获得</option>
                        <option value="expires-asc">最早到期</option>
                        <option value="pool-asc">等级从低到高</option>
                      </select>
                    </label>

                    <div className="flex items-center gap-2 rounded-[16px] border border-[#efddd0] bg-white p-2 shadow-[0_10px_18px_rgba(238,221,206,0.22)]">
                      <button
                        type="button"
                        onClick={() => setInventoryView('grid')}
                        aria-label="网格视图"
                        aria-pressed={inventoryView === 'grid'}
                        className={`flex h-10 w-10 items-center justify-center rounded-xl border transition ${
                          inventoryView === 'grid'
                            ? 'border-[#d89c79] bg-[#fff4ea] text-[#b56d49]'
                            : 'border-transparent text-[#b89b87]'
                        }`}
                      >
                        <div className="grid grid-cols-2 gap-1">
                          <span className="h-1.5 w-1.5 rounded-full bg-current" />
                          <span className="h-1.5 w-1.5 rounded-full bg-current" />
                          <span className="h-1.5 w-1.5 rounded-full bg-current" />
                          <span className="h-1.5 w-1.5 rounded-full bg-current" />
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => setInventoryView('compact')}
                        aria-label="列表视图"
                        aria-pressed={inventoryView === 'compact'}
                        className={`flex h-10 w-10 items-center justify-center rounded-xl border transition ${
                          inventoryView === 'compact'
                            ? 'border-[#d89c79] bg-[#fff4ea] text-[#b56d49]'
                            : 'border-transparent text-[#b89b87]'
                        }`}
                      >
                        <div className="space-y-1">
                          <span className="block h-1.5 w-5 rounded-full bg-current" />
                          <span className="block h-1.5 w-5 rounded-full bg-current" />
                          <span className="block h-1.5 w-5 rounded-full bg-current" />
                        </div>
                      </button>
                    </div>
                  </div>
                </div>

                <div className={`mt-6 ${inventoryView === 'grid' ? 'grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-6' : 'space-y-3'}`}>
                  {filteredItems.map((item) => {
                    const selected = selectedIds.includes(item.id);
                    const art = getPrizeArt(item);

                    if (inventoryView === 'compact') {
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => toggleSelection(item.id)}
                          disabled={interactionLocked}
                          aria-label={selected ? `取消选择 ${item.prizeName}` : `选择 ${item.prizeName}`}
                          className={`flex w-full items-center gap-4 rounded-[24px] border p-4 text-left transition ${
                            selected
                              ? 'border-[#d49773] bg-[linear-gradient(180deg,_#fff6f0,_#fff0e7)] shadow-[0_18px_36px_rgba(230,193,161,0.26)]'
                              : 'border-[#efe0d2] bg-white hover:border-[#e1c0a7]'
                          } ${interactionLocked ? 'cursor-not-allowed opacity-75' : ''}`}
                        >
                          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-[18px] border border-[#efddd0] bg-[#fff9f4]">
                            {art ? <img src={art} alt={item.prizeName} className="max-h-[68px] object-contain" /> : null}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap gap-2">
                              <span className="rounded-full border border-[#f0ddcf] bg-[#fff8f2] px-3 py-1 text-xs text-[#b27b58]">
                                {getPoolText(item.pool)}
                              </span>
                            </div>
                            <p
                              className="mt-3 overflow-hidden text-ellipsis whitespace-nowrap text-[16px] font-semibold leading-[1.35] text-[#73452f] sm:text-[18px]"
                              style={{ fontFamily: 'Noto Serif SC, Songti SC, serif' }}
                              title={item.prizeName}
                            >
                              {item.prizeName}
                            </p>
                            <p className="mt-2 text-sm text-[#9d7a68]">到期：{formatDateOnly(item.expiresAt)}</p>
                          </div>
                          <div
                            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border ${
                              selected
                                ? 'border-[#b46a48] bg-[linear-gradient(180deg,_#8f4b39,_#6f2f25)] text-white'
                                : 'border-[#e5d2c2] bg-white text-transparent'
                            }`}
                          >
                            <CheckIcon className="h-4 w-4" />
                          </div>
                        </button>
                      );
                    }

                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => toggleSelection(item.id)}
                        disabled={interactionLocked}
                        aria-label={selected ? `取消选择 ${item.prizeName}` : `选择 ${item.prizeName}`}
                        className={`rounded-[26px] border p-3 text-left transition ${
                          selected
                            ? 'border-[#d49773] bg-[linear-gradient(180deg,_#fff6f0,_#fff0e7)] shadow-[0_18px_36px_rgba(230,193,161,0.26)]'
                            : 'border-[#efe0d2] bg-white hover:border-[#e1c0a7]'
                        } ${interactionLocked ? 'cursor-not-allowed opacity-75' : ''}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <span className="rounded-full border border-[#f0ddcf] bg-[#fff8f2] px-3 py-1 text-[11px] font-semibold text-[#b27b58]">
                            {SOURCE_KIND_LABEL[item.sourceKind ?? 'lottery']}
                          </span>
                          <span
                            className={`flex h-7 w-7 items-center justify-center rounded-full border ${
                              selected
                                ? 'border-[#b46a48] bg-[linear-gradient(180deg,_#8f4b39,_#6f2f25)] text-white'
                                : 'border-[#e5d2c2] bg-white text-transparent'
                            }`}
                          >
                            <CheckIcon className="h-4 w-4" />
                          </span>
                        </div>

                        <div className="mt-4 flex h-[104px] items-center justify-center rounded-[18px] border border-[#efddd0] bg-[linear-gradient(180deg,_#fffdfb,_#fff7f1)] sm:h-[136px] sm:rounded-[22px]">
                          {art ? <img src={art} alt={item.prizeName} className="max-h-[82px] object-contain sm:max-h-[118px]" /> : null}
                        </div>

                        <div className="mt-4 text-center">
                          <p
                            className="overflow-hidden text-ellipsis whitespace-nowrap text-[14px] font-semibold leading-[1.35] text-[#73452f] sm:text-[18px]"
                            style={{ fontFamily: 'Noto Serif SC, Songti SC, serif' }}
                            title={item.prizeName}
                          >
                            {item.prizeName}
                          </p>
                          <p className="mt-1 text-xs text-[#b49380] sm:mt-2 sm:text-sm">{getPoolText(item.pool)}</p>
                          <p className="mt-1 text-[11px] text-[#9d7a68] sm:mt-2 sm:text-sm">到期：{formatDateOnly(item.expiresAt)}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>

                <p className="mt-5 text-center text-sm text-[#b09484]">只显示当前可重铸的未使用券与奖品</p>
              </div>
            </section>

            <aside className="order-first space-y-5 xl:order-none">
              <div className="rounded-[28px] border border-[#f0ddd0] bg-[linear-gradient(180deg,_rgba(255,255,255,0.96),_rgba(255,249,245,0.96))] p-5 shadow-[0_18px_46px_rgba(238,221,206,0.44)] lg:rounded-[32px] lg:p-6">
                <div className="flex items-center gap-2">
                  <h2
                    className="text-[28px] font-semibold text-[#74452f] lg:text-[36px]"
                    style={{ fontFamily: 'Noto Serif SC, Songti SC, serif' }}
                  >
                    重铸概览
                  </h2>
                  <SparklesIcon className="h-5 w-5 text-[#e1b38d]" />
                </div>

                <div className="mt-5 space-y-4 text-[18px] text-[#7b5a49]">
                  <div className="flex items-center justify-between">
                    <span>可重铸资产：</span>
                    <strong className="text-[#6f4430]">{items.length} 个</strong>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>当前已选：</span>
                    <strong className="text-[#6f4430]">{selectedCount} 个</strong>
                  </div>
                  <p className={`pt-1 text-[20px] font-semibold ${selectedCount === targetFusionCount ? 'text-[#b87150]' : 'text-[#cf6f63]'}`}>
                    {overviewMessage}
                  </p>
                </div>

                <div className="mt-6 rounded-[20px] border border-[#f0ddd0] bg-[#fffaf6] px-4 py-3 text-sm text-[#a27d68]">
                  仅可选择未使用、未过期且支持重铸的券或奖品
                </div>
              </div>

              <div className="relative overflow-hidden rounded-[28px] border border-[#f0ddd0] bg-[linear-gradient(180deg,_rgba(255,255,255,0.96),_rgba(255,249,245,0.96))] p-5 shadow-[0_18px_46px_rgba(238,221,206,0.44)] lg:rounded-[32px] lg:p-6">
                <h2
                  className="text-[28px] font-semibold text-[#74452f] lg:text-[36px]"
                  style={{ fontFamily: 'Noto Serif SC, Songti SC, serif' }}
                >
                  重铸说明
                </h2>

                <ul className="mt-5 space-y-4 pb-16 text-[14px] leading-7 text-[#9d7967] sm:pb-20 sm:text-[15px]">
                  <li>• 当前页面会展示可重铸的未使用券与奖品</li>
                  <li>• 3 个融合：结果只会出银色或金色，最高金色</li>
                  <li>• 4 个融合：结果只会出银色、金色或高级，最高高级</li>
                  <li>• 6 个融合：结果只会出金色、高级或特殊，不会出银色</li>
                  <li>• 重铸后原券/奖品会被消耗，不会返还，请谨慎选择</li>
                </ul>

                <img
                  src="/lottery-fusion/reference/fusion-rose-corner.png"
                  alt=""
                  aria-hidden="true"
                  className="pointer-events-none absolute bottom-0 right-0 w-[112px] sm:w-[168px]"
                />
              </div>
            </aside>
          </div>

          {notice ? (
            <div
              className={`mt-5 rounded-[20px] border px-5 py-4 text-sm ${
                notice.level === 'error'
                  ? 'border-[#f0c6c0] bg-[#fff4f2] text-[#b45f56]'
                  : 'border-[#e8d8ca] bg-[#fffaf5] text-[#a96e4d]'
              }`}
            >
              {notice.text}
            </div>
          ) : null}
        </main>
      </div>

      <div
        className="fixed inset-x-0 bottom-0 z-40 border-t border-[#efd7c5] bg-[linear-gradient(180deg,_rgba(255,251,248,0.96),_rgba(255,244,238,0.98))] px-4 py-3 shadow-[0_-14px_36px_rgba(165,117,96,0.14)] backdrop-blur lg:hidden"
        style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}
      >
        <div className="mx-auto flex max-w-[720px] items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] uppercase tracking-[0.18em] text-[#b09180]">
              {completedResult ? '重铸结果' : `已选 ${selectedCount}/${targetFusionCount}`}
            </p>
            <p className="mt-1 truncate text-sm font-medium text-[#7b5140]">
              {completedResult
                ? `恭喜🎉抽到了${completedResult.prizeName}`
                : canFuse
                  ? `已满足 ${targetFusionCount} 个融合条件`
                  : `还需选择 ${targetFusionCount - selectedCount} 个券或奖品`}
            </p>
          </div>

          <button
            type="button"
            onClick={
              completedResult
                ? resetPrepareCard
                : isAnimating
                  ? () => completeAnimation(animationState.payload)
                  : () => void handleFuse()
            }
            disabled={mobileActionDisabled}
            className={`${primaryActionButtonClassName} w-auto min-w-[152px] px-5 py-3 text-[17px] ${
              mobileActionDisabled ? 'cursor-not-allowed opacity-55' : ''
            }`}
          >
            {mobileActionButtonLabel}
          </button>
        </div>
      </div>

      {blockingDialog ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(71,36,28,0.34)] px-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="lottery-fusion-dialog-title"
            className="w-full max-w-[420px] rounded-[28px] border border-[#efd7c5] bg-[linear-gradient(180deg,_rgba(255,255,255,0.98),_rgba(255,246,240,0.98))] p-6 text-center shadow-[0_24px_60px_rgba(108,61,47,0.24)]"
          >
            <h2
              id="lottery-fusion-dialog-title"
              className="text-[28px] font-semibold text-[#74452f]"
              style={{ fontFamily: 'Noto Serif SC, Songti SC, serif' }}
            >
              {blockingDialog.title}
            </h2>
            <p className="mt-4 text-[15px] leading-7 text-[#8e6a58]">{blockingDialog.text}</p>
            <button
              type="button"
              onClick={() => setBlockingDialog(null)}
              className="mt-6 inline-flex min-w-[168px] items-center justify-center rounded-[999px] border border-[#f0d3b7] bg-[linear-gradient(180deg,_#fffdfb,_#fdf0e3)] px-6 py-3 text-[17px] font-semibold text-[#8c5140] shadow-[0_18px_30px_rgba(83,32,26,0.14)] transition hover:translate-y-[-1px]"
            >
              确认
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
