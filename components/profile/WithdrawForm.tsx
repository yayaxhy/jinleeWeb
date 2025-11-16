'use client';

import { type FormEvent, useMemo, useState } from 'react';

type WithdrawFormProps = {
  maxAmount?: string;
};

export default function WithdrawForm({ maxAmount = '0' }: WithdrawFormProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('');

  const max = useMemo(() => {
    const parsed = Number(maxAmount);
    return Number.isNaN(parsed) ? 0 : parsed;
  }, [maxAmount]);

  const amountValue = Number(amount);
  const amountError =
    amount.length > 0 && (Number.isNaN(amountValue) || amountValue <= 0 || amountValue > max);
  const canSubmit = !amountError && amountValue > 0 && method.trim().length > 0;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) return;
    setIsOpen(false);
    setAmount('');
    setMethod('');
  };

  return (
    <div className="space-y-3">
      <button
        type="button"
        className="px-4 py-2 rounded-full border border-black/10 text-xs uppercase tracking-[0.4em] hover:bg-black/5 transition disabled:opacity-50"
        onClick={() => setIsOpen((open) => !open)}
        disabled={max <= 0}
      >
        提现
      </button>
      {isOpen && (
        <form onSubmit={handleSubmit} className="space-y-4 text-left">
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-[0.4em] text-gray-500">提现金额</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              className={`w-full rounded-2xl border px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#5c43a3] ${
                amountError ? 'border-red-400 text-red-500' : 'border-black/10'
              }`}
              placeholder={`最多可提 ¥${max.toLocaleString('zh-CN')}`}
            />
            {amountError && (
              <p className="text-xs text-red-500">提现金额不能大于可提现余额，且需要为正数。</p>
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
              onClick={() => setIsOpen(false)}
            >
              取消
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className="px-4 py-2 rounded-full bg-[#5c43a3] text-white text-xs uppercase tracking-[0.4em] disabled:bg-gray-300 disabled:text-gray-500"
            >
              确认
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
