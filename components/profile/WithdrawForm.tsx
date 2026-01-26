'use client';

import { type FormEvent, useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

const MIN_WITHDRAW_AMOUNT = 100;
const ROME_TIMEZONE = 'Europe/Rome';
export const WITHDRAW_METHOD_OPTIONS = ['微信', '支付宝', 'Paypal'] as const;

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

type ParsedAccount = { slot: '1' | '2' | '3'; method: string; detail: string };

const parseAccount = (slot: '1' | '2' | '3', value?: string | null): ParsedAccount | null => {
  if (!value) return null;
  const [method, ...rest] = value.split(':');
  const detail = rest.join(':').trim();
  if (!method || !detail) return null;
  return { slot, method, detail };
};

export default function WithdrawForm({
  maxAmount = '0',
  lastWithdrawAt,
  nextAvailableAt,
  savedAccounts,
}: WithdrawFormProps) {
  const router = useRouter();
  const [amount, setAmount] = useState('');
  const [selectedSlot, setSelectedSlot] = useState<string>('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

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
      parseAccount('1', savedAccounts?.account1),
      parseAccount('2', savedAccounts?.account2),
      parseAccount('3', savedAccounts?.account3),
    ].filter(Boolean) as ParsedAccount[];
  }, [savedAccounts?.account1, savedAccounts?.account2, savedAccounts?.account3]);
  const selectedAccount = parsedAccounts.find((acc) => acc.slot === selectedSlot);
  useEffect(() => {
    if (!selectedSlot && parsedAccounts.length > 0) {
      setSelectedSlot(parsedAccounts[0].slot);
    }
  }, [parsedAccounts, selectedSlot]);
  const canSubmit =
    !amountError && amountValue >= MIN_WITHDRAW_AMOUNT && !inCooldown && !!selectedAccount;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) return;
    setStatusMessage(null);

    startTransition(async () => {
      try {
        if (!selectedAccount) {
          throw new Error('请选择提现方式');
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
            data?.error === 'withdraw_cooldown' && nextAvailableFromResponse
              ? `提现冷却中，下次可在 ${nextAvailableFromResponse} 后再试。`
              : data?.error ?? 'unknown_error';
          throw new Error(friendlyMessage);
        }

        const successMessage = nextAvailableFromResponse
          ? `提现成功！下次可提现时间：${nextAvailableFromResponse}`
          : '提现成功，我们将尽快处理！';
        setStatusMessage(successMessage);
        setAmount('');
        setSelectedSlot('');
        router.refresh();
      } catch (error) {
        const message =
          error instanceof Error && error.message ? error.message : '提交失败，请稍后再试';
        setStatusMessage(message);
      }
    });
  };

  return (
    <div className="space-y-3">
      {!canWithdraw && (
        <div className="space-y-1">
          {inCooldown && nextAvailableDate && (
            <p className="text-xs text-amber-600">
              提现冷却中，下次可在 {formatDateTime(nextAvailableDate)} 后再试。
            </p>
          )}
          {maxWithdrawable < MIN_WITHDRAW_AMOUNT && (
            <p className="text-xs text-gray-500">提现金额需大于 {MIN_WITHDRAW_AMOUNT}</p>
          )}
        </div>
      )}
      {lastWithdrawDate && (
        <p className="text-xs text-gray-400">上次提现：{formatDateTime(lastWithdrawDate)}</p>
      )}
      {statusMessage && (
        <p className="text-xs text-gray-600" role="status">
          {statusMessage}
        </p>
      )}
      <div className="space-y-2">
        <label className="text-xs uppercase tracking-[0.4em] text-gray-500">选择提现方式</label>
        <select
          value={selectedSlot}
          onChange={(event) => setSelectedSlot(event.target.value)}
          disabled={parsedAccounts.length === 0}
          className="w-full rounded-2xl border border-black/10 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#5c43a3] disabled:bg-gray-100 disabled:text-gray-400"
        >
          <option value="">请选择提现方式</option>
          {parsedAccounts.map((acc) => (
            <option key={acc.slot} value={acc.slot}>
              提现方式{acc.slot} · {acc.method} · {acc.detail}
            </option>
          ))}
        </select>
        {parsedAccounts.length === 0 && (
          <p className="text-xs text-gray-500">尚未保存提现方式，请先在下方添加。</p>
        )}
      </div>
      <form onSubmit={handleSubmit} className="space-y-4 text-left">
        <div className="space-y-2">
          <label className="text-xs uppercase tracking-[0.4em] text-gray-500">提现金额</label>
          <input
            type="number"
            min={MIN_WITHDRAW_AMOUNT}
            step="0.01"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            disabled={!canWithdraw}
            className={`w-full rounded-2xl border px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#5c43a3] ${
              amountError ? 'border-red-400 text-red-500' : 'border-black/10'
            } ${!canWithdraw ? 'bg-gray-100 text-gray-400' : ''}`}
            placeholder={
              canWithdraw
                ? `最多可提 ¥${maxWithdrawable.toLocaleString('zh-CN')}`
                : '暂无可提现金额'
            }
          />
          {amountError && (
            <p className="text-xs text-red-500">
              提现金额必须大于 {MIN_WITHDRAW_AMOUNT} 且不超过可提现余额。
            </p>
          )}
        </div>
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={!canSubmit || isPending}
            className="px-4 py-2 rounded-full bg-[#5c43a3] text-white text-xs uppercase tracking-[0.4em] disabled:bg-gray-300 disabled:text-gray-500"
          >
            {isPending ? '提交中…' : '确认'}
          </button>
        </div>
      </form>
    </div>
  );
}
