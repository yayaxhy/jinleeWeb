'use client';

import { useState, useTransition } from 'react';
import { NoticeBanner } from './NoticeBanner';

type BlacklistEntry = {
  discordUserId: string;
  displayName: string;
  statusLabel: string;
  peiwanId: number | null;
  createdAtLabel: string;
};

type SearchResult = {
  discordUserId: string;
  displayName: string;
  statusLabel: string;
  peiwanId: number | null;
};

type Props = {
  initialEntries: BlacklistEntry[];
};

type Notice = {
  level: 'success' | 'error' | 'info';
  text: string;
};

export function BlacklistManager({ initialEntries }: Props) {
  const [entries, setEntries] = useState(initialEntries);
  const [keyword, setKeyword] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isPending, startTransition] = useTransition();

  const blockedIds = new Set(entries.map((entry) => entry.discordUserId));

  const handleSearch = async () => {
    const trimmed = keyword.trim();
    if (!trimmed) {
      setNotice({ level: 'info', text: '请输入 Discord ID、昵称或陪玩 ID 进行搜索。' });
      setResults([]);
      return;
    }

    setIsSearching(true);
    setNotice(null);
    try {
      const res = await fetch(`/api/profile/member-search?keyword=${encodeURIComponent(trimmed)}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.error) {
        throw new Error(typeof data?.error === 'string' ? data.error : '搜索失败，请稍后重试');
      }
      const nextResults = Array.isArray(data?.data) ? (data.data as SearchResult[]) : [];
      setResults(nextResults);
      if (nextResults.length === 0) {
        setNotice({ level: 'info', text: '没有找到匹配的老板或陪玩。' });
      }
    } catch (error) {
      setNotice({
        level: 'error',
        text: error instanceof Error ? error.message : '搜索失败，请稍后重试',
      });
    } finally {
      setIsSearching(false);
    }
  };

  const handleAdd = (target: SearchResult) => {
    startTransition(async () => {
      setNotice(null);
      try {
        const res = await fetch('/api/profile/blacklist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ blockedId: target.discordUserId }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data?.error) {
          throw new Error(typeof data?.error === 'string' ? data.error : '加入黑名单失败');
        }
        const entry = data?.entry as BlacklistEntry;
        setEntries((prev) => [entry, ...prev.filter((item) => item.discordUserId !== entry.discordUserId)]);
        setNotice({ level: 'success', text: `已将 ${target.displayName} 加入黑名单。` });
      } catch (error) {
        setNotice({
          level: 'error',
          text: error instanceof Error ? error.message : '加入黑名单失败',
        });
      }
    });
  };

  const handleRemove = (target: BlacklistEntry) => {
    startTransition(async () => {
      setNotice(null);
      try {
        const res = await fetch('/api/profile/blacklist', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ blockedId: target.discordUserId }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data?.error) {
          throw new Error(typeof data?.error === 'string' ? data.error : '移出黑名单失败');
        }
        setEntries((prev) => prev.filter((item) => item.discordUserId !== target.discordUserId));
        setNotice({ level: 'success', text: `已将 ${target.displayName} 移出黑名单。` });
      } catch (error) {
        setNotice({
          level: 'error',
          text: error instanceof Error ? error.message : '移出黑名单失败',
        });
      }
    });
  };

  return (
    <div className="space-y-4 rounded-[32px] border border-black/5 bg-white p-6 shadow-[0_10px_30px_rgba(17,24,39,0.04)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-xl font-semibold tracking-wide text-[#8a6000]">黑名单</h3>
          <p className="text-sm text-gray-500">
            只要任意一方将对方加入黑名单，双方后续派单、抢单、名片发送与点单邀请都会被拦截。
          </p>
        </div>
        <span className="text-xs uppercase tracking-[0.4em] text-gray-400">BLACKLIST</span>
      </div>

      {notice ? (
        <NoticeBanner
          level={notice.level}
          message={notice.text}
          onDismiss={() => setNotice(null)}
        />
      ) : null}

      <div className="rounded-3xl border border-black/5 bg-[#faf7f2] p-4 space-y-3">
        <div className="flex flex-col gap-3 md:flex-row">
          <input
            type="text"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="输入 Discord ID、昵称或陪玩 ID"
            className="flex-1 rounded-full border border-black/10 bg-white px-4 py-3 text-sm text-[#171717] outline-none transition focus:border-[#f0c25b] focus:ring-2 focus:ring-[#f0c25b]/25"
          />
          <button
            type="button"
            onClick={handleSearch}
            disabled={isSearching}
            className="rounded-full border border-[#e7c56c] bg-[linear-gradient(180deg,_#fff4cc,_#f8df97)] px-5 py-3 text-sm font-semibold text-[#8a6000] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSearching ? '搜索中…' : '搜索用户'}
          </button>
        </div>

        {results.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-2">
            {results.map((result) => {
              const alreadyBlocked = blockedIds.has(result.discordUserId);
              return (
                <div
                  key={result.discordUserId}
                  className="rounded-2xl border border-black/5 bg-white px-4 py-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-base font-semibold text-[#171717]">{result.displayName}</p>
                      <p className="mt-1 break-all text-xs text-gray-500">{result.discordUserId}</p>
                      <p className="mt-2 text-xs text-gray-500">
                        {result.statusLabel}
                        {result.peiwanId ? ` · 陪玩ID ${result.peiwanId}` : ''}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleAdd(result)}
                      disabled={alreadyBlocked || isPending}
                      className="shrink-0 rounded-full border border-[#f0c25b]/60 px-4 py-2 text-xs font-semibold text-[#8a6000] transition hover:bg-[#fff6da] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {alreadyBlocked ? '已拉黑' : '加入黑名单'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-[#171717]">当前黑名单</p>
          <span className="text-xs text-gray-400">共 {entries.length} 人</span>
        </div>
        {entries.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-2">
            {entries.map((entry) => (
              <div
                key={entry.discordUserId}
                className="rounded-2xl border border-black/5 bg-white px-4 py-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-base font-semibold text-[#171717]">{entry.displayName}</p>
                    <p className="mt-1 break-all text-xs text-gray-500">{entry.discordUserId}</p>
                    <p className="mt-2 text-xs text-gray-500">
                      {entry.statusLabel}
                      {entry.peiwanId ? ` · 陪玩ID ${entry.peiwanId}` : ''}
                    </p>
                    <p className="mt-1 text-xs text-gray-400">加入时间：{entry.createdAtLabel}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemove(entry)}
                    disabled={isPending}
                    className="shrink-0 rounded-full border border-black/10 px-4 py-2 text-xs font-semibold text-gray-600 transition hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    移出黑名单
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-black/10 bg-[#faf7f2] px-4 py-5 text-sm text-gray-500">
            暂无黑名单记录。
          </div>
        )}
      </div>
    </div>
  );
}
