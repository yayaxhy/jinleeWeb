'use client';
import { SiteText, useSiteCopy } from "@/components/SiteCopyProvider";


import { useRouter } from 'next/navigation';
import { useState } from 'react';

type Feedback = { type: 'success' | 'error'; text: string } | null;

const commonButtonClass =
  'rounded-full bg-[#f4c542] px-4 py-2 text-xs font-semibold text-[#3d2c00] hover:bg-[#ffd45b] disabled:opacity-50 transition-colors';

export function GiftUsageButton({
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
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState('');
  const [message, setMessage] = useState<Feedback>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!target.trim()) {
      setMessage({ type: 'error', text: siteCopy("site.components.profile.giftandselfusebuttons.c623c8075c5b") });
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch('/api/lottery/use', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lotteryId, couponId, mode: 'gift', target: target.trim(), prizeName }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof data?.error === 'string' ? data.error : siteCopy("site.components.profile.giftandselfusebuttons.d5f9ad7f1e7e"));
      }
      setMessage({ type: 'success', text: siteCopy("site.components.profile.giftandselfusebuttons.1c3c75d5fd79", {value1: String(prizeName)}) });
      setOpen(false);
      setTarget('');
      router.refresh();
    } catch (error) {
      setMessage({ type: 'error', text: (error as Error).message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          setMessage(null);
        }}
        className={commonButtonClass}
      ><SiteText copyKey="site.components.profile.giftandselfusebuttons.0e2d3a3c09c2" /></button>
      {message && !open ? (
        <p className={`text-xs ${message.type === 'success' ? 'text-emerald-600' : 'text-rose-500'}`}>
          {message.text}
        </p>
      ) : null}
      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3">
          <div className="w-full max-w-md rounded-xl bg-white p-4 shadow-lg space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.4em] text-gray-500"><SiteText copyKey="site.components.profile.giftandselfusebuttons.bb51b50b9ec0" /></p>
                <h3 className="text-lg font-semibold text-[#171717]"><SiteText namespace="site.lib.vouchercatalog" value={prizeName} /></h3>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-sm font-semibold text-gray-600 hover:text-black"
              ><SiteText copyKey="site.components.profile.giftandselfusebuttons.6c14bd7f6f9e" /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="space-y-1">
                <label className="text-sm text-gray-600"><SiteText copyKey="site.components.profile.giftandselfusebuttons.60cdc1cdcd70" /></label>
                <input
                  type="text"
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  placeholder={siteCopy("site.components.profile.giftandselfusebuttons.defcd75a1443")}
                  className="w-full rounded-lg border border-black/10 bg-gray-50 px-3 py-2 text-sm text-[#171717] focus:outline-none focus:ring-1 focus:ring-[#5c43a3]"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-full border border-black/10 px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-black/5"
                ><SiteText copyKey="site.components.profile.giftandselfusebuttons.4d0b4688c787" /></button>
                <button type="submit" disabled={loading} className={commonButtonClass}>
                  {loading ? <SiteText copyKey="site.components.profile.giftandselfusebuttons.17e519c5a6bd" /> : <SiteText copyKey="site.components.profile.giftandselfusebuttons.ce666e5c1f6e" />}
                </button>
              </div>
            </form>
            {message ? (
              <p
                className={`text-sm ${message.type === 'success' ? 'text-emerald-600' : 'text-rose-500'}`}
              >
                {message.text}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
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
        throw new Error(typeof data?.error === 'string' ? data.error : siteCopy("site.components.profile.giftandselfusebuttons.d5f9ad7f1e7e"));
      }
      setMessage({ type: 'success', text: siteCopy("site.components.profile.giftandselfusebuttons.004f7ff59bfb") });
      setOpen(false);
      router.refresh();
    } catch (error) {
      setMessage({ type: 'error', text: (error as Error).message });
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
