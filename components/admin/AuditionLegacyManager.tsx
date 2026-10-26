'use client';
import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import type { AuditionLegacyCommand, AuditionLegacyEvidence, AuditionLegacyInvite, AuditionLegacyReceipt, createAuditionLegacyService } from '@/lib/audition-legacy-transition';

type Evidence = AuditionLegacyEvidence & { blockers: string[]; receipt: { requestId: string; createdAt: string } | null };
type Preview = Awaited<ReturnType<ReturnType<typeof createAuditionLegacyService>['preview']>>;
const fields = [
  ['bossDlmId', '原老板 DLM 编号'], ['workerDlmId', '原陪玩 DLM 编号'],
  ['bossDiscordIdSnapshot', '原老板 Discord 编号'], ['workerDiscordIdSnapshot', '原陪玩 Discord 编号'],
  ['peiwanId', '原陪玩编号'], ['quotedGross', '原试音报价'],
] as const;
const blank = () => ({ bossDlmId: '', workerDlmId: '', bossDiscordIdSnapshot: '', workerDiscordIdSnapshot: '', peiwanId: '', quotedGross: '', evidenceReference: '', evidenceNote: '' });
const cls = 'min-w-0 w-full rounded-lg border border-white/20 bg-black/20 p-2 text-sm disabled:opacity-50';
export function AuditionLegacyManager() {
  const [rows, setRows] = useState<AuditionLegacyInvite[]>([]), [cursor, setCursor] = useState<string | null>(null);
  const [inviteId, setInviteId] = useState(''), [evidence, setEvidence] = useState<Evidence | null>(null);
  const [values, setValues] = useState(blank), [attest, setAttest] = useState(false), [confirmed, setConfirmed] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null), [command, setCommand] = useState<AuditionLegacyCommand | null>(null);
  const [requestId, setRequestId] = useState(''), [queryId, setQueryId] = useState(''), [receipt, setReceipt] = useState<AuditionLegacyReceipt | null>(null);
  const [busy, setBusy] = useState(false), [unknown, setUnknown] = useState(false), [message, setMessage] = useState('');
  async function read(path: string) {
    const response = await fetch(`/api/admin/auditions/legacy${path}`, { cache: 'no-store' });
    const body = await response.json(); if (!response.ok || !body.ok) throw new Error(body.error || '查询失败，请保留原编号'); return body;
  }
  async function list(more = false) {
    setBusy(true); setMessage('');
    try { const { list } = await read(more && cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''); setRows(old => more ? [...old, ...list.rows] : list.rows); setCursor(list.nextCursor); }
    catch (e) { setMessage(e instanceof Error ? e.message : '查询失败'); } finally { setBusy(false); }
  }
  async function load(id = inviteId) {
    if (unknown) return; setBusy(true); setMessage(''); setPreview(null); setReceipt(null); setEvidence(null);
    try {
      const { evidence: found } = await read(`?inviteId=${encodeURIComponent(id.trim())}`);
      setInviteId(found.invite.id); setEvidence(found); setAttest(false); setConfirmed(false);
      setValues({ ...blank(), ...Object.fromEntries(fields.map(([key]) => [key, found.invite[key] == null ? '' : String(found.invite[key])])) });
      const key = crypto.randomUUID(); setRequestId(key); setQueryId(found.receipt?.requestId ?? key);
    } catch (e) { setMessage(e instanceof Error ? e.message : '读取失败'); } finally { setBusy(false); }
  }
  async function prepare(event: FormEvent) {
    event.preventDefault(); if (!evidence || busy || unknown) return;
    const draft = { ...values, peiwanId: Number(values.peiwanId), inviteId: evidence.invite.id, requestId, confirmedUnpaidAndNotJoined: attest } as AuditionLegacyCommand;
    setBusy(true); setMessage(''); setPreview(null); setConfirmed(false);
    try {
      const response = await fetch('/api/admin/auditions/legacy', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'preview', command: draft }) });
      const body = await response.json(); if (!response.ok || !body.ok) throw new Error(body.error || '无法预览');
      setPreview(body.preview); setCommand(draft); setQueryId(requestId);
    } catch (e) { setMessage(e instanceof Error ? e.message : '无法预览'); } finally { setBusy(false); }
  }
  async function submit() {
    if (!preview || !command || !confirmed || busy) return;
    setBusy(true); setMessage('');
    try {
      const response = await fetch('/api/admin/auditions/legacy', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'execute', command, previewHash: preview.previewHash, confirmed: true }) });
      const body = await response.json();
      if (response.ok && body.ok && body.receipt?.requestId === command.requestId) { setReceipt(body.receipt); setUnknown(false); setPreview(null); setMessage('缺失快照已补齐。状态、期限和账目保持原值。'); return; }
      if (body.code === 'query_required' || response.status >= 500) { setUnknown(true); setMessage('结果待核实，请查询原请求回执；重试也只能使用这一原请求。'); }
      else { setUnknown(false); setPreview(null); setMessage(body.error || '本次未确认补齐，请重新查看原邀请'); }
    } catch { setUnknown(true); setMessage('连接中断，结果待核实。请保留并查询原请求编号，不要重新扣费。'); }
    finally { setBusy(false); }
  }
  async function query() {
    setBusy(true); setMessage('');
    try {
      const body = await read(`?requestId=${encodeURIComponent(queryId.trim())}`);
      if (body.receipt) {
        setReceipt(body.receipt);
        if (!command || body.receipt.requestId === command.requestId) { setUnknown(false); setPreview(null); }
        setMessage('已找到不可变补齐回执。');
      } else setMessage('尚未查到回执；可能仍在处理，不能据此认定原请求失败。');
    } catch (e) { setMessage(e instanceof Error ? e.message : '查询失败'); } finally { setBusy(false); }
  }
  const locked = busy || unknown;
  return <div className="mx-auto max-w-5xl space-y-5 text-white">
    <header className="space-y-2"><Link href="/admin/auditions" className="text-sm text-cyan-200">← 试音结果查账</Link><h1 className="text-2xl font-semibold">旧试音邀请资料补齐</h1>
      </header>
    <section className="space-y-3 rounded-xl border border-white/15 p-4"><button disabled={locked} onClick={() => list()} className="rounded-lg border border-white/25 px-3 py-2 text-sm disabled:opacity-50">列出缺失快照的待处理邀请</button>
      <ul className="space-y-2">{rows.map(row => <li key={row.id} className="flex flex-wrap items-center gap-2 text-sm"><button disabled={locked} onClick={() => load(row.id)} className="break-all text-cyan-200 underline disabled:opacity-50">{row.id}</button><span>{row.status} · 到期 {row.expiresAt}</span></li>)}</ul>
      {cursor && <button disabled={locked} onClick={() => list(true)} className="text-sm text-cyan-200">加载下一页</button>}
      <div className="flex flex-col gap-2 sm:flex-row"><input aria-label="原邀请编号" className={cls} disabled={locked} value={inviteId} onChange={e => setInviteId(e.target.value)} placeholder="输入原邀请编号" maxLength={100}/><button disabled={locked || !inviteId.trim()} onClick={() => load()} className="shrink-0 rounded-lg border border-white/25 px-3 py-2 text-sm disabled:opacity-50">查看凭据</button></div>
    </section>
    {message && <p role="status" className="break-words rounded-xl bg-amber-300/10 p-4 text-sm text-amber-100">{message}</p>}
    {evidence && <section className="space-y-3 rounded-xl border border-white/15 p-4"><h2 className="font-semibold">原邀请和现有凭据</h2>
      <p className="break-all text-sm">{evidence.invite.id} · {evidence.invite.status} · 到期 {evidence.invite.expiresAt}</p>
      <p className="text-sm text-white/65">候选个人流水 {evidence.ledgers.length} 条，打赏审计 {evidence.audits.length} 条，支付 {evidence.payments.length} 条。每类最多展示 21 条。</p>
      <Link href={`/admin/auditions?inviteId=${encodeURIComponent(evidence.invite.id)}`} className="text-sm text-cyan-200 underline">打开原邀请查账页</Link>
      <details><summary className="cursor-pointer text-sm">展开原字段及候选凭据</summary><pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap break-all text-xs">{JSON.stringify(evidence, null, 2)}</pre></details>
      {evidence.receipt && <p className="break-all text-sm text-amber-100">已有补齐回执：{evidence.receipt.requestId}，请在下方查询。</p>}
      {evidence.blockers.length > 0 && <ul className="list-disc space-y-1 pl-5 text-sm text-amber-100">{evidence.blockers.map(reason => <li key={reason}>{reason}</li>)}</ul>}
    </section>}
    {evidence && !evidence.receipt && evidence.blockers.length === 0 && !receipt && <form onSubmit={prepare} className="space-y-4 rounded-xl border border-white/15 p-4">
      <h2 className="font-semibold">核实原资料</h2><div className="grid gap-3 sm:grid-cols-2">{fields.map(([key, label]) => <label key={key} className="min-w-0 space-y-1 text-sm"><span>{label}{evidence.invite[key] !== null ? '（已有，不能覆盖）' : '（缺失，请按原凭据填写）'}</span><input required className={cls} value={values[key]} readOnly={evidence.invite[key] !== null} disabled={locked} maxLength={100} onChange={e => { setValues({ ...values, [key]: e.target.value }); setPreview(null); }} /></label>)}</div>
      <label className="block space-y-1 text-sm"><span>原凭据引用（例如消息链接或档案编号）</span><input required className={cls} disabled={locked} maxLength={500} value={values.evidenceReference} onChange={e => { setValues({ ...values, evidenceReference: e.target.value }); setPreview(null); }} /></label>
      <label className="block space-y-1 text-sm"><span>核实说明（注明如何确认原身份、原报价、未入房和未扣费）</span><textarea required className={cls} rows={4} disabled={locked} maxLength={2000} value={values.evidenceNote} onChange={e => { setValues({ ...values, evidenceNote: e.target.value }); setPreview(null); }} /></label>
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" required checked={attest} disabled={locked} onChange={e => { setAttest(e.target.checked); setPreview(null); }} /><span>我已依据可靠原凭据确认双方身份及报价，并确认原邀请未入房、未扣费，结果明确。</span></label>
      <p className="break-all text-xs text-white/60">本次请求编号：{requestId}</p><button disabled={locked || !attest} className="rounded-lg bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50">生成补齐预览</button>
    </form>}
    {preview && <section className="space-y-3 rounded-xl border border-cyan-300/40 p-4"><h2 className="font-semibold">确认补齐内容</h2>
      <dl className="grid gap-3 sm:grid-cols-2">{fields.filter(([key]) => key in preview.changes).map(([key, label]) => <div key={key}><dt className="text-xs text-white/60">{label}</dt><dd className="break-all text-sm">未记录 → {String(preview.changes[key])}</dd></div>)}</dl>
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={confirmed} disabled={locked} onChange={e => setConfirmed(e.target.checked)}/><span>我确认上述原凭据及补齐内容；仅补缺失字段，不重新结算。</span></label>
      <button disabled={busy || !confirmed} onClick={submit} className="rounded-lg bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50">{unknown ? '重试同一请求' : '确认补齐'}</button>
    </section>}
    <section className="space-y-3 rounded-xl border border-white/15 p-4"><h2 className="font-semibold">按原请求查询回执</h2><div className="flex flex-col gap-2 sm:flex-row"><input aria-label="原请求编号" className={cls} value={queryId} onChange={e => setQueryId(e.target.value)} maxLength={36}/><button disabled={busy || !queryId} onClick={query} className="shrink-0 rounded-lg border border-white/25 px-3 py-2 text-sm disabled:opacity-50">查询回执</button></div>
      {receipt && <div className="space-y-2 break-all text-sm"><p>邀请 {receipt.inviteId} · 请求 {receipt.requestId}</p><p>操作者 {receipt.actorDiscordId} · {receipt.createdAt}</p><p>凭据：{receipt.evidenceReference}</p><p>{receipt.evidenceNote}</p><details><summary>查看完整补齐前后记录</summary><pre className="max-h-96 overflow-auto whitespace-pre-wrap break-all text-xs">{JSON.stringify(receipt, null, 2)}</pre></details></div>}
    </section>
  </div>;
}
