"use client";

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { PEIWAN_GAME_TAG_FIELDS } from '@/constants/peiwan';

type PeiwanItem = {
  id: number;
  serverDisplayName: string | null;
  level: string;
  sex: string;
  techTag: boolean;
  price: number | string | bigint | null;
  gameTags: Record<string, boolean>;
};

type ApiResponse = {
  data: PeiwanItem[];
};

const LOCAL_IMG_EXTS = ['png', 'jpg', 'gif'] as const;

const formatPrice = (value: PeiwanItem['price']) => {
  if (value === null || value === undefined) return '价格待定';
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return String(value);
  return `${numeric} 币/H`;
};

const CardImage = ({ item }: { item: PeiwanItem }) => {
  const [idx, setIdx] = useState(0);
  const sources = useMemo(() => LOCAL_IMG_EXTS.map((ext) => `/peiwanList/img/${item.id}.${ext}`), [item.id]);
  const currentSrc = sources[Math.min(idx, sources.length - 1)];

  return (
    <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-white/10 bg-white/5">
      <Image
        src={currentSrc}
        alt={item.serverDisplayName ?? `陪玩 #${item.id}`}
        fill
        sizes="(min-width: 1024px) 320px, (min-width: 640px) 50vw, 100vw"
        className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
        onError={() => {
          if (idx < sources.length - 1) {
            setIdx(idx + 1);
          }
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/10 to-transparent" />
      <div className="absolute bottom-3 left-3 inline-flex items-center gap-2 rounded-full bg-black/60 px-3 py-1 text-xs text-white">
        <span className="font-semibold tracking-wide">ID {item.id}</span>
        {item.techTag && <span className="rounded-full bg-white/20 px-2 py-0.5">技术</span>}
      </div>
    </div>
  );
};

const RecommendationCard = ({ item }: { item: PeiwanItem }) => {
  const gameTags = PEIWAN_GAME_TAG_FIELDS.filter((tag) => item.gameTags?.[tag]).slice(0, 3);

  return (
    <article className="group relative flex flex-col gap-4 overflow-hidden rounded-3xl border border-white/15 bg-white/10 p-4 backdrop-blur-sm shadow-xl hover:border-white/25 transition">
      <CardImage item={item} />

      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-sm uppercase tracking-[0.35em] text-white/60">陪玩推荐</p>
          <h3 className="text-xl font-semibold text-white">
            {item.serverDisplayName ?? `陪玩 #${item.id}`}
          </h3>
          <p className="text-xs text-white/70">{item.sex} · {formatPrice(item.price)}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <span className="rounded-full bg-gradient-to-r from-[#7c5dff] to-[#b499ff] px-3 py-1 text-xs font-semibold text-white shadow-md">
            {item.level}
          </span>
          <Link
            href="/peiwanList"
            className="text-xs text-white/80 underline underline-offset-4 decoration-white/40 hover:text-white"
          >
            查看列表
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 text-xs text-white/80">
        {gameTags.length > 0 ? (
          gameTags.map((tag) => (
            <span
              key={tag}
              className="rounded-full border border-white/20 bg-white/10 px-2 py-1"
            >
              {tag}
            </span>
          ))
        ) : (
          <span className="rounded-full border border-white/15 bg-white/5 px-2 py-1">自由接单</span>
        )}
      </div>
    </article>
  );
};

export function PeiwanRecommendations() {
  const [items, setItems] = useState<PeiwanItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [seed] = useState(() => Math.random().toString(36).slice(2, 10));

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/peiwan?page=1&pageSize=6&seed=${seed}`, {
          signal: controller.signal,
          cache: 'no-store',
        });
        if (!res.ok) {
          throw new Error('加载失败');
        }
        const json = (await res.json()) as ApiResponse;
        setItems(json.data || []);
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setError('推荐数据加载失败，稍后再试。');
      } finally {
        setLoading(false);
      }
    };

    load();
    return () => controller.abort();
  }, [seed]);

  return (
    <section className="w-full px-6 pb-16 -mt-8">
      <div className="mx-auto max-w-6xl rounded-3xl border border-white/20 bg-white/10 p-6 sm:p-10 shadow-2xl backdrop-blur-2xl space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.45em] text-white/70">Spotlight</p>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-[0.2em] text-[#f0eaff]">陪玩推荐</h2>
            
          </div>
        </div>

        {loading && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, idx) => (
              <div
                key={idx}
                className="animate-pulse rounded-3xl border border-white/15 bg-white/5 p-4 aspect-[4/3] sm:aspect-auto"
              />
            ))}
          </div>
        )}

        {!loading && error && <p className="text-sm text-rose-200">{error}</p>}

        {!loading && !error && (
          <>
            {items.length === 0 ? (
              <p className="text-sm text-white/80">暂无推荐，稍后再来看看～</p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((item) => (
                  <RecommendationCard key={item.id} item={item} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
