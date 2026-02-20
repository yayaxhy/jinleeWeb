'use client';

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
      if (!res.ok) throw new Error(typeof data?.error === 'string' ? data.error : '使用失败');
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
      >
        使用
      </button>
      {error ? <p className="text-xs text-rose-500">{error}</p> : null}

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3">
          <div className="w-full max-w-md rounded-xl bg-white p-4 shadow-lg space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.4em] text-gray-500">使用礼物券</p>
                <h3 className="text-lg font-semibold text-[#171717]">{prizeName}</h3>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-sm font-semibold text-gray-600 hover:text-black"
              >
                关闭
              </button>
            </div>
            <p className="text-sm text-gray-600">确认使用这张礼物券吗？</p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setOpen(false)} className={ghostBtn}>
                取消
              </button>
              <button type="button" onClick={() => void handleUse()} disabled={loading} className={primaryBtn}>
                {loading ? '使用中…' : '确认使用'}
              </button>
            </div>
            {error ? <p className="text-sm text-rose-500">{error}</p> : null}
          </div>
        </div>
      ) : null}
    </>
  );
}

export function CommissionVoucherButton({ prizeName, lotteryId, couponId }: Props) {
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
      if (!res.ok) throw new Error(typeof data?.error === 'string' ? data.error : '使用失败');
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
      >
        使用
      </button>
      {msg && !open ? (
        <p className={`text-xs ${msg.startsWith('使用成功') ? 'text-emerald-600' : 'text-rose-500'}`}>
          {msg}
        </p>
      ) : null}
      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3">
          <div className="w-full max-w-md rounded-xl bg-white p-4 shadow-lg space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.4em] text-gray-500">使用优惠券</p>
                <h3 className="text-lg font-semibold text-[#171717]">{prizeName}</h3>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-sm font-semibold text-gray-600 hover:text-black"
              >
                关闭
              </button>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-sm text-gray-600">陪玩ID 或 Discord ID</label>
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
                  placeholder="如 51111 或 525770714574225408"
                  className="w-full rounded-lg border border-black/10 bg-gray-50 px-3 py-2 text-sm text-[#171717] focus:outline-none focus:ring-1 focus:ring-[#5c43a3]"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setOpen(false)} className={ghostBtn}>
                  取消
                </button>
                <button type="button" onClick={() => void handleUse()} disabled={loading} className={primaryBtn}>
                  {loading ? '使用中…' : '确认使用'}
                </button>
              </div>
              {msg ? (
                <p className={`text-sm ${msg.startsWith('使用成功') ? 'text-emerald-600' : 'text-rose-500'}`}>
                  {msg}
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
      if (!res.ok) throw new Error(typeof data?.error === 'string' ? data.error : '使用失败');
      setMsg('使用成功，额度累计+续期 30 天');
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
      >
        使用
      </button>
      {msg && !open ? (
        <p className={`text-xs ${msg.startsWith('使用成功') ? 'text-emerald-600' : 'text-rose-500'}`}>
          {msg}
        </p>
      ) : null}
      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3">
          <div className="w-full max-w-md rounded-xl bg-white p-4 shadow-lg space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.4em] text-gray-500">使用优惠券</p>
                <h3 className="text-lg font-semibold text-[#171717]">{prizeName}</h3>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-sm font-semibold text-gray-600 hover:text-black"
              >
                关闭
              </button>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-sm text-gray-600">陪玩ID 或 Discord ID</label>
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
                  placeholder="如 51111 或 525770714574225408"
                  className="w-full rounded-lg border border-black/10 bg-gray-50 px-3 py-2 text-sm text-[#171717] focus:outline-none focus:ring-1 focus:ring-[#5c43a3]"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setOpen(false)} className={ghostBtn}>
                  取消
                </button>
                <button type="button" onClick={() => void handleUse()} disabled={loading} className={primaryBtn}>
                  {loading ? '使用中…' : '确认使用'}
                </button>
              </div>
              {msg ? (
                <p className={`text-sm ${msg.startsWith('使用成功') ? 'text-emerald-600' : 'text-rose-500'}`}>
                  {msg}
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
      if (!res.ok) throw new Error(typeof data?.error === 'string' ? data.error : '使用失败');
      setMsg('使用成功，消费统计额度+续期 30 天');
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
      >
        使用
      </button>
      {msg && !open ? (
        <p className={`text-xs ${msg.startsWith('使用成功') ? 'text-emerald-600' : 'text-rose-500'}`}>
          {msg}
        </p>
      ) : null}
      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3">
          <div className="w-full max-w-md rounded-xl bg-white p-4 shadow-lg space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.4em] text-gray-500">使用优惠券</p>
                <h3 className="text-lg font-semibold text-[#171717]">{prizeName}</h3>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-sm font-semibold text-gray-600 hover:text-black"
              >
                关闭
              </button>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-sm text-gray-600">陪玩ID 或 Discord ID</label>
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
                  placeholder="如 51111 或 525770714574225408"
                  className="w-full rounded-lg border border-black/10 bg-gray-50 px-3 py-2 text-sm text-[#171717] focus:outline-none focus:ring-1 focus:ring-[#5c43a3]"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setOpen(false)} className={ghostBtn}>
                  取消
                </button>
                <button type="button" onClick={() => void handleUse()} disabled={loading} className={primaryBtn}>
                  {loading ? '使用中…' : '确认使用'}
                </button>
              </div>
              {msg ? (
                <p className={`text-sm ${msg.startsWith('使用成功') ? 'text-emerald-600' : 'text-rose-500'}`}>
                  {msg}
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
      setError('请输入陪玩 ID');
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
        throw new Error('未找到该陪玩，请检查陪玩ID');
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
      setError('请先查询并选择陪玩');
      return;
    }
    const text = reviewText.trim();
    if (!text) {
      setError('请输入评语');
      return;
    }
    if (text.length > 500) {
      setError('评语最多 500 字');
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
      if (!res.ok) throw new Error(typeof data?.error === 'string' ? data.error : '使用失败');
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
      >
        使用
      </button>
      {error && !open ? <p className="text-xs text-rose-500">{error}</p> : null}

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3">
          <div className="w-full max-w-lg rounded-xl bg-white p-4 shadow-lg space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.4em] text-gray-500">使用优惠券</p>
                <h3 className="text-lg font-semibold text-[#171717]">{prizeName}</h3>
              </div>
              <button
                type="button"
                onClick={closeAll}
                className="text-sm font-semibold text-gray-600 hover:text-black"
              >
                关闭
              </button>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm text-gray-600">选择陪玩（输入陪玩ID）</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={targetKeyword}
                    onChange={(e) => {
                      setTargetKeyword(e.target.value);
                      setSearchResults([]);
                      setTargetResult(null);
                    }}
                    placeholder="输入陪玩ID / 昵称 / Discord ID"
                    className="w-full rounded-lg border border-black/10 bg-gray-50 px-3 py-2 text-sm text-[#171717] focus:outline-none focus:ring-1 focus:ring-[#5c43a3]"
                  />
                  <button type="button" onClick={() => void handleSearchPeiwan()} disabled={searching} className={ghostBtn}>
                    {searching ? '查询中' : '查询'}
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
                          {item.serverDisplayName}（陪玩ID {item.id} / {item.discordUserId}）
                        </button>
                      );
                    })}
                  </div>
                ) : null}
                {targetResult ? (
                  <p className="text-xs text-emerald-600">
                    已选择：{targetResult.serverDisplayName}（ID {targetResult.id}）
                  </p>
                ) : null}
              </div>

              <div className="space-y-2">
                <label className="text-sm text-gray-600">自定义评语</label>
                <textarea
                  value={reviewText}
                  onChange={(e) => setReviewText(e.target.value)}
                  maxLength={500}
                  rows={4}
                  placeholder="请输入你想给这位陪玩的评语"
                  className="w-full rounded-lg border border-black/10 bg-gray-50 px-3 py-2 text-sm text-[#171717] focus:outline-none focus:ring-1 focus:ring-[#5c43a3]"
                />
                <p className="text-xs text-gray-400">最多 500 字</p>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button type="button" onClick={closeAll} className={ghostBtn}>
                取消
              </button>
              <button type="button" onClick={handleOpenConfirm} className={primaryBtn}>
                下一步确认
              </button>
            </div>
            {error ? <p className="text-sm text-rose-500">{error}</p> : null}
          </div>
        </div>
      ) : null}

      {confirmOpen && targetResult ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-3">
          <div className="w-full max-w-md rounded-xl bg-white p-4 shadow-lg space-y-4">
            <h4 className="text-base font-semibold text-[#171717]">最终确认</h4>
            <p className="text-sm text-gray-700 leading-6">
              您给 {targetResult.serverDisplayName} 陪玩的评语是：
              <span className="font-semibold"> {reviewText.trim()}</span>，确认后就不能修改了噢~
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setConfirmOpen(false);
                  setOpen(true);
                }}
                disabled={loading}
                className={ghostBtn}
              >
                返回修改
              </button>
              <button
                type="button"
                onClick={() => void handleFinalConfirm()}
                disabled={loading}
                className={primaryBtn}
              >
                {loading ? '提交中…' : '确认提交'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
