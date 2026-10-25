"use client";
import { SiteText, useSiteCopy } from "@/components/SiteCopyProvider";


import Image from 'next/image';
import { useEffect, useState } from 'react';
import { formatAmountDown2 } from '@/lib/numberFormat';

type PeiwanItem = {
  id: number;
  serverDisplayName: string | null;
  level: string;
  sex: string;
  price: number | string | bigint | null;
  gameLabels: string[];
};

type ApiResponse = {
  data: PeiwanItem[];
};

const MAX_DISPLAY = 8;
type ImageEntry = { id: number; src: string };

const buildFallbackItem = (id: number): PeiwanItem => ({
  id,
  serverDisplayName: `陪玩 #${id}`,
  level: '未知',
  sex: '推荐',
  price: null,
  gameLabels: [],
});

const formatPrice = (value: PeiwanItem['price'], fallback: string) => {
  if (value === null || value === undefined) return fallback;
  const formatted = formatAmountDown2(value);
  if (formatted === '—') return String(value);
  return `${formatted} 币/H`;
};

const CardImage = ({ item, src }: { item: PeiwanItem; src: string }) => {
  const siteCopy = useSiteCopy();
  return (
    <div className="group relative w-full aspect-[4/5] overflow-hidden bg-[#f6f6f6]">
      <Image
        src={src}
        alt={item.serverDisplayName ?? siteCopy("site.components.home.peiwanrecommendations.1d61b82ec64b", {value1: String(item.id)})}
        fill
        sizes="(min-width: 1280px) 25vw, (min-width: 768px) 50vw, 100vw"
        className="h-full w-full object-contain transition duration-700 ease-out group-hover:scale-[1.02]"
      />
    </div>
  );
};

const RecommendationCard = ({ item, src }: { item: PeiwanItem; src: string }) => {
  const siteCopy = useSiteCopy();
  const tags = item.gameLabels.slice(0, 2);

  return (
    <article className="flex flex-col items-center gap-4 text-center">
      <CardImage item={item} src={src} />
      <div className="space-y-1">
        <p className="text-[0.7rem] uppercase tracking-[0.28em] text-neutral-500">
          {item.sex || <SiteText copyKey="site.components.home.peiwanrecommendations.62b46f24ae40" />}
        </p>
        <p className="text-sm font-semibold text-neutral-900">
          {item.serverDisplayName ?? <SiteText copyKey="site.components.home.peiwanrecommendations.1d61b82ec64b" values={{value1: String(item.id)}} />}
        </p>
        <p className="text-xs text-neutral-500">{formatPrice(item.price, siteCopy("site.components.home.peiwanrecommendations.e376565f075f"))}</p>
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
  const siteCopy = useSiteCopy();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [available, setAvailable] = useState<{ item: PeiwanItem; src: string }[]>([]);
  const [start, setStart] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      setLoading(true);
      setError(null);
      setAvailable([]);

      try {
        const imgRes = await fetch('/api/peiwanRecommend', { signal: controller.signal, cache: 'no-store' });
        if (!imgRes.ok) throw new Error(siteCopy("site.components.home.peiwanrecommendations.4c161f59c9c1"));
        const imgJson = (await imgRes.json()) as { data?: ImageEntry[] };
        const imgs = (imgJson.data || []).slice(0, MAX_DISPLAY);
        if (imgs.length === 0) {
          setAvailable([]);
          return;
        }

        const res = await fetch('/api/peiwan?page=1&pageSize=500&seed=home', {
          signal: controller.signal,
          cache: 'no-store',
        });
        if (!res.ok) {
          throw new Error(siteCopy("site.components.home.peiwanrecommendations.f6b7a41e5600"));
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
          found.push({ item: buildFallbackItem(miss.id), src: miss.src });
        }

        setAvailable(found.slice(0, MAX_DISPLAY));
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setError(siteCopy("site.components.home.peiwanrecommendations.296b5bc319c9"));
      } finally {
        setLoading(false);
      }
    };

    load();
    return () => controller.abort();
  }, [siteCopy]);

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
        <div className="text-center text-2xl sm:text-2xl font-semibold tracking-[0.22em] text-neutral-800"><SiteText copyKey="site.components.home.peiwanrecommendations.2af62bc22308" /></div>

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

        {!loading && error && <p className="text-sm text-rose-500 text-center"><SiteText namespace="site.components.home.peiwanrecommendations" value={error} /></p>}

        {!loading && !error && (
          <>
            {available.length === 0 ? (
              <p className="text-sm text-neutral-700 text-center"><SiteText copyKey="site.components.home.peiwanrecommendations.e9b384263250" /></p>
            ) : (
              <div className="relative w-full">
                {available.length > 4 && (
                  <>
                    <button
                      type="button"
                      onClick={handlePrev}
                      className="absolute left-4 top-1/2 -translate-y-1/2 z-10 flex h-12 w-12 items-center justify-center rounded-full bg-neutral-900/80 text-white text-2xl shadow-lg hover:bg-neutral-900 focus:outline-none focus:ring-2 focus:ring-white/70"
                      aria-label={siteCopy("site.components.home.peiwanrecommendations.4a19fd384df3")}
                    >
                      ‹
                    </button>
                    <button
                      type="button"
                      onClick={handleNext}
                      className="absolute right-4 top-1/2 -translate-y-1/2 z-10 flex h-12 w-12 items-center justify-center rounded-full bg-neutral-900/80 text-white text-2xl shadow-lg hover:bg-neutral-900 focus:outline-none focus:ring-2 focus:ring-white/70"
                      aria-label={siteCopy("site.components.home.peiwanrecommendations.ac0218f209c0")}
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
