'use client';
import { SiteText, useSiteCopy } from "@/components/SiteCopyProvider";


import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

type DiscountKind = 'coupon' | 'lottery';

type DiscountableOrder = {
  id: string;
  displayNo: number;
  workerId: string;
  totalMinutes: number | null;
  totalAmount?: string;
  endedAt: string | Date | null;
};

type Props = {
  kind: DiscountKind;
  triggerLabel?: string;
  lotteryId?: string;
  couponId?: string;
};

const ROME_TIMEZONE = 'Europe/Rome';

const formatDateOnly = (value?: Date | string | null) => {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleDateString('zh-CN', { timeZone: ROME_TIMEZONE });
};

export function DiscountUsageButton({ kind, triggerLabel = '使用', lotteryId, couponId }: Props) {
  const siteCopy = useSiteCopy();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [orders, setOrders] = useState<DiscountableOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadOrders = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch('/api/orders/discountable');
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof data?.error === 'string' ? data.error : siteCopy("site.components.profile.discountusagebutton.ee1007d862d0"));
      }
      setOrders(Array.isArray(data?.orders) ? data.orders : []);
    } catch (error) {
      setMessage({ type: 'error', text: (error as Error).message });
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      void loadOrders();
    }
  }, [open]);

  const applyDiscount = async (orderId: string) => {
    setSubmittingId(orderId);
    setMessage(null);
    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(orderId)}/discount`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, lotteryId, couponId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof data?.error === 'string' ? data.error : siteCopy("site.components.profile.discountusagebutton.d5f9ad7f1e7e"));
      }
      const amountText = typeof data?.amount === 'string' ? data.amount : '';
      setMessage({ type: 'success', text: siteCopy("site.components.profile.discountusagebutton.04501864a9f0", {value1: String(amountText)}) });
      setOpen(false);
      router.refresh();
    } catch (error) {
      setMessage({ type: 'error', text: (error as Error).message });
    } finally {
      setSubmittingId(null);
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
        className="rounded-full border border-[#f4c542] bg-[#fff8dd] px-4 py-2 text-xs font-semibold text-[#8a6300] hover:bg-[#ffefb8] transition-colors"
      >
        {triggerLabel}
      </button>
      {message && !open ? (
        <p className={`mt-1 text-xs ${message.type === 'success' ? 'text-emerald-600' : 'text-rose-500'}`}>
          {message.text}
        </p>
      ) : null}

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3">
          <div className="w-full max-w-xl rounded-xl bg-white p-4 shadow-lg space-y-3 max-h-[70vh] overflow-hidden">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.4em] text-gray-500"><SiteText copyKey="site.components.profile.discountusagebutton.dfa98e0d9550" /></p>
                <h3 className="text-xl font-semibold text-[#171717]"><SiteText copyKey="site.components.profile.discountusagebutton.78faaba28e37" /></h3>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-sm font-semibold text-gray-600 hover:text-black"
              ><SiteText copyKey="site.components.profile.discountusagebutton.6c14bd7f6f9e" /></button>
            </div>

            <div className="max-h-[55vh] overflow-y-auto space-y-3 pr-1">
              {message ? (
                <p
                  className={`text-sm ${
                    message.type === 'success' ? 'text-emerald-600' : 'text-rose-500'
                  }`}
                >
                  {message.text}
                </p>
              ) : null}

              {loading ? (
                <p className="text-sm text-gray-500"><SiteText copyKey="site.components.profile.discountusagebutton.300ee3dee4dc" /></p>
              ) : orders.length === 0 ? (
                <p className="text-sm text-gray-500"><SiteText copyKey="site.components.profile.discountusagebutton.660de67d6e75" /></p>
              ) : (
                <div className="grid gap-2">
                  {orders.map((order) => (
                    <div
                      key={order.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-black/10 bg-gray-50 px-3 py-2"
                    >
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-[#171717]"><SiteText copyKey="site.components.profile.discountusagebutton.17bb9d37b41d" />{order.displayNo ?? order.id}
                        </p>
                        <p className="text-xs text-gray-500"><SiteText copyKey="site.components.profile.discountusagebutton.70c5b46f5522" />{order.totalMinutes ?? '—'}<SiteText copyKey="site.components.profile.discountusagebutton.b59d2d5a815f" />{order.totalAmount ?? '—'}
                        </p>
                        <p className="text-xs text-gray-500"><SiteText copyKey="site.components.profile.discountusagebutton.54b36e7d4693" />{formatDateOnly(order.endedAt)}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => void applyDiscount(order.id)}
                        disabled={!!submittingId}
                        className="rounded-full bg-[#f4c542] px-4 py-2 text-xs font-semibold text-[#3d2c00] hover:bg-[#ffd45b] disabled:opacity-50 transition-colors"
                      >
                        {submittingId === order.id ? <SiteText copyKey="site.components.profile.discountusagebutton.17e519c5a6bd" /> : <SiteText copyKey="site.components.profile.discountusagebutton.c11fbf173961" />}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
