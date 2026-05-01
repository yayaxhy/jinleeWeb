"use client";

import Image from 'next/image';
import { useEffect, useState, type FormEvent } from 'react';

const AMOUNT_OPTIONS = [99, 199, 299, 399, 499, 999] as const;
const ROME_TIMEZONE = 'Europe/Rome';

type WechatNativePayClientProps = {
  username?: string | null;
};

type CreatedOrder = {
  id: string;
  payUrl: string;
  qrCodeDataUrl?: string | null;
  status: 'PENDING' | 'PAID';
  amount: string;
  channel: string;
  paidAt?: string | null;
};

const STATUS_TEXT: Record<CreatedOrder['status'], string> = {
  PENDING: '等待支付',
  PAID: '充值成功',
};

const formatCurrency = (value?: string) => {
  if (!value) return '—';
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return value;
  return new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' }).format(numeric);
};

export default function WechatNativePayClient({ username }: WechatNativePayClientProps) {
  const [amount, setAmount] = useState<string>(String(AMOUNT_OPTIONS[0]));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [order, setOrder] = useState<CreatedOrder | null>(null);

  useEffect(() => {
    if (!order || order.status === 'PAID') return;
    const timer = setInterval(async () => {
      try {
        const res = await fetch(`/api/recharge/order/${order.id}`, { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        if (data?.order?.status === 'PAID') {
          setOrder((prev) =>
            prev ? { ...prev, status: 'PAID', paidAt: data.order.paidAt ?? null } : prev,
          );
          setHint('系统已确认到账，刷新个人中心即可看到最新余额。');
        }
      } catch (pollError) {
        console.error('[wechat.native.pay] poll error', pollError);
      }
    }, 4000);
    return () => clearInterval(timer);
  }, [order]);

  const createOrder = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setHint(null);
    try {
      const response = await fetch('/api/wechat/pay/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: Number(amount) }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error ?? '下单失败，请稍后再试');
      }
      setOrder({
        id: payload.orderId,
        payUrl: payload.payUrl,
        qrCodeDataUrl: payload.qrCodeDataUrl ?? null,
        status: 'PENDING',
        amount: payload.amount,
        channel: payload.channel,
      });
      setHint('订单已创建，请使用微信扫一扫完成支付，系统会自动更新余额。');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '创建订单失败';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const copyLink = async () => {
    if (typeof window === 'undefined' || !order?.payUrl || !navigator?.clipboard) return;
    try {
      await navigator.clipboard.writeText(order.payUrl);
      setHint('二维码链接已复制，可在其他设备中打开继续生成二维码。');
    } catch {
      setError('无法复制链接，请手动重试。');
    }
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[320px,1fr]">
      <div className="space-y-6">
        <div className="space-y-6 rounded-[32px] border border-black/5 bg-white p-6">
          <div className="space-y-3">
            <p className="text-xs uppercase tracking-[0.4em] text-gray-500">支付方式</p>
            <div className="rounded-2xl border border-black/10 bg-black/5 px-4 py-3 text-sm">
              微信扫码支付
            </div>
            
            <p className="text-xs text-gray-500">
              当前用户标识：<span className="font-mono">{username ?? '未登录'}</span>
            </p>
          </div>

          <div className="rounded-[24px] border border-black/5 bg-white p-5 text-left">
            <p className="text-xs uppercase tracking-[0.4em] text-gray-500">支付说明</p>
            <ol className="mt-3 list-inside list-decimal space-y-2 text-sm text-gray-600">
              <li>选择充值金额并创建订单。</li>
              <li>使用微信扫一扫页面二维码完成支付。</li>
              <li>支付成功后页面会自动更新到账状态。</li>
            </ol>
          </div>
        </div>
      </div>

      <form
        onSubmit={createOrder}
        className="space-y-6 rounded-[32px] border border-black/5 bg-white p-8"
      >
        <div className="space-y-3">
          <label className="text-xs uppercase tracking-[0.4em] text-gray-500">充值金额 *</label>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {AMOUNT_OPTIONS.map((value) => {
              const active = amount === String(value);
              return (
                <button
                  type="button"
                  key={value}
                  className={`rounded-2xl border px-4 py-3 text-sm font-medium transition ${
                    active
                      ? 'border-black bg-black text-white'
                      : 'border-black/10 text-gray-600 hover:border-black hover:text-black'
                  }`}
                  onClick={() => {
                    setAmount(String(value));
                    setHint(null);
                    setError(null);
                  }}
                >
                  ¥{value}
                </button>
              );
            })}
          </div>
          <p className="text-xs text-gray-500">请选择一项充值金额，暂不支持自定义金额。</p>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-full bg-black px-6 py-3 text-sm uppercase tracking-[0.4em] text-white transition hover:bg-black/80 disabled:opacity-60"
        >
          {loading ? '创建订单中…' : '生成微信二维码'}
        </button>

        {error ? <p className="text-sm text-red-500">{error}</p> : null}
        {hint ? <p className="text-sm text-emerald-600">{hint}</p> : null}

        {order ? (
          <div className="space-y-4 rounded-[24px] border border-black/5 bg-black/5 p-5">
            {order.qrCodeDataUrl ? (
              <div className="space-y-3">
                <p className="text-xs uppercase tracking-[0.4em] text-gray-500">微信扫码支付</p>
                <div className="mx-auto w-56 rounded-[28px] border border-black/10 bg-white p-4">
                  <Image
                    src={order.qrCodeDataUrl}
                    alt="微信支付二维码"
                    width={360}
                    height={360}
                    unoptimized
                    className="h-full w-full object-contain"
                  />
                </div>
                <p className="text-center text-xs text-gray-500">
                  请使用微信扫一扫完成支付，页面会自动刷新到账状态。
                </p>
              </div>
            ) : null}

            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">订单号</span>
              <span className="font-mono text-xs">{order.id}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">金额</span>
              <span className="font-semibold">{formatCurrency(order.amount)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">状态</span>
              <span className={order.status === 'PAID' ? 'text-emerald-600' : 'text-orange-500'}>
                {STATUS_TEXT[order.status]}
              </span>
            </div>
            {order.paidAt ? (
              <p className="text-xs text-gray-500">
                到账时间：
                {new Date(order.paidAt).toLocaleString('zh-CN', { timeZone: ROME_TIMEZONE })}
              </p>
            ) : (
              <p className="text-xs text-gray-500">支付完成后请耐心等待 1-2 分钟，系统会自动确认。</p>
            )}
            <div className="flex flex-wrap gap-3 pt-2">
              <button
                type="button"
                onClick={copyLink}
                className="flex-1 rounded-full border border-black/20 px-4 py-2 text-xs uppercase tracking-[0.4em] transition hover:bg-black/5"
              >
                复制二维码链接
              </button>
            </div>
          </div>
        ) : null}
      </form>
    </div>
  );
}
