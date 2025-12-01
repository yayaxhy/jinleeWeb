"use client";

import Image from 'next/image';
import { useEffect, useState } from 'react';
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

const MAX_DISPLAY = 8;
type ImageEntry = { id: number; src: string };

const buildFallbackItem = (id: number): PeiwanItem => ({
  id,
  serverDisplayName: `陪玩 #${id}`,
  level: '未知' as PeiwanItem['level'],
  sex: '推荐' as PeiwanItem['sex'],
  techTag: false,
  price: null,
  gameTags: {},
});
const formatPrice = (value: PeiwanItem['price']) => {
  if (value === null || value === undefined) return '价格待定';
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return String(value);
  return `${numeric} 币/H`;
};

const CardImage = ({ item, src }: { item: PeiwanItem; src: string }) => {
  return (
    <div className="group relative w-full aspect-[4/5] overflow-hidden bg-[#f6f6f6]">
      <Image
        src={src}
        alt={item.serverDisplayName ?? `陪玩 #${item.id}`}
        fill
        sizes="(min-width: 1280px) 25vw, (min-width: 768px) 50vw, 100vw"
        className="h-full w-full object-contain transition duration-700 ease-out group-hover:scale-[1.02]"
      />
    </div>
  );
};

const RecommendationCard = ({ item, src }: { item: PeiwanItem; src: string }) => {
  const tags = PEIWAN_GAME_TAG_FIELDS.filter((tag) => item.gameTags?.[tag]).slice(0, 2);

  return (
    <article className="flex flex-col items-center gap-4 text-center">
      <CardImage item={item} src={src} />
      <div className="space-y-1">
        <p className="text-[0.7rem] uppercase tracking-[0.28em] text-neutral-500">
          {item.sex || '推荐'}
        </p>
        <p className="text-sm font-semibold text-neutral-900">
          {item.serverDisplayName ?? `陪玩 #${item.id}`}
        </p>
        <p className="text-xs text-neutral-500">{formatPrice(item.price)}</p>
        {tags.length > 0 && (
          <div className="flex justify-center gap-2 text-[0.68rem] text-neutral-500">
            {tags.map((tag) => (
              <span key={tag}>{tag}</span>
            ))}
          </div>
        )}
      </div>
    </article>
  );
};

export function PeiwanRecommendations() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [available, setAvailable] = useState<{ item: PeiwanItem; src: string }[]>([]);
  const [imageEntries, setImageEntries] = useState<ImageEntry[]>([]);
  const [start, setStart] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      setLoading(true);
      setError(null);
      setAvailable([]);

      try {
        // 1) 读取本地名片列表
        const imgRes = await fetch('/api/peiwanRecommend', { signal: controller.signal, cache: 'no-store' });
        if (!imgRes.ok) throw new Error('图片列表加载失败');
        const imgJson = (await imgRes.json()) as { data?: ImageEntry[] };
        const imgs = (imgJson.data || []).slice(0, MAX_DISPLAY);
        setImageEntries(imgs);
        if (imgs.length === 0) {
          setAvailable([]);
          return;
        }

        // 2) 拉取陪玩数据（尽量覆盖更多）
        const res = await fetch(`/api/peiwan?page=1&pageSize=500&seed=home`, {
          signal: controller.signal,
          cache: 'no-store',
        });
        if (!res.ok) {
          throw new Error('加载失败');
        }
        const json = (await res.json()) as ApiResponse;
        const nextItems = json.data || [];
        const itemMap = new Map(nextItems.map((item) => [item.id, item]));

        const found: { item: PeiwanItem; src: string }[] = [];
        const missing: ImageEntry[] = [];

        imgs.forEach((img) => {
          const item = itemMap.get(img.id);
          if (item) {
            found.push({ item, src: img.src });
          } else {
            missing.push(img);
          }
        });

        // 3) 对于未命中的 id，单独请求一次
        for (const miss of missing) {
          if (found.length >= MAX_DISPLAY) break;
          try {
            const r = await fetch(`/api/peiwan?id=${miss.id}&page=1&pageSize=1`, {
              signal: controller.signal,
              cache: 'no-store',
            });
            if (r.ok) {
              const j = (await r.json()) as ApiResponse;
              const item = j.data?.[0];
              if (item) {
                found.push({ item, src: miss.src });
                continue;
              }
            }
          } catch (err) {
            if (err instanceof DOMException && err.name === 'AbortError') return;
          }
          // 如果没查到数据库，也展示本地名片，使用占位信息
          found.push({ item: buildFallbackItem(miss.id), src: miss.src });
        }

        setAvailable(found.slice(0, MAX_DISPLAY));
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setError('推荐数据加载失败，稍后再试。');
      } finally {
        setLoading(false);
      }
    };

    load();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    setStart(0);
  }, [available.length]);

  const visible = (() => {
    if (available.length <= 4) return available;
    const out: { item: PeiwanItem; src: string }[] = [];
    for (let i = 0; i < 4; i += 1) {
      out.push(available[(start + i) % available.length]);
    }
    return out;
  })();

  const handlePrev = () => {
    setStart((prev) => (available.length === 0 ? 0 : (prev - 4 + available.length) % available.length));
  };

  const handleNext = () => {
    setStart((prev) => (available.length === 0 ? 0 : (prev + 4) % available.length));
  };

  return (
    <section className="w-full h-full text-neutral-900 flex flex-col">
      <div className="w-full flex-1 flex flex-col justify-center gap-8">
        <div className="text-center text-2xl sm:text-2xl font-semibold tracking-[0.22em] text-neutral-800">
          陪玩推荐
        </div>

        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-0">
            {Array.from({ length: MAX_DISPLAY }).map((_, key) => (
              <div
                key={key}
                className="h-[360px] sm:h-[420px] animate-pulse bg-neutral-100"
              />
            ))}
          </div>
        )}

        {!loading && error && <p className="text-sm text-rose-500 text-center">{error}</p>}

        {!loading && !error && (
          <>
            {available.length === 0 ? (
              <p className="text-sm text-neutral-700 text-center">暂无推荐，稍后再来看看～</p>
            ) : (
              <div className="relative w-full">
                {available.length > 4 && (
                  <>
                    <button
                      type="button"
                      onClick={handlePrev}
                      className="absolute left-4 top-1/2 -translate-y-1/2 z-10 flex h-12 w-12 items-center justify-center rounded-full bg-neutral-900/80 text-white text-2xl shadow-lg hover:bg-neutral-900 focus:outline-none focus:ring-2 focus:ring-white/70"
                      aria-label="上一组"
                    >
                      ‹
                    </button>
                    <button
                      type="button"
                      onClick={handleNext}
                      className="absolute right-4 top-1/2 -translate-y-1/2 z-10 flex h-12 w-12 items-center justify-center rounded-full bg-neutral-900/80 text-white text-2xl shadow-lg hover:bg-neutral-900 focus:outline-none focus:ring-2 focus:ring-white/70"
                      aria-label="下一组"
                    >
                      ›
                    </button>
                  </>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-0 w-full">
                  {visible.map(({ item, src }) => (
                    <RecommendationCard key={`${item.id}-${src}`} item={item} src={src} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
