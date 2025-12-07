'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

type Feedback = { type: 'success' | 'error'; text: string } | null;

const commonButtonClass =
  'rounded-full bg-[#5c43a3] px-4 py-2 text-xs font-semibold text-white hover:bg-[#4a3388] disabled:opacity-50';

export function GiftUsageButton({ lotteryId, prizeName }: { lotteryId: string; prizeName: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState('');
  const [message, setMessage] = useState<Feedback>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!target.trim()) {
      setMessage({ type: 'error', text: '请输入陪玩ID或 Discord ID' });
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch('/api/lottery/use', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lotteryId, mode: 'gift', target: target.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof data?.error === 'string' ? data.error : '使用失败');
      }
      setMessage({ type: 'success', text: `已将 ${prizeName} 送给目标用户` });
      router.refresh();
    } catch (error) {
      setMessage({ type: 'error', text: (error as Error).message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={commonButtonClass}
      >
        使用
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3">
          <div className="w-full max-w-md rounded-xl bg-white p-4 shadow-lg space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.4em] text-gray-500">赠送礼物</p>
                <h3 className="text-lg font-semibold text-[#171717]">{prizeName}</h3>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-sm font-semibold text-gray-600 hover:text-black"
              >
                关闭
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="space-y-1">
                <label className="text-sm text-gray-600">陪玩ID 或 Discord ID</label>
                <input
                  type="text"
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  placeholder="如 51111 或 525770714574225408"
                  className="w-full rounded-lg border border-black/10 bg-gray-50 px-3 py-2 text-sm text-[#171717] focus:outline-none focus:ring-1 focus:ring-[#5c43a3]"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-full border border-black/10 px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-black/5"
                >
                  取消
                </button>
                <button type="submit" disabled={loading} className={commonButtonClass}>
                  {loading ? '提交中…' : '确认赠送'}
                </button>
              </div>
            </form>
            {message ? (
              <p
                className={`text-sm ${message.type === 'success' ? 'text-emerald-600' : 'text-rose-500'}`}
              >
                {message.text}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}

export function SelfUseButton({ lotteryId, prizeName }: { lotteryId: string; prizeName: string }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<Feedback>(null);

  const handleUse = async () => {
    const confirm = window.confirm(`是否确认使用 ${prizeName}？`);
    if (!confirm) return;
    setSubmitting(true);
    setMessage(null);
    try {
      const res = await fetch('/api/lottery/use', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lotteryId, mode: 'selfuse' }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof data?.error === 'string' ? data.error : '使用失败');
      }
      setMessage({ type: 'success', text: '已使用' });
      router.refresh();
    } catch (error) {
      setMessage({ type: 'error', text: (error as Error).message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={() => void handleUse()}
        disabled={submitting}
        className={commonButtonClass}
      >
        {submitting ? '提交中…' : '使用'}
      </button>
      {message ? (
        <p className={`text-xs ${message.type === 'success' ? 'text-emerald-600' : 'text-rose-500'}`}>
          {message.text}
        </p>
      ) : null}
    </div>
  );
}
