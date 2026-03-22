'use client';

import { useState } from 'react';

export function SyncAllPeiwanTagsCard({ readOnly = false }: { readOnly?: boolean }) {
  const [message, setMessage] = useState<string | null>(null);
  const [state, setState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const handleSync = async () => {
    if (readOnly) {
      setMessage('当前账号为只读权限，无法同步所有陪玩 tag。');
      setState('error');
      return;
    }

    setState('loading');
    setMessage(null);
    try {
      const res = await fetch('/api/admin/peiwan/sync-roles-all', {
        method: 'POST',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((data as { error?: string }).error ?? '同步失败，请稍后重试');
      }
      setState('success');
      const total = Number((data as { total?: number }).total ?? 0);
      const changed = Number((data as { changed?: number }).changed ?? 0);
      const failed = Number((data as { failed?: number }).failed ?? 0);
      setMessage(`同步完成：总计 ${total}，更新 ${changed}，失败 ${failed}`);
    } catch (error) {
      setState('error');
      setMessage((error as Error).message);
    }
  };

  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-6 space-y-4">
      <h3 className="text-xl font-semibold">同步所有陪玩tag</h3>
      <p className="text-sm text-white/70">拉取当前数据库内所有陪玩的 Discord tag，并写回数据库。</p>
      <button
        type="button"
        onClick={handleSync}
        disabled={state === 'loading' || readOnly}
        className="w-full rounded-full bg-[#5c43a3] px-6 py-2 text-sm tracking-[0.2em] text-white hover:bg-[#4a3388] disabled:opacity-50"
      >
        {state === 'loading' ? '同步中…' : '同步tag'}
      </button>
      {message ? (
        <p className={`text-xs ${state === 'success' ? 'text-emerald-300' : 'text-rose-300'}`}>
          {message}
        </p>
      ) : null}
    </div>
  );
}
