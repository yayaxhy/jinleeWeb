'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { MAX_PLOTS, getFarmSeedDurationLabel, type FarmSeedTypeValue } from '@/lib/farmConfig';
import { FARM_CROP_ASSETS, FARM_SCENE_ASSETS } from '@/lib/farmArt';
import type { FarmCompanionEntry, FarmCompanionLists, FarmDashboard } from '@/lib/farm';

const actionLabelMap: Record<string, string> = {
  BALANCE_TO_COINS: '余额兑换金币',
  POINTS_TO_COINS: '积分兑换金币',
  COINS_TO_POINTS: '金币兑换积分',
  PLANT: '种植',
  HARVEST: '收获',
  EXPAND: '扩地',
  STEAL: '偷菜',
};

const formatAmount = (value: string | number) =>
  new Intl.NumberFormat('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value));

const formatRemaining = (remainingSeconds: number) => {
  if (remainingSeconds <= 0) return '已成熟';
  const hours = Math.floor(remainingSeconds / 3600);
  const minutes = Math.floor((remainingSeconds % 3600) / 60);
  const seconds = remainingSeconds % 60;
  if (hours > 0) return `${hours}小时 ${minutes}分`;
  if (minutes > 0) return `${minutes}分 ${seconds}秒`;
  return `${seconds}秒`;
};

const formatVisitTime = (value: string) =>
  new Date(value).toLocaleString('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

const getCompanionStatusTone = (isOnline: boolean) =>
  isOnline
    ? 'border-emerald-200/70 bg-emerald-50/95 text-emerald-700'
    : 'border-slate-300/70 bg-slate-100/95 text-slate-600';

type Props = { initialDashboard: FarmDashboard };
type PlotStatus = 'LOCKED' | 'EMPTY' | 'GROWING' | 'READY';
type DrawerKey = 'none' | 'seeds' | 'exchange' | 'logs';
type CompanionTab = 'friends' | 'frequent' | 'search';
type FrequentVisitSort = 'count' | 'recent';
type FarmSearchResult = {
  id: number;
  peiwanId: number;
  discordUserId: string;
  serverDisplayName: string;
  mpUrl: string | null;
  isOnline: boolean;
  stealablePlots: number;
};
type FloatingReward = { id: number; text: string; variant: 'gold' | 'steal' | 'plant' };
type SceneBurst = { id: number; plotIndex: number; variant: 'harvest' | 'steal' | 'plant' };
type HarvestTransition = { id: number; plotIndex: number; previousAsset: string; previousClassName: string };
type PlantTransition = { id: number; plotIndex: number; asset: string };
type ActionResultModal = {
  title: string;
  description: string;
  accent: 'gold' | 'green' | 'orange';
  asset: string;
  detailLines: string[];
  badge: string;
};

type PlotCard = {
  plotIndex: number;
  unlocked: boolean;
  plot: FarmDashboard['plots'][number] | null;
  status: PlotStatus;
  seedMeta: FarmDashboard['seeds'][number] | null;
  title: string;
  subtitle: string;
  tooltipLines: string[];
  highlight: 'locked' | 'idle' | 'growing' | 'ready';
};

const plotScenePositions: Record<number, { left: string; top: string; depth: number }> = {
  1: { left: '18%', top: '18%', depth: 1 },
  2: { left: '37%', top: '14%', depth: 2 },
  3: { left: '56%', top: '18%', depth: 1 },
  4: { left: '75%', top: '14%', depth: 2 },
  5: { left: '27%', top: '40%', depth: 3 },
  6: { left: '46%', top: '36%', depth: 4 },
  7: { left: '65%', top: '40%', depth: 3 },
  8: { left: '84%', top: '36%', depth: 4 },
};

const drawerMeta: Record<Exclude<DrawerKey, 'none'>, { icon: string; label: string }> = {
  seeds: { icon: '🌱', label: '种子袋' },
  exchange: { icon: '💰', label: '兑换所' },
  logs: { icon: '📜', label: '庄园日志' },
};

const stageLabelMap = {
  SPROUT: '嫩芽阶段',
  YOUNG: '抽枝阶段',
  MATURE: '丰产前夕',
  READY: '成熟完成',
} as const;

const seedPageSize = 2;
const SCENE_BASE_WIDTH = 1536;
const SCENE_BASE_HEIGHT = 1024;

function getSeedRarity(seed: FarmDashboard['seeds'][number]) {
  switch (seed.code) {
    case 'MYSTERY_FRUIT':
      return {
        label: '史诗',
        border: 'border-[#d69c42]/60',
        glow: 'shadow-[0_18px_30px_rgba(151,72,22,0.22)]',
        badge: 'text-[#8f4a13] border-[#f0cd8a]/60 bg-[#fff0d0]',
      };
    case 'KOI_FLOWER':
      return {
        label: '稀有',
        border: 'border-[#f0b44d]/55',
        glow: 'shadow-[0_16px_28px_rgba(180,113,24,0.16)]',
        badge: 'text-[#9a6510] border-[#f2cf8f]/60 bg-[#fff3da]',
      };
    case 'ROSE':
      return {
        label: '进阶',
        border: 'border-[#7fc67d]/55',
        glow: 'shadow-[0_16px_28px_rgba(73,133,70,0.14)]',
        badge: 'text-[#4b7f2f] border-[#b8ddb2]/60 bg-[#eefae7]',
      };
    default:
      return {
        label: '基础',
        border: 'border-[#d2b57a]/50',
        glow: 'shadow-[0_16px_28px_rgba(112,84,34,0.12)]',
        badge: 'text-[#7b6131] border-[#ead7ad]/60 bg-[#fbf3dd]',
      };
  }
}

function getPlotAsset(entry: PlotCard) {
  if (!entry.unlocked) {
    return { asset: FARM_SCENE_ASSETS.plotLocked, className: 'scale-[0.98] opacity-85 drop-shadow-[0_18px_24px_rgba(0,0,0,0.18)]' };
  }
  if (!entry.plot || entry.status === 'EMPTY' || !entry.plot.seedType) {
    return { asset: FARM_SCENE_ASSETS.plotEmpty, className: 'scale-[0.84] opacity-90 drop-shadow-[0_12px_16px_rgba(0,0,0,0.12)]' };
  }
  const asset = FARM_CROP_ASSETS[entry.plot.seedType][entry.plot.growthStage];
  const className =
    entry.plot.growthStage === 'READY'
      ? 'scale-[1.02] animate-[farmGlow_2.2s_ease-in-out_infinite] drop-shadow-[0_16px_24px_rgba(0,0,0,0.18)]'
      : entry.plot.growthStage === 'MATURE'
        ? 'scale-[0.96] drop-shadow-[0_14px_20px_rgba(0,0,0,0.16)]'
        : entry.plot.growthStage === 'YOUNG'
          ? 'scale-[0.86] opacity-95'
          : 'scale-[0.72] opacity-90';
  return { asset, className };
}

function ToolButton({ icon, label, active, onClick, muted = false }: { icon: string; label: string; active: boolean; onClick: () => void; muted?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`group relative flex h-16 w-16 items-center justify-center rounded-[26px] border transition ${
        active
          ? 'border-[#f4d17a] bg-[linear-gradient(180deg,_#a66d28,_#6a3b12)] text-white shadow-[0_18px_28px_rgba(53,30,9,0.3)]'
          : muted
            ? 'border-[#f0d7a0]/18 bg-[linear-gradient(180deg,_rgba(113,69,30,0.58),_rgba(59,34,13,0.62))] text-[#efd7ad]/70 opacity-70'
            : 'border-[#f0d7a0]/35 bg-[linear-gradient(180deg,_rgba(176,117,51,0.92),_rgba(94,53,18,0.94))] text-[#fff1d0] hover:border-[#f0ca72]/7 hover:brightness-105'
      }`}
    >
      <span className="absolute inset-[5px] rounded-[20px] border border-[#f9e5b6]/25" />
      <span className="text-[28px] drop-shadow-[0_2px_4px_rgba(0,0,0,0.22)]">{icon}</span>
      <span className="pointer-events-none absolute right-[calc(100%+12px)] top-1/2 hidden -translate-y-1/2 whitespace-nowrap rounded-full border border-[#e5cb8d]/45 bg-[#2f1908]/92 px-3 py-1 text-xs tracking-[0.18em] text-[#ffe3a5] shadow-[0_10px_20px_rgba(19,10,2,0.25)] lg:group-hover:block">
        {label}
      </span>
    </button>
  );
}

function OverlayDrawer({ title, open, onClose, children }: { title: string; open: boolean; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className={`fixed inset-0 z-50 transition ${open ? 'pointer-events-auto' : 'pointer-events-none'}`}>
      <div className={`absolute inset-0 bg-[#1d0f03]/55 transition-opacity duration-300 ${open ? 'opacity-100' : 'opacity-0'}`} onClick={onClose} />
      <aside className={`absolute inset-y-0 right-0 flex w-full max-w-[460px] flex-col border-l border-[#d6bc84]/40 bg-[linear-gradient(180deg,_rgba(255,249,232,0.98),_rgba(246,228,186,0.98))] shadow-[0_24px_60px_rgba(32,18,6,0.26)] transition-transform duration-300 ${open ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="flex items-center justify-between border-b border-[#d6bc84]/35 px-5 py-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.32em] text-[#a17615]">Koi Manor</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-[0.05em] text-[#35210a]">{title}</h2>
          </div>
          <button type="button" onClick={onClose} className="flex h-11 w-11 items-center justify-center rounded-full border border-[#d8bc83]/45 bg-white/55 text-xl text-[#734d17] transition hover:bg-white/75">×</button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>
      </aside>
    </div>
  );
}

function MetricChip({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <div className="relative rounded-[22px] border border-[#f3d59b]/28 bg-[linear-gradient(180deg,_rgba(141,88,33,0.9),_rgba(78,44,15,0.9))] px-4 py-3 text-[#fff5dc] shadow-[0_12px_22px_rgba(0,0,0,0.16)] backdrop-blur-sm">
      <div className="pointer-events-none absolute inset-[3px] hidden rounded-[18px] border border-[#f8e7be]/12 lg:block" />
      <div className="relative flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.3em] text-[#f2d797]">{label}</p>
          <p className="mt-1 text-lg font-semibold tracking-[0.03em]">{value}</p>
        </div>
        <span className="flex h-10 w-10 items-center justify-center rounded-full border border-[#f7ddb0]/28 bg-[linear-gradient(180deg,_rgba(255,246,221,0.22),_rgba(255,214,120,0.12))] text-lg shadow-[inset_0_1px_0_rgba(255,255,255,0.16)]">
          {icon}
        </span>
      </div>
    </div>
  );
}

export function FarmClient({ initialDashboard }: Props) {
  const [homeDashboard, setHomeDashboard] = useState(initialDashboard);
  const [viewDashboard, setViewDashboard] = useState(initialDashboard);
  const [selectedSeed, setSelectedSeed] = useState<FarmSeedTypeValue | null>(initialDashboard.seeds.find((seed) => seed.unlocked)?.code ?? null);
  const [activeDrawer, setActiveDrawer] = useState<DrawerKey>('none');
  const [activePlotIndex, setActivePlotIndex] = useState<number | null>(null);
  const [hoveredPlotIndex, setHoveredPlotIndex] = useState<number | null>(null);
  const [balanceAmount, setBalanceAmount] = useState('1');
  const [pointAmount, setPointAmount] = useState('100');
  const [coinAmount, setCoinAmount] = useState('100');
  const [farmSearch, setFarmSearch] = useState('');
  const [searchResults, setSearchResults] = useState<FarmSearchResult[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [floatingRewards, setFloatingRewards] = useState<FloatingReward[]>([]);
  const [sceneBursts, setSceneBursts] = useState<SceneBurst[]>([]);
  const [harvestTransitions, setHarvestTransitions] = useState<HarvestTransition[]>([]);
  const [plantTransitions, setPlantTransitions] = useState<PlantTransition[]>([]);
  const [actionResult, setActionResult] = useState<ActionResultModal | null>(null);
  const [friendModalOpen, setFriendModalOpen] = useState(false);
  const [companionTab, setCompanionTab] = useState<CompanionTab>('friends');
  const [companions, setCompanions] = useState<FarmCompanionLists>({ friends: [], frequentVisits: [] });
  const [companionsLoading, setCompanionsLoading] = useState(false);
  const [frequentVisitSort, setFrequentVisitSort] = useState<FrequentVisitSort>('count');
  const [seedPage, setSeedPage] = useState(0);
  const [sceneScale, setSceneScale] = useState(1);

  const isVisiting = viewDashboard.owner.discordUserId !== homeDashboard.owner.discordUserId;
  const currentSeed = homeDashboard.seeds.find((seed) => seed.code === selectedSeed) ?? null;
  const totalSeedPages = Math.max(1, Math.ceil(homeDashboard.seeds.length / seedPageSize));
  const visibleSeedPage = Math.min(seedPage, totalSeedPages - 1);
  const pagedSeeds = homeDashboard.seeds.slice(visibleSeedPage * seedPageSize, (visibleSeedPage + 1) * seedPageSize);
  const sortedFrequentVisits = useMemo(() => {
    const items = [...companions.frequentVisits];
    items.sort((a, b) => {
      if (frequentVisitSort === 'recent') {
        return new Date(b.lastTouchedAt).getTime() - new Date(a.lastTouchedAt).getTime();
      }
      const countDiff = b.count - a.count;
      if (countDiff !== 0) return countDiff;
      return new Date(b.lastTouchedAt).getTime() - new Date(a.lastTouchedAt).getTime();
    });
    return items;
  }, [companions.frequentVisits, frequentVisitSort]);

  useEffect(() => {
    const syncSceneScale = () => {
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const scale = Math.min(viewportWidth / SCENE_BASE_WIDTH, viewportHeight / SCENE_BASE_HEIGHT);
      setSceneScale(scale);
    };

    syncSceneScale();
    window.addEventListener('resize', syncSceneScale);
    return () => window.removeEventListener('resize', syncSceneScale);
  }, []);

  useEffect(() => {
    if (selectedSeed && homeDashboard.seeds.some((seed) => seed.code === selectedSeed && seed.unlocked)) return;
    setSelectedSeed(homeDashboard.seeds.find((seed) => seed.unlocked)?.code ?? null);
  }, [homeDashboard.seeds, selectedSeed]);

  useEffect(() => {
    setSeedPage((current) => Math.min(current, Math.max(0, totalSeedPages - 1)));
  }, [totalSeedPages]);

  useEffect(() => {
    if (isVisiting && activeDrawer !== 'none') {
      setActiveDrawer('none');
    }
  }, [activeDrawer, isVisiting]);

  useEffect(() => {
    if (!friendModalOpen) return;
    let cancelled = false;
    const loadCompanions = async () => {
      setCompanionsLoading(true);
      try {
        const res = await fetch('/api/farm?companions=1');
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(typeof data?.error === 'string' ? data.error : '好友列表加载失败');
        if (!cancelled) {
          setCompanions(
            data?.data && typeof data.data === 'object'
              ? (data.data as FarmCompanionLists)
              : { friends: [], frequentVisits: [] },
          );
        }
      } catch {
        if (!cancelled) {
          setCompanions({ friends: [], frequentVisits: [] });
        }
      } finally {
        if (!cancelled) {
          setCompanionsLoading(false);
        }
      }
    };
    void loadCompanions();
    return () => {
      cancelled = true;
    };
  }, [friendModalOpen]);

  useEffect(() => {
    if (!friendModalOpen || companionTab !== 'search') {
      return;
    }
    const keyword = farmSearch.trim();
    if (!keyword) {
      setSearchResults([]);
      return;
    }
    const timer = window.setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/farm?search=${encodeURIComponent(keyword)}`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(typeof data?.error === 'string' ? data.error : '查询失败');
        setSearchResults(Array.isArray(data?.data) ? (data.data as FarmSearchResult[]) : []);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 260);
    return () => window.clearTimeout(timer);
  }, [farmSearch, friendModalOpen, companionTab]);

  const plotsByIndex = useMemo(() => {
    const map = new Map(viewDashboard.plots.map((plot) => [plot.plotIndex, plot]));
    return Array.from({ length: MAX_PLOTS }, (_, idx) => {
      const plotIndex = idx + 1;
      return { plotIndex, unlocked: plotIndex <= viewDashboard.summary.unlockedPlots, plot: map.get(plotIndex) ?? null };
    });
  }, [viewDashboard.plots, viewDashboard.summary.unlockedPlots]);

  const plotCards = useMemo<PlotCard[]>(() => {
    return plotsByIndex.map(({ plotIndex, unlocked, plot }) => {
      const status: PlotStatus = unlocked ? plot?.status ?? 'EMPTY' : 'LOCKED';
      const seedMeta = plot?.seedType ? viewDashboard.seeds.find((seed) => seed.code === plot.seedType) ?? null : null;
      const title = !unlocked ? '待解锁地块' : status === 'EMPTY' ? '空地' : seedMeta?.name ?? '作物';
      const subtitle = !unlocked
        ? '点击查看扩地'
        : status === 'EMPTY'
          ? viewDashboard.owner.isSelf
            ? currentSeed
              ? `准备播种 ${currentSeed.name}`
              : '先选一个种子'
            : '访客视角 · 这块地目前空着'
          : status === 'READY'
            ? viewDashboard.owner.isSelf
              ? '成熟完成，点击收获'
              : plot?.canSteal
                ? '访客视角 · 成熟完成，可偷菜'
                : '访客视角 · 本轮已被偷过'
            : viewDashboard.owner.isSelf
              ? `${stageLabelMap[plot?.growthStage ?? 'SPROUT']} · ${formatRemaining(plot?.remainingSeconds ?? 0)}`
              : `访客视角 · ${stageLabelMap[plot?.growthStage ?? 'SPROUT']} · ${formatRemaining(plot?.remainingSeconds ?? 0)}`;
      const tooltipLines = !unlocked
        ? ['庄园仍可继续扩地。', homeDashboard.summary.nextPlotCost ? `下一块地：${formatAmount(homeDashboard.summary.nextPlotCost)} 金币` : '已达到最大地块']
        : status === 'EMPTY'
          ? [viewDashboard.owner.isSelf ? `当前种子：${currentSeed?.name ?? '未选择'}` : '访客视角下，这块地目前没有作物。', viewDashboard.owner.isSelf ? '点击地块直接播种。' : '空地没有可以偷的东西。']
          : status === 'READY'
            ? [viewDashboard.owner.isSelf ? '作物已经成熟，点击收获。' : plot?.canSteal ? '访客视角：这一轮可以偷菜。' : '访客视角：这一轮已经被偷过。', seedMeta ? `预计产出：${formatAmount(seedMeta.minYieldCoins)} ~ ${formatAmount(seedMeta.maxYieldCoins)} 金币` : '等待结算产出。']
            : [viewDashboard.owner.isSelf ? `剩余时间：${formatRemaining(plot?.remainingSeconds ?? 0)}` : `访客观察：${formatRemaining(plot?.remainingSeconds ?? 0)} 后成熟`, `成长进度：${Math.round((plot?.progressRatio ?? 0) * 100)}%`];
      const highlight = !unlocked ? 'locked' : status === 'EMPTY' ? 'idle' : status === 'READY' ? 'ready' : 'growing';
      return { plotIndex, unlocked, plot, status, seedMeta, title, subtitle, tooltipLines, highlight };
    });
  }, [plotsByIndex, viewDashboard.seeds, viewDashboard.owner.isSelf, currentSeed, homeDashboard.summary.nextPlotCost]);

  const activePlot = plotCards.find((entry) => entry.plotIndex === activePlotIndex) ?? null;
  const nextLevelProgress = homeDashboard.summary.nextLevelExperience && homeDashboard.summary.nextLevelExperience > 0
    ? Math.min(100, (homeDashboard.summary.experience / homeDashboard.summary.nextLevelExperience) * 100)
    : 100;
  const pushFloatingReward = (text: string, variant: FloatingReward['variant']) => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setFloatingRewards((current) => [...current, { id, text, variant }]);
    window.setTimeout(() => {
      setFloatingRewards((current) => current.filter((item) => item.id !== id));
    }, 1600);
  };

  const pushSceneBurst = (plotIndex: number, variant: SceneBurst['variant']) => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setSceneBursts((current) => [...current, { id, plotIndex, variant }]);
    window.setTimeout(() => {
      setSceneBursts((current) => current.filter((item) => item.id !== id));
    }, 1200);
  };

  const pushHarvestTransition = (entry: PlotCard) => {
    const preview = getPlotAsset(entry);
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setHarvestTransitions((current) => [
      ...current.filter((item) => item.plotIndex !== entry.plotIndex),
      { id, plotIndex: entry.plotIndex, previousAsset: preview.asset, previousClassName: preview.className },
    ]);
    window.setTimeout(() => {
      setHarvestTransitions((current) => current.filter((item) => item.id !== id));
    }, 850);
  };

  const pushPlantTransition = (plotIndex: number, asset: string) => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setPlantTransitions((current) => [
      ...current.filter((item) => item.plotIndex !== plotIndex),
      { id, plotIndex, asset },
    ]);
    window.setTimeout(() => {
      setPlantTransitions((current) => current.filter((item) => item.id !== id));
    }, 900);
  };

  const loadTargetFarm = async (targetDiscordId?: string) => {
    setLoadingKey(targetDiscordId ? 'visit-farm' : 'visit-home');
    setError(null);
    setMessage(null);
    try {
      const url = targetDiscordId ? `/api/farm?targetDiscordId=${encodeURIComponent(targetDiscordId)}` : '/api/farm';
      const res = await fetch(url);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data?.error === 'string' ? data.error : '庄园加载失败');
      const dashboard = data.dashboard as FarmDashboard;
      setViewDashboard(dashboard);
      setActivePlotIndex(null);
      if (!targetDiscordId) setHomeDashboard(dashboard);
      setActiveDrawer('none');
      setFriendModalOpen(false);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoadingKey(null);
    }
  };

  const runAction = async (
    action: string,
    payload: Record<string, unknown>,
    key: string,
    options?: { entry?: PlotCard; seed?: FarmDashboard['seeds'][number] | null },
  ) => {
    setLoadingKey(key);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch('/api/farm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...payload }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data?.error === 'string' ? data.error : '操作失败');
      if (data?.viewerDashboard) setHomeDashboard(data.viewerDashboard as FarmDashboard);
      if (data?.dashboard) {
        const dashboard = data.dashboard as FarmDashboard;
        setViewDashboard(dashboard);
        if (dashboard.owner.discordUserId === homeDashboard.owner.discordUserId && !data?.viewerDashboard) {
          setHomeDashboard(dashboard);
        }
      }
      if (action === 'plant' && options?.seed && typeof payload.plotIndex === 'number') {
        pushFloatingReward(`已播种 ${options.seed.name}`, 'plant');
        pushSceneBurst(payload.plotIndex, 'plant');
        pushPlantTransition(payload.plotIndex, FARM_CROP_ASSETS[options.seed.code].SPROUT);
        setActionResult({
          title: '播种完成',
          description: `${options.seed.name} 已种进 ${payload.plotIndex} 号地块。`,
          accent: 'green',
          asset: FARM_CROP_ASSETS[options.seed.code].SPROUT,
          badge: '播种成功',
          detailLines: [
            `成熟时间：${getFarmSeedDurationLabel(options.seed.durationMinutes)}`,
            `预计收益：${formatAmount(options.seed.minYieldCoins)} ~ ${formatAmount(options.seed.maxYieldCoins)} 金币`,
            `成长奖励：+${options.seed.experience} EXP`,
          ],
        });
      }
      if (action === 'harvest' && data?.result?.harvestCoins) {
        pushFloatingReward(`+${formatAmount(data.result.harvestCoins)} 金币`, 'gold');
        if (options?.entry) pushHarvestTransition(options.entry);
        if (typeof payload.plotIndex === 'number') pushSceneBurst(payload.plotIndex, 'harvest');
        setActionResult({
          title: '收获完成',
          description: data.result.stolenCoins !== '0.00'
            ? `本轮净收 ${formatAmount(data.result.harvestCoins)} 金币，被偷走 ${formatAmount(data.result.stolenCoins)}。`
            : `本轮收获 ${formatAmount(data.result.harvestCoins)} 金币。`,
          accent: 'gold',
          asset: options?.entry?.seedMeta ? FARM_CROP_ASSETS[options.entry.seedMeta.code].READY : FARM_SCENE_ASSETS.plotHarvested,
          badge: '收获结算',
          detailLines: [
            `地块：${payload.plotIndex} 号`,
            data.result.stolenCoins !== '0.00' ? `被偷：${formatAmount(data.result.stolenCoins)} 金币` : '本轮未被偷菜',
            `当前金币：${formatAmount((data?.viewerDashboard ?? data?.dashboard)?.summary?.coins ?? homeDashboard.summary.coins)}`,
          ],
        });
      }
      if (action === 'steal' && data?.result?.stolenCoins) {
        pushFloatingReward(`偷到 +${formatAmount(data.result.stolenCoins)} 金币`, 'steal');
        if (typeof payload.plotIndex === 'number') pushSceneBurst(payload.plotIndex, 'steal');
        setActionResult({
          title: '偷菜成功',
          description: `你从 ${viewDashboard.owner.displayName} 的 ${payload.plotIndex} 号地块带走了 ${formatAmount(data.result.stolenCoins)} 金币。`,
          accent: 'orange',
          asset: options?.entry?.seedMeta ? FARM_CROP_ASSETS[options.entry.seedMeta.code].READY : FARM_SCENE_ASSETS.plotHarvested,
          badge: '拜访战利品',
          detailLines: [
            `目标地块：${payload.plotIndex} 号`,
            `到手金币：${formatAmount(data.result.stolenCoins)}`,
            `你的金币：${formatAmount(data?.viewerDashboard?.summary?.coins ?? homeDashboard.summary.coins)}`,
          ],
        });
      }
      setMessage(typeof data?.message === 'string' ? data.message : '操作成功');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoadingKey(null);
    }
  };

  const plotActionLabel = (entry: PlotCard) => {
    if (!entry.unlocked) return homeDashboard.summary.nextPlotCost ? `解锁下一块地 · ${formatAmount(homeDashboard.summary.nextPlotCost)} 金币` : '已达到地块上限';
    if (entry.status === 'EMPTY') return currentSeed?.name ? `播种 ${currentSeed.name}` : '请选择种子';
    if (entry.status === 'READY' && viewDashboard.owner.isSelf) return '立即收获';
    if (entry.status === 'READY' && !viewDashboard.owner.isSelf) return entry.plot?.canSteal ? '偷这一块地' : '这一轮已经被偷过';
    return entry.plot ? `等待成熟 · ${formatRemaining(entry.plot.remainingSeconds)}` : '当前不可操作';
  };

  const performPlotAction = (entry: PlotCard) => {
    if (!entry.unlocked) {
      if (viewDashboard.owner.isSelf && homeDashboard.summary.nextPlotCost) runAction('expand', {}, 'expand');
      return;
    }
    if (entry.status === 'EMPTY' && viewDashboard.owner.isSelf && currentSeed) {
      runAction('plant', { plotIndex: entry.plotIndex, seedType: currentSeed.code }, `plant:${entry.plotIndex}`, { entry, seed: currentSeed });
      return;
    }
    if (entry.status === 'READY' && viewDashboard.owner.isSelf) {
      runAction('harvest', { plotIndex: entry.plotIndex }, `harvest:${entry.plotIndex}`, { entry });
      return;
    }
    if (entry.status === 'READY' && !viewDashboard.owner.isSelf && entry.plot?.canSteal) {
      runAction('steal', { targetDiscordId: viewDashboard.owner.discordUserId, plotIndex: entry.plotIndex }, `steal:${entry.plotIndex}`, { entry });
    }
  };

  const renderCompanionCards = (items: FarmCompanionEntry[], emptyMessage: string) => {
    if (companionsLoading) {
      return <p className="rounded-2xl border border-dashed border-[#d7bc83]/40 bg-[#fff8e8] p-4 text-sm text-[#816032]">加载中…</p>;
    }
    if (items.length === 0) {
      return <p className="rounded-2xl border border-dashed border-[#d7bc83]/40 bg-[#fff8e8] p-4 text-sm text-[#816032]">{emptyMessage}</p>;
    }

    return (
      <div className="grid gap-3 sm:grid-cols-2">
        {items.map((item) => (
          <button
            key={item.discordUserId}
            type="button"
            disabled={loadingKey === 'visit-farm'}
            onClick={() => loadTargetFarm(item.discordUserId)}
            className="group overflow-hidden rounded-[26px] border border-[#d8bf87]/35 bg-[linear-gradient(180deg,_rgba(255,252,245,0.98),_rgba(249,239,214,0.98))] text-left transition hover:-translate-y-0.5 hover:border-[#d39a24]/50 hover:shadow-[0_18px_34px_rgba(101,66,20,0.14)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <div className="relative h-28 overflow-hidden border-b border-[#e7d4ab]/55 bg-[linear-gradient(180deg,_rgba(250,233,182,0.68),_rgba(214,183,109,0.18))]">
              {item.mpUrl ? (
                <Image src={item.mpUrl} alt={item.displayName} fill className="object-cover transition duration-300 group-hover:scale-[1.04]" />
              ) : (
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_#fff3c7,_#dfbf78_58%,_#a67a2f_100%)]" />
              )}
              <div className="absolute inset-0 bg-[linear-gradient(180deg,_rgba(131,33,22,0.02),_rgba(59,20,13,0.66))]" />
              <div className="absolute inset-x-0 top-0 h-10 bg-[linear-gradient(180deg,_rgba(255,243,202,0.55),_transparent)]" />
              <div className="absolute left-4 top-4 flex h-12 w-12 items-center justify-center rounded-full border border-white/40 bg-[linear-gradient(180deg,_rgba(255,248,228,0.92),_rgba(248,224,161,0.9))] text-lg font-semibold text-[#7d5716] shadow-[0_10px_18px_rgba(31,17,5,0.16)]">
                {item.displayName.trim().charAt(0) || '庄'}
              </div>
              <span className="absolute right-4 top-4 rounded-full border border-white/36 bg-[rgba(86,21,13,0.62)] px-3 py-1 text-[10px] uppercase tracking-[0.22em] text-[#ffe3a6]">
                {item.peiwanId ? `#${item.peiwanId}` : '庄园'}
              </span>
              <div className="absolute bottom-3 left-4 flex flex-wrap gap-2">
                <span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${getCompanionStatusTone(item.isOnline)}`}>
                  {item.isOnline ? '在线' : '离线'}
                </span>
                <span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${
                  item.stealablePlots > 0
                    ? 'border-amber-200/70 bg-amber-50/95 text-amber-700'
                    : 'border-stone-300/70 bg-stone-100/95 text-stone-500'
                }`}>
                  {item.stealablePlots > 0 ? `可偷 ${item.stealablePlots}` : '不可偷'}
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between gap-3 px-4 py-4">
              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-semibold tracking-[0.04em] text-[#35210a]">{item.displayName}</p>
                <p className="mt-1 truncate text-xs text-[#8b6a2c]">{item.discordUserId}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-[#7e6134]">
                  <span className="rounded-full border border-[#dfc48b]/45 bg-[#fff6e2] px-2 py-1 tracking-[0.14em]">{item.label}</span>
                  <span>最近：{formatVisitTime(item.lastTouchedAt)}</span>
                </div>
              </div>
              <span className="rounded-full border border-[#d2ad54]/40 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-[#8f6806]">拜访</span>
            </div>
          </button>
        ))}
      </div>
    );
  };

  const drawerTitle = activeDrawer === 'none' ? '' : drawerMeta[activeDrawer].label;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#fff9e4,_#f4e6bf_28%,_#a9bf7f_74%,_#7f8d52_100%)] text-[#2f1d09]">
      <style jsx global>{`
        @keyframes farmFloatUp {
          0% { opacity: 0; transform: translate3d(-50%, 8px, 0) scale(0.92); }
          15% { opacity: 1; }
          100% { opacity: 0; transform: translate3d(-50%, -56px, 0) scale(1.05); }
        }
        @keyframes farmGlow {
          0%, 100% { filter: drop-shadow(0 0 0 rgba(255, 222, 109, 0.1)); }
          50% { filter: drop-shadow(0 0 16px rgba(255, 222, 109, 0.72)); }
        }
        @keyframes farmBurstRing {
          0% { opacity: 0.95; transform: scale(0.45); }
          100% { opacity: 0; transform: scale(1.5); }
        }
        @keyframes farmSpark {
          0% { opacity: 0; transform: translateY(0) scale(0.8); }
          15% { opacity: 1; }
          100% { opacity: 0; transform: translateY(-22px) scale(1.18); }
        }
        @keyframes farmStealBurst {
          0% { opacity: 0.95; transform: translate(-50%, -50%) scale(0.7) rotate(-18deg); }
          100% { opacity: 0; transform: translate(-50%, -50%) scale(1.3) rotate(18deg); }
        }
        @keyframes farmHarvestCropOut {
          0% { opacity: 1; transform: translateY(0) scale(1); }
          100% { opacity: 0; transform: translateY(-20px) scale(1.08); }
        }
        @keyframes farmHarvestFieldReset {
          0% { opacity: 0; transform: scale(0.82); }
          35% { opacity: 1; transform: scale(1); }
          100% { opacity: 0; transform: scale(1.06); }
        }
        @keyframes farmPlotBob {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-2px); }
        }
        @keyframes farmCloudDrift {
          0%, 100% { transform: translateX(0); }
          50% { transform: translateX(16px); }
        }
        @keyframes farmWindmillSpin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes farmButterflyFloat {
          0%, 100% { transform: translate3d(0, 0, 0) rotate(-4deg); }
          25% { transform: translate3d(12px, -10px, 0) rotate(6deg); }
          50% { transform: translate3d(22px, 2px, 0) rotate(-2deg); }
          75% { transform: translate3d(8px, 10px, 0) rotate(4deg); }
        }
        @keyframes farmPlantBurst {
          0% { opacity: 0.95; transform: translate(-50%, -50%) scale(0.55); }
          100% { opacity: 0; transform: translate(-50%, -50%) scale(1.38); }
        }
        @keyframes farmResultCardIn {
          0% { opacity: 0; transform: translateY(18px) scale(0.94); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes farmRippleFloat {
          0% { opacity: 0.34; transform: scale(0.86); }
          50% { opacity: 0.18; transform: scale(1); }
          100% { opacity: 0.04; transform: scale(1.12); }
        }
        @keyframes farmLightPulse {
          0%, 100% { opacity: 0.18; transform: scale(0.94); }
          50% { opacity: 0.36; transform: scale(1.08); }
        }
        @keyframes farmLeafDrift {
          0% { opacity: 0; transform: translate3d(0, -8px, 0) rotate(0deg); }
          15% { opacity: 0.7; }
          100% { opacity: 0; transform: translate3d(42px, 68px, 0) rotate(115deg); }
        }
      `}</style>

      <div className="relative h-dvh w-screen overflow-hidden bg-[linear-gradient(180deg,_#f3dec2_0%,_#e6cda4_18%,_#97b18a_52%,_#5f7045_100%)]">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-x-0 top-0 h-[34%] bg-[radial-gradient(circle_at_50%_12%,_rgba(255,248,228,0.96),_rgba(255,248,228,0.16)_48%,_transparent_70%)]" />
          <div className="absolute left-[-8%] top-[10%] h-[46%] w-[28%] rounded-[50%] bg-[radial-gradient(circle,_rgba(143,52,34,0.2),_rgba(143,52,34,0.02)_68%,_transparent_74%)] blur-3xl" />
          <div className="absolute right-[-10%] top-[8%] h-[44%] w-[30%] rounded-[50%] bg-[radial-gradient(circle,_rgba(214,169,86,0.22),_rgba(214,169,86,0.03)_68%,_transparent_74%)] blur-3xl" />
          <div className="absolute inset-x-[6%] bottom-[-8%] h-[34%] rounded-[50%] bg-[radial-gradient(circle,_rgba(94,121,84,0.46),_rgba(94,121,84,0.08)_62%,_transparent_76%)] blur-2xl" />
          <div className="absolute inset-x-[10%] bottom-[4%] h-[8px] rounded-full bg-[linear-gradient(90deg,_transparent,_rgba(255,239,194,0.55),_transparent)] blur-md" />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,_rgba(61,27,12,0.06),_transparent_22%,_transparent_78%,_rgba(37,19,8,0.18))]" />
        </div>
        <section
          className="absolute left-1/2 top-1/2 overflow-hidden rounded-[44px] border border-[#f2d492]/70 bg-[linear-gradient(180deg,_#f4dfd1_0%,_#eed0b6_20%,_#8aa15d_48%,_#66773d_100%)] shadow-[0_30px_80px_rgba(55,23,11,0.28)]"
          style={{
            width: `${SCENE_BASE_WIDTH}px`,
            height: `${SCENE_BASE_HEIGHT}px`,
            transform: `translate(-50%, -50%) scale(${sceneScale})`,
            transformOrigin: 'center center',
          }}
        >
          <div className="pointer-events-none absolute inset-[-18px] rounded-[56px] border border-[#fff0c7]/26" />
          <div className="pointer-events-none absolute inset-[10px] rounded-[34px] border border-[#fff1c5]/22" />
          <div className="pointer-events-none absolute -left-[8%] top-[16%] h-[62%] w-[16%] rounded-[50%] bg-[radial-gradient(circle,_rgba(130,41,28,0.18),_rgba(130,41,28,0.02)_68%,_transparent_74%)] blur-2xl" />
          <div className="pointer-events-none absolute -right-[8%] top-[18%] h-[60%] w-[16%] rounded-[50%] bg-[radial-gradient(circle,_rgba(220,181,92,0.2),_rgba(220,181,92,0.02)_68%,_transparent_74%)] blur-2xl" />
          <Image src={FARM_SCENE_ASSETS.manorBase} alt="庄园底图" fill priority className="pointer-events-none absolute inset-0 h-full w-full object-cover" />
          <div className="pointer-events-none absolute inset-x-0 top-0 h-36 bg-[linear-gradient(180deg,_rgba(127,20,17,0.38),_rgba(127,20,17,0.06),_transparent)]" />
          <div className="pointer-events-none absolute inset-x-0 top-0 h-[44%] bg-[radial-gradient(circle_at_50%_8%,_rgba(255,248,224,0.88),_rgba(255,248,224,0.12)_46%,_transparent_62%)]" />
          <div className="pointer-events-none absolute inset-x-[12%] bottom-[5%] h-[26%] rounded-[50%] bg-[radial-gradient(circle,_rgba(245,223,159,0.14),_rgba(245,223,159,0.01)_72%,_transparent_76%)]" />
          <Image src={FARM_SCENE_ASSETS.cloud} alt="" width={250} height={120} className="pointer-events-none absolute left-[8%] top-[5%] w-[250px] opacity-95 [animation:farmCloudDrift_18s_ease-in-out_infinite]" />
          <Image src={FARM_SCENE_ASSETS.cloud} alt="" width={210} height={110} className="pointer-events-none absolute right-[14%] top-[9%] w-[210px] opacity-90 [animation:farmCloudDrift_21s_ease-in-out_infinite_reverse]" />
          <Image src={FARM_SCENE_ASSETS.cloud} alt="" width={180} height={100} className="pointer-events-none absolute left-[26%] top-[14%] w-[180px] opacity-80 [animation:farmCloudDrift_24s_ease-in-out_infinite]" />
          <Image src={FARM_SCENE_ASSETS.butterfly} alt="" width={58} height={58} className="pointer-events-none absolute left-[34%] top-[26%] w-[58px] opacity-90 [animation:farmButterflyFloat_7s_ease-in-out_infinite]" />
          <Image src={FARM_SCENE_ASSETS.butterfly} alt="" width={52} height={52} className="pointer-events-none absolute left-[62%] top-[34%] w-[52px] opacity-85 [animation:farmButterflyFloat_8.5s_ease-in-out_infinite_reverse]" />
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute left-[17%] top-[31%] h-16 w-24 rounded-full border border-[#d8f8ff]/45 [animation:farmRippleFloat_6.5s_ease-in-out_infinite]" />
            <div className="absolute left-[21%] top-[33%] h-12 w-20 rounded-full border border-[#e7fbff]/42 [animation:farmRippleFloat_7.2s_ease-in-out_infinite_reverse]" />
            <div className="absolute left-[48%] top-[22%] h-14 w-14 rounded-full bg-[radial-gradient(circle,_rgba(255,243,192,0.24),_rgba(255,243,192,0.02)_68%)] [animation:farmLightPulse_5.8s_ease-in-out_infinite]" />
            <div className="absolute left-[64%] top-[28%] h-12 w-12 rounded-full bg-[radial-gradient(circle,_rgba(255,244,204,0.18),_rgba(255,244,204,0.02)_68%)] [animation:farmLightPulse_6.6s_ease-in-out_infinite_reverse]" />
            <div className="absolute left-[39%] top-[19%] h-4 w-3 rounded-[80%_20%_75%_25%] bg-[linear-gradient(180deg,_rgba(180,91,55,0.86),_rgba(120,51,26,0.86))] [animation:farmLeafDrift_8.5s_linear_infinite]" />
            <div className="absolute left-[58%] top-[17%] h-4 w-3 rounded-[30%_80%_25%_75%] bg-[linear-gradient(180deg,_rgba(214,141,71,0.82),_rgba(141,84,28,0.82))] [animation:farmLeafDrift_10s_linear_infinite_reverse]" />
            <div className="absolute left-[74%] top-[24%] h-3.5 w-3 rounded-[70%_30%_70%_30%] bg-[linear-gradient(180deg,_rgba(168,89,42,0.8),_rgba(110,56,20,0.8))] [animation:farmLeafDrift_9.2s_linear_infinite]" />
          </div>
          <div className="pointer-events-none absolute inset-x-[14%] bottom-[4.5%] h-[2px] bg-[linear-gradient(90deg,_transparent,_rgba(255,235,183,0.45),_transparent)]" />

          <div className="relative z-10 flex h-full min-h-full flex-col p-4 sm:p-5 lg:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="max-w-xl rounded-[32px] border border-[#f4d18b]/42 bg-[linear-gradient(180deg,_rgba(126,24,20,0.95),_rgba(79,18,15,0.93))] px-5 py-4 text-[#fff6df] shadow-[0_20px_42px_rgba(69,18,15,0.24)] backdrop-blur-sm">
                <div className="rounded-[24px] border border-[#ffd9a7]/18 px-4 py-3">
                  <p className="text-[11px] uppercase tracking-[0.44em] text-[#f7d58c]">Jinli Manor</p>
                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    <h1 className="text-3xl font-semibold tracking-[0.1em] sm:text-4xl">锦鲤庄园</h1>
                    <span className="rounded-full border border-[#f7e3b2]/30 bg-[rgba(255,243,216,0.12)] px-3 py-1 text-xs tracking-[0.22em] text-[#ffe6af]">{isVisiting ? `拜访 ${viewDashboard.owner.displayName}` : '我的庄园'}</span>
                  </div>
                  <p className="mt-3 text-sm leading-7 text-[#fff0cb]/90">整体改成更偏锦鲤红、鎏金边和水庭院的配色，弱化普通后台面板感，保持庄园主场景为主。</p>
                  <div className="mt-4 flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.26em] text-[#ffe4a8]">
                    <span className="rounded-full border border-[#f7e3b2]/28 bg-[rgba(255,243,216,0.12)] px-3 py-2">1 余额 = 100 金币</span>
                    <span className="rounded-full border border-[#f7e3b2]/28 bg-[rgba(255,243,216,0.12)] px-3 py-2">1 积分 = 10 金币</span>
                    <span className="rounded-full border border-[#f7e3b2]/28 bg-[rgba(255,243,216,0.12)] px-3 py-2">100 金币 = 1 积分</span>
                  </div>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                <MetricChip label="等级" value={`Lv.${homeDashboard.summary.level}`} icon="⭐" />
                <MetricChip label="金币" value={formatAmount(homeDashboard.summary.coins)} icon="🪙" />
                <MetricChip label="积分" value={formatAmount(homeDashboard.summary.loyaltyPoints)} icon="🎟️" />
                <MetricChip label="余额" value={`¥ ${formatAmount(homeDashboard.summary.totalBalance)}`} icon="💰" />
                <MetricChip label="地块" value={`${viewDashboard.summary.unlockedPlots}/${MAX_PLOTS}`} icon="🌾" />
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <div className="relative flex-1 overflow-hidden rounded-[22px] border border-[#f5d9a3]/25 bg-[linear-gradient(180deg,_rgba(122,25,18,0.84),_rgba(81,21,15,0.82))] px-4 py-3 text-[#fff4d4] backdrop-blur-sm">
                <div className="pointer-events-none absolute inset-[4px] rounded-[18px] border border-[#f8e6bb]/12" />
                <div className="flex items-center justify-between gap-3 text-xs uppercase tracking-[0.24em] text-[#f5d388]">
                  <span>升级进度</span>
                  <span>{homeDashboard.summary.nextLevelExperience ? `${homeDashboard.summary.experience}/${homeDashboard.summary.nextLevelExperience}` : 'MAX'}</span>
                </div>
                <div className="mt-2 h-4 overflow-hidden rounded-full bg-black/18 p-[2px]">
                  <div className="h-full rounded-full bg-[linear-gradient(90deg,_#b67510,_#eabf4d,_#ffe8b6)] transition-all duration-500" style={{ width: `${nextLevelProgress}%` }} />
                </div>
              </div>
              <div className="flex items-center gap-2">
                {isVisiting ? (
                  <button type="button" disabled={loadingKey === 'visit-home'} onClick={() => loadTargetFarm()} className="rounded-full border border-[#e5cb8d]/38 bg-[linear-gradient(180deg,_rgba(58,31,9,0.92),_rgba(40,21,7,0.92))] px-4 py-3 text-sm font-semibold tracking-[0.12em] text-[#ffe3a4] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60">{loadingKey === 'visit-home' ? '返回中…' : '回到我的庄园'}</button>
                ) : null}
                <Link href="/profile" className="rounded-full border border-[#e5cb8d]/38 bg-[linear-gradient(180deg,_rgba(58,31,9,0.92),_rgba(40,21,7,0.92))] px-4 py-3 text-sm font-semibold tracking-[0.12em] text-[#ffe3a4] transition hover:brightness-105">返回个人主页</Link>
              </div>
            </div>

            {(message || error) && (
              <div className={`mt-4 rounded-[22px] border px-4 py-3 text-sm shadow-[0_12px_24px_rgba(0,0,0,0.12)] ${error ? 'border-rose-200/80 bg-rose-50/92 text-rose-700' : 'border-emerald-200/80 bg-emerald-50/92 text-emerald-700'}`}>{error ?? message}</div>
            )}

            <div className="relative mt-4 flex-1 overflow-hidden rounded-[38px] border border-[#f5dcaa]/35 bg-[linear-gradient(180deg,_rgba(210,231,255,0.18),_rgba(65,90,28,0.08))] shadow-[inset_0_1px_0_rgba(255,255,255,0.22)]">
              <div className="absolute left-4 top-4 z-20 rounded-[22px] border border-[#f6ddb0]/28 bg-[linear-gradient(180deg,_rgba(87,20,14,0.82),_rgba(54,17,12,0.72))] px-4 py-3 text-xs tracking-[0.18em] text-[#fbe5b0] backdrop-blur-sm">
                {isVisiting ? '访客视角 · 主庄园工具已收起' : currentSeed ? `已选种子 · ${currentSeed.name}` : '点击下方图标先选种子'}
              </div>
              {isVisiting ? (
                <div className="absolute left-1/2 top-4 z-20 -translate-x-1/2 rounded-[24px] border border-[#f6ddb0]/38 bg-[linear-gradient(180deg,_rgba(125,24,18,0.92),_rgba(86,18,14,0.88))] px-5 py-3 text-center text-[#fff4d3] shadow-[0_18px_34px_rgba(69,18,15,0.22)] backdrop-blur-sm">
                  <p className="text-[10px] uppercase tracking-[0.32em] text-[#f7d58c]">Visitor Mode</p>
                  <p className="mt-1 text-sm font-semibold tracking-[0.12em]">正在拜访 {viewDashboard.owner.displayName}</p>
                  <p className="mt-1 text-xs text-[#ffe7b3]/80">当前只能偷成熟地块，所有操作不会改动你的庄园布局。</p>
                </div>
              ) : null}
              <div className="absolute right-4 top-4 z-20 flex flex-col gap-2 lg:hidden">
                <ToolButton icon="🧭" label="好友庄园" active={friendModalOpen} onClick={() => setFriendModalOpen(true)} muted={isVisiting} />
                {!isVisiting ? (
                  (Object.keys(drawerMeta) as Array<Exclude<DrawerKey, 'none'>>).map((key) => <ToolButton key={key} icon={drawerMeta[key].icon} label={drawerMeta[key].label} active={activeDrawer === key} onClick={() => setActiveDrawer((current) => (current === key ? 'none' : key))} />)
                ) : (
                  <div className="rounded-[20px] border border-[#efd7a4]/18 bg-[linear-gradient(180deg,_rgba(67,35,14,0.62),_rgba(40,21,7,0.72))] px-3 py-3 text-center text-[10px] uppercase tracking-[0.24em] text-[#ffe5b5]/70">
                    种子袋 / 兑换所 / 日志
                    <div className="mt-1 text-[9px] tracking-[0.16em] text-[#f4ddb3]/55">访客模式已弱化显示</div>
                  </div>
                )}
              </div>
              <div className="absolute right-5 top-5 z-20 hidden flex-col gap-3 lg:flex">
                <ToolButton icon="🧭" label="好友庄园" active={friendModalOpen} onClick={() => setFriendModalOpen(true)} muted={isVisiting} />
                {!isVisiting ? (
                  (Object.keys(drawerMeta) as Array<Exclude<DrawerKey, 'none'>>).map((key) => <ToolButton key={key} icon={drawerMeta[key].icon} label={drawerMeta[key].label} active={activeDrawer === key} onClick={() => setActiveDrawer((current) => (current === key ? 'none' : key))} />)
                ) : (
                  <div className="w-28 rounded-[22px] border border-[#efd7a4]/18 bg-[linear-gradient(180deg,_rgba(67,35,14,0.62),_rgba(40,21,7,0.72))] px-3 py-3 text-center text-[10px] uppercase tracking-[0.24em] text-[#ffe5b5]/70">
                    主庄园工具
                    <div className="mt-1 text-[9px] tracking-[0.16em] text-[#f4ddb3]/55">访客模式收起</div>
                  </div>
                )}
              </div>

              <div className="absolute inset-x-0 top-[12%] bottom-[16%]">
                {plotCards.map((entry) => {
                  const scene = plotScenePositions[entry.plotIndex];
                  const preview = getPlotAsset(entry);
                  const harvestTransition = harvestTransitions.find((item) => item.plotIndex === entry.plotIndex) ?? null;
                  const plantTransition = plantTransitions.find((item) => item.plotIndex === entry.plotIndex) ?? null;
                  const actionKey = entry.status === 'EMPTY' ? `plant:${entry.plotIndex}` : entry.status === 'READY' && viewDashboard.owner.isSelf ? `harvest:${entry.plotIndex}` : `steal:${entry.plotIndex}`;
                  const loading = loadingKey === actionKey || (!entry.unlocked && loadingKey === 'expand');
                  const tooltipVisible = hoveredPlotIndex === entry.plotIndex;
                  return (
                    <div key={entry.plotIndex} className="absolute" style={{ left: scene.left, top: scene.top, zIndex: scene.depth * 10, transform: 'translate(-50%, -50%)' }}>
                      <div className="group relative">
                        <button
                          type="button"
                          onMouseEnter={() => setHoveredPlotIndex(entry.plotIndex)}
                          onMouseLeave={() => setHoveredPlotIndex((current) => (current === entry.plotIndex ? null : current))}
                          onFocus={() => setHoveredPlotIndex(entry.plotIndex)}
                          onBlur={() => setHoveredPlotIndex((current) => (current === entry.plotIndex ? null : current))}
                          onClick={() => setActivePlotIndex(entry.plotIndex)}
                          className={`relative flex h-[132px] w-[150px] items-end justify-center rounded-[34px] px-3 pb-3 transition duration-200 hover:-translate-y-1 hover:scale-[1.02] sm:h-[146px] sm:w-[168px] ${entry.highlight === 'ready' ? 'animate-[farmPlotBob_2.2s_ease-in-out_infinite] hover:brightness-105' : 'hover:brightness-105'} ${entry.highlight === 'locked' ? 'opacity-90' : ''}`}
                        >
                          <div className={`pointer-events-none absolute inset-0 rounded-[34px] ${entry.highlight === 'ready' ? 'bg-[radial-gradient(circle_at_50%_42%,_rgba(255,224,138,0.24),_rgba(255,224,138,0.02)_70%,_transparent_78%)]' : entry.highlight === 'growing' ? 'bg-[radial-gradient(circle_at_50%_42%,_rgba(245,215,140,0.18),_rgba(245,215,140,0.01)_72%,_transparent_78%)]' : 'bg-transparent'}`} />
                          <div className="pointer-events-none absolute inset-x-2 bottom-3 h-7 rounded-[50%] bg-[radial-gradient(circle,_rgba(73,48,16,0.55),_rgba(73,48,16,0.04)_72%)] blur-sm" />
                          <div className="pointer-events-none absolute inset-x-[6%] top-[16%] flex justify-center">
                            <div className="relative h-14 w-14 sm:h-16 sm:w-16">
                              <Image src={FARM_SCENE_ASSETS.woodSign} alt="" fill className="object-contain drop-shadow-[0_6px_8px_rgba(0,0,0,0.18)]" />
                              <span className="absolute inset-x-0 top-[28%] text-center text-[12px] font-black tracking-[0.18em] text-[#583514] sm:text-[13px]">{String(entry.plotIndex).padStart(2, '0')}</span>
                            </div>
                          </div>
                          <div className={`pointer-events-none absolute inset-[4%] rounded-[32px] border ${entry.highlight === 'ready' ? 'border-[#f6d07f]/55' : entry.highlight === 'growing' ? 'border-[#ebca85]/42' : entry.highlight === 'idle' ? 'border-[#e0bf82]/26' : 'border-[#d5c5a3]/20'}`} />
                          {entry.status === 'READY' ? <span className="absolute right-3 top-3 rounded-full border border-[#ffe8b6]/45 bg-[linear-gradient(180deg,_rgba(255,227,153,0.96),_rgba(243,186,62,0.96))] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#684108]">READY</span> : null}
                          {entry.status === 'READY' && !viewDashboard.owner.isSelf && !entry.plot?.canSteal ? <span className="absolute left-1/2 top-3 -translate-x-1/2 rounded-full border border-[#ffd9b3]/35 bg-[linear-gradient(180deg,_rgba(131,63,23,0.95),_rgba(89,38,12,0.95))] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#ffe6c9]">已偷</span> : null}
                          <div className="pointer-events-none absolute inset-0">
                            <Image src={FARM_SCENE_ASSETS.plotFrame} alt="" fill className={`object-contain drop-shadow-[0_22px_28px_rgba(0,0,0,0.24)] ${entry.highlight === 'ready' ? 'brightness-[1.06]' : entry.highlight === 'growing' ? 'brightness-[1.02]' : ''}`} />
                          </div>
                          <div className="relative flex h-[96px] w-[96px] items-end justify-center sm:h-[108px] sm:w-[108px]">
                            {entry.status === 'READY' ? <div className={`absolute inset-1 rounded-full ${viewDashboard.owner.isSelf ? 'bg-[radial-gradient(circle,_rgba(255,224,138,0.56),_rgba(255,224,138,0.06)_70%)]' : 'bg-[radial-gradient(circle,_rgba(255,174,120,0.42),_rgba(255,174,120,0.05)_70%)]'} animate-pulse`} /> : null}
                            {harvestTransition ? (
                              <>
                                <div className="absolute inset-0">
                                  <Image src={FARM_SCENE_ASSETS.plotHarvested} alt="" fill className="object-contain opacity-0" style={{ animation: 'farmHarvestFieldReset 0.8s ease-out forwards' }} />
                                </div>
                                <div className="absolute inset-0">
                                  <Image
                                    src={harvestTransition.previousAsset}
                                    alt={entry.title}
                                    fill
                                    className={`object-contain ${harvestTransition.previousClassName}`}
                                    style={{ animation: 'farmHarvestCropOut 0.78s ease-out forwards' }}
                                  />
                                </div>
                              </>
                            ) : null}
                            {plantTransition ? (
                              <>
                                <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle,_rgba(188,255,165,0.38),_rgba(188,255,165,0.02)_72%)] opacity-0" style={{ animation: 'farmPlantBurst 0.9s ease-out forwards' }} />
                                <div className="absolute inset-0">
                                  <Image src={plantTransition.asset} alt="" fill className="object-contain opacity-0 scale-[0.45]" style={{ animation: 'farmHarvestFieldReset 0.75s ease-out forwards' }} />
                                </div>
                              </>
                            ) : null}
                            <Image src={preview.asset} alt={entry.title} fill className={`object-contain ${preview.className}`} />
                          </div>
                        </button>
                        <div className={`pointer-events-none absolute bottom-[calc(100%+14px)] left-1/2 w-52 -translate-x-1/2 rounded-[20px] border border-[#e4ca8f]/40 bg-[linear-gradient(180deg,_rgba(52,29,9,0.94),_rgba(31,16,6,0.94))] px-4 py-3 text-left text-[#fff3d1] shadow-[0_18px_36px_rgba(17,9,3,0.28)] transition ${tooltipVisible ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'}`}>
                          <p className="text-xs uppercase tracking-[0.28em] text-[#f0ce84]">地块 {entry.plotIndex}</p>
                          <p className="mt-2 text-base font-semibold tracking-[0.04em]">{entry.title}</p>
                          <p className="mt-1 text-sm text-[#ffe6b0]">{entry.subtitle}</p>
                          <div className="mt-3 space-y-1 text-xs leading-5 text-[#edd8aa]">{entry.tooltipLines.map((line) => <p key={line}>{line}</p>)}</div>
                          <div className="mt-3 rounded-full border border-white/12 bg-white/6 px-3 py-2 text-[11px] uppercase tracking-[0.22em] text-[#f4d17b]">{loading ? '处理中…' : plotActionLabel(entry)}</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {sceneBursts.map((burst) => {
                  const scene = plotScenePositions[burst.plotIndex];
                  return (
                    <div key={burst.id} className="pointer-events-none absolute" style={{ left: scene.left, top: scene.top, zIndex: scene.depth * 10 + 5, transform: 'translate(-50%, -50%)' }}>
                      {burst.variant === 'harvest' ? (
                        <div className="relative h-36 w-36">
                          <div className="absolute inset-0 rounded-full border-2 border-[#ffe097] opacity-0" style={{ animation: 'farmBurstRing 1s ease-out forwards' }} />
                          <div className="absolute inset-3 rounded-full border border-[#ffd264] opacity-0" style={{ animation: 'farmBurstRing 1s ease-out 0.08s forwards' }} />
                          <span className="absolute left-1/2 top-[18%] -translate-x-1/2 text-3xl text-[#fff1a9]" style={{ animation: 'farmSpark 1s ease-out forwards' }}>✦</span>
                          <span className="absolute left-[26%] top-[36%] text-xl text-[#ffe08b]" style={{ animation: 'farmSpark 0.95s ease-out 0.08s forwards' }}>✦</span>
                          <span className="absolute right-[22%] top-[38%] text-2xl text-[#ffe08b]" style={{ animation: 'farmSpark 1s ease-out 0.12s forwards' }}>✦</span>
                        </div>
                      ) : burst.variant === 'steal' ? (
                        <div className="relative h-32 w-32">
                          <div className="absolute left-1/2 top-1/2 h-2 w-20 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[linear-gradient(90deg,_rgba(255,220,180,0.1),_rgba(255,220,180,0.95),_rgba(255,220,180,0.1))]" style={{ animation: 'farmStealBurst 0.9s ease-out forwards' }} />
                          <div className="absolute left-1/2 top-1/2 h-2 w-20 rounded-full bg-[linear-gradient(90deg,_rgba(255,171,112,0.1),_rgba(255,171,112,0.95),_rgba(255,171,112,0.1))]" style={{ animation: 'farmStealBurst 0.9s ease-out 0.08s forwards', transform: 'translate(-50%, -50%) rotate(-40deg)' }} />
                          <span className="absolute left-1/2 top-[18%] -translate-x-1/2 text-2xl text-[#ffd3b0]" style={{ animation: 'farmSpark 0.9s ease-out forwards' }}>✦</span>
                        </div>
                      ) : (
                        <div className="relative h-32 w-32">
                          <div className="absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#d8ffb4]/65 opacity-0" style={{ animation: 'farmPlantBurst 0.9s ease-out forwards' }} />
                          <span className="absolute left-[28%] top-[26%] text-2xl text-[#b6ef83]" style={{ animation: 'farmSpark 0.95s ease-out forwards' }}>✦</span>
                          <span className="absolute right-[22%] top-[34%] text-xl text-[#d4ffb1]" style={{ animation: 'farmSpark 0.95s ease-out 0.08s forwards' }}>✦</span>
                          <span className="absolute left-1/2 top-[18%] -translate-x-1/2 text-3xl text-[#f1ffca]" style={{ animation: 'farmSpark 0.95s ease-out 0.12s forwards' }}>✦</span>
                        </div>
                      )}
                    </div>
                  );
                })}
                <div className="pointer-events-none absolute inset-x-[16%] bottom-[4%] z-0 hidden h-[16%] rounded-[50%] border border-white/10 bg-[radial-gradient(circle,_rgba(248,228,161,0.18),_rgba(248,228,161,0.02)_72%,_transparent_76%)] lg:block" />
              </div>

              <div className="absolute inset-x-4 bottom-4 z-20 flex items-center justify-center">
                <div className={`w-full max-w-4xl rounded-[30px] border px-4 py-4 shadow-[0_18px_36px_rgba(14,8,3,0.24)] backdrop-blur-sm ${isVisiting ? 'border-[#f1d59f]/14 bg-[linear-gradient(180deg,_rgba(76,41,14,0.54),_rgba(39,20,6,0.58))]' : 'border-[#f1d59f]/28 bg-[linear-gradient(180deg,_rgba(89,50,17,0.92),_rgba(46,24,7,0.9))]'}`}>
                  <div className="rounded-[24px] border border-[#f8e5bc]/12 px-4 py-3">
                    {isVisiting ? (
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-[11px] uppercase tracking-[0.34em] text-[#f4d38a]/80">访客模式</p>
                          <p className="mt-1 text-sm text-[#fff2c7]/72">已收起你的种子袋和兑换入口。当前只保留拜访、观察与偷菜相关操作。</p>
                        </div>
                        <button type="button" onClick={() => loadTargetFarm()} className="rounded-full border border-[#e4ca8f]/28 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-[#ffe3a5] transition hover:bg-white/16">
                          返回主庄园
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-3">
                        <div className="hidden sm:block">
                          <p className="text-[11px] uppercase tracking-[0.34em] text-[#f4d38a]">庄园背包</p>
                          <p className="mt-1 text-sm text-[#fff2c7]/82">点击物品栏切换当前种子，再对地块执行播种。</p>
                        </div>
                        <div className="flex flex-1 items-center justify-center gap-2 sm:gap-3">
                        {pagedSeeds.map((seed) => {
                          const rarity = getSeedRarity(seed);
                          const selected = seed.code === selectedSeed;
                          return (
                            <button key={seed.code} type="button" disabled={!seed.unlocked} title={seed.name} aria-label={seed.name} onClick={() => setSelectedSeed(seed.code)} className={`group relative flex h-[78px] w-[78px] items-center justify-center rounded-[24px] border transition sm:h-[84px] sm:w-[84px] ${selected ? 'border-[#f6cf77]/80 bg-[linear-gradient(180deg,_rgba(255,239,192,0.95),_rgba(235,190,79,0.95))] shadow-[0_18px_28px_rgba(53,30,9,0.26)]' : seed.unlocked ? `${rarity.border} ${rarity.glow} bg-[linear-gradient(180deg,_rgba(255,248,227,0.15),_rgba(255,230,162,0.08))] hover:border-[#f2cb74]/55 hover:bg-white/16` : 'border-dashed border-white/10 bg-black/12 opacity-45'}`}>
                              <span className="absolute inset-[4px] rounded-[20px] border border-[#f8e7bf]/12" />
                              {seed.unlocked ? <span className={`absolute right-2 top-2 rounded-full border px-1.5 py-0.5 text-[9px] font-semibold tracking-[0.14em] ${rarity.badge}`}>{rarity.label}</span> : null}
                              <div className="relative h-11 w-11 sm:h-12 sm:w-12"><Image src={FARM_CROP_ASSETS[seed.code].READY} alt={seed.name} fill className="object-contain" /></div>
                              <span className="absolute left-2 top-2 rounded-full bg-black/24 px-1.5 py-0.5 text-[10px] font-semibold tracking-[0.18em] text-[#ffe4a5]">{seed.unlockLevel}</span>
                              {!seed.unlocked ? <span className="absolute inset-0 flex items-center justify-center rounded-[24px] bg-black/24 text-xs font-semibold text-[#ffe2a5]">Lv.{seed.unlockLevel}</span> : null}
                              {selected ? <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-[#fff2ae] shadow-[0_0_12px_rgba(255,242,174,0.9)]" /> : null}
                              <span className="pointer-events-none absolute bottom-[calc(100%+12px)] left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded-full border border-[#e4ca8f]/35 bg-[#2a1606]/94 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-[#ffe4a5] lg:group-hover:block">{seed.name}</span>
                            </button>
                          );
                        })}
                        </div>
                        <div className="flex items-center gap-2">
                          <button type="button" disabled={visibleSeedPage === 0} onClick={() => setSeedPage((current) => Math.max(0, current - 1))} className="rounded-full border border-[#e4ca8f]/35 bg-white/12 px-3 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-[#ffe3a5] transition hover:bg-white/18 disabled:opacity-40">‹</button>
                          <span className="text-[11px] uppercase tracking-[0.24em] text-[#f4d38a]">{visibleSeedPage + 1}/{totalSeedPages}</span>
                          <button type="button" disabled={visibleSeedPage >= totalSeedPages - 1} onClick={() => setSeedPage((current) => Math.min(totalSeedPages - 1, current + 1))} className="rounded-full border border-[#e4ca8f]/35 bg-white/12 px-3 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-[#ffe3a5] transition hover:bg-white/18 disabled:opacity-40">›</button>
                          <button type="button" onClick={() => setActiveDrawer('seeds')} className="rounded-full border border-[#e4ca8f]/35 bg-white/12 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-[#ffe3a5] transition hover:bg-white/18">打开种子袋</button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="pointer-events-none absolute inset-0 z-30">
                {floatingRewards.map((item) => <div key={item.id} className={`absolute left-1/2 top-[45%] text-center text-lg font-semibold tracking-[0.08em] ${item.variant === 'gold' ? 'text-[#fff0a1]' : item.variant === 'plant' ? 'text-[#d8ffb4]' : 'text-[#ffd9ae]'}`} style={{ animation: 'farmFloatUp 1.6s ease forwards' }}>{item.text}</div>)}
              </div>
            </div>
          </div>
        </section>
      </div>

      <OverlayDrawer title={drawerTitle} open={activeDrawer !== 'none'} onClose={() => setActiveDrawer('none')}>
        {activeDrawer === 'seeds' ? (
          <div className="space-y-4">
            {currentSeed ? (
              <div className="rounded-[26px] border border-[#d8bf87]/38 bg-[linear-gradient(145deg,_rgba(255,250,236,0.95),_rgba(252,235,194,0.95))] p-5 shadow-[0_16px_30px_rgba(79,53,19,0.08)]">
                <p className="text-[11px] uppercase tracking-[0.28em] text-[#9c7416]">当前选中</p>
                <div className="mt-3 flex items-start gap-4">
                  <div className="relative h-20 w-20 shrink-0"><Image src={FARM_CROP_ASSETS[currentSeed.code].READY} alt={currentSeed.name} fill className="object-contain" /></div>
                  <div>
                    <h3 className="text-2xl font-semibold tracking-[0.05em] text-[#35210a]">{currentSeed.name}</h3>
                    <p className="mt-2 text-sm leading-7 text-[#705529]">{currentSeed.description}</p>
                    <div className="mt-3 grid gap-2 text-sm text-[#60461b] sm:grid-cols-2">
                      <span>成本：{formatAmount(currentSeed.costCoins)} 金币</span>
                      <span>成熟：{getFarmSeedDurationLabel(currentSeed.durationMinutes)}</span>
                      <span>收益：{formatAmount(currentSeed.minYieldCoins)} ~ {formatAmount(currentSeed.maxYieldCoins)}</span>
                      <span>经验：+{currentSeed.experience}</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
            <div className="rounded-[26px] border border-[#d8bf87]/38 bg-[linear-gradient(145deg,_rgba(255,250,236,0.95),_rgba(252,235,194,0.95))] p-5 shadow-[0_16px_30px_rgba(79,53,19,0.08)]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.28em] text-[#9c7416]">种子分页背包</p>
                  <p className="mt-1 text-sm text-[#705529]">每页展示 2 个物品格，边框颜色表示稀有度。</p>
                </div>
                <div className="flex items-center gap-2">
                  <button type="button" disabled={visibleSeedPage === 0} onClick={() => setSeedPage((current) => Math.max(0, current - 1))} className="rounded-full border border-[#d5b778]/45 bg-white/70 px-3 py-2 text-xs font-semibold tracking-[0.18em] text-[#8e670f] transition hover:bg-white disabled:opacity-40">上一页</button>
                  <span className="text-xs font-semibold tracking-[0.22em] text-[#8f6806]">{visibleSeedPage + 1}/{totalSeedPages}</span>
                  <button type="button" disabled={visibleSeedPage >= totalSeedPages - 1} onClick={() => setSeedPage((current) => Math.min(totalSeedPages - 1, current + 1))} className="rounded-full border border-[#d5b778]/45 bg-white/70 px-3 py-2 text-xs font-semibold tracking-[0.18em] text-[#8e670f] transition hover:bg-white disabled:opacity-40">下一页</button>
                </div>
              </div>
              <div className="mt-4 space-y-3">
              {pagedSeeds.map((seed) => {
                const rarity = getSeedRarity(seed);
                const selected = seed.code === selectedSeed;
                return (
                  <button key={seed.code} type="button" disabled={!seed.unlocked} onClick={() => setSelectedSeed(seed.code)} className={`w-full rounded-[26px] border p-4 text-left transition ${selected ? 'border-[#d39916] bg-[linear-gradient(145deg,_#fff3c7,_#ffe19a)] shadow-[0_16px_32px_rgba(211,153,22,0.12)]' : seed.unlocked ? `${rarity.border} ${rarity.glow} bg-white/72 hover:border-[#d39916]/50 hover:bg-[#fff8e7]` : 'border-dashed border-[#cbb68d]/35 bg-[#efe8d7] text-[#9d8e71]'}`}>
                    <div className="flex items-start gap-4">
                      <div className="relative h-16 w-16 shrink-0 rounded-[20px] border border-white/40 bg-[linear-gradient(180deg,_rgba(255,248,234,0.95),_rgba(249,233,194,0.95))] p-2">
                        <Image src={FARM_CROP_ASSETS[seed.code].READY} alt={seed.name} fill className="object-contain p-2" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-lg font-semibold tracking-[0.04em]">{seed.name}</p>
                          <div className="flex items-center gap-2">
                            <span className={`rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.24em] ${rarity.badge}`}>{rarity.label}</span>
                            <span className="rounded-full border border-[#d2ad54]/40 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-[#8f6806]">Lv.{seed.unlockLevel}</span>
                          </div>
                        </div>
                        <p className="mt-1 text-sm text-[#6f5428]">{seed.description}</p>
                        <div className="mt-3 grid grid-cols-2 gap-2 text-sm text-[#654a1c]">
                          <span>成本：{formatAmount(seed.costCoins)} 金币</span>
                          <span>成熟：{getFarmSeedDurationLabel(seed.durationMinutes)}</span>
                          <span>收益：{formatAmount(seed.minYieldCoins)} ~ {formatAmount(seed.maxYieldCoins)}</span>
                          <span>经验：+{seed.experience}</span>
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
              </div>
            </div>
          </div>
        ) : null}

        {activeDrawer === 'exchange' ? (
          <div className="space-y-4">
            {[
              { title: '余额 → 金币', hint: '把 totalBalance 直接投进庄园。', value: balanceAmount, onChange: setBalanceAmount, action: () => runAction('exchange_balance', { amount: balanceAmount }, 'exchange_balance'), loading: 'exchange_balance', button: '兑换金币' },
              { title: '积分 → 金币', hint: '已有积分也能转成庄园货币。', value: pointAmount, onChange: setPointAmount, action: () => runAction('exchange_points', { amount: pointAmount }, 'exchange_points'), loading: 'exchange_points', button: '转成金币' },
              { title: '金币 → 积分', hint: '收菜后的金币也能换回锦鲤积分。', value: coinAmount, onChange: setCoinAmount, action: () => runAction('exchange_coins_to_points', { amount: coinAmount }, 'exchange_coins_to_points'), loading: 'exchange_coins_to_points', button: '兑换积分' },
            ].map((item) => (
              <div key={item.title} className="rounded-[24px] border border-[#d7bc83]/35 bg-white/72 p-4">
                <div className="flex flex-col gap-1"><p className="text-base font-semibold tracking-[0.04em] text-[#38240d]">{item.title}</p><p className="text-sm text-[#7b6131]">{item.hint}</p></div>
                <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                  <input value={item.value} onChange={(event) => item.onChange(event.target.value)} className="flex-1 rounded-full border border-[#d9bf88]/40 bg-[#fffdf7] px-4 py-3 text-sm text-[#38240d] outline-none transition focus:border-[#c98b12]" placeholder="输入数量" />
                  <button type="button" disabled={loadingKey === item.loading} onClick={item.action} className="rounded-full bg-[linear-gradient(90deg,_#8d5b11,_#bf8113)] px-5 py-3 text-sm font-semibold tracking-[0.14em] text-white transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50">{loadingKey === item.loading ? '处理中…' : item.button}</button>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {activeDrawer === 'logs' ? (
          <div className="space-y-3">
            {viewDashboard.recentLogs.length > 0 ? viewDashboard.recentLogs.map((log) => (
              <div key={log.id} className="rounded-[22px] border border-[#d8bf87]/28 bg-[linear-gradient(180deg,_rgba(255,252,245,0.94),_rgba(249,239,214,0.94))] p-4 text-sm text-[#6b4f21]">
                <div className="flex flex-wrap items-center justify-between gap-2"><p className="font-semibold tracking-[0.04em] text-[#31200d]">{actionLabelMap[log.actionType] ?? log.actionType}</p><span className="text-xs text-[#98731a]">{new Date(log.createdAt).toLocaleString('zh-CN')}</span></div>
                <div className="mt-3 flex flex-wrap gap-4 text-xs"><span>金币 {formatAmount(log.coinDelta)}</span><span>积分 {formatAmount(log.pointDelta)}</span><span>余额 {formatAmount(log.balanceDelta)}</span><span>经验 +{log.expDelta}</span>{log.plotIndex ? <span>地块 {log.plotIndex}</span> : null}</div>
                {log.note ? <p className="mt-2 text-xs text-[#8b6a2c]">{log.note}</p> : null}
              </div>
            )) : <p className="rounded-2xl border border-dashed border-[#d7bc83]/40 bg-[#fff8e8] p-4 text-sm text-[#816032]">暂时还没有庄园记录。</p>}
          </div>
        ) : null}
      </OverlayDrawer>

      {friendModalOpen ? (
        <div className="fixed inset-0 z-[55] flex items-center justify-center bg-[#1d0f03]/58 px-3 py-6" onClick={() => setFriendModalOpen(false)}>
          <div
            className="relative w-full max-w-[980px] rounded-[38px] border border-[#e8c777]/60 bg-[linear-gradient(180deg,_rgba(255,250,236,0.98),_rgba(245,225,182,0.98))] shadow-[0_28px_70px_rgba(69,18,15,0.28)]"
            onClick={(event) => event.stopPropagation()}
          >
            <button type="button" onClick={() => setFriendModalOpen(false)} className="absolute right-4 top-4 z-10 flex h-11 w-11 items-center justify-center rounded-full border border-[#d8bc83]/45 bg-white/55 text-xl text-[#734d17] transition hover:bg-white/75">×</button>
            <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[260px_1fr]">
              <div className="rounded-[30px] border border-[#efcf88]/38 bg-[linear-gradient(180deg,_rgba(122,24,20,0.96),_rgba(74,17,14,0.95))] p-5 text-[#fff5da] shadow-[0_18px_40px_rgba(69,18,15,0.24)]">
                <p className="text-[11px] uppercase tracking-[0.34em] text-[#f4d38a]">Koi Manor</p>
                <h2 className="mt-2 text-3xl font-semibold tracking-[0.06em]">好友庄园</h2>
                <p className="mt-3 text-sm leading-7 text-[#fcebc2]/86">好友、常访和搜索都收进独立拜访台，强调锦鲤红和鎏金木牌风格，不再像普通后台列表。</p>
                <div className="mt-5 space-y-2">
                  <button type="button" onClick={() => setCompanionTab('friends')} className={`w-full rounded-[18px] border px-4 py-3 text-left text-sm font-semibold tracking-[0.12em] transition ${companionTab === 'friends' ? 'border-[#f6cf77]/65 bg-[linear-gradient(90deg,_rgba(246,207,119,0.26),_rgba(255,244,195,0.18))] text-white' : 'border-white/12 bg-white/6 text-[#ffeab7] hover:bg-white/10'}`}>我的好友</button>
                  <button type="button" onClick={() => setCompanionTab('frequent')} className={`w-full rounded-[18px] border px-4 py-3 text-left text-sm font-semibold tracking-[0.12em] transition ${companionTab === 'frequent' ? 'border-[#f6cf77]/65 bg-[linear-gradient(90deg,_rgba(246,207,119,0.26),_rgba(255,244,195,0.18))] text-white' : 'border-white/12 bg-white/6 text-[#ffeab7] hover:bg-white/10'}`}>常访名单</button>
                  <button type="button" onClick={() => setCompanionTab('search')} className={`w-full rounded-[18px] border px-4 py-3 text-left text-sm font-semibold tracking-[0.12em] transition ${companionTab === 'search' ? 'border-[#f6cf77]/65 bg-[linear-gradient(90deg,_rgba(246,207,119,0.26),_rgba(255,244,195,0.18))] text-white' : 'border-white/12 bg-white/6 text-[#ffeab7] hover:bg-white/10'}`}>搜索庄园</button>
                </div>
                {isVisiting ? (
                  <button type="button" disabled={loadingKey === 'visit-home'} onClick={() => loadTargetFarm()} className="mt-6 w-full rounded-full border border-[#f5d8a0]/35 bg-white/10 px-4 py-3 text-sm font-semibold tracking-[0.12em] text-[#ffe3a4] transition hover:bg-white/16 disabled:cursor-not-allowed disabled:opacity-50">
                    {loadingKey === 'visit-home' ? '返回中…' : '回到我的庄园'}
                  </button>
                ) : null}
              </div>
              <div className="space-y-4">
                {companionTab === 'friends' ? (
                  <div className="rounded-[28px] border border-[#d7bc83]/35 bg-white/72 p-5 shadow-[0_16px_30px_rgba(79,53,19,0.08)]">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.28em] text-[#9c7416]">真实好友</p>
                        <h3 className="mt-2 text-2xl font-semibold tracking-[0.04em] text-[#38240d]">我的好友</h3>
                        <p className="mt-1 text-sm text-[#7b6131]">根据真实订单和打赏互动生成，可直接拜访对方庄园。</p>
                      </div>
                      <span className="rounded-full border border-[#dfc48b]/45 bg-[#fff6e2] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8f6806]">{companions.friends.length} 位好友</span>
                    </div>
                    <div className="mt-4">{renderCompanionCards(companions.friends, '还没有形成好友庄园名单。先和陪玩互动几次，再回来这里。')}</div>
                  </div>
                ) : null}

                {companionTab === 'frequent' ? (
                  <div className="rounded-[28px] border border-[#d7bc83]/35 bg-white/72 p-5 shadow-[0_16px_30px_rgba(79,53,19,0.08)]">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.28em] text-[#9c7416]">访问记录</p>
                        <h3 className="mt-2 text-2xl font-semibold tracking-[0.04em] text-[#38240d]">常访名单</h3>
                        <p className="mt-1 text-sm text-[#7b6131]">改成服务器真实拜访记录，不再依赖本地缓存。</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button type="button" onClick={() => setFrequentVisitSort('count')} className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${frequentVisitSort === 'count' ? 'border-[#d39a24]/45 bg-[#fff0c8] text-[#8f6806]' : 'border-[#dfc48b]/45 bg-[#fff6e2] text-[#8f6806]'}`}>按次数</button>
                        <button type="button" onClick={() => setFrequentVisitSort('recent')} className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${frequentVisitSort === 'recent' ? 'border-[#d39a24]/45 bg-[#fff0c8] text-[#8f6806]' : 'border-[#dfc48b]/45 bg-[#fff6e2] text-[#8f6806]'}`}>按最近</button>
                        <span className="rounded-full border border-[#dfc48b]/45 bg-[#fff6e2] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8f6806]">{companions.frequentVisits.length} 个庄园</span>
                      </div>
                    </div>
                    <div className="mt-4">{renderCompanionCards(sortedFrequentVisits, '还没有常访庄园。先拜访一次别人的庄园，记录就会出现在这里。')}</div>
                  </div>
                ) : null}

                {companionTab === 'search' ? (
                  <div className="rounded-[28px] border border-[#d7bc83]/35 bg-white/72 p-5 shadow-[0_16px_30px_rgba(79,53,19,0.08)]">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.28em] text-[#9c7416]">地图册</p>
                        <h3 className="mt-2 text-2xl font-semibold tracking-[0.04em] text-[#38240d]">搜索庄园</h3>
                        <p className="mt-1 text-sm text-[#7b6131]">输入陪玩 ID、Discord ID 或展示名，找到后直接进入对方庄园。</p>
                      </div>
                      <span className="rounded-full border border-[#dfc48b]/45 bg-[#fff6e2] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8f6806]">拜访模式</span>
                    </div>
                    <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                      <input value={farmSearch} onChange={(event) => setFarmSearch(event.target.value)} className="flex-1 rounded-full border border-[#d9bf88]/40 bg-[#fffdf7] px-4 py-3 text-sm text-[#38240d] outline-none transition focus:border-[#c98b12]" placeholder="搜索陪玩 ID / Discord ID / 名字" />
                    </div>
                    <div className="mt-4 space-y-3">
                      {searching ? <p className="text-sm text-[#7b6131]">搜索中…</p> : null}
                      {!searching && farmSearch.trim() && searchResults.length === 0 ? <p className="rounded-2xl border border-dashed border-[#d7bc83]/40 bg-[#fff8e8] p-4 text-sm text-[#816032]">没有找到可访问的庄园。</p> : null}
                      <div className="grid gap-3 sm:grid-cols-2">
                        {searchResults.map((result) => (
                          <button key={result.id} type="button" disabled={loadingKey === 'visit-farm'} onClick={() => loadTargetFarm(result.discordUserId)} className="group overflow-hidden rounded-[26px] border border-[#d8bf87]/35 bg-[linear-gradient(180deg,_rgba(255,252,245,0.98),_rgba(249,239,214,0.98))] text-left transition hover:-translate-y-0.5 hover:border-[#d39a24]/50 hover:shadow-[0_18px_34px_rgba(101,66,20,0.14)] disabled:cursor-not-allowed disabled:opacity-60">
                            <div className="relative h-28 overflow-hidden border-b border-[#e7d4ab]/55 bg-[linear-gradient(180deg,_rgba(250,233,182,0.68),_rgba(214,183,109,0.18))]">
                              {result.mpUrl ? (
                                <Image src={result.mpUrl} alt={result.serverDisplayName} fill className="object-cover transition duration-300 group-hover:scale-[1.04]" />
                              ) : (
                                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_#fff3c7,_#dfbf78_58%,_#a67a2f_100%)]" />
                              )}
                              <div className="absolute inset-0 bg-[linear-gradient(180deg,_rgba(131,33,22,0.02),_rgba(59,20,13,0.66))]" />
                              <div className="absolute left-4 top-4 flex h-12 w-12 items-center justify-center rounded-full border border-white/40 bg-[linear-gradient(180deg,_rgba(255,248,228,0.92),_rgba(248,224,161,0.9))] text-lg font-semibold text-[#7d5716] shadow-[0_10px_18px_rgba(31,17,5,0.16)]">
                                {result.serverDisplayName.trim().charAt(0) || '庄'}
                              </div>
                              <span className="absolute right-4 top-4 rounded-full border border-white/36 bg-[rgba(86,21,13,0.62)] px-3 py-1 text-[10px] uppercase tracking-[0.22em] text-[#ffe3a6]">#{result.peiwanId}</span>
                              <div className="absolute bottom-3 left-4 flex flex-wrap gap-2">
                                <span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${getCompanionStatusTone(result.isOnline)}`}>
                                  {result.isOnline ? '在线' : '离线'}
                                </span>
                                <span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${
                                  result.stealablePlots > 0
                                    ? 'border-amber-200/70 bg-amber-50/95 text-amber-700'
                                    : 'border-stone-300/70 bg-stone-100/95 text-stone-500'
                                }`}>
                                  {result.stealablePlots > 0 ? `可偷 ${result.stealablePlots}` : '不可偷'}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center justify-between gap-3 px-4 py-4">
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-base font-semibold tracking-[0.04em] text-[#35210a]">{result.serverDisplayName}</p>
                                <p className="mt-1 truncate text-xs text-[#8b6a2c]">{result.discordUserId}</p>
                                <div className="mt-2 flex items-center gap-2 text-[11px] text-[#7e6134]">
                                  <span className="rounded-full border border-[#dfc48b]/45 bg-[#fff6e2] px-2 py-1 tracking-[0.14em]">搜索结果</span>
                                  <span>直接进入对方庄园</span>
                                </div>
                              </div>
                              <span className="rounded-full border border-[#d2ad54]/40 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-[#8f6806]">拜访</span>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {activePlot ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#1d0f03]/58 px-3 py-6" onClick={() => setActivePlotIndex(null)}>
          <div className="relative w-full max-w-[760px] rounded-[34px] border border-[#e4ca8f]/55 bg-[linear-gradient(180deg,_rgba(255,249,232,0.98),_rgba(246,229,188,0.98))] shadow-[0_28px_70px_rgba(25,14,4,0.3)]" onClick={(event) => event.stopPropagation()}>
            <button type="button" onClick={() => setActivePlotIndex(null)} className="absolute right-4 top-4 z-10 flex h-11 w-11 items-center justify-center rounded-full border border-[#d8bc83]/45 bg-white/55 text-xl text-[#734d17] transition hover:bg-white/75">×</button>
            <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[0.9fr_1.1fr]">
              <div className={`relative overflow-hidden rounded-[30px] border p-5 ${activePlot.highlight === 'ready' ? 'border-[#efc861]/65 bg-[linear-gradient(180deg,_rgba(255,241,190,0.96),_rgba(224,179,70,0.94))]' : activePlot.highlight === 'growing' ? 'border-[#d4b06b]/55 bg-[linear-gradient(180deg,_rgba(255,244,215,0.96),_rgba(232,205,138,0.94))]' : activePlot.highlight === 'idle' ? 'border-[#d4b06b]/42 bg-[linear-gradient(180deg,_rgba(255,250,237,0.96),_rgba(245,231,194,0.94))]' : 'border-[#cdb486]/36 bg-[linear-gradient(180deg,_rgba(234,223,197,0.96),_rgba(208,188,145,0.94))]'}`}>
                <div className="absolute left-5 top-5 rounded-full border border-white/32 bg-white/18 px-4 py-2 text-[11px] uppercase tracking-[0.3em] text-[#8d6509] shadow-[0_10px_18px_rgba(0,0,0,0.08)]">庄园操作台</div>
                <div className="absolute inset-x-10 bottom-5 h-8 rounded-[50%] bg-[radial-gradient(circle,_rgba(75,48,14,0.36),_rgba(75,48,14,0.05)_72%)] blur-sm" />
                <div className="relative flex h-full min-h-[300px] flex-col items-center justify-center text-center">
                  <div className="rounded-full border border-white/35 bg-white/18 px-3 py-1 text-xs uppercase tracking-[0.28em] text-[#8d6509]">地块 {activePlot.plotIndex}</div>
                  <div className="relative mt-5 flex h-56 w-56 items-center justify-center">
                    <Image src={FARM_SCENE_ASSETS.plotFrame} alt="" fill className="object-contain opacity-95" />
                    <Image src={getPlotAsset(activePlot).asset} alt={activePlot.title} fill className={`object-contain ${getPlotAsset(activePlot).className}`} />
                  </div>
                  <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                    <span className="rounded-full border border-white/38 bg-white/24 px-4 py-2 text-sm font-semibold tracking-[0.16em] text-[#5f3b0d]">{activePlot.status === 'READY' ? '成熟完成' : activePlot.status === 'GROWING' && activePlot.plot ? stageLabelMap[activePlot.plot.growthStage] : activePlot.status === 'EMPTY' ? '等待播种' : '待解锁'}</span>
                    {activePlot.seedMeta ? <span className="rounded-full border border-white/34 bg-white/18 px-4 py-2 text-sm font-semibold tracking-[0.12em] text-[#6d4a16]">经验 +{activePlot.seedMeta.experience}</span> : null}
                  </div>
                </div>
              </div>
              <div className="flex flex-col justify-between gap-5">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.34em] text-[#a17615]">Plot Detail</p>
                  <h2 className="mt-2 text-3xl font-semibold tracking-[0.05em] text-[#38230b]">{activePlot.title}</h2>
                  <p className="mt-3 text-sm leading-7 text-[#6d5122]">{activePlot.subtitle}</p>
                  <div className="mt-5 rounded-[26px] border border-[#d7bc83]/35 bg-white/62 p-4 text-sm text-[#6b4f21]">
                    <div className="mb-3 flex flex-wrap gap-2">
                      <span className="rounded-full border border-[#dfc48b]/45 bg-[#fff6e2] px-3 py-2 text-xs font-semibold tracking-[0.16em] text-[#895f19]">{plotActionLabel(activePlot)}</span>
                      {activePlot.seedMeta ? <span className="rounded-full border border-[#dfc48b]/45 bg-[#fff6e2] px-3 py-2 text-xs font-semibold tracking-[0.16em] text-[#895f19]">{getFarmSeedDurationLabel(activePlot.seedMeta.durationMinutes)}</span> : null}
                    </div>
                    <div className="space-y-2">
                    {activePlot.tooltipLines.map((line) => <p key={line}>{line}</p>)}
                    {activePlot.plot?.status === 'GROWING' ? (<div className="pt-2"><div className="h-3 overflow-hidden rounded-full bg-[#ebdfbe] p-[2px]"><div className="h-full rounded-full bg-[linear-gradient(90deg,_#c98b13,_#f0bd40)]" style={{ width: `${Math.round((activePlot.plot.progressRatio ?? 0) * 100)}%` }} /></div><p className="mt-2 text-xs text-[#8b6a2c]">成长进度 {Math.round((activePlot.plot.progressRatio ?? 0) * 100)}%</p></div>) : null}
                    {activePlot.plot?.status === 'READY' && activePlot.plot.stolenCoins !== '0.00' ? <p>本轮已被偷：{formatAmount(activePlot.plot.stolenCoins)} 金币</p> : null}
                    </div>
                  </div>
                  {activePlot.seedMeta ? (
                    <div className="mt-4 grid gap-3 sm:grid-cols-3">
                      <div className="rounded-2xl border border-[#d7bc83]/30 bg-white/58 p-4 text-sm text-[#6a4c1d]"><p className="text-xs uppercase tracking-[0.24em] text-[#9d7518]">成熟时间</p><p className="mt-2 text-lg font-semibold text-[#34210b]">{getFarmSeedDurationLabel(activePlot.seedMeta.durationMinutes)}</p></div>
                      <div className="rounded-2xl border border-[#d7bc83]/30 bg-white/58 p-4 text-sm text-[#6a4c1d]"><p className="text-xs uppercase tracking-[0.24em] text-[#9d7518]">收益区间</p><p className="mt-2 text-lg font-semibold text-[#34210b]">{formatAmount(activePlot.seedMeta.minYieldCoins)} ~ {formatAmount(activePlot.seedMeta.maxYieldCoins)}</p></div>
                      <div className="rounded-2xl border border-[#d7bc83]/30 bg-white/58 p-4 text-sm text-[#6a4c1d]"><p className="text-xs uppercase tracking-[0.24em] text-[#9d7518]">成长奖励</p><p className="mt-2 text-lg font-semibold text-[#34210b]">+{activePlot.seedMeta.experience} EXP</p></div>
                    </div>
                  ) : null}
                </div>
                <div className="space-y-3">
                  {activePlot.status === 'EMPTY' && viewDashboard.owner.isSelf && currentSeed ? <button type="button" disabled={loadingKey === `plant:${activePlot.plotIndex}`} onClick={() => performPlotAction(activePlot)} className="w-full rounded-full bg-[linear-gradient(90deg,_#8e5c11,_#bb7d10)] px-4 py-4 text-sm font-semibold tracking-[0.14em] text-white transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50">{loadingKey === `plant:${activePlot.plotIndex}` ? '种植中…' : plotActionLabel(activePlot)}</button> : null}
                  {activePlot.status === 'READY' ? <button type="button" disabled={(viewDashboard.owner.isSelf && loadingKey === `harvest:${activePlot.plotIndex}`) || (!viewDashboard.owner.isSelf && (!activePlot.plot?.canSteal || loadingKey === `steal:${activePlot.plotIndex}`))} onClick={() => performPlotAction(activePlot)} className="w-full rounded-full bg-[linear-gradient(90deg,_#c98b13,_#f0bd40)] px-4 py-4 text-sm font-semibold tracking-[0.14em] text-white transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50">{viewDashboard.owner.isSelf ? loadingKey === `harvest:${activePlot.plotIndex}` ? '收获中…' : plotActionLabel(activePlot) : loadingKey === `steal:${activePlot.plotIndex}` ? '偷菜中…' : plotActionLabel(activePlot)}</button> : null}
                  {!activePlot.unlocked && viewDashboard.owner.isSelf && homeDashboard.summary.nextPlotCost ? <button type="button" disabled={loadingKey === 'expand'} onClick={() => performPlotAction(activePlot)} className="w-full rounded-full bg-[linear-gradient(90deg,_#503015,_#8d5b11,_#c78a18)] px-4 py-4 text-sm font-semibold tracking-[0.14em] text-white transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50">{loadingKey === 'expand' ? '扩地中…' : plotActionLabel(activePlot)}</button> : null}
                  {activePlot.status === 'EMPTY' && viewDashboard.owner.isSelf && !currentSeed ? <button type="button" onClick={() => { setActivePlotIndex(null); setActiveDrawer('seeds'); }} className="w-full rounded-full border border-[#d7bc83]/45 bg-white/75 px-4 py-4 text-sm font-semibold tracking-[0.14em] text-[#835e19] transition hover:bg-white">打开种子袋选择种子</button> : null}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {actionResult ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[#1d0f03]/42 px-3 py-6" onClick={() => setActionResult(null)}>
          <div
            className={`relative w-full max-w-[420px] rounded-[34px] border p-5 shadow-[0_24px_60px_rgba(21,11,3,0.28)] [animation:farmResultCardIn_0.24s_ease-out_forwards] ${
              actionResult.accent === 'gold'
                ? 'border-[#efc861]/60 bg-[linear-gradient(180deg,_rgba(255,249,227,0.98),_rgba(255,228,166,0.98))]'
                : actionResult.accent === 'green'
                  ? 'border-[#b7df83]/60 bg-[linear-gradient(180deg,_rgba(246,255,232,0.98),_rgba(220,244,180,0.98))]'
                  : 'border-[#f0c19b]/60 bg-[linear-gradient(180deg,_rgba(255,245,236,0.98),_rgba(255,221,192,0.98))]'
            }`}
            onClick={(event) => event.stopPropagation()}
          >
            <button type="button" onClick={() => setActionResult(null)} className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full border border-white/35 bg-white/55 text-xl text-[#734d17] transition hover:bg-white/80">×</button>
            <div className="rounded-[26px] border border-white/28 px-4 py-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[11px] uppercase tracking-[0.34em] text-[#996d11]">Koi Manor</p>
                <span className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${
                  actionResult.accent === 'gold'
                    ? 'border-[#e9ca6a]/42 bg-[#fff4c9] text-[#8b6408]'
                    : actionResult.accent === 'green'
                      ? 'border-[#b7df83]/52 bg-[#eefad8] text-[#537718]'
                      : 'border-[#e7bd9b]/52 bg-[#fff0e3] text-[#9a5e2f]'
                }`}>
                  {actionResult.badge}
                </span>
              </div>
              <h3 className="mt-2 text-3xl font-semibold tracking-[0.06em] text-[#3b250c]">{actionResult.title}</h3>
              <p className="mt-2 text-sm leading-7 text-[#6c4f21]">{actionResult.description}</p>
              <div className="mt-4 rounded-[24px] border border-white/26 bg-white/42 p-4">
                <div className="flex justify-center">
                  <div className="relative h-40 w-40">
                    <div className={`absolute inset-4 rounded-full ${
                      actionResult.accent === 'gold'
                        ? 'bg-[radial-gradient(circle,_rgba(255,224,138,0.48),_rgba(255,224,138,0.04)_70%)]'
                        : actionResult.accent === 'green'
                          ? 'bg-[radial-gradient(circle,_rgba(197,255,172,0.42),_rgba(197,255,172,0.04)_70%)]'
                          : 'bg-[radial-gradient(circle,_rgba(255,191,140,0.4),_rgba(255,191,140,0.04)_70%)]'
                    }`} />
                    <span className="absolute left-[14%] top-[18%] text-2xl text-white/80">✦</span>
                    <span className="absolute right-[14%] top-[26%] text-xl text-white/70">✦</span>
                    <span className="absolute left-1/2 bottom-[8%] -translate-x-1/2 text-2xl text-white/80">✦</span>
                  <Image src={actionResult.asset} alt={actionResult.title} fill className="object-contain drop-shadow-[0_16px_24px_rgba(0,0,0,0.15)]" />
                  </div>
                </div>
              </div>
              <div className="mt-4 space-y-2 rounded-[22px] border border-white/32 bg-white/52 p-4 text-sm text-[#6b4f21]">
                {actionResult.detailLines.map((line) => (
                  <p key={line}>{line}</p>
                ))}
              </div>
              <button type="button" onClick={() => setActionResult(null)} className="mt-5 w-full rounded-full bg-[linear-gradient(90deg,_#8d5b11,_#bf8113)] px-4 py-3 text-sm font-semibold tracking-[0.16em] text-white transition hover:brightness-105">
                确认
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
