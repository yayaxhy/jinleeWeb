'use client';

import { useEffect, useRef, useState } from 'react';

type FusionItemView = {
  id: string;
  prizeName: string;
  prizeType: string;
  pool: string;
  expiresAt: string | null;
  createdAt: string;
};

type FusionResultView = {
  drawId: string;
  prizeName: string;
  prizeType: string;
  pool: string;
  poolLabel: string;
  imageUrl: string | null;
  expiresAt: string | null;
  sourceDrawIds: string[];
};

type LotteryFusionClientProps = {
  initialItems: FusionItemView[];
};

type Notice = {
  level: 'success' | 'error' | 'info';
  text: string;
} | null;

type AnimationPhase = 'collapsing' | 'charging' | 'revealing';

type AnimationPayload = {
  result: FusionResultView;
  sourceItems: FusionItemView[];
};

type AnimationState = {
  phase: AnimationPhase;
  payload: AnimationPayload;
} | null;

type ResultPoolKey = 'NORMAL' | 'MEDIUM' | 'ADVANCED' | 'SPECIAL';

const ROME_TIMEZONE = 'Europe/Rome';
const MAX_SELECTION = 6;
const POOL_LABEL: Record<string, string> = {
  NORMAL: '银色',
  MEDIUM: '金色',
  ADVANCED: '高级',
  SPECIAL: '特级',
};
const MAX_POOL_LABEL_BY_COUNT: Record<number, string> = {
  3: '金色',
  4: '高级',
  6: '特级',
};
const PRIZE_TYPE_LABEL: Record<string, string> = {
  COUPON: '券',
  GIFT: '礼物',
  SELFUSE: '自用',
};
const ANIMATION_TIMINGS = {
  collapsing: 420,
  charging: 900,
  revealing: 560,
} as const;

const PHASE_META: Record<
  AnimationPhase,
  {
    eyebrow: string;
    title: string;
    description: string;
  }
> = {
  collapsing: {
    eyebrow: 'Material Collapse',
    title: '素材正在坍缩',
    description: '选中的奖品正在被重铸，原有结果会被彻底吃掉。',
  },
  charging: {
    eyebrow: 'Core Charging',
    title: 'Reroll Core 充能中',
    description: '奖池正在重算，本次结果已经锁定，可以直接跳过动画。',
  },
  revealing: {
    eyebrow: 'Result Reveal',
    title: '新奖品即将展开',
    description: '最终结果已经生成，正在将新奖品送回你的背包。',
  },
};

const SPECIAL_PARTICLE_POINTS = [
  { top: '8%', left: '48%', delay: '0ms' },
  { top: '20%', left: '80%', delay: '140ms' },
  { top: '48%', left: '92%', delay: '280ms' },
  { top: '78%', left: '78%', delay: '420ms' },
  { top: '90%', left: '50%', delay: '560ms' },
  { top: '76%', left: '18%', delay: '700ms' },
  { top: '46%', left: '6%', delay: '840ms' },
  { top: '18%', left: '22%', delay: '980ms' },
] as const;

const RESULT_EFFECT_META: Record<
  ResultPoolKey,
  {
    overlayShellClass: string;
    overlayBaseTextClass: string;
    overlayAccentTextClass: string;
    overlayBodyTextClass: string;
    overlayAuraClass: string;
    overlayGlowClass: string;
    skipButtonClass: string;
    outerRingClass: string;
    innerRingClass: string;
    coreGlowClass: string;
    coreClass: string;
    coreInnerTextClass: string;
    resultCardClass: string;
    resultTitleClass: string;
    resultBodyClass: string;
    resultEyebrowClass: string;
    sweepGradientClass: string;
    pageCardClass: string;
    pageEyebrowClass: string;
    pageTitleClass: string;
    pageBodyClass: string;
    showSweep: boolean;
    showOrbit: boolean;
    showParticles: boolean;
  }
> = {
  NORMAL: {
    overlayShellClass:
      'border-white/12 bg-[radial-gradient(circle_at_top,_rgba(244,247,250,0.96),_rgba(46,53,61,0.96)_58%)]',
    overlayBaseTextClass: 'text-[#f8fbff]',
    overlayAccentTextClass: 'text-[#d8e0e8]/82',
    overlayBodyTextClass: 'text-[#e7edf3]/74',
    overlayAuraClass: 'bg-[radial-gradient(circle_at_center,_rgba(215,224,235,0.16),_transparent_58%)]',
    overlayGlowClass: 'bg-[#dce3ec]/18',
    skipButtonClass:
      'border-[#dce4eb]/28 bg-white/8 text-[#eef4f9] hover:bg-white/16',
    outerRingClass: 'border-[#dce4eb]/30',
    innerRingClass: 'border-[#eef3f8]/30',
    coreGlowClass: 'bg-[#d1d8e2]/22',
    coreClass:
      'border-[#eef3f8]/52 bg-[radial-gradient(circle,_rgba(255,255,255,0.98),_rgba(180,190,201,0.92))] shadow-[0_0_42px_rgba(207,216,227,0.42)]',
    coreInnerTextClass: 'text-[#364251]',
    resultCardClass: 'border-white/12 bg-white/8',
    resultTitleClass: 'text-[#f8fbff]',
    resultBodyClass: 'text-[#edf2f8]/78',
    resultEyebrowClass: 'text-[#d8e0e8]/74',
    sweepGradientClass: 'from-transparent via-white/28 to-transparent',
    pageCardClass:
      'border-[#d7dee5] bg-[linear-gradient(135deg,_#f8fbff,_#eef3f6)] shadow-[0_18px_48px_rgba(163,175,188,0.16)]',
    pageEyebrowClass: 'text-[#7f8b97]',
    pageTitleClass: 'text-[#36414f]',
    pageBodyClass: 'text-[#64707d]',
    showSweep: false,
    showOrbit: false,
    showParticles: false,
  },
  MEDIUM: {
    overlayShellClass:
      'border-[#f4c542]/22 bg-[radial-gradient(circle_at_top,_rgba(255,243,194,0.96),_rgba(42,24,6,0.96)_58%)]',
    overlayBaseTextClass: 'text-[#fff8e3]',
    overlayAccentTextClass: 'text-[#f7d777]/80',
    overlayBodyTextClass: 'text-[#fef4d0]/78',
    overlayAuraClass: 'bg-[radial-gradient(circle_at_center,_rgba(255,216,107,0.14),_transparent_58%)]',
    overlayGlowClass: 'bg-[#f4c542]/18',
    skipButtonClass:
      'border-[#f7d777]/35 bg-white/10 text-[#fff5d4] hover:bg-white/18',
    outerRingClass: 'border-[#f7d777]/28',
    innerRingClass: 'border-[#ffe9a5]/35',
    coreGlowClass: 'bg-[#f4c542]/22',
    coreClass:
      'border-[#ffe29c]/45 bg-[radial-gradient(circle,_rgba(255,238,187,0.95),_rgba(198,131,0,0.92))] shadow-[0_0_50px_rgba(244,197,66,0.5)]',
    coreInnerTextClass: 'text-[#3d2c00]',
    resultCardClass: 'border-[#f7d777]/25 bg-white/10',
    resultTitleClass: 'text-[#fff6db]',
    resultBodyClass: 'text-[#fef1c4]/78',
    resultEyebrowClass: 'text-[#f7d777]/76',
    sweepGradientClass: 'from-transparent via-[#fff0bd]/35 to-transparent',
    pageCardClass:
      'border-[#e8d28a] bg-[linear-gradient(135deg,_#fff8dc,_#fff0be)] shadow-[0_18px_52px_rgba(212,167,55,0.18)]',
    pageEyebrowClass: 'text-[#a17a16]',
    pageTitleClass: 'text-[#5b4300]',
    pageBodyClass: 'text-[#7d5c00]',
    showSweep: false,
    showOrbit: false,
    showParticles: false,
  },
  ADVANCED: {
    overlayShellClass:
      'border-[#79e3d3]/22 bg-[radial-gradient(circle_at_top,_rgba(221,255,248,0.94),_rgba(4,37,43,0.96)_58%)]',
    overlayBaseTextClass: 'text-[#ecfffb]',
    overlayAccentTextClass: 'text-[#87f1df]/82',
    overlayBodyTextClass: 'text-[#d7fff7]/78',
    overlayAuraClass: 'bg-[radial-gradient(circle_at_center,_rgba(80,255,221,0.14),_transparent_58%)]',
    overlayGlowClass: 'bg-[#55efd0]/18',
    skipButtonClass:
      'border-[#8cf3e1]/35 bg-white/8 text-[#e9fffa] hover:bg-white/16',
    outerRingClass: 'border-[#8cf3e1]/32',
    innerRingClass: 'border-[#b7fff4]/38',
    coreGlowClass: 'bg-[#42ffd6]/20',
    coreClass:
      'border-[#b9fff3]/48 bg-[radial-gradient(circle,_rgba(227,255,248,0.98),_rgba(25,179,152,0.9))] shadow-[0_0_58px_rgba(66,255,214,0.44)]',
    coreInnerTextClass: 'text-[#0b4e44]',
    resultCardClass: 'border-[#8cf3e1]/30 bg-white/10 shadow-[0_0_42px_rgba(66,255,214,0.12)]',
    resultTitleClass: 'text-[#ebfffb]',
    resultBodyClass: 'text-[#d4fff7]/80',
    resultEyebrowClass: 'text-[#8cf3e1]/78',
    sweepGradientClass: 'from-transparent via-[#cffff6]/42 to-transparent',
    pageCardClass:
      'border-[#8fdccc] bg-[linear-gradient(135deg,_#eafff9,_#c9fff1)] shadow-[0_20px_56px_rgba(39,185,157,0.2)]',
    pageEyebrowClass: 'text-[#2f8c7d]',
    pageTitleClass: 'text-[#0f5549]',
    pageBodyClass: 'text-[#2f6e64]',
    showSweep: true,
    showOrbit: true,
    showParticles: false,
  },
  SPECIAL: {
    overlayShellClass:
      'border-[#ffb46c]/24 bg-[radial-gradient(circle_at_top,_rgba(255,233,194,0.94),_rgba(47,11,4,0.97)_58%)]',
    overlayBaseTextClass: 'text-[#fff6ea]',
    overlayAccentTextClass: 'text-[#ffc98d]/84',
    overlayBodyTextClass: 'text-[#ffe2c0]/78',
    overlayAuraClass: 'bg-[radial-gradient(circle_at_center,_rgba(255,144,54,0.18),_transparent_60%)]',
    overlayGlowClass: 'bg-[#ff9440]/22',
    skipButtonClass:
      'border-[#ffc98d]/38 bg-white/10 text-[#fff0dc] hover:bg-white/18',
    outerRingClass: 'border-[#ffc98d]/34',
    innerRingClass: 'border-[#ffd8aa]/42',
    coreGlowClass: 'bg-[#ff9440]/24',
    coreClass:
      'border-[#ffd29d]/50 bg-[radial-gradient(circle,_rgba(255,237,214,0.98),_rgba(255,128,38,0.9))] shadow-[0_0_70px_rgba(255,148,64,0.52)]',
    coreInnerTextClass: 'text-[#5a2004]',
    resultCardClass:
      'border-[#ffc98d]/34 bg-[linear-gradient(135deg,_rgba(255,255,255,0.14),_rgba(255,183,103,0.08))] shadow-[0_0_54px_rgba(255,148,64,0.16)]',
    resultTitleClass: 'text-[#fff7ef]',
    resultBodyClass: 'text-[#ffe7cb]/82',
    resultEyebrowClass: 'text-[#ffc98d]/80',
    sweepGradientClass: 'from-transparent via-[#ffe0bc]/55 to-transparent',
    pageCardClass:
      'border-[#efbc86] bg-[linear-gradient(135deg,_#fff0df,_#ffd3ab)] shadow-[0_24px_64px_rgba(255,144,64,0.24)]',
    pageEyebrowClass: 'text-[#b8601c]',
    pageTitleClass: 'text-[#6a2505]',
    pageBodyClass: 'text-[#8a4a22]',
    showSweep: true,
    showOrbit: true,
    showParticles: true,
  },
};

const getResultEffectMeta = (pool?: string) =>
  RESULT_EFFECT_META[(pool as ResultPoolKey) ?? 'NORMAL'] ?? RESULT_EFFECT_META.NORMAL;

const formatDateOnly = (value?: string | null) => {
  if (!value) return '长期有效';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '长期有效';
  return date.toLocaleDateString('zh-CN', { timeZone: ROME_TIMEZONE });
};

export function LotteryFusionClient({ initialItems }: LotteryFusionClientProps) {
  const [items, setItems] = useState(initialItems);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [result, setResult] = useState<FusionResultView | null>(null);
  const [animationState, setAnimationState] = useState<AnimationState>(null);
  const animationTimersRef = useRef<Array<ReturnType<typeof setTimeout>>>([]);

  const selectedCount = selectedIds.length;
  const currentMaxPoolLabel = MAX_POOL_LABEL_BY_COUNT[selectedCount] ?? null;
  const animationPayload = animationState?.payload ?? null;
  const animationPhase = animationState?.phase ?? null;
  const isAnimating = animationState !== null;
  const interactionLocked = loading || isAnimating;
  const animationResultEffect = getResultEffectMeta(animationPayload?.result.pool);
  const finalResultEffect = getResultEffectMeta(result?.pool);

  const clearAnimationTimers = () => {
    for (const timer of animationTimersRef.current) {
      clearTimeout(timer);
    }
    animationTimersRef.current = [];
  };

  const applyFusionResult = (payload: AnimationPayload) => {
    const usedIds = new Set(payload.result.sourceDrawIds.length ? payload.result.sourceDrawIds : payload.sourceItems.map((item) => item.id));
    setItems((current) => [
      {
        id: payload.result.drawId,
        prizeName: payload.result.prizeName,
        prizeType: payload.result.prizeType,
        pool: payload.result.pool,
        expiresAt: payload.result.expiresAt,
        createdAt: new Date().toISOString(),
      },
      ...current.filter((item) => !usedIds.has(item.id)),
    ]);
    setSelectedIds([]);
    setResult(payload.result);
    setNotice({
      level: 'success',
      text: `融合成功，获得了 ${payload.result.prizeName}`,
    });
  };

  const finishAnimation = (payload: AnimationPayload) => {
    clearAnimationTimers();
    setAnimationState(null);
    applyFusionResult(payload);
  };

  const startAnimation = (payload: AnimationPayload) => {
    clearAnimationTimers();
    setAnimationState({ phase: 'collapsing', payload });

    animationTimersRef.current.push(
      setTimeout(() => {
        setAnimationState((current) => (current ? { ...current, phase: 'charging' } : current));
      }, ANIMATION_TIMINGS.collapsing),
    );

    animationTimersRef.current.push(
      setTimeout(() => {
        setAnimationState((current) => (current ? { ...current, phase: 'revealing' } : current));
      }, ANIMATION_TIMINGS.collapsing + ANIMATION_TIMINGS.charging),
    );

    animationTimersRef.current.push(
      setTimeout(() => {
        finishAnimation(payload);
      }, ANIMATION_TIMINGS.collapsing + ANIMATION_TIMINGS.charging + ANIMATION_TIMINGS.revealing),
    );
  };

  useEffect(() => {
    return () => {
      clearAnimationTimers();
    };
  }, []);

  const toggleSelection = (itemId: string) => {
    if (interactionLocked) return;
    setNotice(null);
    if (!selectedIds.includes(itemId) && selectedIds.length >= MAX_SELECTION) {
      setNotice({ level: 'error', text: '最多只能同时选择 6 个奖品' });
      return;
    }
    setSelectedIds((current) => {
      if (current.includes(itemId)) {
        return current.filter((value) => value !== itemId);
      }
      return [...current, itemId];
    });
  };

  const handleFuse = async () => {
    if (![3, 4, 6].includes(selectedCount)) {
      setNotice({ level: 'error', text: '仅支持选择 3 / 4 / 6 个抽奖奖品进行融合' });
      return;
    }

    const selectedItemsSnapshot = items.filter((item) => selectedIds.includes(item.id));
    setLoading(true);
    setNotice(null);
    try {
      const response = await fetch('/api/lottery/fuse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lotteryIds: selectedIds }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(typeof data?.error === 'string' ? data.error : '融合失败');
      }

      const fusionResult = data?.result as FusionResultView | undefined;
      if (!fusionResult?.drawId || !fusionResult?.prizeName) {
        throw new Error('融合结果异常，请稍后重试');
      }

      startAnimation({
        result: fusionResult,
        sourceItems: selectedItemsSnapshot,
      });
    } catch (error) {
      setNotice({ level: 'error', text: error instanceof Error ? error.message : '融合失败' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-[32px] border border-black/5 bg-white p-6 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.45em] text-gray-500">Reroll</p>
            <h1 className="text-3xl font-semibold tracking-wide text-[#171717]">Reroll</h1>
            <p className="max-w-2xl text-sm leading-6 text-gray-600">
              这里只能选择抽奖活动来源的未使用奖品。选择后会消耗原奖品，并随机生成一个新的抽奖奖品放回你的背包。
            </p>
          </div>
          <div className="rounded-3xl border border-[#f2dfad] bg-[#fff8e6] px-5 py-4 text-sm text-[#7d5c00]">
            <p>可用奖品：{items.length} 个</p>
            <p>当前已选：{selectedCount} 个</p>
            <p>{currentMaxPoolLabel ? `本次最高可出 ${currentMaxPoolLabel}` : '请选择 3 / 4 / 6 个奖品'}</p>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-black/10 bg-[#f7f3ef] px-4 py-3 text-sm text-gray-700">
            <p className="font-semibold text-[#171717]">3 个融合</p>
            <p>最高可出金色奖品</p>
          </div>
          <div className="rounded-2xl border border-black/10 bg-[#f7f3ef] px-4 py-3 text-sm text-gray-700">
            <p className="font-semibold text-[#171717]">4 个融合</p>
            <p>最高可出高级奖品</p>
          </div>
          <div className="rounded-2xl border border-black/10 bg-[#f7f3ef] px-4 py-3 text-sm text-gray-700">
            <p className="font-semibold text-[#171717]">6 个融合</p>
            <p>不会出银色奖品，最高可出特级</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void handleFuse()}
            disabled={interactionLocked || ![3, 4, 6].includes(selectedCount)}
            className="rounded-full bg-[#f4c542] px-5 py-2 text-sm font-semibold text-[#3d2c00] hover:bg-[#ffd45b] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? '请求中…' : isAnimating ? '播放中…' : '开始融合'}
          </button>
          <button
            type="button"
            onClick={() => {
              if (interactionLocked) return;
              setSelectedIds([]);
              setNotice(null);
            }}
            disabled={interactionLocked || selectedCount === 0}
            className="rounded-full border border-black/10 px-5 py-2 text-sm font-semibold text-gray-600 hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-40"
          >
            清空选择
          </button>
          <p className="text-sm text-gray-500">融合后原奖品会被消耗，新奖品会直接进入背包。</p>
        </div>

        {notice ? (
          <p
            className={`text-sm ${
              notice.level === 'success'
                ? 'text-emerald-600'
                : notice.level === 'error'
                  ? 'text-rose-500'
                  : 'text-gray-600'
            }`}
          >
            {notice.text}
          </p>
        ) : null}
      </section>

      {result ? (
        <section className={`rounded-[32px] border p-6 space-y-2 ${finalResultEffect.pageCardClass}`}>
          <p className={`text-xs uppercase tracking-[0.4em] ${finalResultEffect.pageEyebrowClass}`}>Reroll Result</p>
          <h2 className={`text-2xl font-semibold ${finalResultEffect.pageTitleClass}`}>{result.prizeName}</h2>
          <p className={`text-sm ${finalResultEffect.pageBodyClass}`}>
            奖池等级：{result.poolLabel}，到期时间：{formatDateOnly(result.expiresAt)}
          </p>
        </section>
      ) : null}

      {animationPayload && animationPhase ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#120d06]/72 p-5 backdrop-blur-sm">
          <div
            className={`relative w-full max-w-4xl overflow-hidden rounded-[36px] border px-6 py-8 shadow-[0_32px_120px_rgba(0,0,0,0.38)] sm:px-10 ${animationResultEffect.overlayShellClass} ${animationResultEffect.overlayBaseTextClass}`}
          >
            <div className={`absolute inset-0 ${animationResultEffect.overlayAuraClass}`} />
            <div className={`absolute inset-x-[20%] top-14 h-40 rounded-full blur-3xl ${animationResultEffect.overlayGlowClass}`} />

            <div className="relative flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-2">
                <p className={`text-xs uppercase tracking-[0.45em] ${animationResultEffect.overlayAccentTextClass}`}>
                  {PHASE_META[animationPhase].eyebrow}
                </p>
                <h2 className="text-3xl font-semibold tracking-wide">{PHASE_META[animationPhase].title}</h2>
                <p className={`max-w-2xl text-sm leading-6 ${animationResultEffect.overlayBodyTextClass}`}>
                  {PHASE_META[animationPhase].description}
                </p>
              </div>
              <button
                type="button"
                onClick={() => finishAnimation(animationPayload)}
                className={`rounded-full border px-5 py-2 text-sm font-semibold transition ${animationResultEffect.skipButtonClass}`}
              >
                跳过动画
              </button>
            </div>

            <div className="relative mt-8 grid gap-6 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
              <div className="space-y-4">
                <p className={`text-xs uppercase tracking-[0.35em] ${animationResultEffect.overlayAccentTextClass}`}>
                  Source Items
                </p>
                <div className="grid gap-3 sm:grid-cols-3">
                  {animationPayload.sourceItems.map((item, index) => (
                    <div
                      key={item.id}
                      className={`rounded-2xl border bg-white/10 px-4 py-4 text-sm transition-all duration-500 ${animationResultEffect.resultCardClass} ${
                        animationPhase === 'collapsing'
                          ? 'translate-y-0 scale-100 opacity-100'
                          : animationPhase === 'charging'
                            ? 'translate-y-7 scale-75 opacity-0 blur-[1px]'
                            : 'translate-y-10 scale-50 opacity-0 blur-sm'
                      }`}
                      style={{ transitionDelay: `${index * 70}ms` }}
                    >
                      <p className={`text-[11px] uppercase tracking-[0.28em] ${animationResultEffect.resultEyebrowClass}`}>
                        {POOL_LABEL[item.pool] ?? item.pool}
                      </p>
                      <p className="mt-2 text-base font-semibold">{item.prizeName}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="relative mx-auto flex w-full max-w-sm flex-col items-center justify-center gap-5 py-4">
                <div className="relative flex h-44 w-44 items-center justify-center">
                  <div
                    className={`absolute inset-0 rounded-full border ${animationResultEffect.outerRingClass} ${
                      animationPhase === 'revealing' ? 'opacity-40' : 'animate-ping opacity-80'
                    }`}
                  />
                  <div
                    className={`absolute inset-4 rounded-full border ${animationResultEffect.innerRingClass} ${
                      animationPhase === 'charging' ? 'animate-spin' : ''
                    }`}
                    style={{ animationDuration: '1.6s' }}
                  />
                  <div className={`absolute inset-6 rounded-full blur-2xl ${animationResultEffect.coreGlowClass}`} />
                  {animationResultEffect.showOrbit ? (
                    <div
                      className={`absolute inset-2 rounded-full border border-dashed ${animationResultEffect.innerRingClass} ${
                        animationPhase === 'charging' || animationPhase === 'revealing' ? 'animate-spin opacity-90' : 'opacity-0'
                      }`}
                      style={{ animationDuration: '3.6s' }}
                    />
                  ) : null}
                  {animationResultEffect.showParticles
                    ? SPECIAL_PARTICLE_POINTS.map((point, index) => (
                        <div
                          key={`${point.top}-${point.left}`}
                          className={`absolute h-2.5 w-2.5 rounded-full ${
                            animationPhase === 'revealing' ? 'animate-ping opacity-100' : 'opacity-0'
                          } ${animationResultEffect.overlayGlowClass}`}
                          style={{
                            top: point.top,
                            left: point.left,
                            animationDelay: point.delay,
                            animationDuration: `${1.2 + index * 0.06}s`,
                          }}
                        />
                      ))
                    : null}
                  <div
                    className={`relative flex h-28 w-28 items-center justify-center overflow-hidden rounded-full border text-center transition-all duration-500 ${animationResultEffect.coreClass} ${
                      animationPhase === 'revealing' ? 'scale-95' : 'scale-100'
                    }`}
                  >
                    {animationResultEffect.showSweep ? (
                      <div
                        className={`pointer-events-none absolute inset-y-[-15%] left-[-30%] w-10 rotate-[18deg] bg-gradient-to-r ${animationResultEffect.sweepGradientClass} blur-[1px] transition-all duration-700 ${
                          animationPhase === 'revealing' ? 'translate-x-[10.5rem] opacity-100' : 'translate-x-0 opacity-0'
                        }`}
                      />
                    ) : null}
                    <div>
                      <p className={`text-[10px] uppercase tracking-[0.36em] ${animationResultEffect.coreInnerTextClass}`}>
                        Reroll
                      </p>
                      <p className={`mt-2 text-sm font-semibold ${animationResultEffect.coreInnerTextClass}`}>Core</p>
                    </div>
                  </div>
                </div>

                <div
                  className={`w-full rounded-[28px] border p-5 transition-all duration-500 ${animationResultEffect.resultCardClass} ${
                    animationPhase === 'revealing'
                      ? 'translate-y-0 scale-100 opacity-100'
                      : 'translate-y-6 scale-90 opacity-0'
                  }`}
                >
                  <p className={`text-xs uppercase tracking-[0.35em] ${animationResultEffect.resultEyebrowClass}`}>
                    Reroll Result
                  </p>
                  <h3 className={`mt-3 text-2xl font-semibold ${animationResultEffect.resultTitleClass}`}>
                    {animationPayload.result.prizeName}
                  </h3>
                  <p className={`mt-2 text-sm ${animationResultEffect.resultBodyClass}`}>
                    奖池等级：{animationPayload.result.poolLabel}，到期时间：
                    {formatDateOnly(animationPayload.result.expiresAt)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <section className="rounded-[32px] border border-black/5 bg-white p-6 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-[#171717]">可融合奖品</h2>
            <p className="text-sm text-gray-500">仅展示抽奖来源、未使用且未过期的奖品。</p>
          </div>
          <span className="text-xs uppercase tracking-[0.35em] text-gray-400">{items.length} 个</span>
        </div>

        {items.length === 0 ? (
          <p className="text-sm text-gray-500">当前没有可融合的抽奖奖品。</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {items.map((item) => {
              const selected = selectedIds.includes(item.id);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => toggleSelection(item.id)}
                  disabled={interactionLocked}
                  className={`rounded-2xl border p-4 text-left transition ${
                    selected
                      ? 'border-[#f4c542] bg-[#fff8e6] shadow-[0_8px_24px_rgba(244,197,66,0.18)]'
                      : 'border-black/10 bg-[#fcfbff] hover:border-[#f4c542]/60 hover:bg-[#fffdf6]'
                  } ${interactionLocked ? 'cursor-not-allowed opacity-70' : ''}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-2">
                      <span className="inline-flex rounded-full border border-black/10 bg-white/80 px-3 py-1 text-xs uppercase tracking-[0.25em] text-gray-500">
                        {POOL_LABEL[item.pool] ?? item.pool}
                      </span>
                      <h3 className="text-lg font-semibold text-[#171717]">{item.prizeName}</h3>
                    </div>
                    <span
                      className={`mt-1 inline-flex h-6 w-6 items-center justify-center rounded-full border text-xs font-semibold ${
                        selected
                          ? 'border-[#c79200] bg-[#f4c542] text-[#3d2c00]'
                          : 'border-black/10 bg-white text-gray-400'
                      }`}
                    >
                      {selected ? '✓' : ''}
                    </span>
                  </div>
                  <div className="mt-4 space-y-1 text-sm text-gray-600">
                    <p>类型：{PRIZE_TYPE_LABEL[item.prizeType] ?? item.prizeType}</p>
                    <p>到期：{formatDateOnly(item.expiresAt)}</p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
