'use client';

import type { CSSProperties } from 'react';

import type { RecentDispatchItem } from '@/lib/home-page-data';

const fallbackItems: RecentDispatchItem[] = [
  {
    id: 'empty',
    title: '锦鲤客服在线',
    detail: '加入 Discord，说明游戏、段位和其他要求即可。',
    timeLabel: '现在',
    statusLabel: '实时咨询',
  },
];

function DispatchCard({ item }: { item: RecentDispatchItem }) {
  return (
    <article className="w-[min(70vw,250px)] shrink-0 rounded-[1.15rem] border border-white/10 bg-white/[0.055] p-3.5 shadow-[0_14px_36px_rgba(0,0,0,0.2)] md:w-[250px]">
      <div className="flex items-center justify-between gap-3">
        <span className="rounded-full bg-orange-300/10 px-3 py-1 text-xs font-semibold text-orange-100">
          {item.statusLabel}
        </span>
        <span className="text-xs text-white/35">{item.timeLabel}</span>
      </div>
      <h3 className="mt-2.5 text-sm font-semibold tracking-[-0.02em] text-[#fff7ed]">{item.title}</h3>
      <p className="mt-1.5 line-clamp-2 text-xs leading-5 text-white/45">{item.detail}</p>
    </article>
  );
}

export function DispatchTicker({ dispatches }: { dispatches: RecentDispatchItem[] }) {
  const items = dispatches.length > 0 ? dispatches : fallbackItems;
  const animationSeconds = Math.max(20, items.length * 8);

  return (
    <section aria-label="锦鲤公会实时动态" className="mx-auto mt-7 max-w-4xl overflow-hidden">
      <div className="mb-3 flex items-center gap-3 px-1">
        <p className="text-xs font-semibold tracking-[0.36em] text-orange-200/70">公会实时动态</p>
        <span className="h-px flex-1 bg-white/10" />
      </div>

      <div className="group relative overflow-hidden">
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-8 bg-gradient-to-r from-[#050506] to-transparent md:w-12" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-8 bg-gradient-to-l from-[#050506] to-transparent md:w-12" />
        <div
          className="flex w-max animate-[jinlee-dispatch-marquee_var(--dispatch-duration)_linear_infinite] group-hover:[animation-play-state:paused] motion-reduce:animate-none"
          style={{ '--dispatch-duration': `${animationSeconds}s` } as CSSProperties}
        >
          {[false, true].map((isDuplicate) => (
            <div key={String(isDuplicate)} className="flex gap-4 pr-4" aria-hidden={isDuplicate || undefined}>
              {items.map((item) => (
                <DispatchCard key={`${isDuplicate ? 'duplicate' : 'primary'}-${item.id}`} item={item} />
              ))}
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes jinlee-dispatch-marquee {
          from { transform: translate3d(0, 0, 0); }
          to { transform: translate3d(-50%, 0, 0); }
        }
      `}</style>
    </section>
  );
}
