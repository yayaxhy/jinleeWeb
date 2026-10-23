'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

type Boss = {
  dlmId: string;
  wechatContact: string;
  displayName: string | null;
  totalBalance: string;
};

type ManualRecharge = {
  operationId: string;
  sourceDlmId: string;
  bossLabel: string;
  rechargeId: string;
  amount: string;
  createdAt: string;
};

const newRequestId = () => globalThis.crypto.randomUUID();

export function RechargeCorrectionPanel({ bosses, manualRecharges }: {
  bosses: Boss[];
  manualRecharges: ManualRecharge[];
}) {
  const router = useRouter();
  const [sourceOperationId, setSourceOperationId] = useState(manualRecharges[0]?.operationId ?? '');
  const [targetDlmId, setTargetDlmId] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const source = useMemo(
    () => manualRecharges.find((recharge) => recharge.operationId === sourceOperationId) ?? null,
    [manualRecharges, sourceOperationId],
  );

  useEffect(() => {
    if (!manualRecharges.some((recharge) => recharge.operationId === sourceOperationId)) {
      setSourceOperationId(manualRecharges[0]?.operationId ?? '');
    }
  }, [manualRecharges, sourceOperationId]);

  useEffect(() => {
    if (!source) return;
    if (targetDlmId && targetDlmId !== source.sourceDlmId) return;
    setTargetDlmId(bosses.find((boss) => boss.dlmId !== source.sourceDlmId)?.dlmId ?? '');
  }, [bosses, source, targetDlmId]);

  if (!manualRecharges.length || bosses.length < 2) return null;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!source || !targetDlmId || busy) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const form = new FormData(event.currentTarget);
      const response = await fetch('/api/admin/wechat-bosses/recharge-correction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId: newRequestId(),
          sourceOperationId,
          targetDlmId,
          reason: form.get('reason'),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.ok) throw new Error(data?.error || '充值更正失败');
      const result = data.result as { amount?: string; sourceBalanceAfter?: string; targetBalanceAfter?: string } | undefined;
      setMessage(`充值更正已完成：已转移 ¥${result?.amount ?? '—'}。原老板余额：${result?.sourceBalanceAfter ?? '—'} 点点券；正确老板余额：${result?.targetBalanceAfter ?? '—'} 点点券。`);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '充值更正失败');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-3xl border border-amber-300/20 bg-amber-300/5 p-5 space-y-4">
      <div>
        <h2 className="text-xl font-semibold">充值更正</h2>
        <p className="mt-1 text-sm text-white/60">仅用于微信人工充值误充到错误老板的情况。系统保留原充值记录，并新增扣回与转入流水；原老板余额不足时会拒绝操作。</p>
      </div>
      <form onSubmit={submit} className="grid gap-3 lg:grid-cols-2">
        <label className="space-y-1 text-sm text-white/70">
          原充值记录
          <select value={sourceOperationId} onChange={(event) => setSourceOperationId(event.target.value)} required className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none focus:border-amber-300">
            {manualRecharges.map((recharge) => (
              <option key={recharge.operationId} value={recharge.operationId}>
                {recharge.bossLabel} · ¥{recharge.amount} · {recharge.rechargeId} · {new Date(recharge.createdAt).toLocaleString('zh-CN', { hour12: false })}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm text-white/70">
          正确老板
          <select value={targetDlmId} onChange={(event) => setTargetDlmId(event.target.value)} required className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none focus:border-amber-300">
            <option value="">请选择正确老板</option>
            {bosses.filter((boss) => boss.dlmId !== source?.sourceDlmId).map((boss) => (
              <option key={boss.dlmId} value={boss.dlmId}>{boss.displayName || boss.wechatContact} · {boss.dlmId} · 当前余额 ¥{boss.totalBalance}</option>
            ))}
          </select>
        </label>
        <textarea name="reason" required maxLength={500} placeholder="更正原因，例如：误选了老板 A，实际付款人为老板 B" className="min-h-24 rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none focus:border-amber-300 lg:col-span-2" />
        <button disabled={busy || !source || !targetDlmId} className="rounded-xl bg-amber-300 px-4 py-3 text-sm font-medium text-black disabled:opacity-60 lg:col-span-2">{busy ? '更正中…' : '确认更正并转移余额'}</button>
        {message ? <p className="rounded-xl border border-emerald-300/20 bg-emerald-300/10 px-4 py-3 text-sm text-emerald-100 lg:col-span-2">{message}</p> : null}
        {error ? <p className="rounded-xl border border-rose-300/20 bg-rose-300/10 px-4 py-3 text-sm text-rose-100 lg:col-span-2">{error}</p> : null}
      </form>
    </section>
  );
}
