'use client';
import Link from 'next/link';
import { useState } from 'react';
import { type AdjustmentCommand, type AdjustmentWallet } from '@/lib/legacy-adjustment';
import type { createLegacyAdjustmentService } from '@/lib/legacy-adjustment-core';

type Preview = Awaited<ReturnType<ReturnType<typeof createLegacyAdjustmentService>['preview']>>;
const blankWallet = (): AdjustmentWallet => ({ dlmId: '', incomeDelta: '0', rechargeDelta: '0', totalSpentDelta: '0', loyaltyPointsDelta: '0', earnDelta: '0', rewardIncomeDelta: '0' });
const inputClass = 'w-full rounded border border-white/20 bg-black/30 p-2';
const buttonClass = 'rounded border border-white/25 px-3 py-2 disabled:opacity-40';
const walletFields = [['dlmId', '实际账户DLM'], ['incomeDelta', '收入增减'], ['rechargeDelta', '充值余额增减'], ['totalSpentDelta', '累计消费增减'], ['loyaltyPointsDelta', '积分增减'], ['earnDelta', '陪玩流水增减'], ['rewardIncomeDelta', '福星有效收入进度增减']] as const;

export function LegacyAdjustmentManager({ initialKind, initialId, initialRequestId }: { initialKind: 'GIFT' | 'ORDER'; initialId: string; initialRequestId: string }) {
  const [command, setCommand] = useState<AdjustmentCommand>({ requestId: initialRequestId, source: { kind: initialKind, id: initialId }, proof: '', references: [],
    wallets: [blankWallet()], hearts: [], vouchers: [], quotas: [], reporting: { grossDelta: null, payoutDelta: null, referralDelta: null, discountDelta: null, explanation: '' } });
  const [preview, setPreview] = useState<Preview | null>(null), [receipt, setReceipt] = useState<unknown>(null);
  const [busy, setBusy] = useState(false), [uncertain, setUncertain] = useState(!!initialRequestId), [confirmed, setConfirmed] = useState(false), [message, setMessage] = useState('');
  const edit = (next: AdjustmentCommand) => { setCommand(next); setPreview(null); setConfirmed(false); setReceipt(null); };
  const saveRequestLocation = (requestId: string) => {
    const url = new URL(window.location.href); url.searchParams.set('requestId', requestId); window.history.replaceState(null, '', url);
  };
  const response = async (res: Response) => {
    const data = await res.json(); if (!res.ok || !data.ok) throw new Error(data.error ?? '暂未取得回执'); return data;
  };
  async function query() {
    if (!command.requestId) return; setBusy(true);
    try { const data = await response(await fetch(`/api/admin/legacy-adjustments?requestId=${encodeURIComponent(command.requestId)}`, { cache: 'no-store' }));
      setReceipt(data.receipt); setMessage(data.receipt ? '已找到原请求回执。下面记录的是实际处理结果，不会再次记账。' : '尚未查到已提交的记录，不能据此判断原请求一定失败。请稍后继续查询；重新核实时仍保留原请求编号。');
      if (data.receipt) { setUncertain(false); setPreview(null); }
    } catch (e) { setMessage(e instanceof Error ? e.message : '查询失败'); } finally { setBusy(false); }
  }
  async function makePreview() {
    setBusy(true); setMessage('');
    const next = { ...command, requestId: command.requestId || crypto.randomUUID() }; setCommand(next);
    try { const data = await response(await fetch('/api/admin/legacy-adjustments', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'preview', command: next }) }));
      setPreview(data.preview); setConfirmed(false); setMessage('请核对以下实际对象、变动前后数值及有效期。预览不记账。');
    } catch (e) { setPreview(null); setMessage(e instanceof Error ? e.message : '预览失败'); } finally { setBusy(false); }
  }
  async function execute() {
    if (!preview || !confirmed) return; setBusy(true); setUncertain(true); saveRequestLocation(command.requestId);
    try { const data = await response(await fetch('/api/admin/legacy-adjustments', { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'execute', command, previewHash: preview.previewHash, confirmed: true }) }));
      setReceipt(data.receipt); setPreview(null); setUncertain(false); setMessage('人工调整已记账。原单已关闭重复处置，原审计未改变。');
    } catch (e) { setMessage(`${e instanceof Error ? e.message : '未取得回执'} 请先查询原请求。`); } finally { setBusy(false); }
  }
  return <main className="mx-auto max-w-6xl space-y-6 p-6 text-white">
    <Link href="/admin" className="text-cyan-200">返回后台</Link>
    <h1 className="text-2xl font-semibold">旧交易人工退款／调整</h1>

    {message && <p role="status" className="rounded bg-white/10 p-3">{message}</p>}
    <div className="flex flex-wrap items-center gap-3"><span>原请求编号：{command.requestId || '预览时生成'}</span><button className={buttonClass} disabled={busy || !command.requestId} onClick={query}>查询原请求</button>
      {uncertain && <button className={buttonClass} disabled={busy} onClick={() => { setUncertain(false); setPreview(null); setConfirmed(false); }}>保留原编号，重新核实</button>}</div>
    <fieldset disabled={busy || uncertain || !!receipt} className="space-y-5 disabled:opacity-60">
      <div className="grid gap-3 sm:grid-cols-2"><label>原交易类型<select className={inputClass} value={command.source.kind} onChange={e => edit({ ...command, source: { ...command.source, kind: e.target.value as 'GIFT' | 'ORDER' } })}><option value="GIFT">打赏</option><option value="ORDER">已结束订单</option></select></label>
        <label>打赏原IT／付款编号，或订单号<input className={inputClass} value={command.source.id} onChange={e => edit({ ...command, source: { ...command.source, id: e.target.value } })} /></label></div>
      <label className="block">已核实事实与本次处置结论<textarea className={inputClass} rows={3} value={command.proof} onChange={e => edit({ ...command, proof: e.target.value })} /></label>
      <label className="block">已核对凭据编号／地址（每行一项，至少一项）<textarea className={inputClass} value={command.references.join('\n')} onChange={e => edit({ ...command, references: e.target.value.split('\n') })} /></label>
      <section className="space-y-2"><h2 className="font-semibold">余额及累计权益</h2>
        {command.wallets.map((w, i) => <div key={i} className="grid gap-2 rounded border border-white/15 p-3 sm:grid-cols-3">{walletFields.map(([key, label]) => <label key={key} className="text-sm">{label}<input className={inputClass} value={w[key]} onChange={e => edit({ ...command, wallets: command.wallets.map((r, n) => n === i ? { ...r, [key]: e.target.value } : r) })} /></label>)}<button className={buttonClass} onClick={() => edit({ ...command, wallets: command.wallets.filter((_, n) => n !== i) })}>移除此行</button></div>)}
        <button className={buttonClass} onClick={() => edit({ ...command, wallets: [...command.wallets, blankWallet()] })}>添加实际调整账户</button>
      </section>
      <details className="space-y-3 rounded border border-white/15 p-3"><summary>心动、原券及退回额度（按已核实事实填写）</summary>
        <h3>心动关系</h3>{command.hearts.map((h, i) => <div key={i} className="grid gap-2 sm:grid-cols-4">{(['fromDlmId', 'toDlmId', 'delta'] as const).map(k => <label key={k}>{k === 'fromDlmId' ? '来源DLM' : k === 'toDlmId' ? '对象DLM' : '心动增减'}<input className={inputClass} value={h[k]} onChange={e => edit({ ...command, hearts: command.hearts.map((r, n) => n === i ? { ...r, [k]: k === 'delta' ? Number(e.target.value) : e.target.value } : r) })} /></label>)}<button className={buttonClass} onClick={() => edit({ ...command, hearts: command.hearts.filter((_, n) => n !== i) })}>移除</button></div>)}
        <button className={buttonClass} onClick={() => edit({ ...command, hearts: [...command.hearts, { fromDlmId: '', toDlmId: '', delta: 0 }] })}>添加心动调整</button>
        <h3>恢复确实用于原单的券</h3>
        {command.vouchers.map((v, i) => <div key={i} className="grid gap-2 sm:grid-cols-3"><label>来源<select className={inputClass} value={v.model} onChange={e => edit({ ...command, vouchers: command.vouchers.map((r, n) => n === i ? { ...r, model: e.target.value as typeof v.model } : r) })}><option value="coupon">普通券</option><option value="lotteryDraw">抽奖券</option><option value="pointShopGrant">积分商城券</option></select></label>{(['id', 'ownerDlmId', 'proof'] as const).map(k => <label key={k}>{k === 'id' ? '原券编号' : k === 'ownerDlmId' ? '原券所属DLM' : '原单与本次用券关联凭据'}<input className={inputClass} value={v[k]} onChange={e => edit({ ...command, vouchers: command.vouchers.map((r, n) => n === i ? { ...r, [k]: e.target.value } : r) })} /></label>)}<button className={buttonClass} onClick={() => edit({ ...command, vouchers: command.vouchers.filter((_, n) => n !== i) })}>移除</button></div>)}
        <button className={buttonClass} onClick={() => edit({ ...command, vouchers: [...command.vouchers, { model: 'coupon', id: '', ownerDlmId: '', proof: '' }] })}>添加原券恢复</button>
        <h3>退回原来消耗的双倍额度</h3>
        {command.quotas.map((q, i) => <div key={i} className="grid gap-2 sm:grid-cols-3"><label>类型<select className={inputClass} value={q.kind} onChange={e => edit({ ...command, quotas: command.quotas.map((r, n) => n === i ? { ...r, kind: e.target.value as typeof q.kind } : r) })}><option value="flow">双倍流水</option><option value="spend">双倍消费</option></select></label>{(['ownerDlmId', 'amount', 'expiresAt', 'proof'] as const).map(k => <label key={k}>{({ ownerDlmId: '所属DLM', amount: '原消耗额度', expiresAt: '原到期时间（含时区）', proof: '原额度和期限凭据' })[k]}<input className={inputClass} value={q[k]} placeholder={k === 'expiresAt' ? '2026-11-01T12:00:00+08:00' : undefined} onChange={e => edit({ ...command, quotas: command.quotas.map((r, n) => n === i ? { ...r, [k]: e.target.value } : r) })} /></label>)}<button className={buttonClass} onClick={() => edit({ ...command, quotas: command.quotas.filter((_, n) => n !== i) })}>移除</button></div>)}
        <button className={buttonClass} onClick={() => edit({ ...command, quotas: [...command.quotas, { ownerDlmId: '', kind: 'flow', amount: '', expiresAt: '', proof: '' }] })}>添加原期额度退回</button>
      </details>
      <section className="space-y-2"><h2>财务分类核实</h2>
        <div className="grid gap-2 sm:grid-cols-4">{([['grossDelta', '营业收入增减'], ['payoutDelta', '陪玩支出增减'], ['referralDelta', '返佣支出增减'], ['discountDelta', '优惠支出增减']] as const).map(([k, label]) => <label key={k}>{label}<input className={inputClass} placeholder="提交前明确填写，含0" value={command.reporting[k] ?? ''} onChange={e => edit({ ...command, reporting: { ...command.reporting, [k]: e.target.value === '' ? null : e.target.value } })} /></label>)}</div>
        <label className="block">分类依据与未确定事项<textarea className={inputClass} value={command.reporting.explanation} onChange={e => edit({ ...command, reporting: { ...command.reporting, explanation: e.target.value } })} /></label>
      </section>
      <button className={buttonClass} onClick={makePreview}>生成实际调整预览</button>
    </fieldset>
    {preview && <section className="space-y-4 rounded border border-cyan-300/40 p-4"><h2>确认预览 · 原单 {preview.source.canonicalKey}</h2>
      <p>平台钱包合计变化：{preview.totalWalletDelta}。</p>
      {preview.wallets.map(w => <div key={w.dlmId} className="space-y-2"><h3>{w.displayName} · {w.inputDlmId} → 当前 {w.dlmId} · Discord {w.discordId ?? '未绑定'}</h3><div className="overflow-auto"><table className="w-full text-left text-sm"><thead><tr><th>项目</th><th>之前</th><th>之后</th></tr></thead><tbody>{([['income', '收入'], ['recharge', '充值余额'], ['totalBalance', '总余额'], ['totalSpent', '累计消费'], ['loyaltyPoints', '积分']] as const).map(([k, title]) => <tr key={k}><td>{title}</td><td>{w.before[k]}</td><td>{w.after[k]}</td></tr>)}<tr><td>陪玩累计流水</td><td>{w.earnBefore ?? '无陪玩档案'}</td><td>{w.earnAfter ?? '不调整'}</td></tr><tr><td>福星有效收入进度</td><td>按原规则统计</td><td>本次增减 {w.rewardIncomeDelta}</td></tr></tbody></table></div></div>)}
      {preview.hearts.map((h, i) => <p key={i}>心动 {h.from.dlmId} → {h.to.dlmId}：{h.before} → {h.after}</p>)}
      {preview.vouchers.map(v => <p key={`${v.model}:${v.id}`}>原券 {v.id} → {v.owner.dlmId}，{v.afterStatus === 'EXPIRED' ? '原期已过，不恢复可用' : '恢复可用'}；原到期：{v.expiresAt ?? '原记录无到期限制'}</p>)}
      {preview.quotas.map((q, i) => <p key={i}>{q.owner.dlmId} {q.kind === 'flow' ? '双倍流水' : '双倍消费'}：退回 {q.restoredAmount}；原到期 {q.expiresAt}{q.expired ? '（已过期，只留记录）' : ''}</p>)}
      <details><summary>查看原单原始凭据（保持不变）</summary><pre className="overflow-auto whitespace-pre-wrap text-xs">{JSON.stringify(preview.source.snapshot, null, 2)}</pre></details>
      <label className="flex gap-2"><input type="checkbox" checked={confirmed} disabled={busy || uncertain} onChange={e => setConfirmed(e.target.checked)} />我已逐项核实以上实际对象、金额和权益，确认处置本原单；原单不再重复退款。</label>
      <button className={buttonClass} disabled={!confirmed || busy || uncertain} onClick={execute}>确认并执行一次</button>
    </section>}
    {!!receipt && <AdjustmentReceipt value={receipt} />}
  </main>;
}

const record = (v: unknown): Record<string, unknown> => v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {};
const rows = (v: unknown): Record<string, unknown>[] => Array.isArray(v) ? v.map(record) : [];
const shown = (v: unknown) => typeof v === 'string' || typeof v === 'number' ? String(v) : '—';
function AdjustmentReceipt({ value }: { value: unknown }) {
  const receipt = record(value), details = record(receipt.details), result = record(details.result), followUp = record(details.followUp);
  return <section className="space-y-3 rounded border border-emerald-300/40 p-4"><h2>实际处置回执</h2>
    <p>原单 {shown(receipt.sourceKey)} · 请求 {shown(receipt.requestId)}</p><p>记账时间 {shown(receipt.createdAt)} · 操作管理员 {shown(receipt.operatorId)}</p>

    {rows(result.wallets).map((w, i) => <div key={i}><h3>{shown(w.displayName)} · 当前账户 {shown(w.dlmId)}</h3><table className="w-full text-left text-sm"><thead><tr><th>项目</th><th>之前</th><th>之后</th></tr></thead><tbody>
      {([['income', '收入'], ['recharge', '充值余额'], ['totalBalance', '总余额'], ['totalSpent', '累计消费'], ['loyaltyPoints', '积分']] as const).map(([k, label]) => <tr key={k}><td>{label}</td><td>{shown(record(w.before)[k])}</td><td>{shown(record(w.after)[k])}</td></tr>)}
      <tr><td>陪玩累计流水</td><td>{shown(w.earnBefore)}</td><td>{shown(w.earnAfter)}</td></tr><tr><td>福星有效收入进度</td><td>按原规则统计</td><td>本次增减 {shown(w.rewardIncomeDelta)}</td></tr>
      </tbody></table><p className="break-all text-xs">实际流水 {shown(w.transactionId)}</p></div>)}
    {rows(result.hearts).map((h, i) => <p key={i}>心动 {shown(record(h.from).dlmId)} → {shown(record(h.to).dlmId)}：{shown(h.before)} → {shown(h.after)}</p>)}
    {rows(result.vouchers).map((v, i) => <p key={i}>原券 {shown(v.id)}：{v.afterStatus === 'EXPIRED' ? '保持过期，不恢复可用' : '恢复可用'}，原期限 {v.expiresAt === null ? '无到期限制' : shown(v.expiresAt)}</p>)}
    {rows(result.quotas).map((q, i) => <p key={i}>{q.kind === 'flow' ? '双倍流水' : '双倍消费'}退回 {shown(q.restoredAmount)} · 原到期 {shown(q.expiresAt)}{q.expired ? '（已过期，仅留历史）' : ''}</p>)}
    <p>角色／权益刷新：{followUp.status === 'COMPLETED' ? '已完成' : followUp.status === 'FAILED' ? '暂未完成，后台稍后重试；账目已成功' : '等待后台同步；账目已成功' }。</p>
    <details><summary>查看完整原始凭据与处理记录</summary><pre className="overflow-auto whitespace-pre-wrap text-xs">{JSON.stringify(receipt, null, 2)}</pre></details>
  </section>;
}
