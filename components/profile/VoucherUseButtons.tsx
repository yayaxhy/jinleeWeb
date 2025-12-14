'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Props = {
  prizeName: string;
  lotteryId: string;
};

const primaryBtn =
  'rounded-full bg-[#5c43a3] px-4 py-2 text-xs font-semibold text-white hover:bg-[#4a3388] disabled:opacity-50';
const ghostBtn =
  'rounded-full border border-black/10 px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-black/5';

export function SimpleVoucherUseButton({ prizeName, lotteryId }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUse = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/voucher/use', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prizeName, lotteryId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data?.error === 'string' ? data.error : '使用失败');
      // 成功后直接关闭弹窗并刷新，不保留提示
      setError(null);
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={ghostBtn}
      >
        使用
      </button>
      {error ? <p className="text-xs text-rose-500">{error}</p> : null}

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3">
          <div className="w-full max-w-md rounded-xl bg-white p-4 shadow-lg space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.4em] text-gray-500">使用礼物券</p>
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
            <p className="text-sm text-gray-600">确认使用这张礼物券吗？</p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setOpen(false)} className={ghostBtn}>
                取消
              </button>
              <button type="button" onClick={() => void handleUse()} disabled={loading} className={primaryBtn}>
                {loading ? '使用中…' : '确认使用'}
              </button>
            </div>
            {error ? <p className="text-sm text-rose-500">{error}</p> : null}
          </div>
        </div>
      ) : null}
    </>
  );
}

export function CommissionVoucherButton({ prizeName, lotteryId }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const handleUse = async () => {
    if (!target.trim()) {
      setMsg('请输入陪玩ID或Discord ID');
      return;
    }
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch('/api/voucher/use', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prizeName, target, lotteryId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data?.error === 'string' ? data.error : '使用失败');
      setMsg('使用成功，生效期 30 天');
      setOpen(false);
      setTarget('');
      router.refresh();
    } catch (err) {
      setMsg((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          setMsg(null);
        }}
        className={ghostBtn}
      >
        使用
      </button>
      {msg && !open ? (
        <p className={`text-xs ${msg.startsWith('使用成功') ? 'text-emerald-600' : 'text-rose-500'}`}>
          {msg}
        </p>
      ) : null}
      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3">
          <div className="w-full max-w-md rounded-xl bg-white p-4 shadow-lg space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.4em] text-gray-500">使用优惠券</p>
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

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-sm text-gray-600">陪玩ID 或 Discord ID</label>
                <input
                  type="text"
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      void handleUse();
                    }
                  }}
                  placeholder="如 51111 或 525770714574225408"
                  className="w-full rounded-lg border border-black/10 bg-gray-50 px-3 py-2 text-sm text-[#171717] focus:outline-none focus:ring-1 focus:ring-[#5c43a3]"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setOpen(false)} className={ghostBtn}>
                  取消
                </button>
                <button type="button" onClick={() => void handleUse()} disabled={loading} className={primaryBtn}>
                  {loading ? '使用中…' : '确认使用'}
                </button>
              </div>
              {msg ? (
                <p className={`text-sm ${msg.startsWith('使用成功') ? 'text-emerald-600' : 'text-rose-500'}`}>
                  {msg}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

export function FlowVoucherButton({ prizeName, lotteryId }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const handleUse = async () => {
    if (!target.trim()) {
      setMsg('请输入陪玩ID或Discord ID');
      return;
    }
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch('/api/voucher/use', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prizeName, target, lotteryId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data?.error === 'string' ? data.error : '使用失败');
      setMsg('使用成功，额度累计+续期 30 天');
      setOpen(false);
      setTarget('');
      router.refresh();
    } catch (err) {
      setMsg((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          setMsg(null);
        }}
        className={ghostBtn}
      >
        使用
      </button>
      {msg && !open ? (
        <p className={`text-xs ${msg.startsWith('使用成功') ? 'text-emerald-600' : 'text-rose-500'}`}>
          {msg}
        </p>
      ) : null}
      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3">
          <div className="w-full max-w-md rounded-xl bg-white p-4 shadow-lg space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.4em] text-gray-500">使用优惠券</p>
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

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-sm text-gray-600">陪玩ID 或 Discord ID</label>
                <input
                  type="text"
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      void handleUse();
                    }
                  }}
                  placeholder="如 51111 或 525770714574225408"
                  className="w-full rounded-lg border border-black/10 bg-gray-50 px-3 py-2 text-sm text-[#171717] focus:outline-none focus:ring-1 focus:ring-[#5c43a3]"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setOpen(false)} className={ghostBtn}>
                  取消
                </button>
                <button type="button" onClick={() => void handleUse()} disabled={loading} className={primaryBtn}>
                  {loading ? '使用中…' : '确认使用'}
                </button>
              </div>
              {msg ? (
                <p className={`text-sm ${msg.startsWith('使用成功') ? 'text-emerald-600' : 'text-rose-500'}`}>
                  {msg}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
