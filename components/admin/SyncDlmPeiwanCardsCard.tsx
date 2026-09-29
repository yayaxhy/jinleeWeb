'use client';

import { useState } from 'react';

type SyncSummary = {
  sourceMessages?: number;
  imageMessages?: number;
  matchedCards?: number;
  updated?: number;
  unchanged?: number;
  supersededByNewer?: number;
  skippedUnregistered?: Array<{ peiwanId: number; messageId: string; channelId: string }>;
  skippedUnlabelled?: Array<{ messageId: string; channelId: string }>;
  skippedOther?: Array<{ messageId: string; channelId: string; action: string; detail: string | null }>;
  completionMessageSent?: boolean;
  completionMessageError?: string | null;
};

const DLM_GUILD_ID = '1552040603804631110';

function messageUrl(channelId: string, messageId: string): string {
  return `https://discord.com/channels/${DLM_GUILD_ID}/${channelId}/${messageId}`;
}

function MessageLink({ channelId, messageId }: { channelId: string; messageId: string }) {
  return (
    <a href={messageUrl(channelId, messageId)} target="_blank" rel="noreferrer" className="text-[#f1b73d] underline underline-offset-2 hover:text-[#ffd36f]">
      打开消息
    </a>
  );
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
  const unlabelled = summary?.skippedUnlabelled ?? [];
  const otherSkipped = summary?.skippedOther ?? [];

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
          {unregistered.length ? (
            <div>
              <p>未在后台登记的陪玩编号（已跳过）：</p>
              <ul className="list-disc pl-4">
                {unregistered.map((row) => <li key={row.messageId}>{row.peiwanId}（<MessageLink channelId={row.channelId} messageId={row.messageId} />）</li>)}
              </ul>
            </div>
          ) : null}
          {unlabelled.length ? (
            <div>
              <p>以下图片消息未填写陪玩 ID，已跳过：</p>
              <ul className="list-disc pl-4">
                {unlabelled.map((row) => <li key={row.messageId}><MessageLink channelId={row.channelId} messageId={row.messageId} /></li>)}
              </ul>
            </div>
          ) : null}
          {otherSkipped.length ? (
            <div>
              <p>以下图片消息需要调整后重新上传：</p>
              <ul className="list-disc pl-4">
                {otherSkipped.map((row) => (
                  <li key={row.messageId}>
                    {row.action === 'SKIPPED_MULTIPLE_PEIWAN_IDS'
                      ? '请在消息文字中仅填写一个陪玩 ID'
                      : row.action === 'SKIPPED_MULTIPLE_IMAGES'
                        ? '请每条消息只保留一张名片图片'
                        : row.detail ?? '请检查消息内容'}（<MessageLink channelId={row.channelId} messageId={row.messageId} />）
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
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
