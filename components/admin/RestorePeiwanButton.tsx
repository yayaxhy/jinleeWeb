'use client';

import { useState } from 'react';

type RestorePeiwanButtonProps = {
  restoreToken: string;
  isDeleted: boolean;
};

export function RestorePeiwanButton({ restoreToken, isDeleted }: RestorePeiwanButtonProps) {
  const [state, setState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const [deleted, setDeleted] = useState(isDeleted);

  const handleRestore = async () => {
    if (state === 'loading' || !deleted) return;
    setState('loading');
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/peiwan/${encodeURIComponent(restoreToken)}/restore`, {
        method: 'POST',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((data as { error?: string }).error ?? '恢复失败，请稍后重试');
      }
      setState('success');
      setDeleted(false);
      setMessage('已恢复陪玩，上架生效');
    } catch (error) {
      setState('error');
      setMessage((error as Error).message);
    }
  };

  return (
    <div className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-1">
          <p className="text-sm text-white/70">恢复陪玩</p>
          <p className="text-xs text-white/50">删除后可在此重新上架</p>
        </div>
        <button
          type="button"
          disabled={!deleted || state === 'loading'}
          onClick={handleRestore}
          className={`rounded-full px-4 py-2 text-xs font-semibold tracking-[0.15em] text-white transition ${
            deleted
              ? 'bg-emerald-600 hover:bg-emerald-500'
              : 'bg-white/10 text-white/50 cursor-not-allowed'
          } ${state === 'loading' ? 'opacity-70' : ''}`}
        >
          {state === 'loading' ? '恢复中…' : deleted ? '恢复陪玩' : '已上架'}
        </button>
      </div>
      {message ? (
        <p className={`text-xs ${state === 'success' ? 'text-emerald-300' : 'text-rose-300'}`}>
          {message}
        </p>
      ) : null}
    </div>
  );
}
