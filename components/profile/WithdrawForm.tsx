'use client';
import { SiteText, useSiteCopy } from "@/components/SiteCopyProvider";


import { type FormEvent, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { formatAmountDown2 } from '@/lib/numberFormat';
import {
  getWithdrawAccountDetailSummary,
  getWithdrawErrorMessage,
  parseStoredWithdrawAccount,
  type ParsedWithdrawAccount,
} from '@/lib/withdrawAccounts';
import { NoticeBanner } from './NoticeBanner';

const MIN_WITHDRAW_AMOUNT = 100;
const ROME_TIMEZONE = 'Europe/Rome';

type WithdrawFormProps = {
  maxAmount?: string;
  lastWithdrawAt?: string | null;
  nextAvailableAt?: string | null;
  savedAccounts?: {
    account1?: string | null;
    account2?: string | null;
    account3?: string | null;
  };
};

const formatDateTime = (value?: string | Date | null) => {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleString('zh-CN', { hour12: false, timeZone: ROME_TIMEZONE });
};

type Notice = { level: 'success' | 'error'; text: string };
type ParsedAccount = ParsedWithdrawAccount & { slot: '1' | '2' | '3' };

export default function WithdrawForm({
  maxAmount = '0',
  lastWithdrawAt,
  nextAvailableAt,
  savedAccounts,
}: WithdrawFormProps) {
  const siteCopy = useSiteCopy();
  const router = useRouter();
  const [amount, setAmount] = useState('');
  const [selectedSlot, setSelectedSlot] = useState<string>('');
  const [notice, setNotice] = useState<Notice | null>(null);
  const [isPending, startTransition] = useTransition();
  const noticeRef = useRef<HTMLDivElement | null>(null);

  const max = useMemo(() => {
    const parsed = Number(maxAmount);
    return Number.isNaN(parsed) ? 0 : parsed;
  }, [maxAmount]);

  const nextAvailableDate = useMemo(() => {
    if (!nextAvailableAt) return null;
    const parsed = new Date(nextAvailableAt);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }, [nextAvailableAt]);

  const lastWithdrawDate = useMemo(() => {
    if (!lastWithdrawAt) return null;
    const parsed = new Date(lastWithdrawAt);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }, [lastWithdrawAt]);

  const now = Date.now();
  const maxWithdrawable = Math.max(0, max);
  const inCooldown = Boolean(nextAvailableDate && nextAvailableDate.getTime() > now);
  const canWithdraw = maxWithdrawable >= MIN_WITHDRAW_AMOUNT && !inCooldown;
  const amountValue = Number(amount);
  const amountError =
    amount.length > 0 &&
    (Number.isNaN(amountValue) || amountValue < MIN_WITHDRAW_AMOUNT || amountValue > maxWithdrawable);
  const parsedAccounts = useMemo(() => {
    return [
      (() => {
        const account = parseStoredWithdrawAccount(savedAccounts?.account1);
        return account ? { slot: '1' as const, ...account } : null;
      })(),
      (() => {
        const account = parseStoredWithdrawAccount(savedAccounts?.account2);
        return account ? { slot: '2' as const, ...account } : null;
      })(),
      (() => {
        const account = parseStoredWithdrawAccount(savedAccounts?.account3);
        return account ? { slot: '3' as const, ...account } : null;
      })(),
    ].filter(Boolean) as ParsedAccount[];
  }, [savedAccounts?.account1, savedAccounts?.account2, savedAccounts?.account3]);
  const selectedAccount = parsedAccounts.find((acc) => acc.slot === selectedSlot);
  useEffect(() => {
    if (!selectedSlot && parsedAccounts.length > 0) {
      setSelectedSlot(parsedAccounts[0].slot);
    }
  }, [parsedAccounts, selectedSlot]);
  useEffect(() => {
    if (!notice) return;
    noticeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [notice]);
  const canSubmit =
    !amountError && amountValue >= MIN_WITHDRAW_AMOUNT && !inCooldown && !!selectedAccount;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) return;
    setNotice(null);

    startTransition(async () => {
      try {
        if (!selectedAccount) {
          throw new Error(siteCopy("site.components.profile.withdrawform.2369200fe0ce"));
        }
        const method = `${selectedAccount.method}:${selectedAccount.detail}`;
        const response = await fetch('/api/withdraw', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ amount: amountValue, method }),
        });
        const data = await response.json();
        const nextAvailableFromResponse = data?.nextAvailableAt
          ? formatDateTime(String(data.nextAvailableAt))
          : null;
        if (!response.ok || !data?.ok) {
          const friendlyMessage =
            data?.error === 'withdraw_cooldown' && nextAvailableFromResponse ? siteCopy("site.components.profile.withdrawform.0b32188c1dba", {value1: String(nextAvailableFromResponse)}) : getWithdrawErrorMessage(data?.error, siteCopy);
          throw new Error(friendlyMessage);
        }

        const successMessage = nextAvailableFromResponse ? siteCopy("site.components.profile.withdrawform.79f18a05a446", {value1: String(nextAvailableFromResponse)}) : siteCopy("site.components.profile.withdrawform.92b281d8037e");
        setNotice({ level: 'success', text: successMessage });
        setAmount('');
        setSelectedSlot('');
        router.refresh();
      } catch (error) {
        const message =
          error instanceof Error && error.message ? error.message : siteCopy("site.components.profile.withdrawform.6e778a00ec7e");
        setNotice({ level: 'error', text: message });
      }
    });
  };

  return (
    <div className="space-y-3">
      {!canWithdraw && (
        <div className="space-y-1">
          {inCooldown && nextAvailableDate && (
            <p className="text-xs text-amber-600"><SiteText copyKey="site.components.profile.withdrawform.afa5b7fa8d8e" />{formatDateTime(nextAvailableDate)}<SiteText copyKey="site.components.profile.withdrawform.db0d4c6b539f" /></p>
          )}
          {maxWithdrawable < MIN_WITHDRAW_AMOUNT && (
            <p className="text-xs text-gray-500"><SiteText copyKey="site.components.profile.withdrawform.c100da45268b" />{MIN_WITHDRAW_AMOUNT}</p>
          )}
        </div>
      )}
      {lastWithdrawDate && (
        <p className="text-xs text-gray-400"><SiteText copyKey="site.components.profile.withdrawform.2cf305546d4e" />{formatDateTime(lastWithdrawDate)}</p>
      )}
      {notice ? (
        <div ref={noticeRef}>
          <NoticeBanner
            level={notice.level}
            title={notice.level === 'error' ? siteCopy("site.components.profile.withdrawform.4c751832ec79") : undefined}
            message={siteCopy.text(notice.text, "site.components.profile.withdrawform")}
            onDismiss={() => setNotice(null)}
          />
        </div>
      ) : null}
      <div className="space-y-2">
        <label className="text-xs uppercase tracking-[0.4em] text-gray-500"><SiteText copyKey="site.components.profile.withdrawform.cd4e74267f28" /></label>
        <select
          value={selectedSlot}
          onChange={(event) => {
            setSelectedSlot(event.target.value);
            if (notice?.level === 'error') setNotice(null);
          }}
          disabled={parsedAccounts.length === 0}
          className="w-full rounded-2xl border border-black/10 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#5c43a3] disabled:bg-gray-100 disabled:text-gray-400"
        >
          <option value=""><SiteText copyKey="site.components.profile.withdrawform.2369200fe0ce" /></option>
          {parsedAccounts.map((acc) => (
            <option key={acc.slot} value={acc.slot}><SiteText copyKey="site.components.profile.withdrawform.9f9ca5203d0b" />{acc.slot} · {acc.method} · {getWithdrawAccountDetailSummary(acc.detail, 34)}
            </option>
          ))}
        </select>
        {parsedAccounts.length === 0 && (
          <p className="text-xs text-gray-500"><SiteText copyKey="site.components.profile.withdrawform.7e5c9091ded8" /></p>
        )}
        {selectedAccount ? (
          <div className="rounded-2xl border border-black/5 bg-[#faf7ff] px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#5c43a3]"><SiteText copyKey="site.components.profile.withdrawform.2e467fee9ca6" /></p>
            <p className="mt-2 text-sm font-medium text-[#171717]"><SiteText copyKey="site.components.profile.withdrawform.9f9ca5203d0b" />{selectedAccount.slot} · {selectedAccount.method}
            </p>
            <p className="mt-1 break-all text-xs leading-6 text-gray-600">
              {selectedAccount.detail}
            </p>
          </div>
        ) : null}
      </div>
      <form onSubmit={handleSubmit} className="space-y-4 text-left">
        <div className="space-y-2">
          <label className="text-xs uppercase tracking-[0.4em] text-gray-500"><SiteText copyKey="site.components.profile.withdrawform.67272dba97e3" /></label>
          <input
            type="number"
            min={MIN_WITHDRAW_AMOUNT}
            step="0.01"
            value={amount}
            onChange={(event) => {
              setAmount(event.target.value);
              if (notice?.level === 'error') setNotice(null);
            }}
            disabled={!canWithdraw}
            aria-invalid={amountError ? true : undefined}
            className={`w-full rounded-2xl border px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#5c43a3] ${
              amountError ? 'border-red-400 text-red-500' : 'border-black/10'
            } ${!canWithdraw ? 'bg-gray-100 text-gray-400' : ''}`}
            placeholder={canWithdraw ? siteCopy("site.components.profile.withdrawform.35028613900d", {value1: String(formatAmountDown2(maxWithdrawable))}) : siteCopy("site.components.profile.withdrawform.e01db655b1e5")}
          />
          {amountError && (
            <p className="text-xs text-red-500"><SiteText copyKey="site.components.profile.withdrawform.a40c37fc847f" />{MIN_WITHDRAW_AMOUNT}<SiteText copyKey="site.components.profile.withdrawform.bea37dd5fdbd" /></p>
          )}
        </div>
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={!canSubmit || isPending}
            className="px-4 py-2 rounded-full bg-[#5c43a3] text-white text-xs uppercase tracking-[0.4em] disabled:bg-gray-300 disabled:text-gray-500"
          >
            {isPending ? <SiteText copyKey="site.components.profile.withdrawform.17e519c5a6bd" /> : <SiteText copyKey="site.components.profile.withdrawform.b56d9ac6c5a0" />}
          </button>
        </div>
      </form>
    </div>
  );
}
