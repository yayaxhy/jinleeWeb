'use client';

import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { createGiftPostCommitController } from '@/lib/gift-post-commit-client';

const statusNames: Record<string, string> = {
  PENDING: '待处理', RUNNING: '处理中（勿重发）', SUCCEEDED: '已完成', FAILED: '明确失败',
  UNKNOWN: '结果未知', REQUIRES_REVIEW: '需要人工核实', SKIPPED: '不适用，已跳过',
};
const kindNames: Record<string, string> = { GIFT_WALL: '礼物墙收集进度', DISCORD_MESSAGE: '单条 Discord 消息' };
const time = (value: string | null) => value ? new Date(value).toLocaleString('zh-CN') : '未记录';
export function GiftPostCommitTasks({ requestId }: { requestId: string }) {
  const controller = useMemo(() => createGiftPostCommitController(requestId, (...args) => fetch(...args)), [requestId]);
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getServerSnapshot);
  const [confirmTask, setConfirmTask] = useState<string | null>(null);
  useEffect(() => { void controller.refresh(); }, [controller]);
  const disabled = state.loading || state.retrying !== null || state.blocked;
  return <section aria-label="赠礼后续任务" aria-busy={state.loading || state.retrying !== null} className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-4">
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div><h3 className="font-semibold">赠礼后续任务</h3><p className="mt-1 text-xs leading-5 text-white/55">资金已完成与外部任务完成分别核实。这里只管理原任务，不会再次扣款、赠礼或退款。</p></div>
      <button type="button" disabled={state.loading || state.retrying !== null} onClick={() => { setConfirmTask(null); void controller.refresh(); }} className="rounded-xl border border-white/20 px-3 py-2 text-xs disabled:opacity-50">{state.loading ? '刷新中…' : '刷新后续任务'}</button>
    </header>
    {state.message && <p role="status" className="rounded-xl border border-amber-300/25 bg-amber-300/10 p-3 text-sm leading-6 text-amber-100">{state.message}</p>}
    {state.view && <p className="text-xs leading-6 text-white/60">{state.view.message}</p>}
    {state.view?.tasks.map(task => <article key={task.id} className="space-y-3 rounded-xl border border-white/10 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2"><h4 className="font-medium">{kindNames[task.kind] ?? '未支持的任务类型'}</h4><span className={`text-xs ${task.status === 'SUCCEEDED' ? 'text-emerald-200' : 'text-amber-100'}`}>{statusNames[task.status] ?? '未知状态'}</span></div>
      <dl className="grid gap-2 break-all text-xs sm:grid-cols-2">
        {[[ '任务标识', task.taskKey ], [ '任务编号', task.id ], [ '已尝试', `${task.attempts} / 3` ],
          [ '最近更新', time(task.updatedAt) ], [ '最近领取', time(task.claimedAt) ], [ '完成时间', time(task.completedAt) ]].map(([label, value]) => <div key={label}><dt className="text-white/45">{label}</dt><dd className="mt-1 text-white/80">{value}</dd></div>)}
      </dl>
      {task.errorCode && <p className="break-all text-xs text-amber-100">状态代码：{task.errorCode}</p>}
      {task.status === 'UNKNOWN' && <p className="text-xs leading-6 text-amber-100">{task.kind === 'DISCORD_MESSAGE' ? '消息可能已送达。普通私信在 24 小时、总共 3 次的限制内自动补发，可能重复；公告或日志结果未知时需核实，不会自动重发。' : '任务可能已完成但未记录结果。请核对原凭证，不能强制重试或重新赠礼。'}</p>}
      {task.status === 'FAILED' && !task.canRetry && <p className="text-xs leading-6 text-white/60">当前不可安全重试，或已达次数上限；请核实任务记录。</p>}
      {!!task.retries.length && <div className="space-y-1 border-t border-white/10 pt-2"><p className="text-xs text-white/45">已受理的人工重试</p>{task.retries.map((retry, index) => <p key={`${retry.createdAt}:${index}`} className="break-all text-xs text-white/70">{time(retry.createdAt)} · 管理员 {retry.actorDiscordId}</p>)}</div>}
      {task.canRetry && (confirmTask !== task.id ? <button type="button" disabled={disabled} onClick={() => setConfirmTask(task.id)} className="rounded-xl border border-cyan-200/30 px-3 py-2 text-xs text-cyan-100 disabled:opacity-50">重试此任务</button> : <div className="space-y-2 border-t border-white/10 pt-3">
        <p className="text-xs leading-6 text-amber-100">确认只重试这项明确失败的后续任务？不会重新赠礼或退款；受理后需要刷新核实结果。</p>
        <div className="flex flex-wrap gap-2"><button type="button" disabled={disabled} onClick={() => { setConfirmTask(null); void controller.retry(task.id); }} className="rounded-xl border border-cyan-200/40 px-3 py-2 text-xs text-cyan-100 disabled:opacity-50">确认重试此任务</button>
          <button type="button" disabled={disabled} onClick={() => setConfirmTask(null)} className="rounded-xl border border-white/20 px-3 py-2 text-xs disabled:opacity-50">取消</button></div>
      </div>)}
    </article>)}
    {!state.view && state.loading && <p className="text-sm text-white/55">正在读取已记录的后续任务…</p>}
  </section>;
}
