'use client';

import { FormEvent, useMemo, useState } from 'react';
import Link from 'next/link';
import { DISCORD_ID_PATTERN, isDiscordSnowflake } from '@/lib/discord-id';

type Status = { type: 'success' | 'error'; text: string };
type TakeoverSummary = {
  occupied: boolean;
  occupiedJinleeIds: string[];
  member: {
    discordUserId: string;
    linkedJinleeId: string | null;
    status: string;
    totalBalance: string;
    income: string;
    recharge: string;
    totalSpent: string;
    serverDisplayName: string | null;
  } | null;
  jinleeUser: {
    jinleeId: string;
    discordUserId: string | null;
    sessionVersion: number;
    totalBalance: string;
    income: string;
    recharge: string;
    totalSpent: string;
    loyaltyPoints: string;
    createdAt: string;
    updatedAt: string;
  } | null;
  discordBinding: {
    id: string;
    jinleeId: string;
    providerUserId: string;
    lastLoginAt: string | null;
    createdAt: string;
    updatedAt: string;
  } | null;
};

export function MigrateDiscordClient() {
  const [oldId, setOldId] = useState('');
  const [newId, setNewId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<Status | null>(null);
  const [changed, setChanged] = useState<Record<string, number>>({});
  const [takeover, setTakeover] = useState<TakeoverSummary | null>(null);
  const [confirmTakeover, setConfirmTakeover] = useState(false);

  const isDisabled = useMemo(
    () => !oldId.trim() || !newId.trim() || isSubmitting || (Boolean(takeover) && !confirmTakeover),
    [oldId, newId, isSubmitting, takeover, confirmTakeover],
  );

  const resetTakeover = () => {
    setTakeover(null);
    setConfirmTakeover(false);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus(null);
    setChanged({});
    setIsSubmitting(true);

    try {
      const normalizedOldId = oldId.trim();
      const normalizedNewId = newId.trim();
      if (!isDiscordSnowflake(normalizedOldId) || !isDiscordSnowflake(normalizedNewId)) {
        setStatus({ type: 'error', text: '请输入 17-20 位纯数字 Discord 雪花 ID' });
        return;
      }

      const response = await fetch('/api/admin/migrate-discord', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          oldDiscordId: normalizedOldId,
          newDiscordId: normalizedNewId,
          forceTakeover: Boolean(takeover && confirmTakeover),
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        const text = typeof result?.error === 'string' ? result.error : '迁移失败，请稍后再试';
        if (result?.requiresForceTakeover) {
          setTakeover((result?.takeover as TakeoverSummary | undefined) ?? null);
        }
        setStatus({ type: 'error', text });
      } else {
        resetTakeover();
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
          将所有以旧 Discord ID 关联的数据整体迁移到新的 Discord ID。若目标 ID 已被占用，会先归档当前目标账号，再把旧账号迁移过去。
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 rounded-3xl border border-white/10 bg-white/5 p-6">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2 text-sm">
            <span className="text-white/70">旧 Discord ID</span>
            <input
              type="text"
              value={oldId}
              onChange={(event) => {
                resetTakeover();
                setOldId(event.target.value);
              }}
              inputMode="numeric"
              pattern={DISCORD_ID_PATTERN}
              maxLength={20}
              className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white"
              placeholder="请输入旧账号 ID"
            />
          </label>
          <label className="space-y-2 text-sm">
            <span className="text-white/70">新 Discord ID</span>
            <input
              type="text"
              value={newId}
              onChange={(event) => {
                resetTakeover();
                setNewId(event.target.value);
              }}
              inputMode="numeric"
              pattern={DISCORD_ID_PATTERN}
              maxLength={20}
              className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white"
              placeholder="请输入新账号 ID"
            />
          </label>
        </div>
        <p className="text-xs text-white/50">仅支持 17-20 位纯数字 Discord 雪花 ID。</p>

        {takeover ? (
          <div className="space-y-4 rounded-2xl border border-amber-400/35 bg-amber-500/10 p-4 text-sm text-amber-100">
            <div className="space-y-1">
              <p className="font-medium text-amber-50">目标 Discord ID 当前已被占用</p>
              <p className="text-amber-100/80">
                确认后会先归档目标账号当前绑定与历史 Discord-ID 快照，再把旧账号迁移到这个目标 ID。
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                <p className="text-xs uppercase tracking-[0.2em] text-white/45">Member</p>
                <p className="mt-2 text-white/90">{takeover.member?.serverDisplayName ?? '未命名账号'}</p>
                <p className="mt-1 text-white/65">状态：{takeover.member?.status ?? '无'}</p>
                <p className="text-white/65">余额：{takeover.member?.totalBalance ?? '0'}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                <p className="text-xs uppercase tracking-[0.2em] text-white/45">Jinlee</p>
                <p className="mt-2 break-all text-white/90">{takeover.jinleeUser?.jinleeId ?? '未绑定'}</p>
                <p className="mt-1 text-white/65">积分：{takeover.jinleeUser?.loyaltyPoints ?? '0'}</p>
                <p className="text-white/65">Session 版本：{takeover.jinleeUser?.sessionVersion ?? 0}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                <p className="text-xs uppercase tracking-[0.2em] text-white/45">Binding</p>
                <p className="mt-2 break-all text-white/90">{takeover.discordBinding?.id ?? '无 Discord 绑定'}</p>
                <p className="mt-1 text-white/65">
                  最近登录：{takeover.discordBinding?.lastLoginAt ? new Date(takeover.discordBinding.lastLoginAt).toLocaleString() : '无'}
                </p>
              </div>
            </div>

            <label className="flex items-start gap-3 rounded-xl border border-white/10 bg-black/20 p-3 text-white/90">
              <input
                type="checkbox"
                checked={confirmTakeover}
                onChange={(event) => setConfirmTakeover(event.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-white/20 bg-black/20"
              />
              <span>我确认覆盖当前目标 Discord 绑定，并将该目标账号归档到新的内部归档 ID。</span>
            </label>
          </div>
        ) : null}

        <button
          type="submit"
          disabled={isDisabled}
          className="inline-flex items-center justify-center rounded-full bg-white/15 px-6 py-2 text-sm text-white hover:bg-white/25 disabled:opacity-50"
        >
          {isSubmitting ? '迁移中…' : takeover ? '确认覆盖迁移' : '开始迁移'}
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
