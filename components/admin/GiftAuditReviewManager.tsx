'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { parseGiftReviewCommand, validGiftReviewId, type GiftReviewCommand, type GiftReviewSources, type GiftReviewState } from '@/lib/gift-audit-review';

const labels: Record<string, string> = {
  audit: '礼物原始审计', payment: '原付款流水', individual: '付款方个人流水', revert: '已有撤销记录',
  referralReceipts: '原返佣入账凭证',
  auditVersion: '审计版本', giftName: '礼物', quantity: '数量', gross: '原价总额', payable: '实际付款',
  netAmount: '收款净额', feeAmount: '抽成', giverId: '原赠送身份', receiverId: '原收款身份',
  giverDlmId: '原赠送 DLM', receiverDlmId: '原收款 DLM', giverDiscordId: '原赠送 Discord',
  receiverIncomeDelta: '实际收入增量', receiverRechargeDelta: '实际充值增量', receiverEarnDelta: '实际累计流水增量', receiverPeiwanId: '原入账陪玩档案编号',
  heartGain: '计算的心动值', heartApplied: '实际发放心动值', pointsEarned: '发放积分',
  giverFromIncome: '付款来源：收入', giverFromRecharge: '付款来源：充值',
  fromDlmId: '当前付款钱包归属', toDlmId: '当前收款钱包归属', dlmId: '当前个人流水归属',
  spendBonusExtra: '消费增益', flowBonusExtra: '流水增益', balanceBefore: '交易前余额', balanceAfter: '交易后余额',
  spendQuotaUsage: '消费额度与原到期时间', flowQuotaUsage: '流水额度与原到期时间',
  referralLedgerFacts: '返佣原流水编号', boss: '老板邀请人凭证', worker: '陪玩邀请人凭证',
  voucherConsumption: '原赠礼用券与有效期凭证',
  amountChange: '变动金额', individualTransactionId: '个人流水编号', paymentTransactionId: '付款流水编号',
};
const inputStyle = 'w-full rounded-xl border border-white/20 bg-black/30 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-300';
const buttonStyle = 'rounded-xl border border-white/20 px-4 py-2 text-sm hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40';

function Sources({ sources }: { sources: GiftReviewSources }) {
  return <div className="grid items-start gap-3 lg:grid-cols-2">{Object.entries(sources).map(([name, record]) => (
    <details key={name} className="min-w-0 rounded-2xl border border-white/15 p-4" open={name === 'audit'}>
      <summary className="cursor-pointer font-semibold">{labels[name]}{record ? '' : ' · 缺失'}</summary>
      {record && <dl className="mt-4 space-y-2 text-xs">{Object.entries(record).map(([key, value]) => (
        <div key={key} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)] gap-3 border-b border-white/5 pb-2">
          <dt className="break-words text-white/60">{labels[key] ?? key}</dt>
          <dd className="whitespace-pre-wrap break-all font-mono">{value === null ? '未记录' : typeof value === 'object' ? JSON.stringify(value) : String(value)}</dd>
        </div>
      ))}</dl>}
    </details>
  ))}</div>;
}

async function request(path: string, init?: RequestInit) {
  const response = await fetch(path, { ...init, cache: 'no-store' });
  const result = await response.json().catch(() => null);
  if (!response.ok || !result?.ok) throw Object.assign(new Error(result?.message ?? '请求失败，请重新查询核对记录'), { status: response.status });
  return result;
}

export function GiftAuditReviewManager({ initialTransactionId = '', canAdjust = false }: { initialTransactionId?: string; canAdjust?: boolean }) {
  const [transactionId, setTransactionId] = useState(initialTransactionId);
  const [state, setState] = useState<GiftReviewState | null>(null);
  const [note, setNote] = useState('');
  const [references, setReferences] = useState('');
  const [outcome, setOutcome] = useState<GiftReviewCommand['outcome']>('NEEDS_EVIDENCE');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [uncertain, setUncertain] = useState(false);
  const pending = useRef<GiftReviewCommand | null>(null);
  const queryGeneration = useRef(0);

  async function load(id: string, before?: string) {
    if (!validGiftReviewId(id)) { setMessage('请输入有效的个人流水编号，例如 IT12345'); return; }
    const generation = ++queryGeneration.current;
    setBusy(true); setMessage('');
    try {
      const data = await request(`/api/admin/gift-audit-review?transactionId=${encodeURIComponent(id)}${before ? `&beforeNoteId=${encodeURIComponent(before)}` : ''}`) as GiftReviewState;
      if (queryGeneration.current !== generation) return;
      setState((current) => before && current?.transactionId === id ? { ...data, notes: [...current.notes, ...data.notes.filter((row) => !current.notes.some((prior) => prior.id === row.id))] } : data);
      if (pending.current && data.notes.some((row) => row.requestId === pending.current?.requestId)) {
        pending.current = null; setUncertain(false); setNote(''); setReferences(''); setMessage('已确认上次核实记录提交成功。');
      }
    } catch (error) { if (queryGeneration.current === generation) setMessage(error instanceof Error ? error.message : '查询失败'); }
    finally { if (queryGeneration.current === generation) setBusy(false); }
  }

  useEffect(() => {
    // Initial lookup is read-only; route authentication is enforced again by the proxy.
    if (validGiftReviewId(initialTransactionId)) void load(initialTransactionId);
    return () => { queryGeneration.current += 1; };
    // The server-provided initial ID is stable for this mounted page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function save() {
    if (!state) return;
    const command = uncertain && pending.current ? pending.current : parseGiftReviewCommand({
      transactionId: state.transactionId, requestId: crypto.randomUUID(), expectedSnapshotHash: state.snapshotHash,
      outcome, note, evidenceReferences: references.split('\n').map((line) => line.trim()).filter(Boolean),
    });
    if (!command) { setMessage('说明需为 10–2000 字；每行一条凭证引用，最多 8 条。补充凭证时至少填写一条引用。'); return; }
    pending.current = command;
    setBusy(true); setMessage('');
    let saved = false;
    try {
      await request('/api/admin/gift-audit-review', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(command) });
      saved = true;
      pending.current = null; setUncertain(false); setNote(''); setReferences('');
      const data = await request(`/api/admin/gift-audit-review?transactionId=${encodeURIComponent(command.transactionId)}`) as GiftReviewState;
      setState(data); setMessage('核实记录已保存。资金、券和原审计均未改变。');
    } catch (error) {
      const status = error && typeof error === 'object' && 'status' in error ? error.status : null;
      const rejected = typeof status === 'number' && [400, 403, 404, 409, 413, 415].includes(status);
      if (rejected) { pending.current = null; setUncertain(false); }
      else if (pending.current) setUncertain(true);
      setMessage(saved ? '核实记录已保存，但刷新失败。请刷新查询最新记录。' :
        `${error instanceof Error ? error.message : '提交失败'}。${rejected ? '请重新查询，核对后再提交；输入已保留。' : '请先查询核对；重试会沿用同一请求编号。'}`);
    } finally { setBusy(false); }
  }

  return <div className="space-y-6">
    <header className="space-y-2">
      <Link href="/admin/refundable-gifts" className="text-sm text-cyan-200 hover:underline">← 返回礼物流水</Link>
      <h2 className="text-2xl font-semibold">礼物凭证核实</h2>
      <p className="text-sm leading-6 text-white/65">查询原审计和流水，记录凭证与待核实问题。记录只能追加；补充凭证不代表批准退款，旧版礼物仍需完成独立的账务核实处理。</p>
    </header>
    <form className="flex flex-col gap-3 sm:flex-row sm:items-end" onSubmit={(event) => { event.preventDefault(); if (!busy && !uncertain) { setState(null); setNote(''); setReferences(''); void load(transactionId.trim()); } }}>
      <label className="flex-1 space-y-2 text-sm">个人流水编号<input className={inputStyle} value={transactionId} maxLength={100} disabled={busy || uncertain} onChange={(event) => setTransactionId(event.target.value)} placeholder="IT12345" /></label>
      <button className={buttonStyle} disabled={busy || uncertain}>查询交易</button>
    </form>
    {message && <p role="status" className="rounded-xl border border-cyan-300/30 bg-cyan-300/5 p-3 text-sm leading-6">{message}</p>}
    {state && <>
      <section className="space-y-3 rounded-2xl border border-amber-200/25 bg-amber-200/5 p-4">
        <h3 className="font-semibold">核实范围 · {state.transactionId}</h3>
        {canAdjust && <Link className="block text-sm text-cyan-200 hover:underline" href={`/admin/legacy-adjustments?kind=GIFT&id=${encodeURIComponent(state.transactionId)}`}>核实完成后，进入独立人工退款／调整</Link>}
        <ul className="list-disc space-y-2 pl-5 text-sm text-white/75">{state.concerns.map((concern) => <li key={concern}>{concern}</li>)}</ul>
        <p className="text-sm text-white/65">逐项核对付款来源、收款拆分、累计流水、积分、增益、券、心动值及返佣。当前余额无法证明历史实际入账；下方金额保留原精度。</p>
        <button type="button" className={buttonStyle} disabled={busy} onClick={() => void load(state.transactionId)}>刷新原交易与记录</button>
      </section>
      <Sources sources={state.sources} />
      <form className="space-y-4 rounded-2xl border border-white/15 p-4" onSubmit={(event) => { event.preventDefault(); if (!busy) void save(); }}>
        <h3 className="font-semibold">追加核实记录</h3>
        <label className="block space-y-2 text-sm">当前进展<select className={inputStyle} disabled={busy || uncertain} value={outcome} onChange={(event) => setOutcome(event.target.value as GiftReviewCommand['outcome'])}>
          <option value="NEEDS_EVIDENCE">仍需补充凭证</option><option value="EVIDENCE_ADDED">已补充凭证，待账务处理</option>
        </select></label>
        <label className="block space-y-2 text-sm">核实说明<textarea className={inputStyle} rows={5} maxLength={2000} disabled={busy || uncertain} value={note} onChange={(event) => setNote(event.target.value)} placeholder="说明已核对的事实、凭证对应关系和仍不确定的项目。至少 10 字。" /></label>
        <label className="block space-y-2 text-sm">凭证引用<textarea className={inputStyle} rows={3} disabled={busy || uncertain} value={references} onChange={(event) => setReferences(event.target.value)} placeholder="每行一条：工单号、受控文件位置或 Discord 消息链接。最多 8 条，每条 300 字。" /></label>
        <p className="text-xs text-white/55">只保存引用和说明，不上传或自动读取外部文件。请勿填写密码、令牌或银行卡完整信息。</p>
        <button className={`${buttonStyle} bg-cyan-200/10`} disabled={busy}>{uncertain ? '用原请求编号重试' : '保存核实记录'}</button>
        {uncertain && <p className="text-sm text-amber-100">上次提交结果待确认。请先刷新记录；重试只会提交原来的内容。</p>}
      </form>
      <section className="space-y-3">
        <h3 className="font-semibold">核实历史</h3>
        {!state.notes.length && <p className="text-sm text-white/60">暂无核实记录。</p>}
        {state.notes.map((entry) => <article key={entry.id} className="space-y-3 rounded-2xl border border-white/15 p-4">
          <div className="flex flex-wrap justify-between gap-2 text-xs text-white/60"><span>{entry.outcome === 'EVIDENCE_ADDED' ? '已补充凭证' : '仍需补充凭证'} · 操作者 {entry.actorDiscordId}</span><time>{new Date(entry.createdAt).toLocaleString('zh-CN')}</time></div>
          <p className="whitespace-pre-wrap break-words text-sm">{entry.note}</p>
          <ul className="space-y-1 text-sm text-cyan-100">{entry.evidenceReferences.map((ref, index) => <li className="break-all" key={index}>{ref}</li>)}</ul>
          <p className="break-all text-xs text-white/45">请求编号：{entry.requestId}</p>
          <details><summary className="cursor-pointer text-xs text-white/60">查看提交时的原交易快照{entry.snapshotHash !== state.snapshotHash ? '（与当前不同）' : ''}</summary><div className="mt-3"><Sources sources={entry.sourceSnapshot} /></div></details>
        </article>)}
        {state.nextBeforeNoteId && <button className={buttonStyle} disabled={busy} onClick={() => void load(state.transactionId, state.nextBeforeNoteId!)}>加载更早记录</button>}
      </section>
    </>}
  </div>;
}
