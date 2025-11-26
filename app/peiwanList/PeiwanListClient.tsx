"use client";

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  PEIWAN_GAME_TAG_FIELDS,
  PEIWAN_LEVEL_OPTIONS,
  PEIWAN_SEX_OPTIONS,
} from '@/constants/peiwan';

type PeiwanItem = {
  id: number;
  discordUserId: string;
  serverDisplayName: string | null;
  quotationCode: string;
  price: string | number | bigint | null;
  level: (typeof PEIWAN_LEVEL_OPTIONS)[number];
  sex: (typeof PEIWAN_SEX_OPTIONS)[number];
  techTag: boolean;
  mpUrl?: string | null;
  gameTags: Record<string, boolean>;
};

type ApiResponse = {
  data: PeiwanItem[];
  total: number;
  page: number;
  pageSize: number;
};

const PAGE_SIZE = 6;
const LOCAL_IMG_EXTS = ['png', 'jpg', 'gif'] as const;

const formatPrice = (value: PeiwanItem['price']) => {
  if (value === null || value === undefined) return '未设置';
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return String(value);
  return `${numeric} 币/H`;
};

const CardImage = ({ item, onPreview }: { item: PeiwanItem; onPreview?: (src: string) => void }) => {
  const [idx, setIdx] = useState(0);
  const sources = useMemo(() => {
    return LOCAL_IMG_EXTS.map((ext) => `/peiwanList/img/${item.id}.${ext}`);
  }, [item.id]);

  if (sources.length === 0) {
    return (
      <div className="w-full h-40 bg-gradient-to-r from-[#d0c3ff] to-[#f1e6ff] flex items-center justify-center text-gray-500 text-sm">
        无名片
      </div>
    );
  }

  const currentSrc = sources[Math.min(idx, sources.length - 1)];

  return (
    <img
      src={currentSrc}
      alt={`Peiwan ${item.id}`}
      className="w-full h-40 object-cover cursor-zoom-in"
      onClick={() => onPreview?.(currentSrc)}
      onError={() => {
        if (idx < sources.length - 1) {
          setIdx(idx + 1);
        }
      }}
    />
  );
};

const FilterChip = ({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    className={`rounded-full border px-4 py-2 text-sm transition ${
      active ? 'bg-black text-white border-black' : 'border-black/20 text-gray-700 hover:border-black/70'
    }`}
  >
    {children}
  </button>
);

export function PeiwanListClient() {
  const [games, setGames] = useState<Set<string>>(new Set());
  const [techTag, setTechTag] = useState(false);
  const [level, setLevel] = useState<string>('');
  const [gender, setGender] = useState<string>('');
  const [idFilter, setIdFilter] = useState<string>('');
  const [page, setPage] = useState(1);
  const [seed] = useState(() => Math.random().toString(36).slice(2, 10));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ApiResponse | null>(null);
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    params.set('seed', seed);
    if (games.size > 0) params.set('games', Array.from(games).join(','));
    if (techTag) params.set('techTag', 'true');
    if (level) params.set('level', level);
    if (gender) params.set('gender', gender);
    if (idFilter.trim()) params.set('id', idFilter.trim());
    params.set('page', String(page));
    params.set('pageSize', String(PAGE_SIZE));
    return params.toString();
  }, [games, techTag, level, gender, idFilter, page, seed]);

  useEffect(() => {
    const controller = new AbortController();
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/peiwan?${queryString}`, { signal: controller.signal, cache: 'no-store' });
        if (!res.ok) {
          throw new Error('加载失败，请稍后再试');
        }
        const data = (await res.json()) as ApiResponse;
        setResult(data);
      } catch (err: any) {
        if (err.name === 'AbortError') return;
        setError(err.message ?? '加载失败');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
    return () => controller.abort();
  }, [queryString]);

  const toggleGame = (tag: string) => {
    setPage(1);
    setGames((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) {
        next.delete(tag);
      } else {
        next.add(tag);
      }
      return next;
    });
  };

  const resetFilters = () => {
    setGames(new Set());
    setTechTag(false);
    setLevel('');
    setGender('');
    setIdFilter('');
    setPage(1);
  };

  const data = result?.data ?? [];
  const totalPages = result ? Math.max(1, Math.ceil(result.total / PAGE_SIZE)) : 1;

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-3">
          <Link
          href="/"
          className="inline-flex items-center justify-center rounded-full border border-black/20 px-4 py-2 text-sm text-gray-700 hover:border-black hover:text-black transition"
        >
          返回主页
        </Link>
          <h1 className="text-3xl font-bold tracking-wide text-[#2800ff]">陪玩列表</h1>
        </div>
        
      </header>

      <section className="rounded-3xl bg-white border border-black/5 shadow-sm p-5 space-y-4">
        <div className="flex flex-wrap gap-3 items-center">
          <span className="text-sm text-gray-500 min-w-[72px]">游戏：</span>
          <div className="flex flex-wrap gap-2">
            {PEIWAN_GAME_TAG_FIELDS.map((tag) => (
              <FilterChip key={tag} active={games.has(tag)} onClick={() => toggleGame(tag)}>
                {tag}
              </FilterChip>
            ))}
            <FilterChip active={techTag} onClick={() => { setTechTag((v) => !v); setPage(1); }}>
              技术陪玩
            </FilterChip>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 items-center">
          <span className="text-sm text-gray-500 min-w-[72px]">等级：</span>
          <div className="flex flex-wrap gap-2">
            {PEIWAN_LEVEL_OPTIONS.map((item) => (
              <FilterChip
                key={item}
                active={level === item}
                onClick={() => { setLevel(level === item ? '' : item); setPage(1); }}
              >
                {item}
              </FilterChip>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-3 items-center">
          <span className="text-sm text-gray-500 min-w-[72px]">性别：</span>
          <div className="flex flex-wrap gap-2">
            <FilterChip
              active={gender === 'female'}
              onClick={() => { setGender(gender === 'female' ? '' : 'female'); setPage(1); }}
            >
              女陪陪
            </FilterChip>
            <FilterChip
              active={gender === 'male'}
              onClick={() => { setGender(gender === 'male' ? '' : 'male'); setPage(1); }}
            >
              男陪陪
            </FilterChip>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 items-center">
          <span className="text-sm text-gray-500 min-w-[72px]">ID 搜索：</span>
          <input
            type="number"
            value={idFilter}
            onChange={(e) => { setIdFilter(e.target.value); setPage(1); }}
            placeholder="精确匹配陪玩数字ID"
            className="w-48 rounded-full border border-black/10 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2800ff]"
          />
          <button
            type="button"
            onClick={resetFilters}
            className="rounded-full border border-black/20 px-4 py-2 text-sm text-gray-700 hover:border-black hover:text-black"
          >
            清空筛选
          </button>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between text-sm text-gray-600">
          <span>
            共 {result?.total ?? '—'} 人 · 第 {result?.page ?? 1} / {totalPages} 页
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || loading}
              className="rounded-full border border-black/20 px-3 py-1 text-xs uppercase tracking-[0.2em] disabled:opacity-50"
            >
              上一页
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => p + 1)}
              disabled={loading || (result ? page >= totalPages : false)}
              className="rounded-full border border-black/20 px-3 py-1 text-xs uppercase tracking-[0.2em] disabled:opacity-50"
            >
              下一页
            </button>
          </div>
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}
        {loading && <p className="text-sm text-gray-500">加载中…</p>}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((item) => (
            <article key={item.id} className="rounded-3xl border border-black/10 bg-white shadow-sm overflow-hidden flex flex-col">
              <CardImage item={item} onPreview={(src) => setPreviewSrc(src)} />
              <div className="p-4 space-y-2 flex-1">
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-lg">{item.serverDisplayName ?? '未设置昵称'}</div>
                  {item.techTag && (
                    <span className="text-xs px-2 py-1 rounded-full bg-black text-white">技术陪玩</span>
                  )}
                </div>
                <div className="text-sm text-gray-600">ID: {item.id}</div>
                <div className="flex flex-wrap gap-2 text-xs text-gray-600">
                  <span className="px-2 py-1 rounded-full bg-gray-100 border border-black/5">{item.level}</span>
                  <span className="px-2 py-1 rounded-full bg-gray-100 border border-black/5">{item.sex}</span>
                  <span className="px-2 py-1 rounded-full bg-gray-100 border border-black/5">
                    价格: {formatPrice(item.price)}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2 pt-2">
                  {PEIWAN_GAME_TAG_FIELDS.filter((tag) => item.gameTags?.[tag]).map((tag) => (
                    <span
                      key={tag}
                      className="text-xs px-2 py-1 rounded-full border border-black/10 bg-[#f5f0ff] text-[#4b3b9a]"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </article>
          ))}
        </div>

        {!loading && data.length === 0 && (
          <p className="text-gray-500 text-sm">暂无数据，换个筛选条件试试。</p>
        )}
      </section>

      {previewSrc && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setPreviewSrc(null)}
        >
          <img
            src={previewSrc}
            alt="预览"
            className="max-h-[90vh] max-w-[90vw] object-contain rounded-2xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            type="button"
            onClick={() => setPreviewSrc(null)}
            className="absolute top-6 right-6 text-white text-2xl"
            aria-label="关闭预览"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}
