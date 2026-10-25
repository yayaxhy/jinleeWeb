'use client';
import { SiteText, useSiteCopy } from "@/components/SiteCopyProvider";


import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { createGiftExecutionController, giftRecoveryKey, newGiftRequestId, type GiftActor, type GiftRecoveryRecord } from '@/lib/gift-execution-client';
import { giftReviewPublicMessage } from '@/lib/public-error-messages';

const controllers = new Map<string, ReturnType<typeof createGiftExecutionController>>();
const EVENT = 'dlm-gift-recovery-change';
export function useGiftExecutionRecovery(actor: GiftActor, kind: GiftRecoveryRecord['kind']) {
  const key = giftRecoveryKey(actor, kind);
  const controller = useMemo(() => {
    if (typeof window !== 'undefined' && controllers.has(key)) return controllers.get(key)!;
    const next = createGiftExecutionController({ actor, kind,
      storage: { getItem: key => window.localStorage.getItem(key), setItem: (key, value) => window.localStorage.setItem(key, value), removeItem: key => window.localStorage.removeItem(key) },
      fetch: (...args) => fetch(...args), newId: () => newGiftRequestId(),
      exclusive: async (key, work) => {
        if (!navigator.locks) return work();
        return navigator.locks.request(key, { mode: 'exclusive' }, work);
      }, notify: () => window.dispatchEvent(new Event(EVENT)),
    });
    if (typeof window !== 'undefined') controllers.set(key, next);
    return next;
  // The serialized key contains the complete immutable actor identity and kind.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getServerSnapshot);
  useEffect(() => {
    controller.refresh();
    controller.ensureHistory();
    const refresh = () => controller.refresh();
    window.addEventListener('storage', refresh); window.addEventListener(EVENT, refresh);
    return () => { window.removeEventListener('storage', refresh); window.removeEventListener(EVENT, refresh); };
  }, [controller]);
  return { controller, state, blocked: !state.hydrated || state.busy };
}

export function GiftExecutionRecovery({ actor, kind, dark = false, onNew }: {
  actor: GiftActor; kind: GiftRecoveryRecord['kind']; dark?: boolean; onNew?: () => void;
}) {
  const siteCopy = useSiteCopy();
  const { controller, state } = useGiftExecutionRecovery(actor, kind);
  const [abandonRequestId, setAbandonRequestId] = useState<string | null>(null);
  const record = state.record;
  const completedCard = state.completed ? (() => {
    const { record: completed, review } = state.completed!;
    return <section aria-label={siteCopy("site.components.profile.giftexecutionrecovery.7dba6e17396d")} className={`space-y-2 rounded-xl border p-3 text-sm ${dark ? 'border-emerald-300/30 bg-emerald-300/10 text-emerald-100' : 'border-emerald-300 bg-emerald-50 text-emerald-900'}`}>
      <p role="status" className="font-semibold">{state.completed!.prepareNext ? <SiteText copyKey="site.components.profile.giftexecutionrecovery.57edc6939d67" /> : <SiteText copyKey="site.components.profile.giftexecutionrecovery.39b43c1c6d02" />}</p>
      <p className="break-words">{completed.target.displayName} · {completed.intent.giftName} × {completed.intent.quantity}</p>
      <details className="text-xs">
        <summary className="cursor-pointer"><SiteText copyKey="site.components.profile.giftexecutionrecovery.3355ba495a9a" /></summary>
        <div className="mt-2 space-y-1 break-all">
          <p><SiteText copyKey="site.components.profile.giftexecutionrecovery.efeb9bc96fe9" />{completed.requestId}</p>
          <p><SiteText copyKey="site.components.profile.giftexecutionrecovery.8e6e01f2d6a5" />{completed.payerDisplayName} · {completed.intent.payerDlmId}</p>
          {review.transactionId && <p><SiteText copyKey="site.components.profile.giftexecutionrecovery.8ac9b8893a2e" />{review.transactionId}</p>}
          {review.reverted && <p><SiteText copyKey="site.components.profile.giftexecutionrecovery.d223b528d12a" /></p>}
          {review.reverts.some(row => row.status === 'MANUAL_ADJUSTED') && <p><SiteText copyKey="site.components.profile.giftexecutionrecovery.e27f10b4f372" /></p>}
        </div>
      </details>
    </section>;
  })() : null;
  const terminal = state.review?.verified === true && ['COMPLETED', 'ABANDONED'].includes(state.review.status);
  return <div className="space-y-3">{completedCard}<section aria-label={siteCopy("site.components.profile.giftexecutionrecovery.9223c55b32eb")} className={`space-y-3 rounded-xl border p-3 text-sm ${dark ? 'border-amber-300/30 bg-amber-300/10 text-amber-100' : 'border-amber-300 bg-amber-50 text-slate-800'}`}>
    <p className="font-semibold">{record?.phase === 'NOT_SENT' ? <SiteText copyKey="site.components.profile.giftexecutionrecovery.d8998c8b990f" /> : terminal ? state.review!.status === 'ABANDONED' ? <SiteText copyKey="site.components.profile.giftexecutionrecovery.cfa3a9a8876a" /> : <SiteText copyKey="site.components.profile.giftexecutionrecovery.c7b2652d41aa" /> : record ? <SiteText copyKey="site.components.profile.giftexecutionrecovery.9cb2a6ad7447" values={{value1: String(state.records.length)}} /> : <SiteText copyKey="site.components.profile.giftexecutionrecovery.be99317ce852" />}</p>
    <div className="flex flex-wrap gap-2">
      <button type="button" disabled={state.historyLoading} onClick={() => void controller.refreshHistory()} className="rounded-full border border-current/20 px-3 py-2 text-xs disabled:opacity-50">
        {state.historyLoading ? <SiteText copyKey="site.components.profile.giftexecutionrecovery.06ecbdc810fd" /> : <SiteText copyKey="site.components.profile.giftexecutionrecovery.ed8ef555fd50" />}
      </button>
      {state.nextCursor && <button type="button" disabled={state.historyLoading} onClick={() => void controller.loadMoreHistory()} className="rounded-full border border-current/20 px-3 py-2 text-xs disabled:opacity-50"><SiteText copyKey="site.components.profile.giftexecutionrecovery.6b97a80891b2" /></button>}
    </div>
    <p className="text-xs leading-5"><SiteText copyKey="site.components.profile.giftexecutionrecovery.c72923be3d69" /></p>
    {state.historyError && <p role="status" className="text-xs leading-5">{state.historyError}</p>}
    {state.storageError && <p className="text-xs leading-5"><SiteText copyKey="site.components.profile.giftexecutionrecovery.baa04d182f2d" /></p>}
    {state.historyLoaded && !state.records.length && !state.message && <p className="text-xs"><SiteText copyKey="site.components.profile.giftexecutionrecovery.5441c5ecb46c" /></p>}
    {state.records.length > 1 && <label className="block space-y-1 text-xs">
      <span><SiteText copyKey="site.components.profile.giftexecutionrecovery.04e036e0420e" /></span>
      <select aria-label={siteCopy("site.components.profile.giftexecutionrecovery.04e036e0420e")} value={record?.requestId ?? ''} disabled={state.busy} onChange={event => {
        setAbandonRequestId(null); controller.select(event.target.value);
      }} className={`w-full rounded-lg border border-current/20 px-2 py-2 ${dark ? 'bg-slate-900' : 'bg-white'}`}>
        {[...state.records].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)).map(item => <option key={item.requestId} value={item.requestId}>
          {item.target.displayName} · {item.intent.giftName} × {item.intent.quantity} · {item.requestId}
        </option>)}
      </select>
    </label>}
    {record && <>
      {record.inherited && <p className="text-xs"><SiteText copyKey="site.components.profile.giftexecutionrecovery.d3ea529e1f19" /></p>}
      <p className="break-all text-xs"><SiteText copyKey="site.components.profile.giftexecutionrecovery.efeb9bc96fe9" /><span className="font-mono">{record.requestId}</span></p>
      <p><SiteText copyKey="site.components.profile.giftexecutionrecovery.d6077b82de1b" />{record.intent.giftName} × {record.intent.quantity}</p>
      <p className="break-words"><SiteText copyKey="site.components.profile.giftexecutionrecovery.183a0ed03d81" />{record.target.displayName} · {record.target.dlmId}</p>
      <p className="break-all text-xs"><SiteText copyKey="site.components.profile.giftexecutionrecovery.8e6e01f2d6a5" />{record.payerDisplayName} · {record.intent.payerDlmId}</p>
    </>}
    {state.message && <p role="status" className="leading-6">{state.message}</p>}
    {state.review && <div className="space-y-1 break-all text-xs">
      <p>{terminal ? <SiteText namespace="site.lib.public.error.messages" value={giftReviewPublicMessage(state.review)} /> : <SiteText copyKey="site.components.profile.giftexecutionrecovery.f68222cb6ba9" />}</p>
      {state.review.transactionId && <p><SiteText copyKey="site.components.profile.giftexecutionrecovery.8ac9b8893a2e" />{state.review.transactionId}</p>}
    </div>}
    {record && <div className="flex flex-wrap gap-2">
      <button type="button" disabled={state.busy} onClick={() => void controller.query()} className="rounded-full border border-current/20 px-3 py-2 text-xs disabled:opacity-50">{state.busy ? <SiteText copyKey="site.components.profile.giftexecutionrecovery.15954fd62b4f" /> : <SiteText copyKey="site.components.profile.giftexecutionrecovery.12e9ea0616c9" />}</button>
      {!terminal && record.phase !== 'NOT_SENT' && <button type="button" disabled={state.busy} onClick={() => {
        if (controller.startNew()) { setAbandonRequestId(null); onNew?.(); }
      }} className="rounded-full border border-current/30 px-3 py-2 text-xs disabled:opacity-50"><SiteText copyKey="site.components.profile.giftexecutionrecovery.e5a238b6eb6d" /></button>}
      {(terminal || record.phase === 'NOT_SENT') && <button type="button" disabled={state.busy} onClick={async () => {
        if (await controller.clearConfirmed()) { setAbandonRequestId(null); onNew?.(); }
      }} className="rounded-full border border-current/30 px-3 py-2 text-xs disabled:opacity-50">{record.phase === 'NOT_SENT' ? <SiteText copyKey="site.components.profile.giftexecutionrecovery.3d2bfe3f346c" /> : <SiteText copyKey="site.components.profile.giftexecutionrecovery.c248c5a60f60" />}</button>}
      {(state.review?.status === 'PENDING' || (state.missing && !record.inherited)) && record.phase !== 'NOT_SENT' && <button type="button" disabled={state.busy} onClick={() => setAbandonRequestId(record.requestId)} className="rounded-full border border-current/30 px-3 py-2 text-xs disabled:opacity-50"><SiteText copyKey="site.components.profile.giftexecutionrecovery.7bea9b6e966f" /></button>}
    </div>}
    {record && abandonRequestId === record.requestId && (state.review?.status === 'PENDING' || (state.missing && !record.inherited)) && <div className="space-y-2 border-t border-current/20 pt-3">
      <p className="leading-6"><SiteText copyKey="site.components.profile.giftexecutionrecovery.f717fe3f0123" /></p>
      <button type="button" disabled={state.busy} onClick={() => { setAbandonRequestId(null); void controller.abandon(); }} className="rounded-full border border-current/30 px-3 py-2 text-xs"><SiteText copyKey="site.components.profile.giftexecutionrecovery.c9cbe84e862b" /></button>
    </div>}
  </section></div>;
}
