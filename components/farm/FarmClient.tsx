'use client';

import { useEffect, useMemo, useState } from 'react';
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

type Props = {
  initialDashboard: FarmDashboard;
};

export function FarmClient({ initialDashboard }: Props) {
  const [dashboard, setDashboard] = useState(initialDashboard);
  const [selectedSeed, setSelectedSeed] = useState<FarmSeedTypeValue | null>(
    initialDashboard.seeds.find((seed) => seed.unlocked)?.code ?? null,
  );
  const [balanceAmount, setBalanceAmount] = useState('1');
  const [pointAmount, setPointAmount] = useState('100');
  const [coinAmount, setCoinAmount] = useState('100');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingKey, setLoadingKey] = useState<string | null>(null);

  useEffect(() => {
    if (selectedSeed && dashboard.seeds.some((seed) => seed.code === selectedSeed && seed.unlocked)) {
      return;
    }
    setSelectedSeed(dashboard.seeds.find((seed) => seed.unlocked)?.code ?? null);
  }, [dashboard.seeds, selectedSeed]);

  const plotsByIndex = useMemo(() => {
    const map = new Map(dashboard.plots.map((plot) => [plot.plotIndex, plot]));
    return Array.from({ length: MAX_PLOTS }, (_, idx) => {
      const plotIndex = idx + 1;
      return {
        plotIndex,
        unlocked: plotIndex <= dashboard.summary.unlockedPlots,
        plot: map.get(plotIndex) ?? null,
      };
    });
  }, [dashboard.plots, dashboard.summary.unlockedPlots]);

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
      if (!res.ok) {
        throw new Error(typeof data?.error === 'string' ? data.error : '操作失败');
      }
      if (data?.dashboard) {
        setDashboard(data.dashboard as FarmDashboard);
      }
      setMessage(typeof data?.message === 'string' ? data.message : '操作成功');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoadingKey(null);
    }
  };

  const currentSeed = dashboard.seeds.find((seed) => seed.code === selectedSeed) ?? null;
  const currentSeedName = currentSeed?.name ?? null;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#fff7e0,_#f7f3ef_55%,_#efe6d0)] px-6 py-12 text-[#24190a]">
      <div className="mx-auto flex max-w-7xl flex-col gap-8">
        <section className="overflow-hidden rounded-[36px] border border-[#d8bf77]/40 bg-[linear-gradient(135deg,_rgba(255,249,232,0.96),_rgba(255,239,196,0.92))] p-8 shadow-[0_20px_60px_rgba(62,42,12,0.08)]">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-4">
              <p className="text-xs uppercase tracking-[0.5em] text-[#9e7c22]">Koi Farm</p>
              <div className="space-y-2">
                <h1 className="text-4xl font-semibold tracking-[0.08em]">锦鲤庄园</h1>
                <p className="max-w-2xl text-sm leading-7 text-[#6f5732]">
                  用金币买种子，在固定地块上慢慢生长，再把收获兑换成锦鲤积分。第一版只做网页，不接机器人提醒。
                </p>
              </div>
              <div className="flex flex-wrap gap-3 text-xs uppercase tracking-[0.28em] text-[#9e7c22]">
                <span className="rounded-full border border-[#d8bf77]/60 bg-white/50 px-4 py-2">1 余额 = 100 金币</span>
                <span className="rounded-full border border-[#d8bf77]/60 bg-white/50 px-4 py-2">1 积分 = 10 金币</span>
                <span className="rounded-full border border-[#d8bf77]/60 bg-white/50 px-4 py-2">100 金币 = 1 积分</span>
              </div>
            </div>
            <Link
              href="/profile"
              className="inline-flex items-center justify-center rounded-full border border-[#d8bf77]/70 px-5 py-2 text-xs font-semibold uppercase tracking-[0.35em] text-[#8a6000] transition hover:bg-[#f7e0a0]/35"
            >
              返回个人主页
            </Link>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            {[
              { label: '庄园金币', value: `${formatAmount(dashboard.summary.coins)} 金币` },
              { label: '庄园经验', value: dashboard.summary.experience.toString() },
              { label: '庄园等级', value: `Lv.${dashboard.summary.level}` },
              { label: '可用余额', value: `¥ ${formatAmount(dashboard.summary.totalBalance)}` },
              { label: '锦鲤积分', value: formatAmount(dashboard.summary.loyaltyPoints) },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-3xl border border-[#d8bf77]/30 bg-white/70 p-5 shadow-[0_12px_30px_rgba(62,42,12,0.05)]"
              >
                <p className="text-xs uppercase tracking-[0.38em] text-[#9e7c22]">{item.label}</p>
                <p className="mt-3 text-2xl font-semibold tracking-[0.06em]">{item.value}</p>
              </div>
            ))}
          </div>

          {(message || error) && (
            <div
              className={`mt-6 rounded-2xl border px-4 py-3 text-sm ${
                error
                  ? 'border-rose-200 bg-rose-50 text-rose-700'
                  : 'border-emerald-200 bg-emerald-50 text-emerald-700'
              }`}
            >
              {error ?? message}
            </div>
          )}
        </section>

        <div className="grid gap-8 xl:grid-cols-[1.2fr_0.8fr]">
          <section className="space-y-6 rounded-[32px] border border-[#d8bf77]/30 bg-white/80 p-6 shadow-[0_16px_40px_rgba(62,42,12,0.06)]">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.4em] text-[#9e7c22]">Plots</p>
                <h2 className="mt-1 text-2xl font-semibold">我的地块</h2>
              </div>
              <div className="rounded-full border border-[#d8bf77]/40 bg-[#fff7e4] px-4 py-2 text-sm text-[#6f5732]">
                当前已解锁 {dashboard.summary.unlockedPlots} / {MAX_PLOTS} 块地
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {plotsByIndex.map(({ plotIndex, unlocked, plot }) => {
                const status = unlocked ? plot?.status ?? 'EMPTY' : 'LOCKED';
                return (
                  <div
                    key={plotIndex}
                    className={`rounded-[28px] border p-5 transition ${
                      status === 'READY'
                        ? 'border-[#d49c17] bg-[linear-gradient(135deg,_#fff8d8,_#ffe9a8)] shadow-[0_12px_30px_rgba(212,156,23,0.18)]'
                        : status === 'GROWING'
                          ? 'border-[#d8bf77]/40 bg-[linear-gradient(135deg,_#fffdf2,_#f6edd2)]'
                          : unlocked
                            ? 'border-[#d8bf77]/30 bg-[#fffdf7]'
                            : 'border-dashed border-[#d8bf77]/25 bg-[#f8f2e3] text-[#8c7a5a]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-xs uppercase tracking-[0.35em] text-[#9e7c22]">Plot {plotIndex}</p>
                        <h3 className="mt-2 text-xl font-semibold">
                          {!unlocked
                            ? '待解锁'
                            : plot?.seedType
                              ? `${dashboard.seeds.find((seed) => seed.code === plot.seedType)?.emoji ?? '🌱'} ${
                                  dashboard.seeds.find((seed) => seed.code === plot.seedType)?.name ?? plot.seedType
                                }`
                              : '空地'}
                        </h3>
                      </div>
                      <span className="rounded-full border border-[#d8bf77]/40 px-3 py-1 text-xs uppercase tracking-[0.28em] text-[#8a6000]">
                        {status === 'LOCKED'
                          ? 'LOCKED'
                          : status === 'EMPTY'
                            ? 'EMPTY'
                            : status === 'GROWING'
                              ? 'GROWING'
                              : 'READY'}
                      </span>
                    </div>

                    <div className="mt-4 space-y-2 text-sm text-[#6f5732]">
                      {!unlocked ? (
                        <p>解锁更多地块后，这里就能继续种植。</p>
                      ) : status === 'EMPTY' ? (
                        <>
                          <p>选择右侧种子后，直接把它种在这块地里。</p>
                          <button
                            type="button"
                            disabled={!currentSeed || loadingKey === `plant:${plotIndex}`}
                            onClick={() =>
                              currentSeed &&
                              runAction('plant', { plotIndex, seedType: currentSeed }, `plant:${plotIndex}`)
                            }
                            className="mt-3 w-full rounded-full bg-[#8a6000] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#724d00] disabled:opacity-50"
                          >
                            {loadingKey === `plant:${plotIndex}`
                              ? '种植中…'
                              : currentSeedName
                                ? `种植 ${currentSeedName}`
                                : '请选择种子'}
                          </button>
                        </>
                      ) : status === 'GROWING' ? (
                        <>
                          <p>成熟倒计时：{formatRemaining(plot?.remainingSeconds ?? 0)}</p>
                          <p>预计成熟时间：{plot?.readyAt ? new Date(plot.readyAt).toLocaleString('zh-CN') : '-'}</p>
                        </>
                      ) : (
                        <>
                          <p>作物已成熟，可以立即收获。</p>
                          <button
                            type="button"
                            disabled={loadingKey === `harvest:${plotIndex}`}
                            onClick={() => runAction('harvest', { plotIndex }, `harvest:${plotIndex}`)}
                            className="mt-3 w-full rounded-full bg-[#d49c17] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#b87f00] disabled:opacity-50"
                          >
                            {loadingKey === `harvest:${plotIndex}` ? '收获中…' : '立即收获'}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="rounded-[28px] border border-[#d8bf77]/30 bg-[#fff9ec] p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.38em] text-[#9e7c22]">Expand</p>
                  <h3 className="mt-1 text-xl font-semibold">扩地</h3>
                </div>
                {dashboard.summary.nextPlotCost ? (
                  <button
                    type="button"
                    disabled={loadingKey === 'expand'}
                    onClick={() => runAction('expand', {}, 'expand')}
                    className="rounded-full bg-[#8a6000] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[#724d00] disabled:opacity-50"
                  >
                    {loadingKey === 'expand' ? '扩地中…' : `解锁下一块地（${formatAmount(dashboard.summary.nextPlotCost)} 金币）`}
                  </button>
                ) : (
                  <span className="rounded-full border border-[#d8bf77]/40 px-4 py-2 text-sm text-[#8a6000]">已达到最大地块数</span>
                )}
              </div>
            </div>
          </section>

          <div className="space-y-8">
            <section className="rounded-[32px] border border-[#d8bf77]/30 bg-white/80 p-6 shadow-[0_16px_40px_rgba(62,42,12,0.06)]">
              <div>
                <p className="text-xs uppercase tracking-[0.4em] text-[#9e7c22]">Exchange</p>
                <h2 className="mt-1 text-2xl font-semibold">金币兑换</h2>
              </div>

              <div className="mt-5 space-y-4">
                {[
                  {
                    title: '余额 -> 金币',
                    value: balanceAmount,
                    onChange: setBalanceAmount,
                    suffix: '余额',
                    action: () => runAction('exchange_balance', { amount: balanceAmount }, 'exchange_balance'),
                    loading: 'exchange_balance',
                  },
                  {
                    title: '积分 -> 金币',
                    value: pointAmount,
                    onChange: setPointAmount,
                    suffix: '积分',
                    action: () => runAction('exchange_points', { amount: pointAmount }, 'exchange_points'),
                    loading: 'exchange_points',
                  },
                  {
                    title: '金币 -> 积分',
                    value: coinAmount,
                    onChange: setCoinAmount,
                    suffix: '金币',
                    action: () =>
                      runAction('exchange_coins_to_points', { amount: coinAmount }, 'exchange_coins_to_points'),
                    loading: 'exchange_coins_to_points',
                  },
                ].map((item) => (
                  <div key={item.title} className="rounded-2xl border border-[#d8bf77]/25 bg-[#fffaf0] p-4">
                    <p className="text-sm font-semibold">{item.title}</p>
                    <div className="mt-3 flex gap-3">
                      <input
                        value={item.value}
                        onChange={(event) => item.onChange(event.target.value)}
                        className="flex-1 rounded-2xl border border-[#d8bf77]/30 bg-white px-4 py-2 text-sm outline-none ring-0 focus:border-[#d49c17]"
                        placeholder={`输入${item.suffix}数量`}
                      />
                      <button
                        type="button"
                        disabled={loadingKey === item.loading}
                        onClick={item.action}
                        className="rounded-full bg-[#d49c17] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#b87f00] disabled:opacity-50"
                      >
                        {loadingKey === item.loading ? '处理中…' : '兑换'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-[32px] border border-[#d8bf77]/30 bg-white/80 p-6 shadow-[0_16px_40px_rgba(62,42,12,0.06)]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.4em] text-[#9e7c22]">Seeds</p>
                  <h2 className="mt-1 text-2xl font-semibold">种子商店</h2>
                </div>
                {currentSeed ? (
                  <span className="rounded-full border border-[#d8bf77]/40 bg-[#fff7e4] px-4 py-2 text-sm text-[#8a6000]">
                    当前选择：{currentSeed.name}
                  </span>
                ) : null}
              </div>

              <div className="mt-5 space-y-3">
                {dashboard.seeds.map((seed) => {
                  const selected = seed.code === selectedSeed;
                  return (
                    <button
                      key={seed.code}
                      type="button"
                      disabled={!seed.unlocked}
                      onClick={() => setSelectedSeed(seed.code)}
                      className={`w-full rounded-[24px] border p-4 text-left transition ${
                        selected
                          ? 'border-[#d49c17] bg-[#fff2c6] shadow-[0_12px_24px_rgba(212,156,23,0.12)]'
                          : seed.unlocked
                            ? 'border-[#d8bf77]/25 bg-[#fffaf0] hover:border-[#d49c17]/60'
                            : 'border-dashed border-black/10 bg-[#f6f0e3] text-gray-400'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-xl">{seed.emoji}</p>
                          <p className="mt-2 text-lg font-semibold">{seed.name}</p>
                          <p className="mt-1 text-sm text-[#6f5732]">{seed.description}</p>
                        </div>
                        <span className="rounded-full border border-[#d8bf77]/40 px-3 py-1 text-xs uppercase tracking-[0.28em] text-[#8a6000]">
                          Lv.{seed.unlockLevel}
                        </span>
                      </div>
                      <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-[#6f5732] md:grid-cols-4">
                        <div>成本：{formatAmount(seed.costCoins)} 金币</div>
                        <div>收益：{formatAmount(seed.minYieldCoins)} ~ {formatAmount(seed.maxYieldCoins)}</div>
                        <div>经验：+{seed.experience}</div>
                        <div>成熟：{getFarmSeedDurationLabel(seed.durationMinutes)}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="rounded-[32px] border border-[#d8bf77]/30 bg-white/80 p-6 shadow-[0_16px_40px_rgba(62,42,12,0.06)]">
              <div>
                <p className="text-xs uppercase tracking-[0.4em] text-[#9e7c22]">Recent</p>
                <h2 className="mt-1 text-2xl font-semibold">最近记录</h2>
              </div>
              <div className="mt-5 space-y-3">
                {dashboard.recentLogs.length > 0 ? (
                  dashboard.recentLogs.map((log) => (
                    <div key={log.id} className="rounded-2xl border border-[#d8bf77]/20 bg-[#fffaf0] p-4 text-sm text-[#6f5732]">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-semibold text-[#24190a]">{actionLabelMap[log.actionType] ?? log.actionType}</p>
                        <span className="text-xs text-[#9e7c22]">{new Date(log.createdAt).toLocaleString('zh-CN')}</span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-4 text-xs">
                        <span>金币 {formatAmount(log.coinDelta)}</span>
                        <span>积分 {formatAmount(log.pointDelta)}</span>
                        <span>余额 {formatAmount(log.balanceDelta)}</span>
                        <span>经验 +{log.expDelta}</span>
                        {log.plotIndex ? <span>地块 {log.plotIndex}</span> : null}
                      </div>
                      {log.note ? <p className="mt-2 text-xs text-[#8c6a2f]">{log.note}</p> : null}
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-gray-400">暂时还没有庄园记录。</p>
                )}
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
