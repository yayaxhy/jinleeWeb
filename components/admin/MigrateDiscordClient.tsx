'use client';

import { FormEvent, useMemo, useState } from 'react';
import Link from 'next/link';

type Status = { type: 'success' | 'error'; text: string };

export function MigrateDiscordClient() {
  const [oldId, setOldId] = useState('');
  const [newId, setNewId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<Status | null>(null);
  const [changed, setChanged] = useState<Record<string, number>>({});

  const isDisabled = useMemo(
    () => !oldId.trim() || !newId.trim() || isSubmitting,
    [oldId, newId, isSubmitting],
  );

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus(null);
    setChanged({});
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/admin/migrate-discord', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          oldDiscordId: oldId.trim(),
          newDiscordId: newId.trim(),
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        const text = typeof result?.error === 'string' ? result.error : '迁移失败，请稍后再试';
        setStatus({ type: 'error', text });
      } else {
        setStatus({ type: 'success', text: result?.message ?? '迁移完成' });
        setChanged(result?.changed ?? {});
      }
    } catch (err) {
      setStatus({ type: 'error', text: (err as Error).message });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-8 text-white">
      <div className="space-y-2">
        <p className="text-sm uppercase tracking-[0.4em] text-white/50">账号迁移</p>
        <h1 className="text-3xl font-semibold">迁移 Discord 账号数据</h1>
        <p className="text-sm text-white/70">
          将所有以旧 Discord ID 关联的数据整体迁移到新的 Discord ID。操作会在事务内完成，若遇到冲突会回滚。
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 rounded-3xl border border-white/10 bg-white/5 p-6">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2 text-sm">
            <span className="text-white/70">旧 Discord ID</span>
            <input
              type="text"
              value={oldId}
              onChange={(event) => setOldId(event.target.value)}
              className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white"
              placeholder="请输入旧账号 ID"
            />
          </label>
          <label className="space-y-2 text-sm">
            <span className="text-white/70">新 Discord ID</span>
            <input
              type="text"
              value={newId}
              onChange={(event) => setNewId(event.target.value)}
              className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white"
              placeholder="请输入新账号 ID"
            />
          </label>
        </div>

        <button
          type="submit"
          disabled={isDisabled}
          className="inline-flex items-center justify-center rounded-full bg-white/15 px-6 py-2 text-sm text-white hover:bg-white/25 disabled:opacity-50"
        >
          {isSubmitting ? '迁移中…' : '开始迁移'}
        </button>
      </form>

      {status ? (
        <div className={`rounded-2xl border px-4 py-3 text-sm ${status.type === 'success' ? 'border-emerald-400/50 text-emerald-300' : 'border-rose-400/50 text-rose-300'}`}>
          {status.text}
        </div>
      ) : null}

      {Object.keys(changed).length ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/80">
          <p className="text-white">已变更的记录数：</p>
          <ul className="mt-2 space-y-1">
            {Object.entries(changed).map(([key, value]) => (
              <li key={key}>{key}: {value}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <Link
        href="/admin"
        className="inline-flex items-center justify-center rounded-full border border-white/20 px-6 py-2 text-sm tracking-[0.2em] text-white hover:bg-white/10"
      >
        返回后台首页
      </Link>
    </div>
  );
}
