'use client';
import { SiteText, useSiteCopy } from "@/components/SiteCopyProvider";


import { useEffect, useState, useSyncExternalStore } from 'react';
import { createTargetConfirmationController, targetScopeKey, type TargetConfirmation, type TargetConfirmationScope } from '@/lib/target-confirmation-client';
import { canAutoLookupTarget, createTargetConfirmationAutoLookup } from '@/lib/target-confirmation-auto';

export function useTargetConfirmation(scope: TargetConfirmationScope, { autoLookup = false }: { autoLookup?: boolean } = {}) {
  const [controller] = useState(() => createTargetConfirmationController({ fetch: (...args) => fetch(...args) }));
  const [automatic] = useState(() => createTargetConfirmationAutoLookup(controller));
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  const automaticState = useSyncExternalStore(automatic.subscribe, automatic.getSnapshot, automatic.getSnapshot);
  const key = targetScopeKey(scope);
  useEffect(() => { automatic.update(scope, autoLookup); }, [automatic, scope, autoLookup]);
  useEffect(() => {
    if (state.phase !== 'ready' || !state.confirmation) return;
    const timeout = setTimeout(automatic.expire, Math.max(0, Date.parse(state.confirmation.expiresAt) - Date.now()) + 10);
    return () => clearTimeout(timeout);
  }, [automatic, state.confirmation, state.phase]);
  useEffect(() => () => automatic.dispose(), [automatic]);
  return { controller, state, ready: controller.ready(scope),
    lookingUp: (state.phase === 'loading' && state.scopeKey === key) || (autoLookup && canAutoLookupTarget(scope) &&
      (automaticState.scopeKey !== key || automaticState.debouncing)),
    confirmation: state.scopeKey === key || state.phase === 'unknown' || state.phase === 'submitting' ? state.confirmation : null,
    locked: state.phase === 'submitting' || state.phase === 'unknown',
    lookup: () => automatic.lookup(scope),
    submit: (path: string, body: Record<string, unknown>) => controller.submit(scope, path, body),
  };
}

export function TargetConfirmationCard({ confirmation, dark = false }: { confirmation: TargetConfirmation | null; dark?: boolean }) {
  const siteCopy = useSiteCopy();
  if (!confirmation) return null;
  const colors = dark ? 'border-violet-300/30 bg-violet-300/10 text-violet-100' : 'border-violet-200 bg-violet-50 text-slate-800';
  const identity = (label: string, value: TargetConfirmation['target']) => <div className="min-w-0 space-y-1">
    <p className="font-semibold">{label}：{value.displayName || <SiteText copyKey="site.components.profile.targetconfirmation.d5b4063434c8" />}</p>
    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
      <dt><SiteText copyKey="site.components.profile.targetconfirmation.86c67464ba78" /></dt><dd className="break-all font-mono">{value.dlmId}</dd>
      <dt><SiteText copyKey="site.components.profile.targetconfirmation.de14c2aa9b39" /></dt><dd className="break-all font-mono">{value.discordUserId || <SiteText copyKey="site.components.profile.targetconfirmation.3bf179d8d045" />}</dd>
      {value.peiwanId != null ? <><dt><SiteText copyKey="site.components.profile.targetconfirmation.1172ae061d75" /></dt><dd>{value.peiwanId}</dd></> : null}
    </dl>
  </div>;
  return <section aria-label={siteCopy("site.components.profile.targetconfirmation.fd5bf9119597")} className={`space-y-3 rounded-xl border p-3 text-sm ${colors}`}>
    {confirmation.payer ? identity('付款老板', confirmation.payer) : null}
    {identity('接收对象', confirmation.target)}
    {confirmation.selectedVoucher ? <p className="break-all text-xs"><SiteText copyKey="site.components.profile.targetconfirmation.62b9c1195ca8" />{confirmation.selectedVoucher.prizeName} · {confirmation.selectedVoucher.voucherId}</p> : null}
  </section>;
}
