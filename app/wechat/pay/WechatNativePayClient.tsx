"use client";
import { SiteText, useSiteCopy } from "@/components/SiteCopyProvider";


import { PublicMessageError, publicMessage, rechargeErrorMessage, RECHARGE_UNCONFIRMED } from '@/lib/public-error-messages';

import Image from 'next/image';
import { useEffect, useState, type FormEvent } from 'react';

const AMOUNT_OPTIONS = [100, 200, 300, 400, 500, 1000] as const;
const ROME_TIMEZONE = 'Europe/Rome';

type WechatNativePayClientProps = {
  username?: string | null;
};

type CreatedOrder = {
  id: string;
  payUrl: string;
  qrCodeDataUrl?: string | null;
  status: 'PENDING' | 'PAID' | 'FAILED';
  amount: string;
  channel: string;
  paidAt?: string | null;
  expiresAt?: string | null;
};

const STATUS_TEXT: Record<CreatedOrder['status'], string> = {
  PENDING: '等待支付',
  PAID: '充值成功',
  FAILED: '订单已关闭',
};

const formatCurrency = (value?: string) => {
  if (!value) return '—';
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return value;
  return new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' }).format(numeric);
};

export default function WechatNativePayClient({ username }: WechatNativePayClientProps) {
  const siteCopy = useSiteCopy();
  const [amount, setAmount] = useState<string>(String(AMOUNT_OPTIONS[0]));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [order, setOrder] = useState<CreatedOrder | null>(null);

  useEffect(() => {
    if (!order || order.status !== 'PENDING') return;
    const timer = setInterval(async () => {
      try {
        const res = await fetch(`/api/recharge/order/${order.id}`, { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        if (data?.order?.status === 'PAID' || data?.order?.status === 'FAILED') {
          setOrder((prev) =>
            prev
              ? {
                  ...prev,
                  status: data.order.status,
                  paidAt: data.order.paidAt ?? null,
                  expiresAt: data.order.expiresAt ?? prev.expiresAt ?? null,
                }
              : prev,
          );
          setHint(
            data.order.status === 'PAID'
              ? '系统已确认到账，刷新个人中心即可看到最新余额。'
              : '二维码已过期或订单已关闭，请重新创建订单。',
          );
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
        throw new PublicMessageError(rechargeErrorMessage(payload?.error));
      }
      setOrder({
        id: payload.orderId,
        payUrl: payload.payUrl,
        qrCodeDataUrl: payload.qrCodeDataUrl ?? null,
        status: 'PENDING',
        amount: payload.amount,
        channel: payload.channel,
        expiresAt: payload.expiresAt ?? null,
      });
      setHint('订单已创建，请在 1 小时内使用微信扫一扫完成支付，系统会自动更新余额。');
    } catch (err: unknown) {
      const message = siteCopy.text(publicMessage(err, RECHARGE_UNCONFIRMED), "site.lib.public.error.messages");
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
      setError(siteCopy("site.app.wechat.pay.wechatnativepayclient.97dd1933a05d"));
    }
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[320px,1fr]">
      <div className="space-y-6">
        <div className="space-y-6 rounded-[32px] border border-black/5 bg-white p-6">
          <div className="space-y-3">
            <p className="text-xs uppercase tracking-[0.4em] text-gray-500"><SiteText copyKey="site.app.wechat.pay.wechatnativepayclient.a870784d0b6e" /></p>
            <div className="rounded-2xl border border-black/10 bg-black/5 px-4 py-3 text-sm"><SiteText copyKey="site.app.wechat.pay.wechatnativepayclient.c8715f381cf1" /></div>
            
            <p className="text-xs text-gray-500"><SiteText copyKey="site.app.wechat.pay.wechatnativepayclient.233165aee9bc" /><span className="font-mono">{username ?? <SiteText copyKey="site.app.wechat.pay.wechatnativepayclient.e8041a8c9358" />}</span>
            </p>
          </div>

          <div className="rounded-[24px] border border-black/5 bg-white p-5 text-left">
            <p className="text-xs uppercase tracking-[0.4em] text-gray-500"><SiteText copyKey="site.app.wechat.pay.wechatnativepayclient.b67221d19ae5" /></p>
            <ol className="mt-3 list-inside list-decimal space-y-2 text-sm text-gray-600">
              <li><SiteText copyKey="site.app.wechat.pay.wechatnativepayclient.811988ca2a85" /></li>
              <li><SiteText copyKey="site.app.wechat.pay.wechatnativepayclient.a99f9b20258a" /></li>
              <li><SiteText copyKey="site.app.wechat.pay.wechatnativepayclient.93bff56f07b0" /></li>
            </ol>
          </div>
        </div>
      </div>

      <form
        onSubmit={createOrder}
        className="space-y-6 rounded-[32px] border border-black/5 bg-white p-8"
      >
        <div className="space-y-3">
          <label className="text-xs uppercase tracking-[0.4em] text-gray-500"><SiteText copyKey="site.app.wechat.pay.wechatnativepayclient.3b8b236acaca" /></label>
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
          <p className="text-xs text-gray-500"><SiteText copyKey="site.app.wechat.pay.wechatnativepayclient.71843f49b3dc" /></p>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-full bg-black px-6 py-3 text-sm uppercase tracking-[0.4em] text-white transition hover:bg-black/80 disabled:opacity-60"
        >
          {loading ? <SiteText copyKey="site.app.wechat.pay.wechatnativepayclient.69988de37b6d" /> : <SiteText copyKey="site.app.wechat.pay.wechatnativepayclient.f5543e33e6c6" />}
        </button>

        {error ? <p className="text-sm text-red-500"><SiteText namespace="site.app.wechat.pay.wechatnativepayclient" value={error} /></p> : null}
        {hint ? <p className="text-sm text-emerald-600">{hint}</p> : null}

        {order ? (
          <div className="space-y-4 rounded-[24px] border border-black/5 bg-black/5 p-5">
            {order.qrCodeDataUrl ? (
              <div className="space-y-3">
                <p className="text-xs uppercase tracking-[0.4em] text-gray-500"><SiteText copyKey="site.app.wechat.pay.wechatnativepayclient.c8715f381cf1" /></p>
                <div className="mx-auto w-56 rounded-[28px] border border-black/10 bg-white p-4">
                  <Image
                    src={order.qrCodeDataUrl}
                    alt={siteCopy("site.app.wechat.pay.wechatnativepayclient.6eeebac2b29c")}
                    width={360}
                    height={360}
                    unoptimized
                    className="h-full w-full object-contain"
                  />
                </div>
                <p className="text-center text-xs text-gray-500"><SiteText copyKey="site.app.wechat.pay.wechatnativepayclient.de32b6a95b88" /></p>
              </div>
            ) : null}

            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500"><SiteText copyKey="site.app.wechat.pay.wechatnativepayclient.459868e5cb99" /></span>
              <span className="font-mono text-xs">{order.id}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500"><SiteText copyKey="site.app.wechat.pay.wechatnativepayclient.34943c40c9af" /></span>
              <span className="font-semibold">{formatCurrency(order.amount)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500"><SiteText copyKey="site.app.wechat.pay.wechatnativepayclient.62e951a692ff" /></span>
              <span
                className={
                  order.status === 'PAID'
                    ? 'text-emerald-600'
                    : order.status === 'FAILED'
                      ? 'text-red-500'
                      : 'text-orange-500'
                }
              >
                {STATUS_TEXT[order.status]}
              </span>
            </div>
            {order.paidAt ? (
              <p className="text-xs text-gray-500"><SiteText copyKey="site.app.wechat.pay.wechatnativepayclient.e90da359904c" />{new Date(order.paidAt).toLocaleString('zh-CN', { timeZone: ROME_TIMEZONE })}
              </p>
            ) : order.status === 'PENDING' ? (
              <p className="text-xs text-gray-500"><SiteText copyKey="site.app.wechat.pay.wechatnativepayclient.8a4d6ea4a592" /></p>
            ) : null}
            {order.expiresAt && order.status === 'PENDING' ? (
              <p className="text-xs text-gray-500"><SiteText copyKey="site.app.wechat.pay.wechatnativepayclient.f4c45010e6d7" />{new Date(order.expiresAt).toLocaleString('zh-CN', { timeZone: ROME_TIMEZONE })}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-3 pt-2">
              <button
                type="button"
                onClick={copyLink}
                className="flex-1 rounded-full border border-black/20 px-4 py-2 text-xs uppercase tracking-[0.4em] transition hover:bg-black/5"
              ><SiteText copyKey="site.app.wechat.pay.wechatnativepayclient.13a93c4be799" /></button>
            </div>
          </div>
        ) : null}
      </form>
    </div>
  );
}
