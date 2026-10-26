'use client';

import Link from 'next/link';
import { useRef, useState, type FormEvent } from 'react';
import type { GiftExecutionReview } from '@/lib/gift-execution-client';
import { GiftPostCommitTasks } from './GiftPostCommitTasks';

export function GiftRequestManager() {
  const [requestId, setRequestId] = useState('');
  const [review, setReview] = useState<GiftExecutionReview | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const sequence = useRef(0);
  async function read(id: string, generation: number) {
    try {
      const response = await fetch(`/api/profile/gift-executions?requestId=${encodeURIComponent(id)}`, { cache: 'no-store' });
      const data = await response.json();
      if (generation !== sequence.current) return;
      if (!response.ok || data.ok !== true || data.review?.requestId !== id) {
        setReview(null); setMessage(typeof data.message === 'string' && data.message.length <= 500 ? data.message : '无法核实原请求，请保留编号，勿重复打赏。'); return;
      }
      setReview(data.review); setMessage(data.review.message);
    } catch { if (generation === sequence.current) { setReview(null); setMessage('查询连接中断，结果未知。请保留原编号并继续只读核实，勿重复打赏。'); } }
  }
  async function query(event: FormEvent) {
    event.preventDefault(); if (busy) return;
    const id = requestId.trim().startsWith('discord:gift:') ? requestId.trim() : requestId.trim().toLowerCase();
    if (!/^discord:gift:\d{17,20}:\d{17,20}$/.test(id) && !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
      setMessage('请粘贴完整 UUID 或 Discord 打赏请求编号'); return;
    }
    const generation = ++sequence.current; setBusy(true); setReview(null); setConfirm(false); setMessage(null);
    try { await read(id, generation); } finally { if (sequence.current === generation) setBusy(false); }
  }
  async function abandon() {
    if (!review || review.status !== 'PENDING' || busy || !confirm) return;
    const id = review.requestId; const generation = ++sequence.current;
    setBusy(true); setReview(null); setConfirm(false); setMessage('终止结果正在核实；若原打赏已完成，将显示原完成凭证，不会退款。');
    try {
      await fetch('/api/profile/gift-executions/abandon', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ requestId: id }) });
    } catch { /* A lost response never proves abandonment; always read the original request. */ }
    try { await read(id, generation); } finally { if (sequence.current === generation) setBusy(false); }
  }
  return <div className="mx-auto max-w-3xl space-y-5 text-white">
    <header className="space-y-2"><Link href="/admin" className="text-sm text-white/60">← 返回管理后台</Link><h2 className="text-2xl font-semibold">打赏请求核实</h2>
      </header>
    <form onSubmit={query} className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4">
      <label className="block text-sm" htmlFor="gift-request-id">原请求编号</label>
      <input id="gift-request-id" value={requestId} maxLength={100} disabled={busy} onChange={event => { ++sequence.current; setRequestId(event.target.value); setReview(null); setConfirm(false); setMessage(null); }} className="w-full rounded-xl border border-white/20 bg-black/20 px-3 py-2 text-sm" placeholder="UUID 或 discord:gift:消息编号:收礼人编号" />
      <button disabled={busy || !requestId.trim()} className="rounded-xl bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50">{busy ? '核实中…' : '只读查询原请求'}</button>
    </form>
    {message && <p role="status" className="rounded-2xl border border-amber-300/30 bg-amber-300/10 p-4 text-sm leading-6 text-amber-100">{message}</p>}
    {review && <section className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-4">
      <h3 className="font-semibold">{review.status === 'COMPLETED' && review.verified ? '原打赏完成凭证一致' : review.status === 'ABANDONED' && review.verified ? '原请求已终止' : '原请求仍需核实'}</h3>
      <dl className="grid gap-3 break-all text-sm sm:grid-cols-2">{[
        ['原编号', review.requestId], ['状态', review.status], ['礼物', `${review.giftName} × ${review.quantity}`], ['原价 / 实付', `${review.gross ?? '未记录'} / ${review.payable ?? '未记录'}`],
        ['付款 DLM / Discord', `${review.intent?.payerDlmId ?? '未固定'} / ${review.intent?.payerDiscordId ?? '未绑定'}`],
        ['收礼 DLM / Discord', `${review.intent?.receiverDlmId ?? '未固定'} / ${review.intent?.receiverDiscordId ?? '未记录'}`],
        ['原支付编号', review.transactionId], ['审计编号', review.giftAuditId], ['原个人流水', review.individualTransactionId],
      ].map(([label, value]) => <div key={label}><dt className="text-xs text-white/50">{label}</dt><dd className="mt-1">{value ?? '未记录'}</dd></div>)}</dl>
      {review.reverts.map(row => <p key={row.id} className="break-all text-xs text-amber-100">撤销记录：{row.id} · {row.status} · {row.createdAt}（未核准退款细节）</p>)}
      {review.individualTransactionId && <Link href={`/admin/gift-audit-review?transactionId=${encodeURIComponent(review.individualTransactionId)}`} className="block text-sm text-cyan-200">查看原打赏凭证核实记录</Link>}
      {review.status === 'PENDING' && <div className="space-y-3 border-t border-white/10 pt-4">
        {!confirm ? <button type="button" disabled={busy} onClick={() => setConfirm(true)} className="rounded-xl border border-amber-300/30 px-4 py-2 text-sm">终止待处理请求</button> : <>
          <p className="text-sm leading-6 text-amber-100">确认终止尚未完成的原请求？这不会退款；若原打赏已经完成，只返回原完成凭证。</p>
          <button type="button" disabled={busy} onClick={() => void abandon()} className="rounded-xl border border-amber-300/30 px-4 py-2 text-sm">确认终止原请求</button>
        </>}
      </div>}
    </section>}
    {review?.status === 'COMPLETED' && <GiftPostCommitTasks key={review.requestId} requestId={review.requestId} />}
  </div>;
}
