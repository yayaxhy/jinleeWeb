'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Props = {
  prizeName: string;
};

const SIMPLE_PRIZES = new Set(['自定义礼物券', '自定义tag券']);

export function SimpleVoucherUseButton({ prizeName }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const handleUse = async () => {
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch('/api/voucher/use', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prizeName }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data?.error === 'string' ? data.error : '使用失败');
      setMsg('使用成功');
      router.refresh();
    } catch (err) {
      setMsg((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={() => void handleUse()}
        disabled={loading}
        className="rounded-full border border-[#5c43a3] px-4 py-2 text-xs font-semibold text-[#5c43a3] hover:bg-[#5c43a3]/10 transition disabled:opacity-50"
      >
        {loading ? '使用中…' : '使用'}
      </button>
      {msg ? <p className="text-xs text-rose-500">{msg}</p> : null}
    </div>
  );
}

export function CommissionVoucherButton({ prizeName }: Props) {
  const router = useRouter();
  const [target, setTarget] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const handleUse = async () => {
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch('/api/voucher/use', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prizeName, target }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data?.error === 'string' ? data.error : '使用失败');
      setMsg('使用成功，生效期 30 天');
      router.refresh();
    } catch (err) {
      setMsg((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <input
        type="text"
        value={target}
        onChange={(e) => setTarget(e.target.value)}
        placeholder="输入陪玩ID或Discord ID"
        className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm"
      />
      <button
        type="button"
        onClick={() => void handleUse()}
        disabled={loading}
        className="rounded-full border border-[#5c43a3] px-4 py-2 text-xs font-semibold text-[#5c43a3] hover:bg-[#5c43a3]/10 transition disabled:opacity-50"
      >
        {loading ? '使用中…' : '使用'}
      </button>
      {msg ? <p className="text-xs text-rose-500">{msg}</p> : null}
    </div>
  );
}

export function FlowVoucherButton({ prizeName }: Props) {
  const router = useRouter();
  const [target, setTarget] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const handleUse = async () => {
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch('/api/voucher/use', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prizeName, target }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data?.error === 'string' ? data.error : '使用失败');
      setMsg('使用成功，额度累计+续期 30 天');
      router.refresh();
    } catch (err) {
      setMsg((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <input
        type="text"
        value={target}
        onChange={(e) => setTarget(e.target.value)}
        placeholder="输入陪玩ID或Discord ID"
        className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm"
      />
      <button
        type="button"
        onClick={() => void handleUse()}
        disabled={loading}
        className="rounded-full border border-[#5c43a3] px-4 py-2 text-xs font-semibold text-[#5c43a3] hover:bg-[#5c43a3]/10 transition disabled:opacity-50"
      >
        {loading ? '使用中…' : '使用'}
      </button>
      {msg ? <p className="text-xs text-rose-500">{msg}</p> : null}
    </div>
  );
}

export function resolveSpecialVoucher(prizeName: string):
  | { kind: 'simple' }
  | { kind: 'commission' }
  | { kind: 'flow' }
  | null {
  if (SIMPLE_PRIZES.has(prizeName)) return { kind: 'simple' };
  if (prizeName === '抽成降1%券') return { kind: 'commission' };
  if (prizeName === '双倍流水5000券') return { kind: 'flow' };
  return null;
}
