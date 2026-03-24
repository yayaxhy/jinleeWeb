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
type FarmSearchResult = { id: number; discordUserId: string; serverDisplayName: string };
type FloatingReward = { id: number; text: string; variant: 'gold' | 'steal' };

type PlotCard = {
  plotIndex: number;
  unlocked: boolean;
  plot: FarmDashboard['plots'][number] | null;
  status: PlotStatus;
  cropVisual: { cropAsset: string; sproutAsset: string } | null;
  seedMeta: FarmDashboard['seeds'][number] | null;
  statusLabel: string;
  soilClass: string;
  panelClass: string;
  sceneBaseClass: string;
  title: string;
  summaryLines: string[];
};

const plotScenePositions: Record<number, { left: string; top: string; depth: number }> = {
  1: { left: '12%', top: '18%', depth: 1 },
  2: { left: '35%', top: '10%', depth: 2 },
  3: { left: '59%', top: '18%', depth: 1 },
  4: { left: '24%', top: '38%', depth: 3 },
  5: { left: '47%', top: '30%', depth: 4 },
  6: { left: '71%', top: '38%', depth: 3 },
  7: { left: '36%', top: '58%', depth: 5 },
  8: { left: '60%', top: '50%', depth: 4 },
};

const cropVisualMap: Partial<Record<FarmSeedTypeValue, { cropAsset: string; sproutAsset: string }>> = {
  WHEAT: { cropAsset: '/farm/crop-wheat.svg', sproutAsset: '/farm/sprout-generic.svg' },
  ROSE: { cropAsset: '/farm/crop-rose.svg', sproutAsset: '/farm/sprout-generic.svg' },
  KOI_FLOWER: { cropAsset: '/farm/crop-koi-flower.svg', sproutAsset: '/farm/sprout-generic.svg' },
  MYSTERY_FRUIT: { cropAsset: '/farm/crop-mystery-fruit.svg', sproutAsset: '/farm/sprout-generic.svg' },
};

function SectionCard({
  eyebrow,
  title,
  children,
  className = '',
}: {
  eyebrow: string;
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-[28px] border border-[#d6bc83]/40 bg-[linear-gradient(180deg,_rgba(255,251,240,0.94),_rgba(252,242,214,0.9))] p-5 shadow-[0_22px_45px_rgba(73,50,18,0.08)] ${className}`}>
      <p className="text-[11px] uppercase tracking-[0.42em] text-[#9b7413]">{eyebrow}</p>
      <h2 className="mt-2 text-2xl font-semibold tracking-[0.06em] text-[#3e2a12]">{title}</h2>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function getPlotPreview(entry: PlotCard) {
  if (!entry.unlocked) return { asset: '/farm/locked-plot.svg', className: 'drop-shadow-[0_12px_18px_rgba(0,0,0,0.14)]' };
  if (entry.status === 'EMPTY') return { asset: '/farm/sprout-generic.svg', className: 'opacity-50 saturate-75 scale-90' };
  if (!entry.cropVisual || !entry.plot) return { asset: '/farm/sprout-generic.svg', className: 'opacity-80' };
  if (entry.plot.growthStage === 'SPROUT') return { asset: entry.cropVisual.sproutAsset, className: 'scale-[0.64] opacity-85 saturate-75' };
  if (entry.plot.growthStage === 'YOUNG') return { asset: entry.cropVisual.cropAsset, className: 'scale-[0.72] opacity-90 saturate-90 brightness-95' };
  if (entry.plot.growthStage === 'MATURE') return { asset: entry.cropVisual.cropAsset, className: 'scale-[0.88] drop-shadow-[0_8px_12px_rgba(0,0,0,0.12)]' };
  return { asset: entry.cropVisual.cropAsset, className: 'scale-100 drop-shadow-[0_14px_18px_rgba(0,0,0,0.16)]' };
}

export function FarmClient({ initialDashboard }: Props) {
  const [homeDashboard, setHomeDashboard] = useState(initialDashboard);
  const [viewDashboard, setViewDashboard] = useState(initialDashboard);
  const [selectedPlotIndex, setSelectedPlotIndex] = useState(1);
  const [selectedSeed, setSelectedSeed] = useState<FarmSeedTypeValue | null>(initialDashboard.seeds.find((seed) => seed.unlocked)?.code ?? null);
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

  const isVisiting = viewDashboard.owner.discordUserId !== homeDashboard.owner.discordUserId;
  const currentSeed = homeDashboard.seeds.find((seed) => seed.code === selectedSeed) ?? null;

  useEffect(() => {
    if (selectedSeed && homeDashboard.seeds.some((seed) => seed.code === selectedSeed && seed.unlocked)) return;
    setSelectedSeed(homeDashboard.seeds.find((seed) => seed.unlocked)?.code ?? null);
  }, [homeDashboard.seeds, selectedSeed]);

  useEffect(() => {
    const maxIndex = Math.min(MAX_PLOTS, Math.max(1, viewDashboard.summary.unlockedPlots));
    if (selectedPlotIndex > maxIndex) setSelectedPlotIndex(1);
  }, [selectedPlotIndex, viewDashboard.summary.unlockedPlots]);

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
      const cropVisual = plot?.seedType ? cropVisualMap[plot.seedType] ?? null : null;
      const seedMeta = plot?.seedType ? viewDashboard.seeds.find((seed) => seed.code === plot.seedType) ?? null : null;
      const statusLabel = status === 'LOCKED' ? '待解锁' : status === 'EMPTY' ? '空地' : status === 'GROWING' ? '生长中' : '可收获';
      const soilClass = status === 'LOCKED' ? 'bg-[linear-gradient(180deg,_#b9a47b,_#927047)] opacity-60' : status === 'EMPTY' ? 'bg-[linear-gradient(180deg,_#8f6237,_#5e3818)]' : status === 'GROWING' ? 'bg-[linear-gradient(180deg,_#94683d,_#613916)]' : 'bg-[linear-gradient(180deg,_#9c6c3e,_#6b3f17)]';
      const panelClass = status === 'LOCKED' ? 'border-dashed border-[#cdb27b]/45 bg-[linear-gradient(180deg,_rgba(245,235,212,0.95),_rgba(227,211,180,0.95))]' : status === 'EMPTY' ? 'border-[#d9bf8d]/45 bg-[linear-gradient(180deg,_rgba(255,252,244,0.96),_rgba(248,236,204,0.95))]' : status === 'GROWING' ? 'border-[#d0b777]/55 bg-[linear-gradient(180deg,_rgba(255,249,225,0.98),_rgba(240,225,176,0.96))]' : 'border-[#f0bf36]/70 bg-[linear-gradient(180deg,_rgba(255,248,215,1),_rgba(255,228,141,0.98))]';
      const sceneBaseClass = status === 'LOCKED' ? 'border-[#c7b08a]/35 bg-[linear-gradient(180deg,_#c9bb94,_#a38857)]' : status === 'EMPTY' ? 'border-[#a06b37]/45 bg-[linear-gradient(180deg,_#9f764b,_#6c451e)]' : status === 'GROWING' ? 'border-[#8a6a2c]/45 bg-[linear-gradient(180deg,_#a17b43,_#6a481a)]' : 'border-[#d7a728]/55 bg-[linear-gradient(180deg,_#cb9740,_#83531b)]';
      const title = !unlocked ? '待解锁地块' : seedMeta?.name ?? '空地';
      const summaryLines = !unlocked ? ['解锁更多地块后，这里会加入新的作物位置。'] : status === 'EMPTY' ? (isVisiting ? ['这块地当前空着，没有可以偷的作物。'] : [`当前已选种子：${currentSeed?.name ?? '未选择'}`, '选好右侧种子后，就能直接播种在这里。']) : status === 'GROWING' ? [`成熟倒计时：${formatRemaining(plot?.remainingSeconds ?? 0)}`, `成长进度：${Math.round((plot?.progressRatio ?? 0) * 100)}%`] : (isVisiting ? [plot?.canSteal ? '这块地已成熟，可以直接偷菜。' : '这块地已成熟，但这一轮已经被偷过。', plot?.stolenCoins && plot.stolenCoins !== '0.00' ? `本轮已被偷：${formatAmount(plot.stolenCoins)} 金币` : '这一轮还没有被偷。'] : ['作物已成熟，直接收获即可回收金币和经验。', `预计收获区间：${seedMeta ? `${formatAmount(seedMeta.minYieldCoins)} ~ ${formatAmount(seedMeta.maxYieldCoins)} 金币` : '—'}`]);
      return { plotIndex, unlocked, plot, status, cropVisual, seedMeta, statusLabel, soilClass, panelClass, sceneBaseClass, title, summaryLines };
    });
  }, [plotsByIndex, viewDashboard.seeds, isVisiting, currentSeed]);

  const selectedPlotEntry = plotCards.find((item) => item.plotIndex === selectedPlotIndex) ?? plotCards[0];
  const selectedPreview = getPlotPreview(selectedPlotEntry);
  const nextLevelProgress = homeDashboard.summary.nextLevelExperience && homeDashboard.summary.nextLevelExperience > 0 ? Math.min(100, (homeDashboard.summary.experience / homeDashboard.summary.nextLevelExperience) * 100) : 100;

  const pushFloatingReward = (text: string, variant: FloatingReward['variant']) => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setFloatingRewards((current) => [...current, { id, text, variant }]);
    window.setTimeout(() => setFloatingRewards((current) => current.filter((item) => item.id !== id)), 1600);
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
      setSelectedPlotIndex(1);
      if (!targetDiscordId) setHomeDashboard(dashboard);
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
        if (dashboard.owner.discordUserId === homeDashboard.owner.discordUserId && !data?.viewerDashboard) setHomeDashboard(dashboard);
      }
      if (action === 'harvest' && data?.result?.harvestCoins) pushFloatingReward(`+${formatAmount(data.result.harvestCoins)} 金币`, 'gold');
      if (action === 'steal' && data?.result?.stolenCoins) pushFloatingReward(`偷到 +${formatAmount(data.result.stolenCoins)} 金币`, 'steal');
      setMessage(typeof data?.message === 'string' ? data.message : '操作成功');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoadingKey(null);
    }
  };

  return (
    <div className="min-h-screen overflow-hidden bg-[linear-gradient(180deg,_#fff6df_0%,_#f4ead0_20%,_#dde2bb_55%,_#d6c58f_100%)] text-[#2f1d09]">
      <style jsx global>{`
        @keyframes farmFloatUp {
          0% { opacity: 0; transform: translate3d(-50%, 6px, 0) scale(0.92); }
          15% { opacity: 1; }
          100% { opacity: 0; transform: translate3d(-50%, -52px, 0) scale(1.05); }
        }
        @keyframes farmGlow {
          0%, 100% { filter: drop-shadow(0 0 0 rgba(255, 217, 109, 0.1)); }
          50% { filter: drop-shadow(0 0 14px rgba(255, 217, 109, 0.65)); }
        }
      `}</style>
      <div className="relative px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[340px] bg-[radial-gradient(circle_at_top,_rgba(255,248,217,0.92),_transparent_66%)]" />
        <div className="pointer-events-none absolute right-[6%] top-12 h-32 w-32 rounded-full bg-[radial-gradient(circle,_rgba(255,219,111,0.62),_rgba(255,219,111,0.08)_70%,_transparent_72%)] blur-sm" />
        <div className="pointer-events-none absolute left-[8%] top-16 h-14 w-36 rounded-full bg-white/45 blur-2xl" />
        <div className="relative mx-auto flex max-w-7xl flex-col gap-8">
          <section className="relative overflow-hidden rounded-[36px] border border-[#d9bf84]/60 bg-[linear-gradient(140deg,_rgba(255,251,237,0.96),_rgba(255,241,202,0.95)_45%,_rgba(255,226,159,0.92)_100%)] px-6 py-7 shadow-[0_32px_70px_rgba(93,67,25,0.13)] sm:px-8 lg:px-10 lg:py-9">
            <div className="pointer-events-none absolute inset-y-0 right-0 w-[34%] bg-[radial-gradient(circle_at_center,_rgba(178,120,22,0.1),_transparent_68%)]" />
            <div className="relative flex flex-col gap-8 xl:flex-row xl:items-end xl:justify-between">
              <div className="space-y-5">
                <p className="text-[11px] uppercase tracking-[0.52em] text-[#a07611]">Koi Manor</p>
                <div className="space-y-3">
                  <h1 className="text-4xl font-semibold tracking-[0.08em] text-[#38230b] sm:text-5xl">锦鲤庄园</h1>
                  <p className="max-w-3xl text-sm leading-7 text-[#6c5126] sm:text-base">总余额和积分都能换金币，种进去、收回来、再慢慢扩地。现在已经支持访问别人的庄园和偷成熟作物。</p>
                </div>
                <div className="flex flex-wrap gap-3 text-[11px] uppercase tracking-[0.3em] text-[#8f6806]">
                  <span className="rounded-full border border-[#ddb967]/50 bg-white/55 px-4 py-2">1 余额 = 100 金币</span>
                  <span className="rounded-full border border-[#ddb967]/50 bg-white/55 px-4 py-2">1 积分 = 10 金币</span>
                  <span className="rounded-full border border-[#ddb967]/50 bg-white/55 px-4 py-2">100 金币 = 1 积分</span>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:w-[380px]">
                <div className="rounded-[26px] border border-white/45 bg-white/55 p-4 backdrop-blur">
                  <p className="text-[11px] uppercase tracking-[0.35em] text-[#9a741d]">等级进度</p>
                  <p className="mt-3 text-3xl font-semibold tracking-[0.06em]">Lv.{homeDashboard.summary.level}</p>
                  <div className="mt-4 h-3 overflow-hidden rounded-full bg-white/60">
                    <div className="h-full rounded-full bg-[linear-gradient(90deg,_#b77511,_#f2c84f,_#ffe39f)] transition-all duration-500" style={{ width: `${nextLevelProgress}%` }} />
                  </div>
                  <p className="mt-2 text-xs text-[#755724]">{homeDashboard.summary.nextLevelExperience ? `${homeDashboard.summary.experience} / ${homeDashboard.summary.nextLevelExperience} 经验` : '已达到当前配置的最高等级'}</p>
                </div>
                <div className="rounded-[26px] border border-white/45 bg-[#42290f] p-4 text-[#fff5dc]">
                  <p className="text-[11px] uppercase tracking-[0.35em] text-[#f2cc79]">当前庄园</p>
                  <p className="mt-3 text-xl font-semibold tracking-[0.06em]">{isVisiting ? `拜访 ${viewDashboard.owner.displayName}` : '我的庄园'}</p>
                  <div className="mt-4 flex flex-wrap gap-2 text-xs text-[#f6deae]">
                    <span className="rounded-full border border-[#c89b45]/40 px-3 py-1">{isVisiting ? '访客模式' : '自主管理'}</span>
                    <span className="rounded-full border border-[#c89b45]/40 px-3 py-1">已解锁 {viewDashboard.summary.unlockedPlots} 块地</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="relative mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              {[
                { label: '我的庄园金币', value: `${formatAmount(homeDashboard.summary.coins)} 金币`, accent: 'bg-[linear-gradient(90deg,_#fff1ba,_#f0bb38)]' },
                { label: '我的庄园经验', value: homeDashboard.summary.experience.toString(), accent: 'bg-[linear-gradient(90deg,_#f6d19d,_#dc8b3d)]' },
                { label: '可用余额', value: `¥ ${formatAmount(homeDashboard.summary.totalBalance)}`, accent: 'bg-[linear-gradient(90deg,_#ffe6c1,_#d29c4d)]' },
                { label: '锦鲤积分', value: formatAmount(homeDashboard.summary.loyaltyPoints), accent: 'bg-[linear-gradient(90deg,_#fde5af,_#d8a62f)]' },
                { label: '下一块地', value: homeDashboard.summary.nextPlotCost ? `${formatAmount(homeDashboard.summary.nextPlotCost)} 金币` : '已满', accent: 'bg-[linear-gradient(90deg,_#fff5d8,_#e1be72)]' },
              ].map((item) => (
                <div key={item.label} className="relative overflow-hidden rounded-[28px] border border-white/55 bg-white/62 p-4 backdrop-blur">
                  <div className={`absolute inset-x-4 top-0 h-1 rounded-b-full ${item.accent}`} />
                  <p className="text-[11px] uppercase tracking-[0.35em] text-[#8f690d]">{item.label}</p>
                  <p className="mt-3 text-xl font-semibold tracking-[0.05em] text-[#34210c]">{item.value}</p>
                </div>
              ))}
            </div>
            {(message || error) && (
              <div className={`mt-6 rounded-2xl border px-4 py-3 text-sm ${error ? 'border-rose-200 bg-rose-50/90 text-rose-700' : 'border-emerald-200 bg-emerald-50/90 text-emerald-700'}`}>
                {error ?? message}
              </div>
            )}
          </section>

          <div className="grid gap-8 xl:grid-cols-[1.45fr_0.95fr]">
            <SectionCard eyebrow="Garden" title={isVisiting ? `${viewDashboard.owner.displayName} 的庄园` : '庄园场景'} className="overflow-hidden">
              <div className="space-y-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <p className="text-sm text-[#6d5122]">支持搜索陪玩 ID / Discord ID / 名字访问别人的庄园。成熟作物每轮只允许偷一次。</p>
                  <div className="flex flex-wrap gap-2">
                    {isVisiting ? (
                      <button
                        type="button"
                        onClick={() => loadTargetFarm()}
                        disabled={loadingKey === 'visit-home'}
                        className="rounded-full border border-[#d6bc83]/50 bg-white/75 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-[#835d11] transition hover:bg-[#fff8e7] disabled:opacity-50"
                      >
                        {loadingKey === 'visit-home' ? '返回中…' : '回到我的庄园'}
                      </button>
                    ) : null}
                    <Link href="/profile" className="inline-flex items-center rounded-full border border-[#d6bc83]/50 bg-white/75 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-[#835d11] transition hover:bg-[#fff8e7]">
                      返回个人主页
                    </Link>
                  </div>
                </div>

                <div className="rounded-[26px] border border-[#d7bc83]/35 bg-white/68 p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                    <input
                      value={farmSearch}
                      onChange={(event) => setFarmSearch(event.target.value)}
                      className="flex-1 rounded-full border border-[#d9bf88]/40 bg-[#fffdf7] px-4 py-3 text-sm text-[#38240d] outline-none transition focus:border-[#c98b12]"
                      placeholder="搜索陪玩ID / Discord ID / 名字，访问庄园"
                    />
                    {searching ? <span className="text-sm text-[#8e6812]">搜索中…</span> : null}
                  </div>
                  {farmSearch.trim() && searchResults.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {searchResults.map((item) => (
                        <button
                          key={item.discordUserId}
                          type="button"
                          onClick={() => loadTargetFarm(item.discordUserId)}
                          className="rounded-full border border-[#d7bc83]/35 bg-[linear-gradient(145deg,_#fff6da,_#ffe6aa)] px-4 py-2 text-sm text-[#7f5a14] transition hover:brightness-105"
                        >
                          {item.serverDisplayName} · {item.id}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>

                <div className="relative overflow-hidden rounded-[28px] border border-[#d4bf90]/45 bg-[linear-gradient(180deg,_rgba(209,229,176,0.92)_0%,_rgba(182,213,135,0.96)_30%,_rgba(148,187,100,0.98)_100%)] p-4 sm:p-5 lg:p-6">
                  <div className="pointer-events-none absolute left-6 top-5 h-16 w-40 rounded-full bg-white/35 blur-2xl" />
                  <div className="pointer-events-none absolute right-10 top-7 h-20 w-20 rounded-full bg-[radial-gradient(circle,_rgba(255,244,185,0.55),_transparent_70%)]" />
                  <div className="pointer-events-none absolute bottom-[-48px] left-[-18px] h-48 w-48 rounded-full bg-[radial-gradient(circle,_rgba(75,129,117,0.28),_rgba(75,129,117,0))]" />
                  <div className="pointer-events-none absolute left-6 top-6 flex items-center gap-4 rounded-full border border-white/35 bg-white/25 px-4 py-2 text-[11px] uppercase tracking-[0.32em] text-[#4f5620] backdrop-blur">
                    <span>暖田</span>
                    <span>金币成长</span>
                    <span>{isVisiting ? '可偷菜' : '可扩地'}</span>
                  </div>
                  <div className="pointer-events-none absolute bottom-4 left-4 h-24 w-24">
                    <Image src="/farm/pond.svg" alt="pond" fill className="object-contain" />
                  </div>
                  <div className="pointer-events-none absolute right-2 top-16 h-24 w-24 sm:h-28 sm:w-28">
                    <Image src="/farm/tree.svg" alt="tree" fill className="object-contain" />
                  </div>
                  <div className="pointer-events-none absolute bottom-8 right-8 h-28 w-28 sm:h-32 sm:w-32">
                    <Image src="/farm/barn.svg" alt="barn" fill className="object-contain" />
                  </div>
                  <div className="pointer-events-none absolute bottom-14 right-8 rounded-full border border-[#d7bf84]/45 bg-[#fff7dd]/80 px-4 py-2 text-xs text-[#7a5d25]">
                    当前已解锁 {viewDashboard.summary.unlockedPlots} 块地
                  </div>

                  <div className="relative mt-16 hidden xl:block">
                    <div className="relative h-[720px] overflow-hidden rounded-[30px] border border-white/35 bg-[linear-gradient(180deg,_rgba(180,216,132,0.12),_rgba(83,126,54,0.08))]">
                      <div className="pointer-events-none absolute left-[10%] top-[14%] h-24 w-24 rounded-full bg-white/20 blur-3xl" />
                      <div className="pointer-events-none absolute right-[14%] top-[20%] h-28 w-28 rounded-full bg-[radial-gradient(circle,_rgba(255,241,188,0.4),_transparent_72%)]" />
                      <div className="pointer-events-none absolute bottom-8 left-[12%] h-20 w-[76%] rounded-[999px] bg-[linear-gradient(90deg,_rgba(111,83,34,0.08),_rgba(111,83,34,0.18),_rgba(111,83,34,0.08))] blur-xl" />

                      {floatingRewards.map((reward, index) => (
                        <div
                          key={reward.id}
                          className={`pointer-events-none absolute left-1/2 top-[18%] z-[220] rounded-full px-5 py-2 text-sm font-semibold tracking-[0.08em] text-white ${reward.variant === 'gold' ? 'bg-[linear-gradient(90deg,_#c98b13,_#f0bd40)]' : 'bg-[linear-gradient(90deg,_#7f4f12,_#bd6d1a)]'}`}
                          style={{ transform: `translateX(-50%) translateY(${index * 12}px)`, animation: 'farmFloatUp 1.6s ease-out forwards' }}
                        >
                          {reward.text}
                        </div>
                      ))}

                      {plotCards.map((entry) => {
                        const position = plotScenePositions[entry.plotIndex]
                        const preview = getPlotPreview(entry)
                        const isSelected = entry.plotIndex === selectedPlotIndex
                        const shouldGlow = entry.status === 'READY'

                        return (
                          <button
                            key={entry.plotIndex}
                            type="button"
                            onClick={() => setSelectedPlotIndex(entry.plotIndex)}
                            className="absolute h-[214px] w-[214px] -translate-x-1/2 -translate-y-1/2 text-left transition duration-300 hover:scale-[1.03]"
                            style={{ left: position.left, top: position.top, zIndex: isSelected ? 120 + position.depth : position.depth * 10 }}
                          >
                            <div className="pointer-events-none absolute inset-x-9 bottom-8 h-8 rounded-full bg-black/20 blur-lg" />
                            <div className={`pointer-events-none absolute inset-x-6 bottom-8 h-[108px] rounded-[34px] border shadow-[0_16px_28px_rgba(45,28,8,0.18)] [transform:perspective(900px)_rotateX(64deg)_rotateZ(45deg)] ${entry.sceneBaseClass} ${isSelected ? 'ring-4 ring-[#ffe094]/55' : ''}`} />
                            <div className="pointer-events-none absolute inset-x-12 bottom-[36px] h-[14px] rounded-b-[24px] bg-black/15 blur-[2px]" />
                            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                              <div className="mb-2 rounded-full border border-white/30 bg-white/25 px-3 py-1 text-[10px] uppercase tracking-[0.3em] text-[#fff6dd]">地块 {entry.plotIndex}</div>
                              <div className="relative flex h-28 w-28 items-center justify-center" style={shouldGlow ? { animation: 'farmGlow 2.1s ease-in-out infinite' } : undefined}>
                                <Image src={preview.asset} alt={entry.title} width={118} height={118} className={preview.className} />
                              </div>
                              <div className={`mt-2 rounded-full px-3 py-1 text-[11px] font-semibold tracking-[0.18em] ${entry.status === 'READY' ? 'bg-[linear-gradient(90deg,_#c98b13,_#f0bd40)] text-white' : 'border border-white/35 bg-white/75 text-[#7e5c1d]'}`}>
                                {entry.statusLabel}
                              </div>
                              <p className="mt-3 max-w-[170px] text-center text-sm font-semibold tracking-[0.08em] text-[#fff9eb] drop-shadow-[0_2px_6px_rgba(0,0,0,0.18)]">
                                {entry.title}
                              </p>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  <div className="relative mt-16 grid grid-cols-1 gap-4 md:grid-cols-2 xl:hidden">
                    {plotCards.map((entry) => {
                      const preview = getPlotPreview(entry)
                      const isSelected = entry.plotIndex === selectedPlotIndex

                      return (
                        <button
                          key={entry.plotIndex}
                          type="button"
                          onClick={() => setSelectedPlotIndex(entry.plotIndex)}
                          className={`relative rounded-[28px] border px-4 pb-4 pt-5 text-left text-[#34210c] shadow-[0_20px_40px_rgba(86,55,20,0.10)] transition ${entry.panelClass} ${isSelected ? 'ring-2 ring-[#e0b24c]' : ''}`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="text-[11px] uppercase tracking-[0.35em] text-[#8d690e]">地块 {entry.plotIndex}</p>
                              <p className="mt-2 text-lg font-semibold tracking-[0.04em]">{entry.title}</p>
                            </div>
                            <span className="rounded-full border border-[#d0b27c]/50 bg-white/75 px-3 py-1 text-[11px] uppercase tracking-[0.28em] text-[#946c10]">{entry.statusLabel}</span>
                          </div>
                          <div className="mt-5 rounded-[26px] border border-black/5 bg-[linear-gradient(180deg,_rgba(255,255,255,0.34),_rgba(255,255,255,0.08))] p-4">
                            <div className={`relative overflow-hidden rounded-[26px] ${entry.soilClass} px-4 pb-5 pt-6 text-center`}>
                              <div className="flex h-36 flex-col items-center justify-center">
                                <Image src={preview.asset} alt={entry.title} width={118} height={118} className={preview.className} />
                              </div>
                            </div>
                          </div>
                        </button>
                      )
                    })}
                  </div>

                  <div className="mt-6 grid gap-4 lg:grid-cols-[0.92fr_1.08fr]">
                    <div className={`rounded-[28px] border p-5 shadow-[0_18px_34px_rgba(77,52,19,0.10)] ${selectedPlotEntry.panelClass}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-[11px] uppercase tracking-[0.35em] text-[#8f690d]">当前选中</p>
                          <h3 className="mt-2 text-2xl font-semibold tracking-[0.05em] text-[#38230b]">地块 {selectedPlotEntry.plotIndex}</h3>
                          <p className="mt-2 text-sm text-[#6c5126]">{selectedPlotEntry.title}</p>
                        </div>
                        <span className="rounded-full border border-[#d0b27c]/50 bg-white/75 px-3 py-1 text-[11px] uppercase tracking-[0.28em] text-[#946c10]">{selectedPlotEntry.statusLabel}</span>
                      </div>
                      <div className="mt-5 rounded-[26px] border border-black/5 bg-[linear-gradient(180deg,_rgba(255,255,255,0.34),_rgba(255,255,255,0.08))] p-4">
                        <div className={`relative overflow-hidden rounded-[26px] ${selectedPlotEntry.soilClass} px-4 pb-5 pt-6 text-center`}>
                          {!selectedPlotEntry.unlocked ? (
                            <div className="flex h-44 flex-col items-center justify-center text-[#f5e4b8]">
                              <Image src="/farm/locked-plot.svg" alt="locked plot" width={128} height={128} className="drop-shadow-[0_14px_18px_rgba(0,0,0,0.14)]" />
                              <p className="mt-4 text-sm tracking-[0.2em] text-[#f8edcf]">解锁后启用</p>
                            </div>
                          ) : selectedPlotEntry.status === 'EMPTY' ? (
                            <div className="flex h-44 flex-col items-center justify-center text-[#f5e4b8]">
                              <Image src="/farm/sprout-generic.svg" alt="empty plot" width={130} height={130} className="opacity-45 saturate-50" />
                              <p className="mt-3 text-sm tracking-[0.18em] text-[#f6e8c2]">等待播种</p>
                            </div>
                          ) : (
                            <div className="flex h-44 flex-col items-center justify-center">
                              <div className="relative flex h-32 w-32 items-center justify-center rounded-full border border-white/30 bg-white/20 shadow-[0_18px_28px_rgba(0,0,0,0.12)]">
                                <Image src={selectedPreview.asset} alt={selectedPlotEntry.seedMeta?.name ?? 'crop'} width={108} height={108} className={selectedPreview.className} />
                              </div>
                              <div className="mt-4 rounded-full bg-[linear-gradient(90deg,_#c98b13,_#f0bd40)] px-4 py-1 text-xs font-semibold text-white">
                                {selectedPlotEntry.status === 'READY'
                                  ? '成熟完成'
                                  : selectedPlotEntry.plot?.growthStage === 'MATURE'
                                    ? '即将成熟'
                                    : selectedPlotEntry.plot?.growthStage === 'YOUNG'
                                      ? '快速成长'
                                      : '嫩芽阶段'}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="rounded-[28px] border border-[#d7bc83]/45 bg-[linear-gradient(145deg,_rgba(255,250,236,0.95),_rgba(255,235,193,0.95))] p-5 shadow-[0_18px_34px_rgba(77,52,19,0.10)]">
                      <p className="text-[11px] uppercase tracking-[0.35em] text-[#9d7518]">地块详情</p>
                      <div className="mt-4 space-y-3 text-sm leading-7 text-[#6d5122]">
                        {selectedPlotEntry.summaryLines.map((line) => (
                          <p key={line}>{line}</p>
                        ))}
                        {selectedPlotEntry.plot?.status === 'GROWING' ? (
                          <div className="space-y-2">
                            <div className="h-2 overflow-hidden rounded-full bg-white/70">
                              <div
                                className="h-full rounded-full bg-[linear-gradient(90deg,_#c98b13,_#f0bd40)]"
                                style={{ width: `${Math.round((selectedPlotEntry.plot.progressRatio ?? 0) * 100)}%` }}
                              />
                            </div>
                            <p className="text-xs text-[#8b6a2c]">进度 {Math.round((selectedPlotEntry.plot.progressRatio ?? 0) * 100)}%</p>
                          </div>
                        ) : null}
                        {selectedPlotEntry.plot?.status === 'READY' && selectedPlotEntry.plot.stolenCoins !== '0.00' ? (
                          <p>本轮已被偷：{formatAmount(selectedPlotEntry.plot.stolenCoins)} 金币</p>
                        ) : null}
                      </div>

                      {selectedPlotEntry.unlocked && selectedPlotEntry.status === 'EMPTY' && viewDashboard.owner.isSelf ? (
                        <button
                          type="button"
                          disabled={!currentSeed || loadingKey === `plant:${selectedPlotEntry.plotIndex}`}
                          onClick={() => currentSeed && runAction('plant', { plotIndex: selectedPlotEntry.plotIndex, seedType: currentSeed.code }, `plant:${selectedPlotEntry.plotIndex}`)}
                          className="mt-5 w-full rounded-full bg-[linear-gradient(90deg,_#8e5c11,_#bb7d10)] px-4 py-3 text-sm font-semibold tracking-[0.14em] text-white transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {loadingKey === `plant:${selectedPlotEntry.plotIndex}` ? '种植中…' : currentSeed?.name ? `种植 ${currentSeed.name}` : '请选择种子'}
                        </button>
                      ) : null}

                      {selectedPlotEntry.unlocked && selectedPlotEntry.status === 'READY' && viewDashboard.owner.isSelf ? (
                        <button
                          type="button"
                          disabled={loadingKey === `harvest:${selectedPlotEntry.plotIndex}`}
                          onClick={() => runAction('harvest', { plotIndex: selectedPlotEntry.plotIndex }, `harvest:${selectedPlotEntry.plotIndex}`)}
                          className="mt-5 w-full rounded-full bg-[linear-gradient(90deg,_#c98b13,_#f0bd40)] px-4 py-3 text-sm font-semibold tracking-[0.14em] text-white transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {loadingKey === `harvest:${selectedPlotEntry.plotIndex}` ? '收获中…' : '立即收获'}
                        </button>
                      ) : null}

                      {selectedPlotEntry.unlocked && selectedPlotEntry.status === 'READY' && !viewDashboard.owner.isSelf ? (
                        <button
                          type="button"
                          disabled={!selectedPlotEntry.plot?.canSteal || loadingKey === `steal:${selectedPlotEntry.plotIndex}`}
                          onClick={() => runAction('steal', { targetDiscordId: viewDashboard.owner.discordUserId, plotIndex: selectedPlotEntry.plotIndex }, `steal:${selectedPlotEntry.plotIndex}`)}
                          className="mt-5 w-full rounded-full bg-[linear-gradient(90deg,_#7f4f12,_#bd6d1a)] px-4 py-3 text-sm font-semibold tracking-[0.14em] text-white transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {loadingKey === `steal:${selectedPlotEntry.plotIndex}` ? '偷菜中…' : selectedPlotEntry.plot?.canSteal ? '偷这一块地' : '这一轮已经被偷过'}
                        </button>
                      ) : null}

                      {!selectedPlotEntry.unlocked && homeDashboard.summary.nextPlotCost && viewDashboard.owner.isSelf ? (
                        <button
                          type="button"
                          disabled={loadingKey === 'expand'}
                          onClick={() => runAction('expand', {}, 'expand')}
                          className="mt-5 w-full rounded-full bg-[linear-gradient(90deg,_#503015,_#8d5b11,_#c78a18)] px-4 py-3 text-sm font-semibold tracking-[0.14em] text-white transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {loadingKey === 'expand' ? '扩地中…' : `解锁下一块地 · ${formatAmount(homeDashboard.summary.nextPlotCost)} 金币`}
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            </SectionCard>
            <div className="space-y-8">
              <SectionCard eyebrow="Selection" title="当前种子">
                {currentSeed ? (
                  <div className="rounded-[28px] border border-[#d7bc83]/45 bg-[linear-gradient(145deg,_rgba(255,250,236,0.95),_rgba(255,235,193,0.95))] p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="relative h-16 w-16">
                          <Image src={cropVisualMap[currentSeed.code]?.cropAsset ?? '/farm/crop-wheat.svg'} alt={currentSeed.name} fill className="object-contain drop-shadow-[0_8px_12px_rgba(0,0,0,0.12)]" />
                        </div>
                        <h3 className="mt-3 text-2xl font-semibold tracking-[0.04em] text-[#35210a]">{currentSeed.name}</h3>
                        <p className="mt-2 text-sm leading-7 text-[#6f5428]">{currentSeed.description}</p>
                      </div>
                      <span className="rounded-full border border-[#d2ad54]/45 bg-white/65 px-3 py-1 text-xs uppercase tracking-[0.28em] text-[#8d6508]">Lv.{currentSeed.unlockLevel}</span>
                    </div>
                    <div className="mt-5 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-2xl border border-white/60 bg-white/65 p-4 text-sm text-[#6a4c1d]"><p className="text-xs uppercase tracking-[0.28em] text-[#9d7518]">播种成本</p><p className="mt-2 text-lg font-semibold text-[#34210b]">{formatAmount(currentSeed.costCoins)} 金币</p></div>
                      <div className="rounded-2xl border border-white/60 bg-white/65 p-4 text-sm text-[#6a4c1d]"><p className="text-xs uppercase tracking-[0.28em] text-[#9d7518]">成熟时间</p><p className="mt-2 text-lg font-semibold text-[#34210b]">{getFarmSeedDurationLabel(currentSeed.durationMinutes)}</p></div>
                      <div className="rounded-2xl border border-white/60 bg-white/65 p-4 text-sm text-[#6a4c1d]"><p className="text-xs uppercase tracking-[0.28em] text-[#9d7518]">收益区间</p><p className="mt-2 text-lg font-semibold text-[#34210b]">{formatAmount(currentSeed.minYieldCoins)} ~ {formatAmount(currentSeed.maxYieldCoins)}</p></div>
                      <div className="rounded-2xl border border-white/60 bg-white/65 p-4 text-sm text-[#6a4c1d]"><p className="text-xs uppercase tracking-[0.28em] text-[#9d7518]">收获经验</p><p className="mt-2 text-lg font-semibold text-[#34210b]">+{currentSeed.experience}</p></div>
                    </div>
                  </div>
                ) : (
                  <p className="rounded-2xl border border-dashed border-[#d7bc83]/45 bg-[#fff8e8] p-5 text-sm text-[#816032]">当前没有可选种子，请先提升庄园等级。</p>
                )}
              </SectionCard>

              <SectionCard eyebrow="Seeds" title="种子背包">
                <div className="space-y-3">
                  {homeDashboard.seeds.map((seed) => {
                    const selected = seed.code === selectedSeed;
                    return (
                      <button key={seed.code} type="button" disabled={!seed.unlocked} onClick={() => setSelectedSeed(seed.code)} className={`w-full rounded-[24px] border p-4 text-left transition ${selected ? 'border-[#d39916] bg-[linear-gradient(145deg,_#fff3c7,_#ffe19a)] shadow-[0_16px_32px_rgba(211,153,22,0.12)]' : seed.unlocked ? 'border-[#d7bc83]/35 bg-white/72 hover:border-[#d39916]/50 hover:bg-[#fff8e7]' : 'border-dashed border-[#cbb68d]/35 bg-[#efe8d7] text-[#9d8e71]'}`}>
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <div className="flex items-center gap-3">
                              <div className="relative h-11 w-11 shrink-0">
                                <Image src={cropVisualMap[seed.code]?.cropAsset ?? '/farm/crop-wheat.svg'} alt={seed.name} fill className="object-contain drop-shadow-[0_6px_10px_rgba(0,0,0,0.12)]" />
                              </div>
                              <div>
                                <p className="text-lg font-semibold tracking-[0.04em]">{seed.name}</p>
                                <p className="mt-1 text-sm text-[#6f5428]">{seed.description}</p>
                              </div>
                            </div>
                          </div>
                          <span className="shrink-0 rounded-full border border-[#d2ad54]/40 px-3 py-1 text-[11px] uppercase tracking-[0.26em] text-[#8f6806]">Lv.{seed.unlockLevel}</span>
                        </div>
                        <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-[#6a4d1d]"><div>成本：{formatAmount(seed.costCoins)} 金币</div><div>经验：+{seed.experience}</div><div>收益：{formatAmount(seed.minYieldCoins)} ~ {formatAmount(seed.maxYieldCoins)}</div><div>成熟：{getFarmSeedDurationLabel(seed.durationMinutes)}</div></div>
                      </button>
                    );
                  })}
                </div>
              </SectionCard>

              <SectionCard eyebrow="Exchange" title="庄园兑换所">
                <div className="space-y-4">
                  {[
                    { title: '余额 → 金币', hint: '把 totalBalance 直接投进庄园。', value: balanceAmount, onChange: setBalanceAmount, action: () => runAction('exchange_balance', { amount: balanceAmount }, 'exchange_balance'), loading: 'exchange_balance', button: '兑换金币' },
                    { title: '积分 → 金币', hint: '已有积分也能补仓继续种。', value: pointAmount, onChange: setPointAmount, action: () => runAction('exchange_points', { amount: pointAmount }, 'exchange_points'), loading: 'exchange_points', button: '转成金币' },
                    { title: '金币 → 积分', hint: '收菜后的金币可以继续换回锦鲤积分。', value: coinAmount, onChange: setCoinAmount, action: () => runAction('exchange_coins_to_points', { amount: coinAmount }, 'exchange_coins_to_points'), loading: 'exchange_coins_to_points', button: '兑换积分' },
                  ].map((item) => (
                    <div key={item.title} className="rounded-[24px] border border-[#d7bc83]/35 bg-white/72 p-4">
                      <div className="flex flex-col gap-1"><p className="text-base font-semibold tracking-[0.04em] text-[#38240d]">{item.title}</p><p className="text-sm text-[#7b6131]">{item.hint}</p></div>
                      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                        <input value={item.value} onChange={(event) => item.onChange(event.target.value)} className="flex-1 rounded-full border border-[#d9bf88]/40 bg-[#fffdf7] px-4 py-3 text-sm text-[#38240d] outline-none transition focus:border-[#c98b12]" placeholder="输入数量" />
                        <button type="button" disabled={loadingKey === item.loading} onClick={item.action} className="rounded-full bg-[linear-gradient(90deg,_#8d5b11,_#bf8113)] px-5 py-3 text-sm font-semibold tracking-[0.14em] text-white transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50">
                          {loadingKey === item.loading ? '处理中…' : item.button}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </SectionCard>

              <SectionCard eyebrow="Estate" title="扩建庄园">
                <div className="rounded-[26px] border border-[#d8bf87]/35 bg-[linear-gradient(145deg,_rgba(255,250,238,0.95),_rgba(252,235,194,0.95))] p-5">
                  <p className="text-sm leading-7 text-[#6f5428]">地块越多，庄园的自然产能越高。当前解锁 {homeDashboard.summary.unlockedPlots} / {MAX_PLOTS} 块地。</p>
                  {homeDashboard.summary.nextPlotCost ? (
                    <button type="button" disabled={loadingKey === 'expand' || isVisiting} onClick={() => runAction('expand', {}, 'expand')} className="mt-5 w-full rounded-full bg-[linear-gradient(90deg,_#503015,_#8d5b11,_#c78a18)] px-5 py-3 text-sm font-semibold tracking-[0.16em] text-white transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50">
                      {loadingKey === 'expand' ? '扩地中…' : isVisiting ? '回到自己的庄园后才能扩地' : `花费 ${formatAmount(homeDashboard.summary.nextPlotCost)} 金币解锁下一块地`}
                    </button>
                  ) : (
                    <div className="mt-5 rounded-full border border-[#d3b36a]/45 bg-white/65 px-4 py-3 text-center text-sm font-semibold text-[#8c650a]">已达到当前最大地块数量</div>
                  )}
                </div>
              </SectionCard>

              <SectionCard eyebrow="Ledger" title={isVisiting ? `${viewDashboard.owner.displayName} 的庄园动态` : '最近记录'}>
                <div className="space-y-3">
                  {viewDashboard.recentLogs.length > 0 ? (
                    viewDashboard.recentLogs.map((log) => (
                      <div key={log.id} className="rounded-[22px] border border-[#d8bf87]/28 bg-[linear-gradient(180deg,_rgba(255,252,245,0.94),_rgba(249,239,214,0.94))] p-4 text-sm text-[#6b4f21]">
                        <div className="flex flex-wrap items-center justify-between gap-2"><p className="font-semibold tracking-[0.04em] text-[#31200d]">{actionLabelMap[log.actionType] ?? log.actionType}</p><span className="text-xs text-[#98731a]">{new Date(log.createdAt).toLocaleString('zh-CN')}</span></div>
                        <div className="mt-3 flex flex-wrap gap-4 text-xs"><span>金币 {formatAmount(log.coinDelta)}</span><span>积分 {formatAmount(log.pointDelta)}</span><span>余额 {formatAmount(log.balanceDelta)}</span><span>经验 +{log.expDelta}</span>{log.plotIndex ? <span>地块 {log.plotIndex}</span> : null}</div>
                        {log.note ? <p className="mt-2 text-xs text-[#8b6a2c]">{log.note}</p> : null}
                      </div>
                    ))
                  ) : (
                    <p className="rounded-2xl border border-dashed border-[#d7bc83]/40 bg-[#fff8e8] p-4 text-sm text-[#816032]">暂时还没有庄园记录。</p>
                  )}
                </div>
              </SectionCard>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


