'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  getRechargeResultMessage,
  parseRechargeResultOrder,
  type RechargeResultOrder,
  type RechargeResultState,
} from '@/lib/recharge-result';

const POLL_INTERVAL_MS = 4000;
const POLL_DURATION_MS = 120000;

export default function RechargeResultClient({ orderId }: { orderId: string | null }) {
  const [result, setResult] = useState<{
    state: RechargeResultState;
    order: RechargeResultOrder | null;
    pollingComplete: boolean;
  }>({ state: orderId ? 'CHECKING' : 'NOT_FOUND', order: null, pollingComplete: false });

  useEffect(() => {
    if (!orderId) return;
    const controller = new AbortController();
    const deadline = Date.now() + POLL_DURATION_MS;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const checkStatus = async () => {
      const timeout = setTimeout(() => controller.abort(), 10000);
      try {
        const response = await fetch(`/api/recharge/order/${encodeURIComponent(orderId)}`, {
          cache: 'no-store',
          signal: controller.signal,
        });
        if (stopped) return;
        if (!response.ok) {
          setResult({
            state: response.status === 401 ? 'UNAUTHORIZED' : response.status === 404 ? 'NOT_FOUND' : 'ERROR',
            order: null,
            pollingComplete: true,
          });
          return;
        }

        const payload = await response.json();
        if (stopped) return;
        const order = payload.ok ? parseRechargeResultOrder(payload.order, orderId) : null;
        if (!order) {
          setResult({ state: 'ERROR', order: null, pollingComplete: true });
          return;
        }

        const pollingComplete = order.status !== 'PENDING' || Date.now() >= deadline;
        setResult({ state: order.status, order, pollingComplete });
        if (!pollingComplete) timer = setTimeout(checkStatus, POLL_INTERVAL_MS);
      } catch {
        if (!stopped) setResult({ state: 'ERROR', order: null, pollingComplete: true });
      } finally {
        clearTimeout(timeout);
      }
    };

    void checkStatus();
    return () => {
      stopped = true;
      controller.abort();
      if (timer) clearTimeout(timer);
    };
  }, [orderId]);

  const message = getRechargeResultMessage(result.state, result.pollingComplete);
  const isChecking = result.state === 'CHECKING' || (result.state === 'PENDING' && !result.pollingComplete);
  const amount = result.order ? Number(result.order.amount) : null;

  return (
    <main className="min-h-screen bg-[#f7f3ef] px-6 py-12">
      <section className="max-w-3xl mx-auto space-y-8">
        <div className="space-y-2 text-center" aria-live="polite" aria-busy={isChecking}>
          <p className="text-xs uppercase tracking-[0.6em] text-gray-500">Recharge Result</p>
          <h1 className="text-3xl font-semibold tracking-wide">{message.title}</h1>
          <p className="text-sm text-gray-500">{message.description}</p>
        </div>

        <div className="rounded-[32px] border border-black/5 bg-white p-8 space-y-6 text-center text-sm text-gray-500">
          {result.order ? (
            <div className="space-y-3">
              <p>订单号：<span className="font-mono break-all">{result.order.id}</span></p>
              <p>
                充值金额：{amount !== null && Number.isFinite(amount)
                  ? new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' }).format(amount)
                  : result.order.amount}
              </p>
            </div>
          ) : null}

          {result.pollingComplete && result.state !== 'PAID' ? (
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-full border border-black/10 px-5 py-2 hover:bg-black/5 transition"
            >
              重新查询状态
            </button>
          ) : null}

          <div className="flex flex-wrap gap-3 pt-2">
            <Link href="/recharge" className="flex-1 rounded-full border border-black/10 px-5 py-2 text-xs uppercase tracking-[0.4em] hover:bg-black/5 transition">
              返回充值
            </Link>
            <Link href="/kefu" className="flex-1 rounded-full border border-black/10 px-5 py-2 text-xs uppercase tracking-[0.4em] hover:bg-black/5 transition">
              联系客服
            </Link>
            <Link href="/profile" className="flex-1 rounded-full bg-black px-5 py-2 text-xs uppercase tracking-[0.4em] text-white hover:bg-black/80 transition">
              查看余额
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
