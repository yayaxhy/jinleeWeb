'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { SiteText } from '@/components/SiteCopyProvider';

type Account = { dlmId: string; discordId: string | null; displayName: string; wallet: Record<string, string> };
type ArchivedItem = { model: string; recordKey: string };
type Preview = { previewHash: string; source: Account; target: Account; mergedWallet: Record<string, string>; peiwanId: number | null; vipLevel: number; conflicts: ArchivedItem[] };
type Result = { completed: boolean; mergedWallet: Record<string, string>; peiwanId: number | null; skipped: ArchivedItem[] };
type Operation = { requestId: string; sourceIdentifier: string; targetIdentifier: string; sourceDlmId: string; targetDlmId: string };
const storageKey = 'admin-account-merge-pending';
const namespace = 'site.components.admin.assettransferclient';
const failureText = '资产转移失败，请稍后再试';
const labels: Record<string, string> = { totalBalance: '总余额', income: '可提现', recharge: '充值池', totalSpent: '累计消费', loyaltyPoints: '积分' };
const Copy = ({ text }: { text: string }) => <SiteText namespace={namespace} value={text} />;
function Wallet({ values }: { values: Record<string, string> }) {
  return <dl className="grid gap-2 text-sm sm:grid-cols-2">{Object.entries(values).map(([key, value]) => <div key={key}>
    <dt className="inline text-white/60"><Copy text={labels[key] ?? key} />：</dt><dd className="inline">{value}</dd>
  </div>)}</dl>;
}
function ArchiveList({ items }: { items: ArchivedItem[] }) {
  if (!items.length) return null;
  return <div className="space-y-2"><p className="font-medium"><Copy text="归档后跳过" /></p>
    <ul className="space-y-1 text-sm text-white/70">{items.map((item, index) => <li key={`${item.model}:${item.recordKey}:${index}`} className="break-all">{item.model} · {item.recordKey}</li>)}</ul>
  </div>;
}
function saveOperation(operation: Operation | null) {
  try { if (operation) sessionStorage.setItem(storageKey, JSON.stringify(operation)); else sessionStorage.removeItem(storageKey); } catch { /* Storage is optional; the current operation remains in memory. */ }
}

export function AssetTransferClient() {
  const [sourceIdentifier, setSource] = useState('');
  const [targetIdentifier, setTarget] = useState('');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [requestId, setRequestId] = useState('');
  const [operation, setOperation] = useState<Operation | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const running = useRef(false);

  const complete = (value: Result) => {
    setResult(value); setOperation(null); saveOperation(null); setPreview(null); setRequestId(''); setMessage('');
  };
  async function lookup(current: Operation) {
    try {
      const response = await fetch(`/api/admin/asset-transfer?requestId=${encodeURIComponent(current.requestId)}`, { cache: 'no-store', signal: AbortSignal.timeout(20000) });
      const data = await response.json();
      if (response.ok && data.record?.result?.completed) { complete(data.record.result); return true; }
      if (response.status === 403) { setMessage('无权访问'); }
    } catch { /* Keep the original request available for another read. */ }
    return false;
  }
  useEffect(() => {
    let current: Operation;
    try {
      const saved = JSON.parse(sessionStorage.getItem(storageKey) ?? 'null');
      if (!saved || !/^[0-9a-f-]{36}$/i.test(saved.requestId) || typeof saved.sourceIdentifier !== 'string' || typeof saved.targetIdentifier !== 'string' || typeof saved.sourceDlmId !== 'string' || typeof saved.targetDlmId !== 'string') return;
      current = saved;
    } catch { return; }
    setSource(current.sourceIdentifier); setTarget(current.targetIdentifier); setOperation(current); setBusy(true); running.current = true;
    void lookup(current).finally(() => { setBusy(false); running.current = false; });
    // Recovery is a one-time read, never a replay of the mutation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const edit = (setter: (value: string) => void, value: string) => {
    if (running.current || operation) return;
    setter(value); setPreview(null); setRequestId(''); setResult(null); setMessage('');
  };
  async function previewMerge(event: FormEvent) {
    event.preventDefault();
    if (running.current || !sourceIdentifier.trim() || !targetIdentifier.trim()) return;
    running.current = true; setBusy(true); setMessage(''); setResult(null); setPreview(null); setRequestId('');
    try {
      if (operation && await lookup(operation)) return;
      const response = await fetch('/api/admin/asset-transfer', { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(90000),
        body: JSON.stringify({ action: 'preview', sourceIdentifier: operation?.sourceDlmId ?? sourceIdentifier.trim(), targetIdentifier: operation?.targetDlmId ?? targetIdentifier.trim() }) });
      const data = await response.json();
      if (!response.ok || !data.preview || typeof data.requestId !== 'string') { setMessage(data.error ?? failureText); return; }
      setPreview(data.preview); setRequestId(operation?.requestId ?? data.requestId);
    } catch { setMessage(failureText); }
    finally { running.current = false; setBusy(false); }
  }
  async function execute() {
    if (!preview || !requestId || running.current) return;
    running.current = true; setBusy(true); setMessage('');
    const current = { requestId, sourceIdentifier: preview.source.dlmId, targetIdentifier: preview.target.dlmId, sourceDlmId: preview.source.dlmId, targetDlmId: preview.target.dlmId };
    setOperation(current); saveOperation(current);
    try {
      const response = await fetch('/api/admin/asset-transfer', { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(90000),
        body: JSON.stringify({ action: 'execute', ...current, sourceDlmId: preview.source.dlmId, targetDlmId: preview.target.dlmId, expectedPreviewHash: preview.previewHash }) });
      const data = await response.json();
      if (response.ok && data.result?.completed) { complete(data.result); return; }
      if (response.status >= 400 && response.status < 500) {
        if (!operation) { setOperation(null); saveOperation(null); }
        setPreview(null); setRequestId(''); setMessage(data.error ?? failureText);
        if (operation) await lookup(current);
        return;
      }
      await lookup(current);
    } catch { await lookup(current); }
    finally { running.current = false; setBusy(false); }
  }
  async function query() {
    if (!operation || running.current) return;
    running.current = true; setBusy(true); setMessage('');
    try { await lookup(operation); } finally { running.current = false; setBusy(false); }
  }

  return <div className="space-y-6 text-white">
    <h1 className="text-3xl font-semibold"><Copy text="完整账号合并" /></h1>
    <form onSubmit={previewMerge} className="space-y-5 rounded-3xl border border-white/10 bg-white/5 p-6">
      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2 text-sm"><span className="block text-white/70"><Copy text="旧账号 DLM／Discord 编号" /></span>
          <input value={sourceIdentifier} onChange={event => edit(setSource, event.target.value)} disabled={busy || !!operation} required maxLength={100} autoComplete="off" className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2" /></label>
        <label className="space-y-2 text-sm"><span className="block text-white/70"><Copy text="新账号 DLM／Discord 编号" /></span>
          <input value={targetIdentifier} onChange={event => edit(setTarget, event.target.value)} disabled={busy || !!operation} required maxLength={100} autoComplete="off" className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2" /></label>
      </div>
      <button type="submit" disabled={busy || !sourceIdentifier.trim() || !targetIdentifier.trim()} className="rounded-full bg-white/15 px-6 py-2 hover:bg-white/25 disabled:opacity-50"><Copy text={busy ? '转移中…' : '预览合并方案'} /></button>
    </form>
    {preview && <section className="space-y-5 rounded-3xl border border-white/10 bg-white/5 p-6">
      <div className="grid gap-4 lg:grid-cols-2">{[['源账号预览', preview.source], ['目标账号预览', preview.target]].map(([title, value]) => {
        const account = value as Account;
        return <div key={title as string} className="space-y-3 rounded-2xl border border-white/10 bg-black/20 p-4"><h2><Copy text={title as string} /></h2>
          <p className="break-all">{account.displayName}</p><p className="break-all text-xs text-white/60">{account.dlmId}{account.discordId ? ` · ${account.discordId}` : ''}</p><Wallet values={account.wallet} /></div>;
      })}</div>
      <h2 className="font-semibold"><Copy text="合并后的预计资产" /></h2><Wallet values={preview.mergedWallet} />
      <p className="text-sm"><Copy text="陪玩档案" />：{preview.peiwanId == null ? '—' : `#${preview.peiwanId}`} · VIP：{preview.vipLevel}</p>
      <ArchiveList items={preview.conflicts} />
      <button type="button" disabled={busy} onClick={execute} className="rounded-full bg-violet-600 px-6 py-2 hover:bg-violet-500 disabled:opacity-50"><Copy text="确认合并并删除旧账号" /></button>
    </section>}
    {message && <p role="status" className="rounded-xl border border-rose-400/40 px-4 py-3 text-rose-300"><Copy text={message} /></p>}
    {operation && !busy && <button type="button" onClick={query} className="rounded-full border border-white/20 px-6 py-2 hover:bg-white/10"><Copy text="重新查询结果" /></button>}
    {result && <section className="space-y-4 rounded-3xl border border-emerald-400/40 p-6">
      <h2 role="status" className="font-semibold text-emerald-300"><Copy text="资产转移完成" /></h2><Wallet values={result.mergedWallet} />
      <p className="text-sm"><Copy text="陪玩档案" />：{result.peiwanId == null ? '—' : `#${result.peiwanId}`}</p><ArchiveList items={result.skipped} />
    </section>}
    <Link href="/admin" className="inline-flex rounded-full border border-white/20 px-6 py-2 hover:bg-white/10"><Copy text="返回后台首页" /></Link>
  </div>;
}
