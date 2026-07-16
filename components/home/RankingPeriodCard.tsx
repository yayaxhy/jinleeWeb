/* eslint-disable @next/next/no-img-element */
'use client';

import { useRef, useState, type PointerEvent } from 'react';

import type { PeriodKey, RankingItem } from '@/lib/home-page-data';
import { getVipLevelLabel } from '@/lib/vip-levels';

const PAGE_SIZE = 5;
const DEFAULT_RANKING_AVATAR = '/og-jinlee-logo.png';

function AvatarBadge({
  name,
  tone,
  avatarUrl,
  anonymous = false,
  size = 'default',
}: {
  name: string;
  tone: string;
  avatarUrl: string | null;
  anonymous?: boolean;
  size?: 'default' | 'featured' | 'compact';
}) {
  const initial = name.replace(/^神秘老板\s*/, '').trim().charAt(0) || '锦';
  const resolvedAvatar = anonymous ? DEFAULT_RANKING_AVATAR : avatarUrl;
  const sizeClass = {
    default: 'h-14 w-14 text-lg',
    featured: 'h-20 w-20 text-2xl',
    compact: 'h-12 w-12 text-base',
  }[size];

  return (
    <div className={`relative grid shrink-0 place-items-center overflow-hidden rounded-full bg-gradient-to-br ${sizeClass} ${tone} font-black text-white shadow-[0_12px_30px_rgba(0,0,0,0.35)] ring-2 ring-white/15`}>
      {resolvedAvatar ? (
        <img
          src={resolvedAvatar}
          alt={anonymous ? '锦鲤匿名头像' : `${name} 头像`}
          className={`h-full w-full ${anonymous ? 'bg-white object-contain p-1.5' : 'object-cover'}`}
        />
      ) : (
        initial.toUpperCase()
      )}
    </div>
  );
}

function VipBadge({ vipName, compact = false }: { vipName: string; compact?: boolean }) {
  return (
    <span className={`inline-flex w-fit items-center rounded-full border border-amber-100/30 bg-[linear-gradient(135deg,rgba(255,226,142,0.28),rgba(154,94,20,0.24))] font-bold tracking-[0.14em] text-amber-100 shadow-[0_0_20px_rgba(251,191,36,0.14)] ${compact ? 'mt-1 px-2 py-0.5 text-[0.62rem]' : 'mt-2 px-2.5 py-1 text-xs'}`}>
      {vipName}
    </span>
  );
}

function RankingEntries({
  period,
  pageIndex,
  items,
  emptyLabel,
  showTag,
  showVipLevel,
}: {
  period: PeriodKey;
  pageIndex: number;
  items: RankingItem[];
  emptyLabel: string;
  showTag: boolean;
  showVipLevel: boolean;
}) {
  const podiumItems = pageIndex === 0 ? items.slice(0, 3) : [];
  const champion = podiumItems[0];
  const standardItems = pageIndex === 0 ? items.slice(3) : items;
  const standardStartIndex = pageIndex === 0 ? 3 : pageIndex * PAGE_SIZE;

  return (
    <ol className="mt-4">
      {items.length === 0 ? (
          <li className="rounded-2xl bg-white/[0.045] px-4 py-5 text-sm text-white/45">
            {emptyLabel}
          </li>
      ) : null}

      {champion ? (() => {
        const anonymous = champion.anonymous || champion.tag.includes('匿名');
        const vipName = showVipLevel && !anonymous
          ? getVipLevelLabel(champion.vipLevel)
          : (showTag ? champion.tag : null);
        const subtitle = showVipLevel ? null : vipName;
        const championClass = showVipLevel
          ? 'relative mb-3 overflow-hidden rounded-[1.35rem] border border-amber-200/45 bg-[radial-gradient(circle_at_84%_6%,rgba(255,220,125,0.38),transparent_40%),radial-gradient(circle_at_16%_120%,rgba(183,110,20,0.32),transparent_44%),linear-gradient(135deg,rgba(85,57,16,0.96),rgba(25,19,11,0.98))] p-4 shadow-[0_0_0_1px_rgba(251,191,36,0.12),0_22px_54px_rgba(213,150,33,0.24)] md:p-5'
          : 'mb-2 overflow-hidden rounded-2xl border border-amber-200/20 bg-[radial-gradient(circle_at_82%_0%,rgba(241,193,104,0.22),transparent_42%),linear-gradient(135deg,rgba(68,49,19,0.76),rgba(23,20,14,0.96))] p-3.5 shadow-[0_18px_42px_rgba(0,0,0,0.3)]';

        return (
          <li className={championClass}>
            {showVipLevel ? <span className="pointer-events-none absolute -right-2 -top-7 text-7xl text-amber-100/[0.08]" aria-hidden="true">♛</span> : null}
            <div className="relative flex min-w-0 items-center gap-4 border-b border-amber-100/15 pb-3.5">
              <div className="relative">
                <AvatarBadge
                  name={champion.name}
                  tone={champion.tone}
                  avatarUrl={champion.avatarUrl}
                  anonymous={anonymous}
                  size="featured"
                />
                <span className="absolute -bottom-1 left-1/2 grid h-6 min-w-8 -translate-x-1/2 place-items-center rounded-full border border-amber-100/35 bg-[#4b3211] px-1.5 text-[0.65rem] font-black text-amber-100 shadow-lg">
                  #1
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="rounded-full border border-amber-100/20 bg-amber-200/10 px-2 py-0.5 text-[0.65rem] font-semibold tracking-[0.16em] text-amber-100">
                    TOP 1
                  </span>
                  {anonymous ? (
                    <span className="rounded-full bg-emerald-400/10 px-2 py-0.5 text-[0.65rem] text-emerald-100">
                      匿名
                    </span>
                  ) : null}
                </div>
                <p className="mt-2 truncate text-lg font-bold text-[#fffaf0]">{champion.name}</p>
                {showVipLevel && vipName ? <VipBadge vipName={vipName} /> : null}
                {subtitle ? <p className="mt-1 truncate text-sm text-amber-100/55">{subtitle}</p> : null}
              </div>
              <span className="self-start text-xl leading-none text-amber-200/80" aria-hidden="true">♛</span>
            </div>

            {podiumItems.length > 1 ? (
              <div className="mt-3 grid gap-2">
                {podiumItems.slice(1).map((item, index) => {
                  const rank = index + 2;
                  const runnerUpAnonymous = item.anonymous || item.tag.includes('匿名');
                  const vipName = showVipLevel && !runnerUpAnonymous
                    ? getVipLevelLabel(item.vipLevel)
                    : (showTag ? item.tag : null);
                  const subtitle = showVipLevel ? null : vipName;
                  const rankStyle = rank === 2
                    ? 'border-slate-100/35 bg-[linear-gradient(135deg,rgba(226,232,240,0.18),rgba(71,85,105,0.16))] text-slate-100 shadow-[0_10px_28px_rgba(148,163,184,0.1)]'
                    : 'border-orange-200/35 bg-[linear-gradient(135deg,rgba(251,146,60,0.2),rgba(120,53,15,0.2))] text-orange-100 shadow-[0_10px_28px_rgba(251,146,60,0.1)]';

                  return (
                    <div key={`${period}-${item.name}-${rank}`} className={`flex min-w-0 items-center gap-3 rounded-xl border p-2.5 ${rankStyle}`}>
                      <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-current/30 bg-black/15 text-center font-mono text-xs font-black">#{rank}</div>
                      <AvatarBadge
                        name={item.name}
                        tone={item.tone}
                        avatarUrl={item.avatarUrl}
                        anonymous={runnerUpAnonymous}
                        size="compact"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-[#fff7ed]">{item.name}</p>
                        {showVipLevel && vipName ? <VipBadge vipName={vipName} compact /> : null}
                        {subtitle ? <p className="mt-1 truncate text-xs text-white/45">{subtitle}</p> : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : null}
          </li>
        );
      })() : null}

      {standardItems.map((item, index) => {
        const rankingIndex = standardStartIndex + index;
        const anonymous = item.anonymous || item.tag.includes('匿名');
        const vipName = showVipLevel && !anonymous
          ? getVipLevelLabel(item.vipLevel)
          : (showTag ? item.tag : null);
        const subtitle = showVipLevel ? null : vipName;

        return (
          <li key={`${period}-${item.name}-${rankingIndex}`} className="flex min-w-0 items-center gap-4 border-b border-white/10 py-4 last:border-b-0">
            <div className="w-8 shrink-0 font-mono text-sm text-orange-200/90">#{rankingIndex + 1}</div>
            <AvatarBadge
              name={item.name}
              tone={item.tone}
              avatarUrl={item.avatarUrl}
              anonymous={anonymous}
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate text-base font-semibold text-[#fff7ed]">{item.name}</p>
                {anonymous ? (
                  <span className="rounded-full bg-emerald-400/10 px-2 py-0.5 text-[0.65rem] text-emerald-100">
                    匿名
                  </span>
                ) : null}
              </div>
              {showVipLevel && vipName ? <VipBadge vipName={vipName} compact /> : null}
              {subtitle ? <p className="mt-1 truncate text-sm text-white/45">{subtitle}</p> : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function RankingPeriodCard({
  period,
  items,
  accent,
  emptyLabel,
  showTag = true,
  showVipLevel = false,
}: {
  period: PeriodKey;
  items: RankingItem[];
  accent: string;
  emptyLabel: string;
  showTag?: boolean;
  showVipLevel?: boolean;
}) {
  const [page, setPage] = useState(0);
  const dragStartX = useRef<number | null>(null);
  const pageCount = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pages = Array.from({ length: pageCount }, (_, pageIndex) => (
    items.slice(pageIndex * PAGE_SIZE, (pageIndex + 1) * PAGE_SIZE)
  ));

  const goToPage = (targetPage: number) => {
    const nextPage = Math.min(Math.max(targetPage, 0), pageCount - 1);
    setPage(nextPage);
  };

  const startDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (!event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0)) return;

    dragStartX.current = event.clientX;
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const finishDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (!event.isPrimary || dragStartX.current === null) return;

    const deltaX = event.clientX - dragStartX.current;
    dragStartX.current = null;
    if (Math.abs(deltaX) < 48) return;

    goToPage(safePage + (deltaX < 0 ? 1 : -1));
  };

  return (
    <article className="min-w-[82vw] snap-center rounded-[2rem] border border-white/10 bg-[#11100d]/82 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.34)] backdrop-blur md:min-w-[420px] md:p-6 lg:min-w-[31%]">
      <div className="mb-2">
        <p className={`h-1.5 w-16 rounded-full ${accent}`} />
        <h3 className="mt-4 text-2xl font-semibold text-[#fff7ed]">{period}</h3>
      </div>

      <div
        onPointerDown={startDrag}
        onPointerUp={finishDrag}
        onPointerCancel={() => { dragStartX.current = null; }}
        className="overflow-hidden [touch-action:pan-y]"
        aria-label={`${period}榜单分页`}
      >
        <div
          className="flex will-change-transform transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
          style={{
            width: `${pageCount * 100}%`,
            transform: `translate3d(-${(safePage * 100) / pageCount}%, 0, 0)`,
          }}
        >
          {pages.map((pageItems, pageIndex) => (
            <div
              key={`${period}-page-${pageIndex}`}
              className="shrink-0"
              style={{ width: `${100 / pageCount}%` }}
            >
              <RankingEntries
                period={period}
                pageIndex={pageIndex}
                items={pageItems}
                emptyLabel={emptyLabel}
                showTag={showTag}
                showVipLevel={showVipLevel}
              />
            </div>
          ))}
        </div>
      </div>

      {pageCount > 1 ? (
        <div className="mt-5 flex justify-center gap-2" aria-label={`${period}榜单第 ${safePage + 1} 页，共 ${pageCount} 页`}>
          {pages.map((_, pageIndex) => (
            <button
              key={`${period}-dot-${pageIndex}`}
              type="button"
              onClick={() => goToPage(pageIndex)}
              aria-label={`查看第 ${pageIndex + 1} 页`}
              aria-current={safePage === pageIndex ? 'page' : undefined}
              className={`h-2.5 rounded-full transition-all duration-300 ${safePage === pageIndex ? 'w-7 bg-amber-200 shadow-[0_0_16px_rgba(251,191,36,0.45)]' : 'w-2.5 bg-white/25 hover:bg-white/45'}`}
            >
              <span className="sr-only">第 {pageIndex + 1} 页</span>
            </button>
          ))}
        </div>
      ) : null}
    </article>
  );
}
