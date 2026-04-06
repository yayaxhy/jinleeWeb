'use client';

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
      setNotice({ level: 'error', text: getWithdrawErrorMessage('detail_required'), slot });
      return;
    }
    if (shouldValidateWithdrawImageLink(method, trimmed) && !parsedUrl) {
      setNotice({ level: 'error', text: getWithdrawErrorMessage('wechat_detail_invalid_url'), slot });
      return;
    }
    if (shouldValidateWithdrawImageLink(method, trimmed) && parsedUrl && !isDiscordCdnHost(parsedUrl)) {
      setNotice({ level: 'error', text: getWithdrawErrorMessage('wechat_detail_invalid_host'), slot });
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
          throw new Error(getWithdrawErrorMessage(data?.error));
        }
        setAccounts((prev) => ({
          ...prev,
          [`account${slot}`]: `${method}:${trimmed}`,
        }));
        setNotice({ level: 'success', text: `提现方式${slot} 已保存`, slot });
        router.refresh();
      } catch (error) {
        setNotice({
          level: 'error',
          text: error instanceof Error ? error.message : '保存失败，请稍后重试',
          slot,
        });
      }
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-[#5c43a3]">预存提现方式</h3>
      </div>
      {notice ? (
        <div ref={noticeRef}>
          <NoticeBanner
            level={notice.level}
            title={notice.level === 'error' ? '保存失败，请检查输入内容' : undefined}
            message={notice.text}
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
                <p className="text-sm font-semibold text-[#171717]">提现方式{slot}</p>
                {slotError ? <span className="text-xs font-semibold text-red-700">需要处理</span> : null}
                {slotSuccess ? <span className="text-xs font-semibold text-emerald-700">已保存</span> : null}
              </div>
              {parsed ? (
                <p className="text-sm text-gray-600">
                  提现方式：{parsed.method} <br />
                  账户信息：{parsed.detail}
                </p>
              ) : (
                <p className="text-sm text-gray-400">未设置</p>
              )}
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-[0.4em] text-gray-500">方式</label>
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
                <label className="text-xs uppercase tracking-[0.4em] text-gray-500">账户信息</label>
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
                  placeholder={
                    editing[slot as SlotKey].method === '微信'
                      ? '请输入 cdn.discordapp.com 图片链接'
                      : '请输入账号'
                  }
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
                {isPending ? '保存中…' : '保存'}
              </button>
              <p className="text-xs text-gray-500">
                例子：<br />
                支付宝：18888888 真实姓名<br />
                <br />
                微信：https://cdn.discordapp.com/...<br />
                <br />
                Paypal: xxx@gmail.com +名字<br />
                <br />
                如果填写的是链接而不是纯文本账号，也必须使用 `cdn.discordapp.com` 图片链接
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
