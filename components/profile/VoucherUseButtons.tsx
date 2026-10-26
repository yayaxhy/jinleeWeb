'use client';
import { SiteText, useSiteCopy } from "@/components/SiteCopyProvider";


import { useState } from 'react';
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
  const siteCopy = useSiteCopy();
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
      if (!res.ok) throw new Error(typeof data?.error === 'string' ? data.error : siteCopy("site.components.profile.voucherusebuttons.d5f9ad7f1e7e"));
      // 成功后直接关闭弹窗并刷新，不保留提示
      setError(null);
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
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

export function CommissionVoucherButton({ prizeName, lotteryId, couponId }: Props) {
  const siteCopy = useSiteCopy();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const handleUse = async () => {
    if (!target.trim()) {
      setMsg('请输入陪玩ID或Discord ID');
      return;
    }
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch('/api/voucher/use', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prizeName, target, lotteryId, couponId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data?.error === 'string' ? data.error : siteCopy("site.components.profile.voucherusebuttons.d5f9ad7f1e7e"));
      setMsg('使用成功，生效期 30 天');
      setOpen(false);
      setTarget('');
      router.refresh();
    } catch (err) {
      setMsg((err as Error).message);
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
          setMsg(null);
        }}
        className={useTriggerBtn}
      ><SiteText copyKey="site.components.profile.voucherusebuttons.0e2d3a3c09c2" /></button>
      {msg && !open ? (
        <p className={`text-xs ${msg.startsWith('使用成功') ? 'text-emerald-600' : 'text-rose-500'}`}>
          <SiteText namespace="site.components.profile.voucherusebuttons" value={msg} />
        </p>
      ) : null}
      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3">
          <div className="w-full max-w-md rounded-xl bg-white p-4 shadow-lg space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.4em] text-gray-500"><SiteText copyKey="site.components.profile.voucherusebuttons.e8a77a40238b" /></p>
                <h3 className="text-lg font-semibold text-[#171717]"><SiteText namespace="site.lib.vouchercatalog" value={prizeName} /></h3>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-sm font-semibold text-gray-600 hover:text-black"
              ><SiteText copyKey="site.components.profile.voucherusebuttons.6c14bd7f6f9e" /></button>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-sm text-gray-600"><SiteText copyKey="site.components.profile.voucherusebuttons.60cdc1cdcd70" /></label>
                <input
                  type="text"
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      void handleUse();
                    }
                  }}
                  placeholder={siteCopy("site.components.profile.voucherusebuttons.defcd75a1443")}
                  className="w-full rounded-lg border border-black/10 bg-gray-50 px-3 py-2 text-sm text-[#171717] focus:outline-none focus:ring-1 focus:ring-[#5c43a3]"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setOpen(false)} className={ghostBtn}><SiteText copyKey="site.components.profile.voucherusebuttons.4d0b4688c787" /></button>
                <button type="button" onClick={() => void handleUse()} disabled={loading} className={primaryBtn}>
                  {loading ? <SiteText copyKey="site.components.profile.voucherusebuttons.18f6eb88eef5" /> : <SiteText copyKey="site.components.profile.voucherusebuttons.19b6a1bf9fca" />}
                </button>
              </div>
              {msg ? (
                <p className={`text-sm ${msg.startsWith('使用成功') ? 'text-emerald-600' : 'text-rose-500'}`}>
                  <SiteText namespace="site.components.profile.voucherusebuttons" value={msg} />
                </p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

export function FlowVoucherButton({ prizeName, lotteryId, couponId }: Props) {
  const siteCopy = useSiteCopy();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const handleUse = async () => {
    if (!target.trim()) {
      setMsg('请输入陪玩ID或Discord ID');
      return;
    }
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch('/api/voucher/use', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prizeName, target, lotteryId, couponId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data?.error === 'string' ? data.error : siteCopy("site.components.profile.voucherusebuttons.d5f9ad7f1e7e"));
      setMsg('使用成功');
      setOpen(false);
      setTarget('');
      router.refresh();
    } catch (err) {
      setMsg((err as Error).message);
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
          setMsg(null);
        }}
        className={useTriggerBtn}
      ><SiteText copyKey="site.components.profile.voucherusebuttons.0e2d3a3c09c2" /></button>
      {msg && !open ? (
        <p className={`text-xs ${msg.startsWith('使用成功') ? 'text-emerald-600' : 'text-rose-500'}`}>
          <SiteText namespace="site.components.profile.voucherusebuttons" value={msg} />
        </p>
      ) : null}
      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3">
          <div className="w-full max-w-md rounded-xl bg-white p-4 shadow-lg space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.4em] text-gray-500"><SiteText copyKey="site.components.profile.voucherusebuttons.e8a77a40238b" /></p>
                <h3 className="text-lg font-semibold text-[#171717]"><SiteText namespace="site.lib.vouchercatalog" value={prizeName} /></h3>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-sm font-semibold text-gray-600 hover:text-black"
              ><SiteText copyKey="site.components.profile.voucherusebuttons.6c14bd7f6f9e" /></button>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-sm text-gray-600"><SiteText copyKey="site.components.profile.voucherusebuttons.60cdc1cdcd70" /></label>
                <input
                  type="text"
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      void handleUse();
                    }
                  }}
                  placeholder={siteCopy("site.components.profile.voucherusebuttons.defcd75a1443")}
                  className="w-full rounded-lg border border-black/10 bg-gray-50 px-3 py-2 text-sm text-[#171717] focus:outline-none focus:ring-1 focus:ring-[#5c43a3]"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setOpen(false)} className={ghostBtn}><SiteText copyKey="site.components.profile.voucherusebuttons.4d0b4688c787" /></button>
                <button type="button" onClick={() => void handleUse()} disabled={loading} className={primaryBtn}>
                  {loading ? <SiteText copyKey="site.components.profile.voucherusebuttons.18f6eb88eef5" /> : <SiteText copyKey="site.components.profile.voucherusebuttons.19b6a1bf9fca" />}
                </button>
              </div>
              {msg ? (
                <p className={`text-sm ${msg.startsWith('使用成功') ? 'text-emerald-600' : 'text-rose-500'}`}>
                  <SiteText namespace="site.components.profile.voucherusebuttons" value={msg} />
                </p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

export function SpendVoucherButton({ prizeName, lotteryId, couponId }: Props) {
  const siteCopy = useSiteCopy();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const handleUse = async () => {
    if (!target.trim()) {
      setMsg('请输入陪玩ID或Discord ID');
      return;
    }
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch('/api/voucher/use', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prizeName, target, lotteryId, couponId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data?.error === 'string' ? data.error : siteCopy("site.components.profile.voucherusebuttons.d5f9ad7f1e7e"));
      setMsg('使用成功');
      setOpen(false);
      setTarget('');
      router.refresh();
    } catch (err) {
      setMsg((err as Error).message);
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
          setMsg(null);
        }}
        className={useTriggerBtn}
      ><SiteText copyKey="site.components.profile.voucherusebuttons.0e2d3a3c09c2" /></button>
      {msg && !open ? (
        <p className={`text-xs ${msg.startsWith('使用成功') ? 'text-emerald-600' : 'text-rose-500'}`}>
          <SiteText namespace="site.components.profile.voucherusebuttons" value={msg} />
        </p>
      ) : null}
      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3">
          <div className="w-full max-w-md rounded-xl bg-white p-4 shadow-lg space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.4em] text-gray-500"><SiteText copyKey="site.components.profile.voucherusebuttons.e8a77a40238b" /></p>
                <h3 className="text-lg font-semibold text-[#171717]"><SiteText namespace="site.lib.vouchercatalog" value={prizeName} /></h3>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-sm font-semibold text-gray-600 hover:text-black"
              ><SiteText copyKey="site.components.profile.voucherusebuttons.6c14bd7f6f9e" /></button>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-sm text-gray-600"><SiteText copyKey="site.components.profile.voucherusebuttons.60cdc1cdcd70" /></label>
                <input
                  type="text"
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      void handleUse();
                    }
                  }}
                  placeholder={siteCopy("site.components.profile.voucherusebuttons.defcd75a1443")}
                  className="w-full rounded-lg border border-black/10 bg-gray-50 px-3 py-2 text-sm text-[#171717] focus:outline-none focus:ring-1 focus:ring-[#5c43a3]"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setOpen(false)} className={ghostBtn}><SiteText copyKey="site.components.profile.voucherusebuttons.4d0b4688c787" /></button>
                <button type="button" onClick={() => void handleUse()} disabled={loading} className={primaryBtn}>
                  {loading ? <SiteText copyKey="site.components.profile.voucherusebuttons.18f6eb88eef5" /> : <SiteText copyKey="site.components.profile.voucherusebuttons.19b6a1bf9fca" />}
                </button>
              </div>
              {msg ? (
                <p className={`text-sm ${msg.startsWith('使用成功') ? 'text-emerald-600' : 'text-rose-500'}`}>
                  <SiteText namespace="site.components.profile.voucherusebuttons" value={msg} />
                </p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

export function PeiwanReviewVoucherButton({ prizeName, lotteryId, couponId }: Props) {
  const siteCopy = useSiteCopy();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [targetKeyword, setTargetKeyword] = useState('');
  const [searchResults, setSearchResults] = useState<PeiwanSearchItem[]>([]);
  const [targetResult, setTargetResult] = useState<PeiwanSearchItem | null>(null);
  const [reviewText, setReviewText] = useState('');
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const closeAll = () => {
    setOpen(false);
    setConfirmOpen(false);
    setTargetKeyword('');
    setSearchResults([]);
    setTargetResult(null);
    setReviewText('');
    setError(null);
    setLoading(false);
    setSearching(false);
  };

  const handleSearchPeiwan = async () => {
    const keyword = targetKeyword.trim();
    if (!keyword) {
      setError(siteCopy("site.components.profile.voucherusebuttons.94f71f82e132"));
      return;
    }
    setSearching(true);
    setError(null);
    try {
      const res = await fetch(`/api/profile/peiwan-search?keyword=${encodeURIComponent(keyword)}`, {
        method: 'GET',
      });
      const data = (await res.json().catch(() => ({}))) as { data?: PeiwanSearchItem[] };
      const hits = Array.isArray(data?.data) ? data.data : [];
      if (!res.ok || hits.length === 0) {
        throw new Error(siteCopy("site.components.profile.voucherusebuttons.bf6b201a002f"));
      }
      setSearchResults(hits);
      setTargetResult(hits[0] ?? null);
    } catch (err) {
      setSearchResults([]);
      setTargetResult(null);
      setError((err as Error).message);
    } finally {
      setSearching(false);
    }
  };

  const handleOpenConfirm = () => {
    if (!targetResult) {
      setError(siteCopy("site.components.profile.voucherusebuttons.71cfbe4c3806"));
      return;
    }
    const text = reviewText.trim();
    if (!text) {
      setError(siteCopy("site.components.profile.voucherusebuttons.1a976d91e7fd"));
      return;
    }
    if (text.length > 500) {
      setError(siteCopy("site.components.profile.voucherusebuttons.1cb97fdd4512"));
      return;
    }
    setError(null);
    setOpen(false);
    setConfirmOpen(true);
  };

  const handleFinalConfirm = async () => {
    if (!targetResult) return;
    const text = reviewText.trim();
    if (!text) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/voucher/use', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prizeName,
          target: targetResult.discordUserId,
          reviewText: text,
          lotteryId,
          couponId,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data?.error === 'string' ? data.error : siteCopy("site.components.profile.voucherusebuttons.d5f9ad7f1e7e"));
      closeAll();
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setConfirmOpen(false);
      setOpen(true);
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
          setConfirmOpen(false);
          setError(null);
        }}
        className={useTriggerBtn}
      ><SiteText copyKey="site.components.profile.voucherusebuttons.0e2d3a3c09c2" /></button>
      {error && !open ? <p className="text-xs text-rose-500"><SiteText namespace="site.components.profile.voucherusebuttons" value={error} /></p> : null}

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3">
          <div className="w-full max-w-lg rounded-xl bg-white p-4 shadow-lg space-y-4">
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
                <label className="text-sm text-gray-600"><SiteText copyKey="site.components.profile.voucherusebuttons.f4b21d7254e3" /></label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={targetKeyword}
                    onChange={(e) => {
                      setTargetKeyword(e.target.value);
                      setSearchResults([]);
                      setTargetResult(null);
                    }}
                    placeholder={siteCopy("site.components.profile.voucherusebuttons.892544ea486c")}
                    className="w-full rounded-lg border border-black/10 bg-gray-50 px-3 py-2 text-sm text-[#171717] focus:outline-none focus:ring-1 focus:ring-[#5c43a3]"
                  />
                  <button type="button" onClick={() => void handleSearchPeiwan()} disabled={searching} className={ghostBtn}>
                    {searching ? <SiteText copyKey="site.components.profile.voucherusebuttons.76f9eb5e90a5" /> : <SiteText copyKey="site.components.profile.voucherusebuttons.711363c42474" />}
                  </button>
                </div>
                {searchResults.length > 0 ? (
                  <div className="max-h-40 overflow-auto rounded-lg border border-black/10 bg-white">
                    {searchResults.map((item) => {
                      const active = targetResult?.discordUserId === item.discordUserId;
                      return (
                        <button
                          key={`${item.id}:${item.discordUserId}`}
                          type="button"
                          onClick={() => setTargetResult(item)}
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
                  onChange={(e) => setReviewText(e.target.value)}
                  maxLength={500}
                  rows={4}
                  placeholder={siteCopy("site.components.profile.voucherusebuttons.b7ec87b86f7c")}
                  className="w-full rounded-lg border border-black/10 bg-gray-50 px-3 py-2 text-sm text-[#171717] focus:outline-none focus:ring-1 focus:ring-[#5c43a3]"
                />
                <p className="text-xs text-gray-400"><SiteText copyKey="site.components.profile.voucherusebuttons.5f4a3eeae24f" /></p>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button type="button" onClick={closeAll} className={ghostBtn}><SiteText copyKey="site.components.profile.voucherusebuttons.4d0b4688c787" /></button>
              <button type="button" onClick={handleOpenConfirm} className={primaryBtn}><SiteText copyKey="site.components.profile.voucherusebuttons.51622365ee40" /></button>
            </div>
            {error ? <p className="text-sm text-rose-500"><SiteText namespace="site.components.profile.voucherusebuttons" value={error} /></p> : null}
          </div>
        </div>
      ) : null}

      {confirmOpen && targetResult ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-3">
          <div className="w-full max-w-md rounded-xl bg-white p-4 shadow-lg space-y-4">
            <h4 className="text-base font-semibold text-[#171717]"><SiteText copyKey="site.components.profile.voucherusebuttons.a2692f976e7f" /></h4>
            <p className="text-sm text-gray-700 leading-6"><SiteText copyKey="site.components.profile.voucherusebuttons.b4df64d00ce6" />{targetResult.serverDisplayName}<SiteText copyKey="site.components.profile.voucherusebuttons.3a973174c15d" /><span className="font-semibold"> {reviewText.trim()}</span><SiteText copyKey="site.components.profile.voucherusebuttons.5cdf189b4408" /></p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setConfirmOpen(false);
                  setOpen(true);
                }}
                disabled={loading}
                className={ghostBtn}
              ><SiteText copyKey="site.components.profile.voucherusebuttons.9a233f23b4ec" /></button>
              <button
                type="button"
                onClick={() => void handleFinalConfirm()}
                disabled={loading}
                className={primaryBtn}
              >
                {loading ? <SiteText copyKey="site.components.profile.voucherusebuttons.17e519c5a6bd" /> : <SiteText copyKey="site.components.profile.voucherusebuttons.13bf67032d4c" />}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
