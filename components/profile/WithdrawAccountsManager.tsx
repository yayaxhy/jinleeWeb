'use client';

import { useMemo, useState, useTransition } from 'react';
import { WITHDRAW_METHOD_OPTIONS } from './WithdrawForm';

type SlotKey = 1 | 2 | 3;
type AccountMap = { account1?: string | null; account2?: string | null; account3?: string | null };

const parseAccount = (value?: string | null) => {
  if (!value) return null;
  const [method, ...rest] = value.split(':');
  const detail = rest.join(':').trim();
  if (!method || !detail) return null;
  return { method, detail };
};

type WithdrawAccountsManagerProps = {
  initialAccounts: AccountMap;
};

export function WithdrawAccountsManager({ initialAccounts }: WithdrawAccountsManagerProps) {
  const [accounts, setAccounts] = useState<AccountMap>(initialAccounts);
  const [editing, setEditing] = useState<Record<SlotKey, { method: string; detail: string }>>({
    1: { method: WITHDRAW_METHOD_OPTIONS[0], detail: '' },
    2: { method: WITHDRAW_METHOD_OPTIONS[0], detail: '' },
    3: { method: WITHDRAW_METHOD_OPTIONS[0], detail: '' },
  });
  const [status, setStatus] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const parsedAccounts = useMemo(() => {
    return {
      1: parseAccount(accounts.account1),
      2: parseAccount(accounts.account2),
      3: parseAccount(accounts.account3),
    } as Record<SlotKey, { method: string; detail: string } | null>;
  }, [accounts.account1, accounts.account2, accounts.account3]);

  const handleSave = (slot: SlotKey) => {
    const { method, detail } = editing[slot];
    const trimmed = detail.trim();
    if (!trimmed) {
      setStatus('请输入提现账号信息');
      return;
    }
    startTransition(async () => {
      setStatus(null);
      try {
        const res = await fetch('/api/profile/withdraw-accounts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ slot, method, detail: trimmed }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data?.error) {
          throw new Error(data.error ?? '保存失败，请稍后重试');
        }
        setAccounts((prev) => ({
          ...prev,
          [`account${slot}`]: `${method}:${trimmed}`,
        }));
        setStatus(`提现方式${slot} 已保存`);
      } catch (error) {
        setStatus(error instanceof Error ? error.message : '保存失败，请稍后重试');
      }
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-[#5c43a3]">预存提现方式</h3>
        {status && <p className="text-xs text-gray-500">{status}</p>}
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {[1, 2, 3].map((slot) => {
          const parsed = parsedAccounts[slot as SlotKey];
          return (
            <div
              key={slot}
              className="rounded-2xl border border-black/5 bg-white p-4 space-y-3 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-[#171717]">提现方式{slot}</p>
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
                    setEditing((prev) => ({
                      ...prev,
                      [slot]: { ...prev[slot as SlotKey], method: event.target.value },
                    }))
                  }
                  className="w-full rounded-2xl border border-black/10 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#5c43a3]"
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
                    setEditing((prev) => ({
                      ...prev,
                      [slot]: { ...prev[slot as SlotKey], detail: event.target.value },
                    }))
                  }
                  className="w-full rounded-2xl border border-black/10 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#5c43a3]"
                  placeholder="请输入账号"
                />
              </div>
              <button
                type="button"
                onClick={() => handleSave(slot as SlotKey)}
                disabled={isPending}
                className="w-full rounded-full bg-[#5c43a3] text-white text-xs uppercase tracking-[0.3em] py-2 hover:bg-[#4a3388] disabled:opacity-60"
              >
                {isPending ? '保存中…' : '保存'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
