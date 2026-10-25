'use client';
import { SiteText, useSiteCopy } from "@/components/SiteCopyProvider";


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
  const siteCopy = useSiteCopy();
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
      setNotice({ level: 'info', text: siteCopy("site.components.profile.blacklistmanager.2647e3137262") });
      setResults([]);
      return;
    }

    setIsSearching(true);
    setNotice(null);
    try {
      const res = await fetch(`/api/profile/member-search?keyword=${encodeURIComponent(trimmed)}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.error) {
        throw new Error(typeof data?.error === 'string' ? data.error : siteCopy("site.components.profile.blacklistmanager.80f9c9cd1c92"));
      }
      const nextResults = Array.isArray(data?.data) ? (data.data as SearchResult[]) : [];
      setResults(nextResults);
      if (nextResults.length === 0) {
        setNotice({ level: 'info', text: siteCopy("site.components.profile.blacklistmanager.e33c6cbee834") });
      }
    } catch (error) {
      setNotice({
        level: 'error',
        text: error instanceof Error ? error.message : siteCopy("site.components.profile.blacklistmanager.80f9c9cd1c92"),
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
          throw new Error(typeof data?.error === 'string' ? data.error : siteCopy("site.components.profile.blacklistmanager.398cc7f9fce5"));
        }
        const entry = data?.entry as BlacklistEntry;
        setEntries((prev) => [entry, ...prev.filter((item) => item.discordUserId !== entry.discordUserId)]);
        setNotice({ level: 'success', text: siteCopy("site.components.profile.blacklistmanager.53658630ac05", {value1: String(target.displayName)}) });
      } catch (error) {
        setNotice({
          level: 'error',
          text: error instanceof Error ? error.message : siteCopy("site.components.profile.blacklistmanager.398cc7f9fce5"),
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
          throw new Error(typeof data?.error === 'string' ? data.error : siteCopy("site.components.profile.blacklistmanager.22ee2061c5db"));
        }
        setEntries((prev) => prev.filter((item) => item.discordUserId !== target.discordUserId));
        setNotice({ level: 'success', text: siteCopy("site.components.profile.blacklistmanager.70e2391c6ca9", {value1: String(target.displayName)}) });
      } catch (error) {
        setNotice({
          level: 'error',
          text: error instanceof Error ? error.message : siteCopy("site.components.profile.blacklistmanager.22ee2061c5db"),
        });
      }
    });
  };

  return (
    <div className="space-y-4 rounded-[32px] border border-black/5 bg-white p-6 shadow-[0_10px_30px_rgba(17,24,39,0.04)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-xl font-semibold tracking-wide text-[#8a6000]"><SiteText copyKey="site.components.profile.blacklistmanager.2faec64b3c56" /></h3>
          <p className="text-sm text-gray-500"><SiteText copyKey="site.components.profile.blacklistmanager.2fe5a288fafc" /></p>
        </div>
        <span className="text-xs uppercase tracking-[0.4em] text-gray-400"><SiteText copyKey="site.components.profile.blacklistmanager.a15a7a8f2c3b" /></span>
      </div>

      {notice ? (
        <NoticeBanner
          level={notice.level}
          message={siteCopy.text(notice.text, "site.components.profile.blacklistmanager")}
          onDismiss={() => setNotice(null)}
        />
      ) : null}

      <div className="rounded-3xl border border-black/5 bg-[#faf7f2] p-4 space-y-3">
        <div className="flex flex-col gap-3 md:flex-row">
          <input
            type="text"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder={siteCopy("site.components.profile.blacklistmanager.30b51988117a")}
            className="flex-1 rounded-full border border-black/10 bg-white px-4 py-3 text-sm text-[#171717] outline-none transition focus:border-[#f0c25b] focus:ring-2 focus:ring-[#f0c25b]/25"
          />
          <button
            type="button"
            onClick={handleSearch}
            disabled={isSearching}
            className="rounded-full border border-[#e7c56c] bg-[linear-gradient(180deg,_#fff4cc,_#f8df97)] px-5 py-3 text-sm font-semibold text-[#8a6000] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSearching ? <SiteText copyKey="site.components.profile.blacklistmanager.8a88cdc40e68" /> : <SiteText copyKey="site.components.profile.blacklistmanager.d9574e760f94" />}
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
                        {result.peiwanId ? <SiteText copyKey="site.components.profile.blacklistmanager.411646cefff2" values={{value1: String(result.peiwanId)}} /> : ''}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleAdd(result)}
                      disabled={alreadyBlocked || isPending}
                      className="shrink-0 rounded-full border border-[#f0c25b]/60 px-4 py-2 text-xs font-semibold text-[#8a6000] transition hover:bg-[#fff6da] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {alreadyBlocked ? <SiteText copyKey="site.components.profile.blacklistmanager.63054d8dc0aa" /> : <SiteText copyKey="site.components.profile.blacklistmanager.093505f06a6e" />}
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
          <p className="text-sm font-semibold text-[#171717]"><SiteText copyKey="site.components.profile.blacklistmanager.16b2fb2bf390" /></p>
          <span className="text-xs text-gray-400"><SiteText copyKey="site.components.profile.blacklistmanager.497064be1f41" />{entries.length}<SiteText copyKey="site.components.profile.blacklistmanager.4912771a4216" /></span>
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
                      {entry.peiwanId ? <SiteText copyKey="site.components.profile.blacklistmanager.411646cefff2" values={{value1: String(entry.peiwanId)}} /> : ''}
                    </p>
                    <p className="mt-1 text-xs text-gray-400"><SiteText copyKey="site.components.profile.blacklistmanager.0fc81626c9ae" />{entry.createdAtLabel}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemove(entry)}
                    disabled={isPending}
                    className="shrink-0 rounded-full border border-black/10 px-4 py-2 text-xs font-semibold text-gray-600 transition hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-50"
                  ><SiteText copyKey="site.components.profile.blacklistmanager.04eda59ff628" /></button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-black/10 bg-[#faf7f2] px-4 py-5 text-sm text-gray-500"><SiteText copyKey="site.components.profile.blacklistmanager.8164051805f5" /></div>
        )}
      </div>
    </div>
  );
}
