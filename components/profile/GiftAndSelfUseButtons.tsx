'use client';
import { SiteText, useSiteCopy } from "@/components/SiteCopyProvider";


import { PublicMessageError, publicMessage } from '@/lib/public-error-messages';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { TargetConfirmationCard, useTargetConfirmation } from './TargetConfirmation';
import { GiftExecutionRecovery, useGiftExecutionRecovery } from './GiftExecutionRecovery';
import { giftIntentForConfirmation, type GiftActor } from '@/lib/gift-execution-client';
import { GIFT_NAME_BY_PRIZE_NAME } from '@/lib/voucherCatalog';
import type { TargetConfirmation } from '@/lib/target-confirmation-client';

type Feedback = { type: 'success' | 'error'; text: string } | null;

const commonButtonClass =
  'rounded-full bg-[#f4c542] px-4 py-2 text-xs font-semibold text-[#3d2c00] hover:bg-[#ffd45b] disabled:opacity-50 transition-colors';

export function GiftUsageButton({ lotteryId, couponId, prizeName, actor = { dlmId: '', discordId: null } }: {
  lotteryId?: string; couponId?: string; prizeName: string; actor?: GiftActor;
}) {
  const siteCopy = useSiteCopy();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState('');
  const [message, setMessage] = useState<Feedback>(null);
  const scope = { purpose: 'gift' as const, target, prizeName, lotteryId, couponId };
  const recovery = useGiftExecutionRecovery(actor, 'VOUCHER_GIFT');
  const completed = recovery.state.completed;
  const usedThisVoucher = !!completed && !completed.review.reverted && (!!couponId && completed.record.intent.couponVoucherId === couponId || !!lotteryId && completed.record.intent.lotteryVoucherId === lotteryId);
  const confirmation = useTargetConfirmation(scope, { autoLookup: open && !recovery.blocked && !usedThisVoucher });
  const siteCopyRef = useRef(siteCopy);
  useEffect(() => { siteCopyRef.current = siteCopy; }, [siteCopy]);
  const submittedConfirmation = useRef<TargetConfirmation | null>(null);
  const handledCompletion = useRef<string | null>(null);
  useEffect(() => {
    let previousDraftVersion = recovery.controller.getSnapshot().draftVersion;
    return recovery.controller.subscribe(() => {
      const snapshot = recovery.controller.getSnapshot();
      if (snapshot.draftVersion !== previousDraftVersion) {
        previousDraftVersion = snapshot.draftVersion;
        confirmation.controller.invalidate();
        setTarget('');
      }
      const result = snapshot.completed;
      const matchesVoucher = result && (!!couponId && result.record.intent.couponVoucherId === couponId || !!lotteryId && result.record.intent.lotteryVoucherId === lotteryId);
      if (!result || !matchesVoucher || handledCompletion.current === result.record.requestId) return;
      handledCompletion.current = result.record.requestId;
      if (result.prepareNext && !result.review.reverted) {
        confirmation.controller.invalidate();
        setTarget(''); setOpen(false);
        setMessage({ type: 'success', text: siteCopyRef.current("site.components.profile.giftandselfusebuttons.e9bff98c367e") });
      }
      router.refresh();
    });
  }, [recovery.controller, confirmation.controller, couponId, lotteryId, router]);
  const close = () => { if (!recovery.blocked) confirmation.controller.invalidate(); setOpen(false); };
  const handleSubmit = async () => {
    if (!confirmation.ready || !confirmation.confirmation || recovery.blocked || usedThisVoucher || submittedConfirmation.current === confirmation.confirmation) return;
    submittedConfirmation.current = confirmation.confirmation;
    setMessage(null);
    try {
      const selected = confirmation.confirmation.selectedVoucher;
      if (!selected) throw new PublicMessageError('missing_confirmed_voucher');
      const giftName = GIFT_NAME_BY_PRIZE_NAME[selected.prizeName] ?? selected.prizeName.replace(/代金券$/, '');
      await recovery.controller.submit({ scope, confirmation: confirmation.confirmation,
        intent: giftIntentForConfirmation(actor, scope, confirmation.confirmation, giftName), path: '/api/lottery/use',
        body: { lotteryId, couponId, mode: 'gift', target: target.trim(), prizeName } });
    } catch { setMessage({ type: 'error', text: siteCopy("site.components.profile.giftandselfusebuttons.2a677deef7f2") }); }
  };
  return <>
    <button type="button" disabled={usedThisVoucher} onClick={() => { setOpen(true); setMessage(null); }} className={commonButtonClass}>{usedThisVoucher ? <SiteText copyKey="site.components.profile.giftandselfusebuttons.2df8cf2b4633" /> : <SiteText copyKey="site.components.profile.giftandselfusebuttons.0e2d3a3c09c2" />}</button>
    {!open && (message || confirmation.state.message) ? <p className={`text-xs ${message?.type === 'success' ? 'text-emerald-600' : 'text-rose-500'}`}>{message?.text || confirmation.state.message}</p> : null}
    {open ? <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3">
      <div role="dialog" aria-modal="true" aria-label={siteCopy("site.components.profile.giftandselfusebuttons.bb51b50b9ec0")} className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-xl bg-white p-4 shadow-lg space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div><p className="text-xs uppercase tracking-[0.4em] text-gray-500"><SiteText copyKey="site.components.profile.giftandselfusebuttons.bb51b50b9ec0" /></p><h3 className="text-lg font-semibold text-[#171717]"><SiteText namespace="site.lib.vouchercatalog" value={prizeName} /></h3></div>
          <button type="button" onClick={close} disabled={recovery.state.busy} className="text-sm font-semibold text-gray-600 hover:text-black"><SiteText copyKey="site.components.profile.giftandselfusebuttons.6c14bd7f6f9e" /></button>
        </div>
        <form onSubmit={(event) => { event.preventDefault(); void handleSubmit(); }} className="space-y-3">
          <label className="block space-y-1 text-sm text-gray-600"><SiteText copyKey="site.components.profile.giftandselfusebuttons.1ec62b6f4968" /><input value={target} disabled={recovery.blocked} onChange={(event) => { confirmation.controller.invalidate(); setTarget(event.target.value); }} placeholder={siteCopy("site.components.profile.giftandselfusebuttons.defcd75a1443")} className="w-full rounded-lg border border-black/10 bg-gray-50 px-3 py-2 text-sm text-[#171717] focus:outline-none focus:ring-1 focus:ring-[#5c43a3]" />
          </label>
          {confirmation.lookingUp ? <p role="status" className="text-sm text-gray-500"><SiteText copyKey="site.components.profile.giftandselfusebuttons.2aba7a48cd86" /></p> : !target.trim() ? <p className="text-xs text-gray-500"><SiteText copyKey="site.components.profile.giftandselfusebuttons.64d6bea2c2b1" /></p> : null}
          <TargetConfirmationCard confirmation={confirmation.confirmation} />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={close} disabled={recovery.state.busy} className="rounded-full border border-black/10 px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-black/5"><SiteText copyKey="site.components.profile.giftandselfusebuttons.6c14bd7f6f9e" /></button>
            <button type="submit" disabled={!confirmation.ready || recovery.blocked || usedThisVoucher} className={commonButtonClass}>{recovery.state.busy ? <SiteText copyKey="site.components.profile.giftandselfusebuttons.17e519c5a6bd" /> : <SiteText copyKey="site.components.profile.giftandselfusebuttons.ce666e5c1f6e" />}</button>
          </div>
          {confirmation.state.message ? <p role="status" className="text-sm text-rose-600">{confirmation.state.message}</p> : null}
          {message ? <p role="status" className={`text-sm ${message.type === 'success' ? 'text-emerald-600' : 'text-rose-600'}`}>{message.text}</p> : null}
          {(confirmation.state.phase === 'error' || message?.type === 'error') && !recovery.blocked ? <button type="button" onClick={() => { setMessage(null); void confirmation.lookup(); }} className="text-sm text-[#5c43a3] underline"><SiteText copyKey="site.components.profile.giftandselfusebuttons.9b9dc1f09589" /></button> : null}
          <GiftExecutionRecovery actor={actor} kind="VOUCHER_GIFT" onNew={() => { confirmation.controller.invalidate(); setTarget(''); }} />
        </form>
      </div>
    </div> : null}
  </>;
}

export function SelfUseButton({
  lotteryId,
  couponId,
  prizeName,
}: {
  lotteryId?: string;
  couponId?: string;
  prizeName: string;
}) {
  const siteCopy = useSiteCopy();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<Feedback>(null);
  const [open, setOpen] = useState(false);

  const handleUse = async () => {
    setSubmitting(true);
    setMessage(null);
    try {
      const res = await fetch('/api/lottery/use', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lotteryId, couponId, mode: 'selfuse', prizeName }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new PublicMessageError(typeof data?.error === 'string' ? data.error : '使用失败');
      }
      setMessage({ type: 'success', text: siteCopy("site.components.profile.giftandselfusebuttons.004f7ff59bfb") });
      setOpen(false);
      router.refresh();
    } catch (error) {
      setMessage({ type: 'error', text: publicMessage(error, '暂时无法确认用券结果，请先核对券状态，勿重复提交。') });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <button type="button" onClick={() => setOpen(true)} className={commonButtonClass}><SiteText copyKey="site.components.profile.giftandselfusebuttons.0e2d3a3c09c2" /></button>
      {message ? (
        <p className={`text-xs ${message.type === 'success' ? 'text-emerald-600' : 'text-rose-500'}`}>
          {message.text}
        </p>
      ) : null}

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3">
          <div className="w-full max-w-md rounded-xl bg-white p-4 shadow-lg space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.4em] text-gray-500"><SiteText copyKey="site.components.profile.giftandselfusebuttons.68ec92b4d10f" /></p>
                <h3 className="text-lg font-semibold text-[#171717]"><SiteText namespace="site.lib.vouchercatalog" value={prizeName} /></h3>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-sm font-semibold text-gray-600 hover:text-black"
              ><SiteText copyKey="site.components.profile.giftandselfusebuttons.6c14bd7f6f9e" /></button>
            </div>
            <p className="text-sm text-gray-600"><SiteText copyKey="site.components.profile.giftandselfusebuttons.de2f8ef86e4d" /></p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full border border-black/10 px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-black/5"
              ><SiteText copyKey="site.components.profile.giftandselfusebuttons.4d0b4688c787" /></button>
              <button
                type="button"
                onClick={() => void handleUse()}
                disabled={submitting}
                className={commonButtonClass}
              >
                {submitting ? <SiteText copyKey="site.components.profile.giftandselfusebuttons.17e519c5a6bd" /> : <SiteText copyKey="site.components.profile.giftandselfusebuttons.19b6a1bf9fca" />}
              </button>
            </div>
            {message ? (
              <p className={`text-sm ${message.type === 'success' ? 'text-emerald-600' : 'text-rose-500'}`}>
                {message.text}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
