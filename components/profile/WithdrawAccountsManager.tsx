'use client';
import { SiteText, useSiteCopy } from "@/components/SiteCopyProvider";


import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  getWithdrawErrorMessage,
  isDiscordCdnHost,
  parseHttpUrl,
  parseStoredWithdrawAccount,
  shouldValidateWithdrawImageLink,
  WITHDRAW_METHOD_OPTIONS,
} from '@/lib/withdrawAccounts';
import { NoticeBanner } from './NoticeBanner';

type SlotKey = 1 | 2 | 3;
type AccountMap = { account1?: string | null; account2?: string | null; account3?: string | null };
type Notice = { level: 'success' | 'error'; text: string; slot?: SlotKey };

type WithdrawAccountsManagerProps = {
  initialAccounts: AccountMap;
};

export function WithdrawAccountsManager({ initialAccounts }: WithdrawAccountsManagerProps) {
  const siteCopy = useSiteCopy();
  const router = useRouter();
  const [accounts, setAccounts] = useState<AccountMap>(initialAccounts);
  const [editing, setEditing] = useState<Record<SlotKey, { method: string; detail: string }>>({
    1: { method: WITHDRAW_METHOD_OPTIONS[0], detail: '' },
    2: { method: WITHDRAW_METHOD_OPTIONS[0], detail: '' },
    3: { method: WITHDRAW_METHOD_OPTIONS[0], detail: '' },
  });
  const [notice, setNotice] = useState<Notice | null>(null);
  const [isPending, startTransition] = useTransition();
  const noticeRef = useRef<HTMLDivElement | null>(null);

  const parsedAccounts = useMemo(() => {
    return {
      1: parseStoredWithdrawAccount(accounts.account1),
      2: parseStoredWithdrawAccount(accounts.account2),
      3: parseStoredWithdrawAccount(accounts.account3),
    } as Record<SlotKey, { method: string; detail: string } | null>;
  }, [accounts.account1, accounts.account2, accounts.account3]);

  useEffect(() => {
    if (!notice) return;
    noticeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [notice]);

  const handleSave = (slot: SlotKey) => {
    const { method, detail } = editing[slot];
    const trimmed = detail.trim();
    const parsedUrl = parseHttpUrl(trimmed);

    if (!trimmed) {
      setNotice({ level: 'error', text: getWithdrawErrorMessage('detail_required', siteCopy), slot });
      return;
    }
    if (shouldValidateWithdrawImageLink(method, trimmed) && !parsedUrl) {
      setNotice({ level: 'error', text: getWithdrawErrorMessage('wechat_detail_invalid_url', siteCopy), slot });
      return;
    }
    if (shouldValidateWithdrawImageLink(method, trimmed) && parsedUrl && !isDiscordCdnHost(parsedUrl)) {
      setNotice({ level: 'error', text: getWithdrawErrorMessage('wechat_detail_invalid_host', siteCopy), slot });
      return;
    }

    startTransition(async () => {
      setNotice(null);
      try {
        const res = await fetch('/api/profile/withdraw-accounts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ slot, method, detail: trimmed }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data?.error) {
          throw new Error(getWithdrawErrorMessage(data?.error, siteCopy));
        }
        setAccounts((prev) => ({
          ...prev,
          [`account${slot}`]: `${method}:${trimmed}`,
        }));
        setNotice({ level: 'success', text: siteCopy("site.components.profile.withdrawaccountsmanager.9adf13a65508", {value1: String(slot)}), slot });
        router.refresh();
      } catch (error) {
        setNotice({
          level: 'error',
          text: error instanceof Error ? error.message : siteCopy("site.components.profile.withdrawaccountsmanager.b285807f8f65"),
          slot,
        });
      }
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-[#5c43a3]"><SiteText copyKey="site.components.profile.withdrawaccountsmanager.2bdeb9172608" /></h3>
      </div>
      {notice ? (
        <div ref={noticeRef}>
          <NoticeBanner
            level={notice.level}
            title={notice.level === 'error' ? siteCopy("site.components.profile.withdrawaccountsmanager.a549196c96ed") : undefined}
            message={siteCopy.text(notice.text, "site.components.profile.withdrawaccountsmanager")}
            onDismiss={() => setNotice(null)}
          />
        </div>
      ) : null}
      <div className="grid gap-4 md:grid-cols-3">
        {[1, 2, 3].map((slot) => {
          const parsed = parsedAccounts[slot as SlotKey];
          const slotNotice = notice?.slot === slot ? notice : null;
          const slotError = slotNotice?.level === 'error';
          const slotSuccess = slotNotice?.level === 'success';
          return (
            <div
              key={slot}
              className={`rounded-2xl border bg-white p-4 space-y-3 shadow-sm transition-colors ${
                slotError
                  ? 'border-red-300 bg-red-50/60 shadow-[0_0_0_3px_rgba(239,68,68,0.08)]'
                  : slotSuccess
                    ? 'border-emerald-200 bg-emerald-50/60 shadow-[0_0_0_3px_rgba(16,185,129,0.08)]'
                    : 'border-black/5'
              }`}
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-[#171717]"><SiteText copyKey="site.components.profile.withdrawaccountsmanager.9f9ca5203d0b" />{slot}</p>
                {slotError ? <span className="text-xs font-semibold text-red-700"><SiteText copyKey="site.components.profile.withdrawaccountsmanager.8036f192eea7" /></span> : null}
                {slotSuccess ? <span className="text-xs font-semibold text-emerald-700"><SiteText copyKey="site.components.profile.withdrawaccountsmanager.cdfab96f757f" /></span> : null}
              </div>
              {parsed ? (
                <div className="text-sm text-gray-600">
                  <p><SiteText copyKey="site.components.profile.withdrawaccountsmanager.51315db2050e" />{parsed.method}</p>
                  <p className="mt-1"><SiteText copyKey="site.components.profile.withdrawaccountsmanager.9aa848d21a24" /></p>
                  <p
                    className="mt-1 overflow-hidden text-xs leading-5 text-gray-500"
                    style={{
                      display: '-webkit-box',
                      WebkitBoxOrient: 'vertical',
                      WebkitLineClamp: 2,
                      wordBreak: 'break-all',
                    }}
                    title={parsed.detail}
                  >
                    {parsed.detail}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-gray-400"><SiteText copyKey="site.components.profile.withdrawaccountsmanager.55a04b58cd2c" /></p>
              )}
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-[0.4em] text-gray-500"><SiteText copyKey="site.components.profile.withdrawaccountsmanager.af90809619ca" /></label>
                <select
                  value={editing[slot as SlotKey].method}
                  onChange={(event) =>
                    {
                      setEditing((prev) => ({
                        ...prev,
                        [slot]: { ...prev[slot as SlotKey], method: event.target.value },
                      }));
                      if (notice?.slot === slot) setNotice(null);
                    }
                  }
                  className={`w-full rounded-2xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#5c43a3] ${
                    slotError ? 'border-red-300 bg-white' : 'border-black/10'
                  }`}
                >
                  {WITHDRAW_METHOD_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-[0.4em] text-gray-500"><SiteText copyKey="site.components.profile.withdrawaccountsmanager.bd9157656f72" /></label>
                <input
                  type="text"
                  value={editing[slot as SlotKey].detail}
                  onChange={(event) =>
                    {
                      setEditing((prev) => ({
                        ...prev,
                        [slot]: { ...prev[slot as SlotKey], detail: event.target.value },
                      }));
                      if (notice?.slot === slot) setNotice(null);
                    }
                  }
                  aria-invalid={slotError ? true : undefined}
                  className={`w-full rounded-2xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#5c43a3] ${
                    slotError ? 'border-red-300 bg-white text-red-900 placeholder:text-red-300' : 'border-black/10'
                  }`}
                  placeholder={editing[slot as SlotKey].method === '微信' ? siteCopy("site.components.profile.withdrawaccountsmanager.b56f436052ca") : siteCopy("site.components.profile.withdrawaccountsmanager.dfcc84468b6e")}
                />
                {slotError ? (
                  <p className="text-xs font-medium text-red-700">{slotNotice?.text}</p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => handleSave(slot as SlotKey)}
                disabled={isPending}
                className="w-full rounded-full bg-[#5c43a3] text-white text-xs uppercase tracking-[0.3em] py-2 hover:bg-[#4a3388] disabled:opacity-60"
              >
                {isPending ? <SiteText copyKey="site.components.profile.withdrawaccountsmanager.6644f06197a4" /> : <SiteText copyKey="site.components.profile.withdrawaccountsmanager.fadf24dbc5a9" />}
              </button>
              <p className="text-xs text-gray-500"><SiteText copyKey="site.components.profile.withdrawaccountsmanager.1c98854287d8" /><br /><SiteText copyKey="site.components.profile.withdrawaccountsmanager.1d7815e22bb4" /><br />
                <br /><SiteText copyKey="site.components.profile.withdrawaccountsmanager.547702bf834b" /><br />
                <br /><SiteText copyKey="site.components.profile.withdrawaccountsmanager.03c588cf9eed" /><br />
                <br /><SiteText copyKey="site.components.profile.withdrawaccountsmanager.36d90adb3caa" /></p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
