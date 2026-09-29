'use client';

import { useState } from 'react';

type SyncSummary = {
  sourceMessages?: number;
  imageMessages?: number;
  matchedCards?: number;
  updated?: number;
  unchanged?: number;
  supersededByNewer?: number;
  initializedChannels?: string[];
  skippedUnregistered?: Array<{ peiwanId: number; messageId: string }>;
  skippedUnlabelledMessageIds?: string[];
  skippedOtherMessageIds?: string[];
  completionMessageSent?: boolean;
  completionMessageError?: string | null;
};

function compactIds(ids: string[], limit = 8): string {
  const visible = ids.slice(0, limit).join('、');
  return ids.length > limit ? `${visible} 等 ${ids.length} 条` : visible;
}

export function SyncDlmPeiwanCardsCard() {
  const [summary, setSummary] = useState<SyncSummary | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [state, setState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const handleSync = async () => {
    setState('loading');
    setMessage(null);
    setSummary(null);
    try {
      const response = await fetch('/api/admin/peiwan/sync-cards', { method: 'POST' });
      const data = (await response.json().catch(() => ({}))) as SyncSummary & { error?: string };
      if (!response.ok) throw new Error(data.error ?? '同步失败，请稍后重试');

      setSummary(data);
      setState('success');
      setMessage(
        `同步完成：读取 ${Number(data.sourceMessages ?? 0)} 条新消息，其中 ${Number(data.imageMessages ?? 0)} 条含图片；` +
          `匹配 ${Number(data.matchedCards ?? 0)} 张名片，更新 ${Number(data.updated ?? 0)} 张，无需更新 ${Number(data.unchanged ?? 0)} 张。`,
      );
    } catch (error) {
      setState('error');
      setMessage((error as Error).message);
    }
  };

  const unregistered = summary?.skippedUnregistered ?? [];
  const unlabelled = summary?.skippedUnlabelledMessageIds ?? [];
  const otherSkipped = summary?.skippedOtherMessageIds ?? [];

  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-6 space-y-4">
      <div className="space-y-2">
        <h3 className="text-xl font-semibold">自动同步 DLM 名片</h3>
        <p className="text-sm text-white/70">
          从 DLM 图库的名片频道读取新图片；同一陪玩编号只采用发布时间最新的一张。首次同步会建立历史记录，之后仅处理上次完成后新增的消息。
        </p>
      </div>
      <button
        type="button"
        onClick={handleSync}
        disabled={state === 'loading'}
        className="w-full rounded-full bg-[#c99122] px-6 py-2 text-sm font-medium tracking-[0.16em] text-[#281c08] hover:bg-[#e4ae3d] disabled:opacity-50"
      >
        {state === 'loading' ? '同步中…' : '同步新名片'}
      </button>
      {message ? (
        <p className={`text-xs leading-5 ${state === 'success' ? 'text-emerald-300' : 'text-rose-300'}`}>
          {message}
        </p>
      ) : null}
      {summary ? (
        <div className="space-y-2 text-xs leading-5 text-white/65">
          {summary.initializedChannels?.length ? <p>首次扫描已为 {summary.initializedChannels.length} 个来源频道建立同步记录。</p> : null}
          {summary.supersededByNewer ? <p>已忽略 {summary.supersededByNewer} 条被更新名片替代的旧记录。</p> : null}
          {unregistered.length ? (
            <p>
              未在后台登记的陪玩编号（已跳过）：{unregistered.map((row) => `${row.peiwanId}（消息 ${row.messageId}）`).join('、')}
            </p>
          ) : null}
          {unlabelled.length ? <p>未填写陪玩编号的图片消息（已跳过）：{compactIds(unlabelled)}</p> : null}
          {otherSkipped.length ? <p>需人工确认的图片消息（已跳过）：{compactIds(otherSkipped)}</p> : null}
          {summary.completionMessageSent ? (
            <p>已在「名片」频道发送“以上名片已经上传完成”。</p>
          ) : summary.completionMessageError ? (
            <p className="text-amber-300">名片已同步，但完成回执发送失败：{summary.completionMessageError}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
