'use client';
import { SiteText, useSiteCopy } from "@/components/SiteCopyProvider";


import { PublicMessageError, publicMessage } from '@/lib/public-error-messages';

import { useEffect, useRef, useState } from 'react';
import { TargetConfirmationCard, useTargetConfirmation } from './TargetConfirmation';
import { useRouter } from 'next/navigation';

type Props = {
  prizeName: string;
  lotteryId?: string;
  couponId?: string;
};

type PeiwanSearchItem = {
  id: number;
  discordUserId: string;
  serverDisplayName: string;
};

const primaryBtn =
  'rounded-full bg-[#f4c542] px-4 py-2 text-xs font-semibold text-[#3d2c00] hover:bg-[#ffd45b] disabled:opacity-50 transition-colors';
const useTriggerBtn =
  'rounded-full border border-[#f4c542] bg-[#fff8dd] px-4 py-2 text-xs font-semibold text-[#8a6300] hover:bg-[#ffefb8] disabled:opacity-50 transition-colors';
const ghostBtn =
  'rounded-full border border-black/10 px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-black/5';

export function SimpleVoucherUseButton({ prizeName, lotteryId, couponId }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUse = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/voucher/use', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prizeName, lotteryId, couponId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new PublicMessageError(typeof data?.error === 'string' ? data.error : '使用失败');
      // 成功后直接关闭弹窗并刷新，不保留提示
      setError(null);
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(publicMessage(err, '暂时无法确认操作结果，请先核对券状态或联系客服，勿重复提交。'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={useTriggerBtn}
      ><SiteText copyKey="site.components.profile.voucherusebuttons.0e2d3a3c09c2" /></button>
      {error ? <p className="text-xs text-rose-500"><SiteText namespace="site.components.profile.voucherusebuttons" value={error} /></p> : null}

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3">
          <div className="w-full max-w-md rounded-xl bg-white p-4 shadow-lg space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.4em] text-gray-500"><SiteText copyKey="site.components.profile.voucherusebuttons.a01a58bf1a8f" /></p>
                <h3 className="text-lg font-semibold text-[#171717]"><SiteText namespace="site.lib.vouchercatalog" value={prizeName} /></h3>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-sm font-semibold text-gray-600 hover:text-black"
              ><SiteText copyKey="site.components.profile.voucherusebuttons.6c14bd7f6f9e" /></button>
            </div>
            <p className="text-sm text-gray-600"><SiteText copyKey="site.components.profile.voucherusebuttons.ebace2a234bb" /></p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setOpen(false)} className={ghostBtn}><SiteText copyKey="site.components.profile.voucherusebuttons.4d0b4688c787" /></button>
              <button type="button" onClick={() => void handleUse()} disabled={loading} className={primaryBtn}>
                {loading ? <SiteText copyKey="site.components.profile.voucherusebuttons.18f6eb88eef5" /> : <SiteText copyKey="site.components.profile.voucherusebuttons.19b6a1bf9fca" />}
              </button>
            </div>
            {error ? <p className="text-sm text-rose-500"><SiteText namespace="site.components.profile.voucherusebuttons" value={error} /></p> : null}
          </div>
        </div>
      ) : null}
    </>
  );
}

function DirectedVoucherButton({ prizeName, lotteryId, couponId, successText }: Props & { successText: string }) {
  const siteCopy = useSiteCopy();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const confirmation = useTargetConfirmation({ purpose: 'voucher', target, prizeName, lotteryId, couponId }, { autoLookup: open });
  const close = () => { if (!confirmation.locked) confirmation.controller.invalidate(); setOpen(false); };
  const handleUse = async () => {
    const outcome = await confirmation.submit('/api/voucher/use', { prizeName, target: target.trim(), lotteryId, couponId });
    if (outcome.status === 'success') { setMessage(successText); setOpen(false); setTarget(''); router.refresh(); }
  };
  return <>
    <button type="button" onClick={() => { setOpen(true); setMessage(null); }} className={useTriggerBtn}><SiteText copyKey="site.components.profile.voucherusebuttons.0e2d3a3c09c2" /></button>
    {!open && (message || confirmation.state.message) ? <p className={`text-xs ${message ? 'text-emerald-600' : 'text-rose-500'}`}>{message || confirmation.state.message}</p> : null}
    {open ? <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3">
      <div role="dialog" aria-modal="true" aria-label={siteCopy("site.components.profile.voucherusebuttons.e8a77a40238b")} className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-xl bg-white p-4 shadow-lg space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div><p className="text-xs uppercase tracking-[0.4em] text-gray-500"><SiteText copyKey="site.components.profile.voucherusebuttons.e8a77a40238b" /></p><h3 className="text-lg font-semibold text-[#171717]"><SiteText namespace="site.lib.vouchercatalog" value={prizeName} /></h3></div>
          <button type="button" disabled={confirmation.state.phase === 'submitting'} onClick={close} className="text-sm font-semibold text-gray-600 hover:text-black"><SiteText copyKey="site.components.profile.voucherusebuttons.6c14bd7f6f9e" /></button>
        </div>
        <form onSubmit={(event) => { event.preventDefault(); void handleUse(); }} className="space-y-3">
          <label className="block space-y-1 text-sm text-gray-600"><SiteText copyKey="site.components.profile.voucherusebuttons.1ec62b6f4968" /><input value={target} disabled={confirmation.locked} onChange={(event) => { confirmation.controller.invalidate(); setTarget(event.target.value); }} placeholder={siteCopy("site.components.profile.voucherusebuttons.defcd75a1443")} className="w-full rounded-lg border border-black/10 bg-gray-50 px-3 py-2 text-sm text-[#171717] focus:outline-none focus:ring-1 focus:ring-[#5c43a3]" />
          </label>
          {confirmation.lookingUp && <p className="text-xs text-gray-500"><SiteText copyKey="site.components.profile.voucherusebuttons.83e8ed097ae9" /></p>}
          {confirmation.state.phase === 'error' ? <button type="button" onClick={() => void confirmation.lookup()} className={ghostBtn}><SiteText copyKey="site.components.profile.voucherusebuttons.ad5c0ece8720" /></button> : null}
          <TargetConfirmationCard confirmation={confirmation.confirmation} />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={close} disabled={confirmation.state.phase === 'submitting'} className={ghostBtn}><SiteText copyKey="site.components.profile.voucherusebuttons.6c14bd7f6f9e" /></button>
            <button type="button" onClick={() => void handleUse()} disabled={!confirmation.ready} className={primaryBtn}>{confirmation.state.phase === 'submitting' ? <SiteText copyKey="site.components.profile.voucherusebuttons.18f6eb88eef5" /> : <SiteText copyKey="site.components.profile.voucherusebuttons.19b6a1bf9fca" />}</button>
          </div>
          {confirmation.state.message ? <p role="status" className="text-sm text-rose-600">{confirmation.state.message}</p> : null}
        </form>
      </div>
    </div> : null}
  </>;
}

export function CommissionVoucherButton(props: Props) { return <DirectedVoucherButton {...props} successText="使用成功，生效期 30 天" />; }
export function FlowVoucherButton(props: Props) { return <DirectedVoucherButton {...props} successText="使用成功，新增 5000 流水额度，独立有效 30 天；旧额度不延期" />; }
export function SpendVoucherButton(props: Props) { return <DirectedVoucherButton {...props} successText="使用成功，新增 5000 消费额度，独立有效 30 天；旧额度不延期" />; }

export function PeiwanReviewVoucherButton({ prizeName, lotteryId, couponId }: Props) {
  const siteCopy = useSiteCopy();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [targetKeyword, setTargetKeyword] = useState('');
  const [searchResults, setSearchResults] = useState<PeiwanSearchItem[]>([]);
  const [targetResult, setTargetResult] = useState<PeiwanSearchItem | null>(null);
  const [reviewText, setReviewText] = useState('');
  const searchGeneration = useRef(0);
  const confirmation = useTargetConfirmation({ purpose: 'voucher', target: targetResult?.discordUserId ?? '', prizeName, lotteryId, couponId }, { autoLookup: open && Boolean(targetResult) });
  const [searchAttempt, setSearchAttempt] = useState(0);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const closeAll = () => {
    if (confirmation.locked) { setOpen(false); return; }
    searchGeneration.current += 1;
    confirmation.controller.invalidate();
    setOpen(false);
    setTargetKeyword('');
    setSearchResults([]);
    setTargetResult(null);
    setReviewText('');
    setError(null);
    setSearching(false);
  };

  useEffect(() => {
    const keyword = targetKeyword.trim();
    if (!open || !keyword || confirmation.locked) return;
    const generation = ++searchGeneration.current;
    const abort = new AbortController();
    setSearching(true);
    setError(null);
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const res = await fetch(`/api/profile/peiwan-search?keyword=${encodeURIComponent(keyword)}`, { signal: abort.signal });
          const data = (await res.json().catch(() => ({}))) as { data?: PeiwanSearchItem[] };
          if (generation !== searchGeneration.current) return;
          const hits = Array.isArray(data.data) ? data.data : [];
          if (!res.ok || hits.length === 0) throw new PublicMessageError('未找到该陪玩，请检查陪玩ID');
          setSearchResults(hits);
          setTargetResult(hits.length === 1 ? hits[0] : null);
        } catch (err) {
          if (generation !== searchGeneration.current) return;
          setSearchResults([]); setTargetResult(null);
          setError(publicMessage(err, '查询未完成，请检查网络后重新查询。'));
        } finally {
          if (generation === searchGeneration.current) setSearching(false);
        }
      })();
    }, 350);
    return () => { clearTimeout(timer); abort.abort(); searchGeneration.current += 1; };
  }, [open, targetKeyword, searchAttempt, confirmation.locked]);

  const handleFinalConfirm = async () => {
    if (!targetResult || !reviewText.trim() || reviewText.trim().length > 500) return;
    const outcome = await confirmation.submit('/api/voucher/use', {
      prizeName, target: targetResult.discordUserId, reviewText: reviewText.trim(), lotteryId, couponId,
    });
    if (outcome.status === 'success') { closeAll(); router.refresh(); }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          setError(null);
        }}
        className={useTriggerBtn}
      ><SiteText copyKey="site.components.profile.voucherusebuttons.0e2d3a3c09c2" /></button>
      {!open && (error || confirmation.state.message) ? <p className="text-xs text-rose-500">{error || confirmation.state.message}</p> : null}

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3">
          <div role="dialog" aria-modal="true" aria-label={siteCopy("site.components.profile.voucherusebuttons.51222d16bb8f")} className="max-h-[90dvh] overflow-y-auto w-full max-w-lg rounded-xl bg-white p-4 shadow-lg space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.4em] text-gray-500"><SiteText copyKey="site.components.profile.voucherusebuttons.e8a77a40238b" /></p>
                <h3 className="text-lg font-semibold text-[#171717]"><SiteText namespace="site.lib.vouchercatalog" value={prizeName} /></h3>
              </div>
              <button
                type="button"
                onClick={closeAll}
                className="text-sm font-semibold text-gray-600 hover:text-black"
              ><SiteText copyKey="site.components.profile.voucherusebuttons.6c14bd7f6f9e" /></button>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm text-gray-600"><SiteText copyKey="site.components.profile.voucherusebuttons.0465742fe516" /></label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={targetKeyword}
                    disabled={confirmation.locked}
                    onChange={(e) => {
                      searchGeneration.current += 1;
                      setSearching(false);
                      setError(null);
                      confirmation.controller.invalidate();
                      setTargetKeyword(e.target.value);
                      setSearchResults([]);
                      setTargetResult(null);
                    }}
                    placeholder={siteCopy("site.components.profile.voucherusebuttons.892544ea486c")}
                    className="min-w-0 w-full rounded-lg border border-black/10 bg-gray-50 px-3 py-2 text-sm text-[#171717] focus:outline-none focus:ring-1 focus:ring-[#5c43a3]"
                  />
                </div>
                {searching && <p className="text-xs text-gray-500"><SiteText copyKey="site.components.profile.voucherusebuttons.d6e52550e701" /></p>}
                {error && !confirmation.locked ? <button type="button" disabled={searching} onClick={() => { confirmation.controller.invalidate(); setSearchAttempt(value => value + 1); }} className={ghostBtn}><SiteText copyKey="site.components.profile.voucherusebuttons.72073749ded7" /></button> : null}
                {searchResults.length > 0 ? (
                  <div className="max-h-40 overflow-auto rounded-lg border border-black/10 bg-white">
                    {searchResults.map((item) => {
                      const active = targetResult?.discordUserId === item.discordUserId;
                      return (
                        <button
                          key={`${item.id}:${item.discordUserId}`}
                          type="button"
                          disabled={confirmation.locked}
                          onClick={() => { confirmation.controller.invalidate(); setTargetResult(item); }}
                          className={`w-full px-3 py-2 text-left text-xs border-b border-black/5 last:border-b-0 ${
                            active ? 'bg-[#f1edff] text-[#5c43a3]' : 'hover:bg-black/5 text-gray-700'
                          }`}
                        >
                          {item.serverDisplayName}<SiteText copyKey="site.components.profile.voucherusebuttons.2dcf41705102" />{item.id} / {item.discordUserId}）
                        </button>
                      );
                    })}
                  </div>
                ) : null}
                {targetResult ? (
                  <p className="text-xs text-emerald-600"><SiteText copyKey="site.components.profile.voucherusebuttons.9c5605840c67" />{targetResult.serverDisplayName}<SiteText copyKey="site.components.profile.voucherusebuttons.d5016b9e6b3f" />{targetResult.id}）
                  </p>
                ) : null}
              </div>

              <div className="space-y-2">
                <label className="text-sm text-gray-600"><SiteText copyKey="site.components.profile.voucherusebuttons.0c17d34b62a3" /></label>
                <textarea
                  value={reviewText}
                  disabled={confirmation.locked}
                  onChange={(e) => setReviewText(e.target.value)}
                  maxLength={500}
                  rows={4}
                  placeholder={siteCopy("site.components.profile.voucherusebuttons.b7ec87b86f7c")}
                  className="min-w-0 w-full rounded-lg border border-black/10 bg-gray-50 px-3 py-2 text-sm text-[#171717] focus:outline-none focus:ring-1 focus:ring-[#5c43a3]"
                />
                <p className="text-xs text-gray-400"><SiteText copyKey="site.components.profile.voucherusebuttons.5f4a3eeae24f" /></p>
              </div>
            </div>

            {confirmation.lookingUp ? <p role="status" className="text-xs text-gray-500"><SiteText copyKey="site.components.profile.voucherusebuttons.4173b1450922" /></p> : null}
            <TargetConfirmationCard confirmation={confirmation.confirmation} />
            {confirmation.state.phase === 'error' ? <button type="button" onClick={() => void confirmation.lookup()} className={ghostBtn}><SiteText copyKey="site.components.profile.voucherusebuttons.cb349e361949" /></button> : null}
            {targetResult && <p className="text-xs text-gray-500"><SiteText copyKey="site.components.profile.voucherusebuttons.3f9246ebc904" values={{ displayName: targetResult.serverDisplayName, reviewText: reviewText.trim() }} /></p>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={closeAll} className={ghostBtn}><SiteText copyKey="site.components.profile.voucherusebuttons.6c14bd7f6f9e" /></button>
              <button type="button" onClick={() => void handleFinalConfirm()} disabled={!confirmation.ready || searching || !reviewText.trim() || reviewText.trim().length > 500} className={primaryBtn}>
                {confirmation.state.phase === 'submitting' ? <SiteText copyKey="site.components.profile.voucherusebuttons.17e519c5a6bd" /> : <SiteText copyKey="site.components.profile.voucherusebuttons.13bf67032d4c" />}
              </button>
            </div>
            {error || confirmation.state.message ? <p role="status" className="text-sm text-rose-500">{error || confirmation.state.message}</p> : null}
          </div>
        </div>
      ) : null}

    </>
  );
}
