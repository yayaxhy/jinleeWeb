'use client';

import { type FormEvent, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

type WithdrawFormProps = {
  maxAmount?: string;
};

export default function WithdrawForm({ maxAmount = '0' }: WithdrawFormProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const max = useMemo(() => {
    const parsed = Number(maxAmount);
    return Number.isNaN(parsed) ? 0 : parsed;
  }, [maxAmount]);

  const maxWithdrawable = Math.floor(max);
  const amountValue = Number(amount);
  const amountError =
    amount.length > 0 &&
    (Number.isNaN(amountValue) ||
      amountValue <= 0 ||
      amountValue > maxWithdrawable ||
      !Number.isInteger(amountValue));
  const canSubmit = !amountError && amountValue > 0 && method.trim().length > 0;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) return;
    setStatusMessage(null);

    startTransition(async () => {
      try {
        const response = await fetch('/api/withdraw', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ amount: amountValue, method }),
        });
        const data = await response.json();
        if (!response.ok || !data?.ok) {
          throw new Error(data?.error ?? 'unknown_error');
        }

        setStatusMessage('提现成功，我们将尽快处理！');
        setIsOpen(false);
        setAmount('');
        setMethod('');
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
        disabled={maxWithdrawable <= 0 || isPending}
      >
        提现
      </button>
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
              min="1"
              step="1"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              className={`w-full rounded-2xl border px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#5c43a3] ${
                amountError ? 'border-red-400 text-red-500' : 'border-black/10'
              }`}
              placeholder={
                maxWithdrawable > 0
                  ? `最多可提 ¥${maxWithdrawable.toLocaleString('zh-CN')}`
                  : '暂无可提现金额'
              }
            />
            {amountError && (
              <p className="text-xs text-red-500">
                提现金额必须为不超过可提现余额的正整数。
              </p>
            )}
          </div>
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-[0.4em] text-gray-500">提现方式 *</label>
            <input
              type="text"
              value={method}
              onChange={(event) => setMethod(event.target.value)}
              className="w-full rounded-2xl border border-black/10 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#5c43a3]"
              placeholder="用户可以输入任何文本"
              required
            />
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
