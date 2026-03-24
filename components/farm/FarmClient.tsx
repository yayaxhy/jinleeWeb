'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { MAX_PLOTS, getFarmSeedDurationLabel, type FarmSeedTypeValue } from '@/lib/farmConfig';
import type { FarmDashboard } from '@/lib/farm';

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

type Props = { initialDashboard: FarmDashboard };
type PlotStatus = 'LOCKED' | 'EMPTY' | 'GROWING' | 'READY';
type DrawerKey = 'none' | 'seeds' | 'exchange' | 'visit' | 'logs';
type FarmSearchResult = { id: number; discordUserId: string; serverDisplayName: string };
type FloatingReward = { id: number; text: string; variant: 'gold' | 'steal' };
type SceneBurst = { id: number; plotIndex: number; variant: 'harvest' | 'steal' };

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

const cropStageAssetMap: Record<FarmSeedTypeValue, Record<'SPROUT' | 'YOUNG' | 'MATURE' | 'READY', string>> = {
  WHEAT: {
    SPROUT: '/farm/wheat-sprout.svg',
    YOUNG: '/farm/wheat-young.svg',
    MATURE: '/farm/wheat-mature.svg',
    READY: '/farm/wheat-ready.svg',
  },
  ROSE: {
    SPROUT: '/farm/rose-sprout.svg',
    YOUNG: '/farm/rose-young.svg',
    MATURE: '/farm/rose-mature.svg',
    READY: '/farm/rose-ready.svg',
  },
  KOI_FLOWER: {
    SPROUT: '/farm/koi-flower-sprout.svg',
    YOUNG: '/farm/koi-flower-young.svg',
    MATURE: '/farm/koi-flower-mature.svg',
    READY: '/farm/koi-flower-ready.svg',
  },
  MYSTERY_FRUIT: {
    SPROUT: '/farm/mystery-fruit-sprout.svg',
    YOUNG: '/farm/mystery-fruit-young.svg',
    MATURE: '/farm/mystery-fruit-mature.svg',
    READY: '/farm/mystery-fruit-ready.svg',
  },
};

const drawerMeta: Record<Exclude<DrawerKey, 'none'>, { icon: string; label: string }> = {
  seeds: { icon: '🌱', label: '种子袋' },
  exchange: { icon: '💰', label: '兑换所' },
  visit: { icon: '🧭', label: '拜访庄园' },
  logs: { icon: '📜', label: '庄园日志' },
};

const stageLabelMap = {
  SPROUT: '嫩芽阶段',
  YOUNG: '抽枝阶段',
  MATURE: '丰产前夕',
  READY: '成熟完成',
} as const;

function getPlotAsset(entry: PlotCard) {
  if (!entry.unlocked) {
    return { asset: '/farm/locked-plot.svg', className: 'scale-[0.98] opacity-85 drop-shadow-[0_18px_24px_rgba(0,0,0,0.18)]' };
  }
  if (!entry.plot || entry.status === 'EMPTY' || !entry.plot.seedType) {
    return { asset: '/farm/sprout-generic.svg', className: 'scale-[0.86] opacity-45 saturate-75' };
  }
  const asset = cropStageAssetMap[entry.plot.seedType][entry.plot.growthStage];
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

function ToolButton({ icon, label, active, onClick }: { icon: string; label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`group relative flex h-14 w-14 items-center justify-center rounded-[22px] border transition ${
        active
          ? 'border-[#f4d17a] bg-[linear-gradient(180deg,_rgba(91,55,17,0.96),_rgba(56,31,9,0.96))] text-white shadow-[0_18px_28px_rgba(53,30,9,0.28)]'
          : 'border-white/30 bg-[linear-gradient(180deg,_rgba(255,250,238,0.22),_rgba(84,49,18,0.38))] text-[#fff1d0] hover:border-[#f0ca72]/55 hover:bg-[linear-gradient(180deg,_rgba(98,59,19,0.92),_rgba(60,34,11,0.95))]'
      }`}
    >
      <span className="text-2xl">{icon}</span>
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

function MetricChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[20px] border border-white/25 bg-[linear-gradient(180deg,_rgba(255,251,242,0.18),_rgba(62,34,10,0.34))] px-4 py-3 text-[#fff5dc] shadow-[0_12px_22px_rgba(0,0,0,0.12)] backdrop-blur-sm">
      <p className="text-[10px] uppercase tracking-[0.3em] text-[#f2d797]">{label}</p>
      <p className="mt-1 text-lg font-semibold tracking-[0.03em]">{value}</p>
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

  const isVisiting = viewDashboard.owner.discordUserId !== homeDashboard.owner.discordUserId;
  const currentSeed = homeDashboard.seeds.find((seed) => seed.code === selectedSeed) ?? null;

  useEffect(() => {
    if (selectedSeed && homeDashboard.seeds.some((seed) => seed.code === selectedSeed && seed.unlocked)) return;
    setSelectedSeed(homeDashboard.seeds.find((seed) => seed.unlocked)?.code ?? null);
  }, [homeDashboard.seeds, selectedSeed]);

  useEffect(() => {
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
  }, [farmSearch]);

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
            : '这块地目前空着'
          : status === 'READY'
            ? viewDashboard.owner.isSelf
              ? '成熟完成，点击收获'
              : plot?.canSteal
                ? '成熟完成，点击偷菜'
                : '本轮已被偷过'
            : `${stageLabelMap[plot?.growthStage ?? 'SPROUT']} · ${formatRemaining(plot?.remainingSeconds ?? 0)}`;
      const tooltipLines = !unlocked
        ? ['庄园仍可继续扩地。', homeDashboard.summary.nextPlotCost ? `下一块地：${formatAmount(homeDashboard.summary.nextPlotCost)} 金币` : '已达到最大地块']
        : status === 'EMPTY'
          ? [viewDashboard.owner.isSelf ? `当前种子：${currentSeed?.name ?? '未选择'}` : '这块地目前没有作物。', viewDashboard.owner.isSelf ? '点击地块直接播种。' : '空地没有可以偷的东西。']
          : status === 'READY'
            ? [viewDashboard.owner.isSelf ? '作物已经成熟，点击收获。' : plot?.canSteal ? '这一轮可以偷菜。' : '这一轮已经被偷过。', seedMeta ? `预计产出：${formatAmount(seedMeta.minYieldCoins)} ~ ${formatAmount(seedMeta.maxYieldCoins)} 金币` : '等待结算产出。']
            : [`剩余时间：${formatRemaining(plot?.remainingSeconds ?? 0)}`, `成长进度：${Math.round((plot?.progressRatio ?? 0) * 100)}%`];
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
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoadingKey(null);
    }
  };

  const runAction = async (action: string, payload: Record<string, unknown>, key: string) => {
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
      if (action === 'harvest' && data?.result?.harvestCoins) {
        pushFloatingReward(`+${formatAmount(data.result.harvestCoins)} 金币`, 'gold');
        if (typeof payload.plotIndex === 'number') pushSceneBurst(payload.plotIndex, 'harvest');
      }
      if (action === 'steal' && data?.result?.stolenCoins) {
        pushFloatingReward(`偷到 +${formatAmount(data.result.stolenCoins)} 金币`, 'steal');
        if (typeof payload.plotIndex === 'number') pushSceneBurst(payload.plotIndex, 'steal');
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
      runAction('plant', { plotIndex: entry.plotIndex, seedType: currentSeed.code }, `plant:${entry.plotIndex}`);
      return;
    }
    if (entry.status === 'READY' && viewDashboard.owner.isSelf) {
      runAction('harvest', { plotIndex: entry.plotIndex }, `harvest:${entry.plotIndex}`);
      return;
    }
    if (entry.status === 'READY' && !viewDashboard.owner.isSelf && entry.plot?.canSteal) {
      runAction('steal', { targetDiscordId: viewDashboard.owner.discordUserId, plotIndex: entry.plotIndex }, `steal:${entry.plotIndex}`);
    }
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
      `}</style>

      <div className="mx-auto max-w-[1540px] px-3 py-3 sm:px-4 lg:px-6 lg:py-4">
        <section className="relative min-h-[calc(100vh-2rem)] overflow-hidden rounded-[42px] border border-[#e4ca8f]/60 bg-[linear-gradient(180deg,_#dff2ff_0%,_#d2e9ff_18%,_#86b46b_46%,_#71874f_100%)] shadow-[0_28px_80px_rgba(48,28,9,0.24)]">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-[42%] bg-[radial-gradient(circle_at_50%_10%,_rgba(255,251,229,0.92),_rgba(255,251,229,0.15)_45%,_transparent_60%)]" />
          <div className="pointer-events-none absolute inset-x-[7%] top-[20%] h-[9%] rounded-[50%] border border-[#e8d3a5]/25 bg-[linear-gradient(90deg,_rgba(194,160,98,0.18),_rgba(126,92,36,0.24),_rgba(194,160,98,0.18))]" />
          <div className="pointer-events-none absolute inset-x-[12%] top-[43%] h-[10%] rounded-[50%] border border-[#e8d3a5]/25 bg-[linear-gradient(90deg,_rgba(194,160,98,0.18),_rgba(126,92,36,0.24),_rgba(194,160,98,0.18))]" />
          <div className="pointer-events-none absolute inset-x-[17%] top-[66%] h-[10%] rounded-[50%] border border-[#e8d3a5]/22 bg-[linear-gradient(90deg,_rgba(194,160,98,0.16),_rgba(126,92,36,0.22),_rgba(194,160,98,0.16))]" />
          <div className="pointer-events-none absolute inset-x-[8%] bottom-[9%] h-[30%] rounded-[50%] bg-[radial-gradient(circle,_rgba(77,118,42,0.72),_rgba(76,104,43,0.12)_68%,_transparent_74%)]" />
          <div className="pointer-events-none absolute inset-x-[16%] bottom-[13%] h-[26%] rounded-[50%] border border-white/10 bg-[radial-gradient(circle,_rgba(171,198,116,0.38),_rgba(171,198,116,0.08)_65%,_transparent_72%)] blur-sm" />
          <div className="pointer-events-none absolute left-[11%] top-[24%] h-[54%] w-[74%] rotate-[-6deg] rounded-[48%] border border-white/8 bg-[repeating-linear-gradient(135deg,_rgba(255,255,255,0.06)_0px,_rgba(255,255,255,0.06)_1px,_transparent_1px,_transparent_28px)] opacity-60" />
          <div className="pointer-events-none absolute left-[9%] top-[18%] h-[58%] w-[78%] rounded-[48%] border border-[#6f8747]/20 bg-[radial-gradient(circle,_rgba(103,140,58,0.06),_transparent_70%)]" />
          <div className="pointer-events-none absolute right-[14%] top-[26%] h-[2px] w-[16%] bg-[linear-gradient(90deg,_transparent,_rgba(255,239,198,0.56),_transparent)]" />
          <div className="pointer-events-none absolute left-[16%] top-[53%] h-[2px] w-[22%] bg-[linear-gradient(90deg,_transparent,_rgba(255,239,198,0.46),_transparent)]" />
          <Image src="/farm/pond.svg" alt="pond" width={260} height={180} className="pointer-events-none absolute left-[5%] top-[18%] w-[20vw] min-w-[110px] max-w-[250px] opacity-85" />
          <Image src="/farm/tree.svg" alt="tree" width={170} height={220} className="pointer-events-none absolute left-[2%] bottom-[18%] w-[11vw] min-w-[90px] max-w-[150px] opacity-95" />
          <Image src="/farm/tree.svg" alt="tree" width={180} height={230} className="pointer-events-none absolute right-[8%] top-[17%] w-[11vw] min-w-[88px] max-w-[150px] scale-x-[-1] opacity-95" />
          <Image src="/farm/barn.svg" alt="barn" width={260} height={220} className="pointer-events-none absolute right-[5%] bottom-[16%] w-[18vw] min-w-[130px] max-w-[250px] opacity-95" />

          <div className="relative z-10 flex h-full min-h-[calc(100vh-2rem)] flex-col p-4 sm:p-5 lg:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="max-w-xl rounded-[28px] border border-white/22 bg-[linear-gradient(180deg,_rgba(52,28,7,0.38),_rgba(40,22,6,0.24))] px-5 py-4 text-[#fff6df] shadow-[0_14px_30px_rgba(0,0,0,0.14)] backdrop-blur-sm">
                <p className="text-[11px] uppercase tracking-[0.44em] text-[#f7d58c]">Koi Manor</p>
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <h1 className="text-3xl font-semibold tracking-[0.1em] sm:text-4xl">锦鲤庄园</h1>
                  <span className="rounded-full border border-white/22 bg-white/12 px-3 py-1 text-xs tracking-[0.22em] text-[#ffe6af]">{isVisiting ? `拜访 ${viewDashboard.owner.displayName}` : '我的庄园'}</span>
                </div>
                <p className="mt-3 text-sm leading-7 text-[#fff0cb]/90">主视图只保留农场场景、地块、作物和操作。种子袋、兑换所、拜访和日志全部收进抽屉。</p>
                <div className="mt-4 flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.26em] text-[#ffe4a8]">
                  <span className="rounded-full border border-white/20 bg-white/12 px-3 py-2">1 余额 = 100 金币</span>
                  <span className="rounded-full border border-white/20 bg-white/12 px-3 py-2">1 积分 = 10 金币</span>
                  <span className="rounded-full border border-white/20 bg-white/12 px-3 py-2">100 金币 = 1 积分</span>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                <MetricChip label="等级" value={`Lv.${homeDashboard.summary.level}`} />
                <MetricChip label="金币" value={formatAmount(homeDashboard.summary.coins)} />
                <MetricChip label="积分" value={formatAmount(homeDashboard.summary.loyaltyPoints)} />
                <MetricChip label="余额" value={`¥ ${formatAmount(homeDashboard.summary.totalBalance)}`} />
                <MetricChip label="地块" value={`${viewDashboard.summary.unlockedPlots}/${MAX_PLOTS}`} />
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <div className="flex-1 rounded-full border border-white/22 bg-[linear-gradient(180deg,_rgba(255,247,228,0.18),_rgba(56,30,9,0.22))] px-4 py-3 text-[#fff4d4] backdrop-blur-sm">
                <div className="flex items-center justify-between gap-3 text-xs uppercase tracking-[0.24em] text-[#f5d388]">
                  <span>升级进度</span>
                  <span>{homeDashboard.summary.nextLevelExperience ? `${homeDashboard.summary.experience}/${homeDashboard.summary.nextLevelExperience}` : 'MAX'}</span>
                </div>
                <div className="mt-2 h-3 overflow-hidden rounded-full bg-black/18"><div className="h-full rounded-full bg-[linear-gradient(90deg,_#b67510,_#eabf4d,_#ffe8b6)] transition-all duration-500" style={{ width: `${nextLevelProgress}%` }} /></div>
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

            <div className="relative mt-4 flex-1 overflow-hidden rounded-[38px] border border-white/22 bg-[linear-gradient(180deg,_rgba(210,231,255,0.22),_rgba(65,90,28,0.1))] shadow-[inset_0_1px_0_rgba(255,255,255,0.22)]">
              <div className="absolute left-4 top-4 z-20 rounded-[22px] border border-white/20 bg-[linear-gradient(180deg,_rgba(56,31,9,0.74),_rgba(35,18,5,0.62))] px-4 py-3 text-xs tracking-[0.18em] text-[#fbe5b0] backdrop-blur-sm">{currentSeed ? `已选种子 · ${currentSeed.name}` : '点击下方图标先选种子'}</div>
              <div className="absolute right-4 top-4 z-20 flex flex-col gap-2 lg:hidden">
                {(Object.keys(drawerMeta) as Array<Exclude<DrawerKey, 'none'>>).map((key) => <ToolButton key={key} icon={drawerMeta[key].icon} label={drawerMeta[key].label} active={activeDrawer === key} onClick={() => setActiveDrawer((current) => (current === key ? 'none' : key))} />)}
              </div>
              <div className="absolute right-5 top-5 z-20 hidden flex-col gap-3 lg:flex">
                {(Object.keys(drawerMeta) as Array<Exclude<DrawerKey, 'none'>>).map((key) => <ToolButton key={key} icon={drawerMeta[key].icon} label={drawerMeta[key].label} active={activeDrawer === key} onClick={() => setActiveDrawer((current) => (current === key ? 'none' : key))} />)}
              </div>

              <div className="absolute inset-x-0 top-[12%] bottom-[16%]">
                {plotCards.map((entry) => {
                  const scene = plotScenePositions[entry.plotIndex];
                  const preview = getPlotAsset(entry);
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
                          className={`relative flex h-[122px] w-[142px] items-end justify-center rounded-[34px] border px-3 pb-3 transition duration-200 sm:h-[136px] sm:w-[156px] ${entry.highlight === 'ready' ? 'border-[#f5ce70]/80 bg-[linear-gradient(180deg,_rgba(169,122,39,0.96),_rgba(110,66,19,0.96))] shadow-[0_20px_30px_rgba(69,40,12,0.28)] hover:brightness-105' : entry.highlight === 'growing' ? 'border-[#d7ba7b]/55 bg-[linear-gradient(180deg,_rgba(154,108,42,0.94),_rgba(102,64,22,0.94))] shadow-[0_18px_28px_rgba(53,31,9,0.24)] hover:brightness-105' : entry.highlight === 'idle' ? 'border-[#d2b27a]/42 bg-[linear-gradient(180deg,_rgba(136,87,44,0.9),_rgba(91,56,23,0.92))] shadow-[0_18px_28px_rgba(53,31,9,0.18)] hover:brightness-105' : 'border-[#ccb487]/35 bg-[linear-gradient(180deg,_rgba(146,117,77,0.72),_rgba(88,65,40,0.8))] shadow-[0_18px_28px_rgba(53,31,9,0.16)] hover:brightness-105'}`}
                        >
                          <div className="pointer-events-none absolute inset-x-3 bottom-4 h-6 rounded-[50%] bg-[radial-gradient(circle,_rgba(73,48,16,0.55),_rgba(73,48,16,0.04)_72%)] blur-sm" />
                          <span className="absolute left-3 top-3 rounded-full border border-white/15 bg-black/14 px-2 py-1 text-[10px] uppercase tracking-[0.22em] text-[#ffe5ad]">{entry.plotIndex}</span>
                          {entry.status === 'READY' ? <span className="absolute right-3 top-3 rounded-full border border-[#ffe8b6]/45 bg-[linear-gradient(180deg,_rgba(255,227,153,0.96),_rgba(243,186,62,0.96))] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#684108]">READY</span> : null}
                          {entry.status === 'READY' && !viewDashboard.owner.isSelf && !entry.plot?.canSteal ? <span className="absolute left-1/2 top-3 -translate-x-1/2 rounded-full border border-[#ffd9b3]/35 bg-[linear-gradient(180deg,_rgba(131,63,23,0.95),_rgba(89,38,12,0.95))] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#ffe6c9]">已偷</span> : null}
                          <div className="relative flex h-[92px] w-[92px] items-end justify-center sm:h-[104px] sm:w-[104px]">
                            {entry.status === 'READY' ? <div className={`absolute inset-1 rounded-full ${viewDashboard.owner.isSelf ? 'bg-[radial-gradient(circle,_rgba(255,224,138,0.56),_rgba(255,224,138,0.06)_70%)]' : 'bg-[radial-gradient(circle,_rgba(255,174,120,0.42),_rgba(255,174,120,0.05)_70%)]'} animate-pulse`} /> : null}
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
                      ) : (
                        <div className="relative h-32 w-32">
                          <div className="absolute left-1/2 top-1/2 h-2 w-20 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[linear-gradient(90deg,_rgba(255,220,180,0.1),_rgba(255,220,180,0.95),_rgba(255,220,180,0.1))]" style={{ animation: 'farmStealBurst 0.9s ease-out forwards' }} />
                          <div className="absolute left-1/2 top-1/2 h-2 w-20 rounded-full bg-[linear-gradient(90deg,_rgba(255,171,112,0.1),_rgba(255,171,112,0.95),_rgba(255,171,112,0.1))]" style={{ animation: 'farmStealBurst 0.9s ease-out 0.08s forwards', transform: 'translate(-50%, -50%) rotate(-40deg)' }} />
                          <span className="absolute left-1/2 top-[18%] -translate-x-1/2 text-2xl text-[#ffd3b0]" style={{ animation: 'farmSpark 0.9s ease-out forwards' }}>✦</span>
                        </div>
                      )}
                    </div>
                  );
                })}
                <div className="pointer-events-none absolute inset-x-[16%] bottom-[4%] z-0 hidden h-[16%] rounded-[50%] border border-white/10 bg-[radial-gradient(circle,_rgba(248,228,161,0.18),_rgba(248,228,161,0.02)_72%,_transparent_76%)] lg:block" />
              </div>

              <div className="absolute inset-x-4 bottom-4 z-20 flex items-center justify-center">
                <div className="w-full max-w-3xl rounded-[28px] border border-white/22 bg-[linear-gradient(180deg,_rgba(57,31,9,0.74),_rgba(33,17,5,0.72))] px-4 py-3 shadow-[0_18px_36px_rgba(14,8,3,0.22)] backdrop-blur-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div className="hidden text-xs uppercase tracking-[0.34em] text-[#f4d38a] sm:block">种子栏</div>
                    <div className="flex flex-1 items-center justify-center gap-2 sm:gap-3">
                      {homeDashboard.seeds.map((seed) => {
                        const selected = seed.code === selectedSeed;
                        return (
                          <button key={seed.code} type="button" disabled={!seed.unlocked} title={seed.name} aria-label={seed.name} onClick={() => setSelectedSeed(seed.code)} className={`group relative flex h-16 w-16 items-center justify-center rounded-[22px] border transition sm:h-[72px] sm:w-[72px] ${selected ? 'border-[#f6cf77]/80 bg-[linear-gradient(180deg,_rgba(255,239,192,0.95),_rgba(235,190,79,0.95))] shadow-[0_16px_26px_rgba(53,30,9,0.22)]' : seed.unlocked ? 'border-white/20 bg-white/10 hover:border-[#f2cb74]/55 hover:bg-white/16' : 'border-dashed border-white/10 bg-black/12 opacity-45'}`}>
                            <div className="relative h-11 w-11 sm:h-12 sm:w-12"><Image src={cropStageAssetMap[seed.code].READY} alt={seed.name} fill className="object-contain" /></div>
                            {!seed.unlocked ? <span className="absolute inset-0 flex items-center justify-center rounded-[22px] bg-black/24 text-xs font-semibold text-[#ffe2a5]">Lv.{seed.unlockLevel}</span> : null}
                            {selected ? <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-[#fff2ae] shadow-[0_0_12px_rgba(255,242,174,0.9)]" /> : null}
                            <span className="pointer-events-none absolute bottom-[calc(100%+12px)] left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded-full border border-[#e4ca8f]/35 bg-[#2a1606]/94 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-[#ffe4a5] lg:group-hover:block">{seed.name}</span>
                          </button>
                        );
                      })}
                    </div>
                    <button type="button" onClick={() => setActiveDrawer('seeds')} className="rounded-full border border-[#e4ca8f]/35 bg-white/12 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-[#ffe3a5] transition hover:bg-white/18">打开种子袋</button>
                  </div>
                </div>
              </div>

              <div className="pointer-events-none absolute inset-0 z-30">
                {floatingRewards.map((item) => <div key={item.id} className={`absolute left-1/2 top-[45%] text-center text-lg font-semibold tracking-[0.08em] ${item.variant === 'gold' ? 'text-[#fff0a1]' : 'text-[#ffd9ae]'}`} style={{ animation: 'farmFloatUp 1.6s ease forwards' }}>{item.text}</div>)}
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
                  <div className="relative h-20 w-20 shrink-0"><Image src={cropStageAssetMap[currentSeed.code].READY} alt={currentSeed.name} fill className="object-contain" /></div>
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
            <div className="space-y-3">
              {homeDashboard.seeds.map((seed) => {
                const selected = seed.code === selectedSeed;
                return (
                  <button key={seed.code} type="button" disabled={!seed.unlocked} onClick={() => setSelectedSeed(seed.code)} className={`w-full rounded-[24px] border p-4 text-left transition ${selected ? 'border-[#d39916] bg-[linear-gradient(145deg,_#fff3c7,_#ffe19a)] shadow-[0_16px_32px_rgba(211,153,22,0.12)]' : seed.unlocked ? 'border-[#d7bc83]/35 bg-white/72 hover:border-[#d39916]/50 hover:bg-[#fff8e7]' : 'border-dashed border-[#cbb68d]/35 bg-[#efe8d7] text-[#9d8e71]'}`}>
                    <div className="flex items-start gap-4">
                      <div className="relative h-14 w-14 shrink-0"><Image src={cropStageAssetMap[seed.code].READY} alt={seed.name} fill className="object-contain" /></div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-lg font-semibold tracking-[0.04em]">{seed.name}</p>
                          <span className="rounded-full border border-[#d2ad54]/40 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-[#8f6806]">Lv.{seed.unlockLevel}</span>
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

        {activeDrawer === 'visit' ? (
          <div className="space-y-4">
            <div className="rounded-[24px] border border-[#d7bc83]/35 bg-white/72 p-4">
              <p className="text-base font-semibold tracking-[0.04em] text-[#38240d]">搜索别人的庄园</p>
              <p className="mt-1 text-sm text-[#7b6131]">输入陪玩 ID、Discord ID 或展示名，找到后直接切到对方庄园。</p>
              <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                <input value={farmSearch} onChange={(event) => setFarmSearch(event.target.value)} className="flex-1 rounded-full border border-[#d9bf88]/40 bg-[#fffdf7] px-4 py-3 text-sm text-[#38240d] outline-none transition focus:border-[#c98b12]" placeholder="搜索陪玩 ID / Discord ID / 名字" />
                {isVisiting ? <button type="button" disabled={loadingKey === 'visit-home'} onClick={() => loadTargetFarm()} className="rounded-full border border-[#d7bc83]/40 bg-white/70 px-5 py-3 text-sm font-semibold tracking-[0.12em] text-[#825f1a] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50">{loadingKey === 'visit-home' ? '返回中…' : '回到我的庄园'}</button> : null}
              </div>
            </div>
            <div className="space-y-3">
              {searching ? <p className="text-sm text-[#7b6131]">搜索中…</p> : null}
              {!searching && farmSearch.trim() && searchResults.length === 0 ? <p className="rounded-2xl border border-dashed border-[#d7bc83]/40 bg-[#fff8e8] p-4 text-sm text-[#816032]">没有找到可访问的庄园。</p> : null}
              {searchResults.map((result) => (
                <button key={result.id} type="button" disabled={loadingKey === 'visit-farm'} onClick={() => loadTargetFarm(result.discordUserId)} className="flex w-full items-center justify-between rounded-[22px] border border-[#d8bf87]/35 bg-[linear-gradient(180deg,_rgba(255,252,245,0.94),_rgba(249,239,214,0.94))] px-4 py-4 text-left transition hover:border-[#d39a24]/50 hover:bg-[#fff8e8]">
                  <div><p className="text-base font-semibold tracking-[0.04em] text-[#35210a]">{result.serverDisplayName}</p><p className="mt-1 text-xs text-[#8b6a2c]">{result.discordUserId}</p></div>
                  <span className="rounded-full border border-[#d2ad54]/40 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-[#8f6806]">拜访</span>
                </button>
              ))}
            </div>
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

      {activePlot ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#1d0f03]/58 px-3 py-6" onClick={() => setActivePlotIndex(null)}>
          <div className="relative w-full max-w-[760px] rounded-[34px] border border-[#e4ca8f]/55 bg-[linear-gradient(180deg,_rgba(255,249,232,0.98),_rgba(246,229,188,0.98))] shadow-[0_28px_70px_rgba(25,14,4,0.3)]" onClick={(event) => event.stopPropagation()}>
            <button type="button" onClick={() => setActivePlotIndex(null)} className="absolute right-4 top-4 z-10 flex h-11 w-11 items-center justify-center rounded-full border border-[#d8bc83]/45 bg-white/55 text-xl text-[#734d17] transition hover:bg-white/75">×</button>
            <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[0.9fr_1.1fr]">
              <div className={`relative overflow-hidden rounded-[30px] border p-5 ${activePlot.highlight === 'ready' ? 'border-[#efc861]/65 bg-[linear-gradient(180deg,_rgba(255,241,190,0.96),_rgba(224,179,70,0.94))]' : activePlot.highlight === 'growing' ? 'border-[#d4b06b]/55 bg-[linear-gradient(180deg,_rgba(255,244,215,0.96),_rgba(232,205,138,0.94))]' : activePlot.highlight === 'idle' ? 'border-[#d4b06b]/42 bg-[linear-gradient(180deg,_rgba(255,250,237,0.96),_rgba(245,231,194,0.94))]' : 'border-[#cdb486]/36 bg-[linear-gradient(180deg,_rgba(234,223,197,0.96),_rgba(208,188,145,0.94))]'}`}>
                <div className="absolute inset-x-10 bottom-5 h-8 rounded-[50%] bg-[radial-gradient(circle,_rgba(75,48,14,0.36),_rgba(75,48,14,0.05)_72%)] blur-sm" />
                <div className="relative flex h-full min-h-[300px] flex-col items-center justify-center text-center">
                  <div className="rounded-full border border-white/35 bg-white/18 px-3 py-1 text-xs uppercase tracking-[0.28em] text-[#8d6509]">地块 {activePlot.plotIndex}</div>
                  <div className="relative mt-5 flex h-56 w-56 items-center justify-center"><Image src={getPlotAsset(activePlot).asset} alt={activePlot.title} fill className={`object-contain ${getPlotAsset(activePlot).className}`} /></div>
                  <div className="mt-4 rounded-full border border-white/38 bg-white/24 px-4 py-2 text-sm font-semibold tracking-[0.16em] text-[#5f3b0d]">{activePlot.status === 'READY' ? '成熟完成' : activePlot.status === 'GROWING' && activePlot.plot ? stageLabelMap[activePlot.plot.growthStage] : activePlot.status === 'EMPTY' ? '等待播种' : '待解锁'}</div>
                </div>
              </div>
              <div className="flex flex-col justify-between gap-5">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.34em] text-[#a17615]">Plot Detail</p>
                  <h2 className="mt-2 text-3xl font-semibold tracking-[0.05em] text-[#38230b]">{activePlot.title}</h2>
                  <p className="mt-3 text-sm leading-7 text-[#6d5122]">{activePlot.subtitle}</p>
                  <div className="mt-5 space-y-2 rounded-[26px] border border-[#d7bc83]/35 bg-white/62 p-4 text-sm text-[#6b4f21]">
                    {activePlot.tooltipLines.map((line) => <p key={line}>{line}</p>)}
                    {activePlot.plot?.status === 'GROWING' ? (<div className="pt-2"><div className="h-2 overflow-hidden rounded-full bg-[#ebdfbe]"><div className="h-full rounded-full bg-[linear-gradient(90deg,_#c98b13,_#f0bd40)]" style={{ width: `${Math.round((activePlot.plot.progressRatio ?? 0) * 100)}%` }} /></div><p className="mt-2 text-xs text-[#8b6a2c]">成长进度 {Math.round((activePlot.plot.progressRatio ?? 0) * 100)}%</p></div>) : null}
                    {activePlot.plot?.status === 'READY' && activePlot.plot.stolenCoins !== '0.00' ? <p>本轮已被偷：{formatAmount(activePlot.plot.stolenCoins)} 金币</p> : null}
                  </div>
                  {activePlot.seedMeta ? (
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-2xl border border-[#d7bc83]/30 bg-white/58 p-4 text-sm text-[#6a4c1d]"><p className="text-xs uppercase tracking-[0.24em] text-[#9d7518]">成熟时间</p><p className="mt-2 text-lg font-semibold text-[#34210b]">{getFarmSeedDurationLabel(activePlot.seedMeta.durationMinutes)}</p></div>
                      <div className="rounded-2xl border border-[#d7bc83]/30 bg-white/58 p-4 text-sm text-[#6a4c1d]"><p className="text-xs uppercase tracking-[0.24em] text-[#9d7518]">收益区间</p><p className="mt-2 text-lg font-semibold text-[#34210b]">{formatAmount(activePlot.seedMeta.minYieldCoins)} ~ {formatAmount(activePlot.seedMeta.maxYieldCoins)}</p></div>
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
    </div>
  );
}
