'use client';

import { FormEvent, useMemo, useState } from 'react';
import Link from 'next/link';
import { DISCORD_ID_PATTERN, isDiscordSnowflake } from '@/lib/discord-id';

type Status = { type: 'success' | 'error'; text: string };

type AccountSummary = {
  discordId: string;
  exists: boolean;
  memberExists: boolean;
  jinleeId: string | null;
  serverDisplayName: string | null;
  memberStatus: string | null;
  wallet: {
    totalBalance: string;
    income: string;
    recharge: string;
    totalSpent: string;
    loyaltyPoints: string;
  };
  vip: {
    derivedLevel: number;
    lastSettledLevel: number;
    roleOptOut: boolean;
    announcementEnabled: boolean;
    hasDispatchImage: boolean;
  };
  heart: {
    outgoingPairs: number;
    incomingPairs: number;
    maxSent: number;
    maxReceived: number;
  };
  commission: {
    currentRate: string;
    baseRate: string;
    isPeiwan: boolean;
    peiwanId: number | null;
  };
  buffs: {
    commissionBoostExpiresAt: string | null;
    flowRemaining: string;
    flowExpiresAt: string | null;
    spendRemaining: string;
    spendExpiresAt: string | null;
    autoCommissionActiveUntil: string | null;
  };
  hasTransferableData: boolean;
};

type TransferResult = {
  totalBalance: string;
  income: string;
  recharge: string;
  totalSpent: string;
  loyaltyPoints: string;
  vipLevelAfter: number;
};

const SummaryCard = ({ title, summary }: { title: string; summary: AccountSummary | null }) => {
  if (!summary) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4 space-y-3">
      <div className="space-y-1">
        <p className="text-xs uppercase tracking-[0.3em] text-white/45">{title}</p>
        <p className="text-base text-white/90">{summary.serverDisplayName ?? summary.discordId}</p>
        <p className="text-xs text-white/55">
          {summary.memberStatus ?? '未知状态'} · {summary.jinleeId ?? '无 Jinlee 身份'}
        </p>
      </div>
      <div className="grid gap-2 text-sm text-white/70 sm:grid-cols-2">
        <p>总余额：{summary.wallet.totalBalance}</p>
        <p>可提现：{summary.wallet.income}</p>
        <p>充值池：{summary.wallet.recharge}</p>
        <p>累计消费：{summary.wallet.totalSpent}</p>
        <p>积分：{summary.wallet.loyaltyPoints}</p>
        <p>VIP：{summary.vip.derivedLevel} / 已结算 {summary.vip.lastSettledLevel}</p>
        <p>心动发出关系：{summary.heart.outgoingPairs}</p>
        <p>心动收到关系：{summary.heart.incomingPairs}</p>
        <p>基础抽成：{summary.commission.baseRate}</p>
        <p>当前抽成：{summary.commission.currentRate}</p>
      </div>
    </div>
  );
};

export function AssetTransferClient() {
  const [sourceId, setSourceId] = useState('');
  const [targetId, setTargetId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<Status | null>(null);
  const [changed, setChanged] = useState<Record<string, number>>({});
  const [warnings, setWarnings] = useState<string[]>([]);
  const [previewSource, setPreviewSource] = useState<AccountSummary | null>(null);
  const [previewTarget, setPreviewTarget] = useState<AccountSummary | null>(null);
  const [confirmMerge, setConfirmMerge] = useState(false);
  const [transferred, setTransferred] = useState<TransferResult | null>(null);

  const resetPreview = () => {
    setPreviewSource(null);
    setPreviewTarget(null);
    setConfirmMerge(false);
  };

  const isDisabled = useMemo(
    () =>
      !sourceId.trim() ||
      !targetId.trim() ||
      isSubmitting ||
      (Boolean(previewTarget?.hasTransferableData) && !confirmMerge),
    [sourceId, targetId, isSubmitting, previewTarget, confirmMerge],
  );

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus(null);
    setChanged({});
    setWarnings([]);
    setTransferred(null);
    setIsSubmitting(true);

    try {
      const normalizedSourceId = sourceId.trim();
      const normalizedTargetId = targetId.trim();
      if (!isDiscordSnowflake(normalizedSourceId) || !isDiscordSnowflake(normalizedTargetId)) {
        setStatus({ type: 'error', text: '请输入 17-20 位纯数字 Discord 雪花 ID' });
        return;
      }

      const response = await fetch('/api/admin/asset-transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceDiscordId: normalizedSourceId,
          targetDiscordId: normalizedTargetId,
          forceMerge: Boolean(previewTarget?.hasTransferableData && confirmMerge),
        }),
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        const text = typeof result?.error === 'string' ? result.error : '资产转移失败，请稍后再试';
        if (result?.requiresForceMerge) {
          setPreviewSource((result?.source as AccountSummary | undefined) ?? null);
          setPreviewTarget((result?.target as AccountSummary | undefined) ?? null);
        }
        setStatus({ type: 'error', text });
        return;
      }

      resetPreview();
      setStatus({ type: 'success', text: result?.message ?? '资产转移完成' });
      setTransferred((result?.transferred as TransferResult | undefined) ?? null);
      setChanged((result?.changed as Record<string, number> | undefined) ?? {});
      setWarnings(
        Array.isArray(result?.warnings)
          ? result.warnings.filter((item: unknown): item is string => typeof item === 'string')
          : [],
      );
    } catch (err) {
      setStatus({ type: 'error', text: (err as Error).message });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-8 text-white">
      <div className="space-y-2">
        <p className="text-sm uppercase tracking-[0.4em] text-white/50">资产转移</p>
        <h1 className="text-3xl font-semibold">转移固定资产资料</h1>
        <p className="text-sm text-white/70">
          转移余额、累计消费、积分、VIP 结算状态、心动值关系、基础抽成与手动 Buff。不会转移流水明细、未消耗权益、订单历史，也不会转移自动 91% 抽成状态。
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 rounded-3xl border border-white/10 bg-white/5 p-6">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2 text-sm">
            <span className="text-white/70">源 Discord ID</span>
            <input
              type="text"
              value={sourceId}
              onChange={(event) => {
                resetPreview();
                setSourceId(event.target.value);
              }}
              inputMode="numeric"
              pattern={DISCORD_ID_PATTERN}
              maxLength={20}
              className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white"
              placeholder="从这个账号转出资产"
            />
          </label>
          <label className="space-y-2 text-sm">
            <span className="text-white/70">目标 Discord ID</span>
            <input
              type="text"
              value={targetId}
              onChange={(event) => {
                resetPreview();
                setTargetId(event.target.value);
              }}
              inputMode="numeric"
              pattern={DISCORD_ID_PATTERN}
              maxLength={20}
              className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white"
              placeholder="转入这个账号"
            />
          </label>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/65 space-y-1">
          <p>1. 钱包类资产按源账号全部划转到目标账号，源账号同步清零。</p>
          <p>2. 目标账号若已有资产，会先弹出预览并要求确认，再按规则合并。</p>
          <p>3. 个人流水会新增“资产转出 / 资产转入”两条余额记录，完整明细写入审计表。</p>
        </div>

        {previewTarget?.hasTransferableData ? (
          <div className="space-y-4 rounded-2xl border border-amber-400/35 bg-amber-500/10 p-4 text-sm text-amber-100">
            <div className="space-y-1">
              <p className="font-medium text-amber-50">目标账号已经有可转移资产</p>
              <p className="text-amber-100/80">
                确认后会合并钱包/累计消费/积分/心动值，并用源账号覆盖目标账号的基础抽成与 VIP 配置。
              </p>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <SummaryCard title="源账号预览" summary={previewSource} />
              <SummaryCard title="目标账号预览" summary={previewTarget} />
            </div>
            <label className="flex items-start gap-3 rounded-xl border border-white/10 bg-black/20 p-3 text-white/90">
              <input
                type="checkbox"
                checked={confirmMerge}
                onChange={(event) => setConfirmMerge(event.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-white/20 bg-black/20"
              />
              <span>我确认按资产转移规则合并目标账号现有资产，并清空源账号对应资产。</span>
            </label>
          </div>
        ) : null}

        <button
          type="submit"
          disabled={isDisabled}
          className="inline-flex items-center justify-center rounded-full bg-white/15 px-6 py-2 text-sm text-white hover:bg-white/25 disabled:opacity-50"
        >
          {isSubmitting ? '转移中…' : previewTarget?.hasTransferableData ? '确认合并并转移' : '开始转移'}
        </button>
      </form>

      {status ? (
        <div
          className={`rounded-2xl border px-4 py-3 text-sm ${
            status.type === 'success'
              ? 'border-emerald-400/50 text-emerald-300'
              : 'border-rose-400/50 text-rose-300'
          }`}
        >
          {status.text}
        </div>
      ) : null}

      {transferred ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/80 space-y-2">
          <p className="text-white">本次已转移：</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <p>总余额：{transferred.totalBalance}</p>
            <p>可提现：{transferred.income}</p>
            <p>充值池：{transferred.recharge}</p>
            <p>累计消费：{transferred.totalSpent}</p>
            <p>积分：{transferred.loyaltyPoints}</p>
            <p>目标 VIP：{transferred.vipLevelAfter}</p>
          </div>
        </div>
      ) : null}

      {warnings.length ? (
        <div className="rounded-2xl border border-amber-400/35 bg-amber-500/10 p-4 text-sm text-amber-100">
          <p className="font-medium text-amber-50">注意事项</p>
          <ul className="mt-2 space-y-1">
            {warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {Object.keys(changed).length ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/80">
          <p className="text-white">已变更的记录数：</p>
          <ul className="mt-2 space-y-1">
            {Object.entries(changed).map(([key, value]) => (
              <li key={key}>
                {key}: {value}
              </li>
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
