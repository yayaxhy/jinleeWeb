'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

type DiscountKind = 'coupon' | 'lottery';

type DiscountableOrder = {
  id: string;
  displayNo: number;
  workerId: string;
  unitPrice: string;
  totalMinutes: number | null;
  endedAt: string | Date | null;
};

type Props = {
  kind: DiscountKind;
  triggerLabel?: string;
};

const formatDateOnly = (value?: Date | string | null) => {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('zh-CN');
};

export function DiscountUsageButton({ kind, triggerLabel = '使用' }: Props) {
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
        throw new Error(typeof data?.error === 'string' ? data.error : '加载订单失败');
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
        body: JSON.stringify({ kind }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof data?.error === 'string' ? data.error : '使用失败');
      }
      const amountText = typeof data?.amount === 'string' ? data.amount : '';
      setMessage({ type: 'success', text: `已优惠 ${amountText} 元，返还至余额` });
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
        onClick={() => setOpen(true)}
        className="rounded-full border border-[#5c43a3] px-4 py-2 text-xs font-semibold text-[#5c43a3] hover:bg-[#5c43a3]/10 transition"
      >
        {triggerLabel}
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3">
          <div className="w-full max-w-xl rounded-xl bg-white p-4 shadow-lg space-y-3 max-h-[70vh] overflow-hidden">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.4em] text-gray-500">选择订单</p>
                <h3 className="text-xl font-semibold text-[#171717]">请选择要使用优惠的订单</h3>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-sm font-semibold text-gray-600 hover:text-black"
              >
                关闭
              </button>
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
                <p className="text-sm text-gray-500">加载中…</p>
              ) : orders.length === 0 ? (
                <p className="text-sm text-gray-500">没有可用的已结单订单。</p>
              ) : (
                <div className="grid gap-2">
                  {orders.map((order) => (
                    <div
                      key={order.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-black/10 bg-gray-50 px-3 py-2"
                    >
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-[#171717]">
                          订单 #{order.displayNo ?? order.id}
                        </p>
                        <p className="text-xs text-gray-500">
                          时长：{order.totalMinutes ?? '—'} 分 · 单价：{order.unitPrice}
                        </p>
                        <p className="text-xs text-gray-500">结单：{formatDateOnly(order.endedAt)}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => void applyDiscount(order.id)}
                        disabled={!!submittingId}
                        className="rounded-full bg-[#5c43a3] px-4 py-2 text-xs font-semibold text-white hover:bg-[#4a3388] disabled:opacity-50"
                      >
                        {submittingId === order.id ? '提交中…' : '用在此单'}
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
