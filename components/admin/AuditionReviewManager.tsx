'use client';

import Link from 'next/link';
import { useRef, useState, type FormEvent } from 'react';
import type { AuditionReview } from '@/lib/audition-review';

type Field = readonly [string, unknown];
function Fields({ values }: { values: Field[] }) {
  return <dl className="grid gap-3 sm:grid-cols-2">{values.map(([label, value]) => <div className="min-w-0" key={label}>
    <dt className="text-xs text-white/50">{label}</dt><dd className="mt-1 break-all text-sm">{value === null || value === undefined ? '未记录' : String(value)}</dd>
  </div>)}</dl>;
}
function Evidence({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-5"><h3 className="font-semibold">{title}</h3>{children}</section>;
}
const time = (value: string | null) => value ? new Date(value).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false }) : null;
const stateNames: Record<string, string> = { PENDING: '待接受', ACCEPTED: '已接受，等待结算', REJECTED: '已拒绝', EXPIRED: '已过期', FULFILLED: '已完成', CANCELED: '已取消' };

export function AuditionReviewManager({ initialInviteId = '' }: { initialInviteId?: string }) {
  const [inviteId, setInviteId] = useState(initialInviteId.slice(0, 100));
  const [review, setReview] = useState<AuditionReview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const sequence = useRef(0);
  async function query(event: FormEvent) {
    event.preventDefault();
    if (loading) return;
    const id = inviteId.trim();
    if (!/^[A-Za-z0-9_-]{1,100}$/.test(id)) { setError('请输入 1–100 位有效邀请编号'); return; }
    const requestId = ++sequence.current;
    setLoading(true); setReview(null); setError(null);
    try {
      const response = await fetch(`/api/admin/auditions?inviteId=${encodeURIComponent(id)}`, { cache: 'no-store' });
      const payload = await response.json();
      if (requestId !== sequence.current) return;
      if (!response.ok || payload.ok !== true || !payload.review || payload.review.invite?.id !== id) {
        setError(typeof payload.message === 'string' && payload.message.length <= 300 ? payload.message : '无法核实结果，请保留邀请编号并人工查账，勿再次扣费。');
        return;
      }
      setReview(payload.review as AuditionReview);
    } catch { if (requestId === sequence.current) setError('查询连接中断，当前结果未知。请保留邀请编号并人工查账，勿再次发起扣费。'); }
    finally { if (requestId === sequence.current) setLoading(false); }
  }
  return <div className="mx-auto max-w-5xl space-y-5 text-white">
    <header className="space-y-2"><Link href="/admin" className="text-sm text-white/60 hover:text-white">← 返回管理后台</Link>
      <h2 className="text-2xl font-semibold">试音结果核实</h2><Link href="/admin/auditions/legacy" className="inline-block text-sm text-cyan-200 underline">旧邀请缺失资料补齐</Link><p className="text-sm leading-6 text-white/60">使用 Discord 消息中的邀请编号查询。此页面只读，不会重新结算或执行退款。</p></header>
    <form onSubmit={query} className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-5">
      <label htmlFor="audition-invite-id" className="block text-sm">邀请编号</label>
      <div className="flex flex-col gap-3 sm:flex-row"><input id="audition-invite-id" maxLength={100} value={inviteId} autoComplete="off" spellCheck={false}
        onChange={event => { ++sequence.current; setInviteId(event.target.value); setReview(null); setError(null); setLoading(false); }}
        className="min-w-0 flex-1 rounded-xl border border-white/20 bg-black/20 px-3 py-2 text-sm outline-none focus:border-cyan-300" placeholder="粘贴完整邀请编号" />
        <button disabled={loading || !inviteId.trim()} className="rounded-xl bg-cyan-300 px-5 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50">{loading ? '查询中…' : '查询邀请'}</button></div>
      <p className="text-xs leading-5 text-white/50">查不到记录、等待状态或连接中断，都不能作为再次扣费的依据。</p>
    </form>
    {error && <p role="alert" className="rounded-2xl border border-amber-300/30 bg-amber-300/10 p-4 text-sm leading-6 text-amber-100">{error}</p>}
    {review && <div className="space-y-4" aria-live="polite">
      <section className={`rounded-2xl border p-4 sm:p-5 ${review.outcome === 'CONSISTENT' ? 'border-emerald-300/30 bg-emerald-300/10' : 'border-amber-300/30 bg-amber-300/10'}`}>
        <h3 className="font-semibold">{review.summary}</h3><p className="mt-2 text-sm leading-6 text-white/70">{review.scope}</p>
        {review.issues.length > 0 && <ul className="mt-3 list-disc space-y-1 pl-5 text-sm leading-6 text-amber-100">{review.issues.map(issue => <li key={issue}>{issue}</li>)}</ul>}
      </section>
      <Evidence title="邀请与原身份快照"><Fields values={[
        ['邀请编号', review.invite.id], ['派单请求编号', review.invite.orderRequestId], ['邀请状态', stateNames[review.invite.status] ?? review.invite.status], ['固定陪玩编号', review.invite.peiwanId],
        ['原老板 DLM ID', review.invite.bossDlmId], ['原老板 Discord ID', review.invite.bossDiscordId],
        ['原陪玩 DLM ID', review.invite.workerDlmId], ['原陪玩 Discord ID', review.invite.workerDiscordId],
        ['原始报价（点点券）', review.invite.quotedGross], ['原支付编号', review.invite.transactionId],
        ['实付（点点券）', review.invite.grossAmount], ['抽成（点点券）', review.invite.feeAmount], ['净收入（点点券）', review.invite.netAmount],
      ]} /><p className="text-xs leading-5 text-white/50">原昵称未保存；以固定身份编号核对。当前邀请关联：老板 {review.invite.currentBossDiscordId}，陪玩 {review.invite.currentWorkerDiscordId}。</p></Evidence>
      <Evidence title="事件时间 · 北京时间"><Fields values={[
        ['创建', time(review.invite.createdAt)], ['更新', time(review.invite.updatedAt)], ['接受', time(review.invite.acceptedAt)], ['加入', time(review.invite.joinedAt)],
        ['扣款', time(review.invite.chargedAt)], ['完成', time(review.invite.fulfilledAt)], ['到期', time(review.invite.expiresAt)],
        ['拒绝', time(review.invite.declinedAt)], ['取消', time(review.invite.canceledAt)],
      ]} /></Evidence>
      <Evidence title={`关联支付 · ${review.payments.length} 条`}>{review.payments.map((row, index) => <Fields key={index} values={[
        ['支付编号', row.transactionId], ['流水单号', row.orderId], ['付款 DLM / Discord', `${row.fromDlmId ?? '未记录'} / ${row.fromDiscordId ?? '未记录'}`],
        ['收款 DLM / Discord', `${row.toDlmId ?? '未记录'} / ${row.toDiscordId}`], ['金额', row.amount], ['抽成', row.feeAmount], ['净收入', row.netAmount], ['记账时间', time(row.createdAt)],
      ]} />)}</Evidence>
      <Evidence title={`关联打赏审计 · ${review.audits.length} 条`}>{review.audits.map((row, index) => <div key={index} className="space-y-3"><Fields values={[
        ['审计编号 / 版本', `${row.id} / v${row.auditVersion}`], ['原支付编号', row.paymentTransactionId], ['原付款个人流水', row.individualTransactionId], ['类型', row.giftName],
        ['原老板 DLM / Discord', `${row.giverDlmId ?? '未记录'} / ${row.giverDiscordId ?? '未记录'}`], ['原陪玩 DLM / Discord', `${row.receiverDlmId ?? '未记录'} / ${row.receiverDiscordId}`],
        ['固定陪玩编号', row.receiverPeiwanId], ['实付', row.payable], ['收入仓扣款', row.giverFromIncome], ['充值仓扣款', row.giverFromRecharge],
        ['收款收入仓增量', row.receiverIncomeDelta], ['收款充值仓增量', row.receiverRechargeDelta], ['实际陪玩流水增量', row.receiverEarnDelta], ['实际心动', row.heartApplied],
        ['积分', row.pointsEarned], ['消费翻倍增量', row.spendBonusExtra], ['流水翻倍增量', row.flowBonusExtra],
      ]} /><Link href={`/admin/gift-audit-review?transactionId=${encodeURIComponent(row.individualTransactionId)}`} className="inline-block text-sm text-cyan-200 hover:underline">查看打赏凭证核实记录</Link></div>)}</Evidence>
      <Evidence title={`原付款个人流水 · ${review.payerLedgers.length} 条`}>{review.payerLedgers.map((row, index) => <Fields key={index} values={[
        ['个人流水编号', row.transactionId], ['类型', row.type], ['DLM / Discord', `${row.dlmId ?? '未记录'} / ${row.discordId ?? '未记录'}`], ['对方 Discord', row.counterpartyDiscordId],
        ['记账金额', row.amount], ['原余额', row.balanceBefore], ['记账后余额', row.balanceAfter], ['记账时间', time(row.createdAt)],
      ]} />)}</Evidence>
      <Evidence title={`关联抽成 · ${review.commissions.length} 条`}>{review.commissions.map((row, index) => <Fields key={index} values={[
        ['支付编号', row.transactionId], ['流水单号', row.orderId], ['付款 DLM / Discord', `${row.fromDlmId ?? '未记录'} / ${row.fromDiscordId ?? '未记录'}`],
        ['收款 DLM / Discord', `${row.toDlmId ?? '未记录'} / ${row.toDiscordId}`], ['抽成', row.feeAmount], ['记账时间', time(row.createdAt)],
      ]} />)}</Evidence>
      <Evidence title={`关联撤销 · ${review.reverts.length} 条`}>{review.reverts.length ? review.reverts.map((row, index) => <Fields key={index} values={[
        ['撤销编号', row.id], ['原付款个人流水', row.originalTransactionId], ['撤销状态', row.status], ['记录时间', time(row.createdAt)],
      ]} />) : <p className="text-sm text-white/60">当前关联凭证中未查到撤销记录；本页不验证退款全链路。</p>}</Evidence>
    </div>}
  </div>;
}
