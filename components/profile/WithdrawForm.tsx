'use client';

import { type FormEvent, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

const MIN_WITHDRAW_AMOUNT = 100;
const ROME_TIMEZONE = 'Europe/Rome';
const METHOD_OPTIONS = ['微信', '支付宝', 'Paypal'];

type WithdrawFormProps = {
  maxAmount?: string;
  lastWithdrawAt?: string | null;
  nextAvailableAt?: string | null;
};

const formatDateTime = (value?: string | Date | null) => {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleString('zh-CN', { hour12: false, timeZone: ROME_TIMEZONE });
};

export default function WithdrawForm({ maxAmount = '0', lastWithdrawAt, nextAvailableAt }: WithdrawFormProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [methodType, setMethodType] = useState<string>(METHOD_OPTIONS[0]);
  const [methodDetail, setMethodDetail] = useState('');
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
  const canSubmit =
    !amountError && amountValue >= MIN_WITHDRAW_AMOUNT && methodDetail.trim().length > 0 && !inCooldown;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) return;
    setStatusMessage(null);

    startTransition(async () => {
      try {
        const method = `${methodType}:${methodDetail.trim()}`;
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
        setIsOpen(false);
        setAmount('');
        setMethodType(METHOD_OPTIONS[0]);
        setMethodDetail('');
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
      <button
        type="button"
        className="px-4 py-2 rounded-full border border-black/10 text-xs uppercase tracking-[0.4em] hover:bg-black/5 transition disabled:opacity-50"
        onClick={() => setIsOpen((open) => !open)}
        disabled={!canWithdraw || isPending}
      >
        提现
      </button>
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
      {isOpen && (
        <form onSubmit={handleSubmit} className="space-y-4 text-left">
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-[0.4em] text-gray-500">提现金额</label>
            <input
              type="number"
              min={MIN_WITHDRAW_AMOUNT}
              step="0.01"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              className={`w-full rounded-2xl border px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#5c43a3] ${
                amountError ? 'border-red-400 text-red-500' : 'border-black/10'
              }`}
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
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-[0.4em] text-gray-500">提现方式 *</label>
            <div className="flex flex-col gap-2">
              <select
                value={methodType}
                onChange={(event) => setMethodType(event.target.value)}
                className="w-full rounded-2xl border border-black/10 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#5c43a3]"
              >
                {METHOD_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              <input
                type="text"
                value={methodDetail}
                onChange={(event) => setMethodDetail(event.target.value)}
                className="w-full rounded-2xl border border-black/10 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#5c43a3]"
                placeholder="请输入账号信息"
                required
              />
            </div>
            <p className="text-xs text-gray-500">
              例子：<br/>支付宝：18888888 真实姓名<br/><br/>微信：微信号 真实姓名<br/><br/>Paypal: xxx@gmail.com +名字<br/><br/>如有错误，请联系客服
            </p>
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              className="px-4 py-2 rounded-full border border-black/10 text-xs uppercase tracking-[0.4em]"
              onClick={() => {
                setIsOpen(false);
                setStatusMessage(null);
              }}
            >
              取消
            </button>
            <button
              type="submit"
              disabled={!canSubmit || isPending}
              className="px-4 py-2 rounded-full bg-[#5c43a3] text-white text-xs uppercase tracking-[0.4em] disabled:bg-gray-300 disabled:text-gray-500"
            >
              {isPending ? '提交中…' : '确认'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
