'use client';

import { useState } from 'react';

export function DeletePeiwanCard() {
  const [peiwanId, setPeiwanId] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [state, setState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const handleDelete = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = peiwanId.trim();
    if (!trimmed) {
      setMessage('请输入陪玩ID');
      setState('error');
      return;
    }

    setState('loading');
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/peiwan/${encodeURIComponent(trimmed)}`, {
        method: 'DELETE',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((data as { error?: string }).error ?? '删除失败，请稍后重试');
      }
      setState('success');
      setMessage(`已删除陪玩 ID ${data.peiwanId ?? trimmed}`);
      setPeiwanId('');
    } catch (error) {
      setState('error');
      setMessage((error as Error).message);
    }
  };

  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-6 space-y-4">
      <h3 className="text-xl font-semibold">删除陪玩</h3>
      <p className="text-sm text-white/70">输入陪玩 ID，确认后将删除对应陪玩资料。</p>
      <form onSubmit={handleDelete} className="space-y-3">
        <input
          type="number"
          inputMode="numeric"
          value={peiwanId}
          onChange={(event) => setPeiwanId(event.target.value)}
          placeholder="陪玩ID（数字）"
          className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[#5c43a3]"
        />
        <button
          type="submit"
          disabled={state === 'loading'}
          className="w-full rounded-full bg-rose-500 px-6 py-2 text-sm tracking-[0.2em] text-white hover:bg-rose-600 disabled:opacity-50"
        >
          {state === 'loading' ? '删除中…' : '确认删除'}
        </button>
        {message ? (
          <p className={`text-xs ${state === 'success' ? 'text-emerald-300' : 'text-rose-300'}`}>
            {message}
          </p>
        ) : null}
      </form>
    </div>
  );
}

