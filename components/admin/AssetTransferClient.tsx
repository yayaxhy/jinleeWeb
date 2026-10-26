'use client';
import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { migrationModelLabel, migrationRolesLabel } from '@/lib/account-migration-labels';

type Account = { dlmId: string; discordId: string | null; displayName: string; wallet: Record<string, string>; peiwanId: number | null };
type Preview = { previewHash: string; source: Account; target: Account; mergedWallet: Record<string, string>; peiwanId: number | null; vipLevel: number; suppressedVipLevels: number[]; conflicts: Array<{ model: string; recordKey: string; policy: string }>; notice: string };
type Result = { requestId: string; completed: boolean; sourceDlmId: string; targetDlmId: string; mergedWallet: Record<string, string>; peiwanId: number | null; rolesStatus: string; skipped: Array<{ model: string; recordKey: string; reason: string }>; warnings: string[] };
const labels: Record<string, string> = { totalBalance: '总余额', income: '可提现', recharge: '充值池', totalSpent: '累计消费', loyaltyPoints: '积分' };
const wallet = (values: Record<string, string>) => <dl className="grid gap-2 sm:grid-cols-2">{Object.entries(values).map(([key, value]) => <div key={key}><dt className="inline text-white/50">{labels[key] ?? key}：</dt><dd className="inline">{value}</dd></div>)}</dl>;
export default function AssetTransferClient() {
  const [sourceIdentifier, setSource] = useState('');
  const [targetIdentifier, setTarget] = useState('');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [requestId, setRequestId] = useState('');
  const [lookupId, setLookupId] = useState('');
  const [message, setMessage] = useState('');
  const [unknown, setUnknown] = useState(false);
  const change = (setter: (value: string) => void, value: string) => { setter(value); setPreview(null); setConfirmed(false); };
  async function previewMerge(event: FormEvent) {
    event.preventDefault(); if (busy || unknown) return;
    setBusy(true); setMessage(''); setPreview(null); setConfirmed(false); setResult(null);
    try {
      const response = await fetch('/api/admin/asset-transfer', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'preview', sourceIdentifier, targetIdentifier }) });
      const data = await response.json();
      if (!response.ok || !data.preview) throw new Error(data.error ?? '预览失败');
      setPreview(data.preview); setRequestId(crypto.randomUUID());
    } catch (error) { setMessage(error instanceof Error ? error.message : '预览失败'); }
    finally { setBusy(false); }
  }
  async function execute() {
    if (!preview || !confirmed || busy || unknown) return;
    setBusy(true); setMessage(''); setLookupId(requestId);
    try {
      const response = await fetch('/api/admin/asset-transfer', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({
        action: 'execute', sourceIdentifier, targetIdentifier, sourceDlmId: preview.source.dlmId, targetDlmId: preview.target.dlmId,
        requestId, expectedPreviewHash: preview.previewHash,
      }) });
      const data = await response.json();
      if (response.status >= 500) { setUnknown(true); throw new Error(data.error ?? '结果不明，请查询原编号'); }
      if (!response.ok || !data.result?.completed) { setPreview(null); setConfirmed(false); throw new Error(data.error ?? '本次未确认完成，请重新预览'); }
      setResult(data.result); setPreview(null); setConfirmed(false); setUnknown(false);
    } catch (error) { setMessage(error instanceof Error ? error.message : '结果不明，请查询原编号'); if (!(error instanceof Error) || error instanceof TypeError || error instanceof SyntaxError) setUnknown(true); }
    finally { setBusy(false); }
  }
  async function query() {
    if (!lookupId.trim() || busy) return;
    setBusy(true); setMessage('');
    try {
      const response = await fetch(`/api/admin/asset-transfer?requestId=${encodeURIComponent(lookupId.trim())}`, { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok || !data.record) throw new Error(data.error ?? '暂时无法核实');
      setResult({ ...data.record.result, rolesStatus: data.record.rolesStatus });
      setMessage(data.record.rolesError ? `资金迁移已完成；角色仍待处理：${data.record.rolesError}` : '已查到原迁移结果。本次查询没有转移资金。');
      if (lookupId.trim() === requestId) { setUnknown(false); setPreview(null); setConfirmed(false); }
    } catch (error) { setMessage(error instanceof Error ? error.message : '暂时无法核实'); }
    finally { setBusy(false); }
  }
  return <div className="space-y-6 text-white/85">

    <form onSubmit={previewMerge} className="space-y-3">
      <label className="block">旧账号 DLM／Discord 编号<input className="mt-1 block w-full rounded border border-white/20 bg-black/30 p-3" value={sourceIdentifier} disabled={busy || unknown} onChange={event => change(setSource, event.target.value)} required /></label>
      <label className="block">新账号 DLM／Discord 编号<input className="mt-1 block w-full rounded border border-white/20 bg-black/30 p-3" value={targetIdentifier} disabled={busy || unknown} onChange={event => change(setTarget, event.target.value)} required /></label>
      <button type="submit" disabled={busy || unknown} className="rounded bg-violet-600 px-4 py-2 disabled:opacity-50">{busy ? '处理中…' : '预览合并方案'}</button>
    </form>
    {preview && <section className="space-y-4 rounded-xl border border-white/20 p-4">
      <div className="grid gap-4 md:grid-cols-2">{([['旧号', preview.source], ['新号', preview.target]] as const).map(([label, account]) => <div key={label} className="min-w-0 break-words"><h2 className="font-semibold">{label}：{account.displayName}</h2><p>{account.dlmId} · {account.discordId ?? '未绑定 Discord'}</p>{wallet(account.wallet)}</div>)}</div>
      <h2 className="font-semibold">合并后的预计资产</h2>{wallet(preview.mergedWallet)}
      <p>陪玩编号：{preview.peiwanId ?? '无'}；VIP：{preview.vipLevel}。</p>

      {preview.conflicts.length > 0 && <div><h3 className="font-semibold text-amber-300">预计归档跳过</h3><ul className="list-disc pl-5">{preview.conflicts.map((item, i) => <li key={i} className="break-words">{migrationModelLabel(item.model)}：{item.policy}</li>)}</ul></div>}

      <label className="flex items-start gap-2"><input type="checkbox" className="mt-1" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} /><span>已核对旧号、新号及合并规则，确认合并后删除旧账号。</span></label>
      <p className="break-all text-xs text-white/50">本次编号：{requestId}</p>
      <button type="button" disabled={!confirmed || busy || unknown} onClick={execute} className="rounded bg-violet-600 px-4 py-2 disabled:opacity-50">确认合并并转移</button>
    </section>}
    {message && <p role="status" className="rounded border border-amber-400/30 p-3">{message}</p>}
    <section className="space-y-3 rounded-xl border border-white/20 p-4"><h2 className="font-semibold">查询原迁移结果</h2><input aria-label="原迁移请求编号" value={lookupId} onChange={event => setLookupId(event.target.value)} className="w-full rounded bg-black/30 p-3" placeholder="粘贴原请求编号" /><button type="button" onClick={query} disabled={busy || !lookupId.trim()} className="rounded border border-white/20 px-4 py-2">只读查询</button></section>
    {result && <section className="space-y-2 rounded-xl border border-emerald-400/30 p-4"><h2 className="font-semibold">资产转移完成</h2><p className="break-all">编号：{result.requestId}</p>{wallet(result.mergedWallet)}<p>角色处理：{migrationRolesLabel(result.rolesStatus)}。</p>{result.warnings.map((warning, i) => <p key={i}>{warning}</p>)}{result.skipped.length > 0 && <><h3>已归档、未继续使用的内容</h3><ul className="list-disc pl-5">{result.skipped.map((item, i) => <li key={i} className="break-words">{migrationModelLabel(item.model)} · 原始记录已保存</li>)}</ul></>}</section>}
    <p><Link href="/profile/account-migrations" className="underline">查看账户迁移历史与归档</Link></p>
  </div>;
}

export { AssetTransferClient };
