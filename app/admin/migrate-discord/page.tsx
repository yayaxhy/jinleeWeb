'use client';

import { FormEvent, useMemo, useState } from 'react';
import Link from 'next/link';

type Status = { type: 'success' | 'error'; text: string };

export default function MigrateDiscordPage() {
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
          <label className="space-y-2">
            <span className="text-sm text-white/60">旧 Discord ID</span>
            <input
              type="text"
              value={oldId}
              onChange={(event) => setOldId(event.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[#5c43a3]"
              placeholder="被封/失效的 Discord ID"
              autoComplete="off"
              required
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm text-white/60">新 Discord ID</span>
            <input
              type="text"
              value={newId}
              onChange={(event) => setNewId(event.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[#5c43a3]"
              placeholder="新账号的 Discord ID"
              autoComplete="off"
              required
            />
          </label>
        </div>

        <div className="space-y-3 rounded-2xl border border-amber-400/40 bg-amber-500/10 p-4 text-amber-100">
          <p className="text-sm font-semibold">执行前请确认</p>
          <ul className="space-y-1 text-sm text-amber-50/80">
            <li>· 新 Discord ID 不应已在系统中存在。</li>
            <li>· 旧账号的订单、流水、礼物墙、邀请关系等都会指向新账号。</li>
            <li>· 遇到冲突（例如唯一约束）会回滚并提示错误。</li>
          </ul>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={isDisabled}
            className="inline-flex items-center justify-center rounded-full bg-[#5c43a3] px-6 py-2 text-sm font-semibold text-white transition disabled:opacity-50 hover:bg-[#4a3388]"
          >
            {isSubmitting ? '迁移中…' : '执行迁移'}
          </button>
          <Link
            href="/admin"
            className="inline-flex items-center justify-center rounded-full border border-white/20 px-6 py-2 text-sm text-white hover:bg-white/10"
          >
            返回后台
          </Link>
        </div>

        {status ? (
          <div
            className={`rounded-2xl border px-4 py-3 text-sm ${
              status.type === 'success'
                ? 'border-emerald-400/40 bg-emerald-500/10 text-emerald-100'
                : 'border-rose-400/40 bg-rose-500/10 text-rose-100'
            }`}
          >
            {status.text}
          </div>
        ) : null}

        {Object.keys(changed).length > 0 ? (
          <div className="space-y-2 rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-sm text-white/70">更新行数（按表/字段统计）</p>
            <div className="grid gap-2 md:grid-cols-2">
              {Object.entries(changed).map(([label, count]) => (
                <div key={label} className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm">
                  <span className="text-white/80">{label}</span>
                  <span className="text-white font-semibold">{count}</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </form>
    </div>
  );
}
