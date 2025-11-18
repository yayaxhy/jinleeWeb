"use client";

import { useEffect, useMemo, useState, type FormEvent } from 'react';

const PAYMENT_CHANNELS = [
  {
    id: 'alipay',
    label: '支付宝',
    description: '使用支付宝扫一扫完成支付，系统确认成功后自动加款。',
    accent: 'from-[#bfdbfe] to-[#93c5fd]',
  },
  // {
  //   id: 'wxpay',
  //   label: '微信支付',
  //   description: '使用微信扫一扫完成转账，无需上传凭证。',
  //   accent: 'from-[#bbf7d0] to-[#86efac]',
  // },
] as const;

const QR_ENDPOINT = 'https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=';
const AMOUNT_OPTIONS = [99, 199, 299, 399, 499, 999] as const;

type RechargeClientProps = {
  username?: string | null;
};

type CreatedOrder = {
  id: string;
  payUrl: string;
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

export default function RechargeClient({ username }: RechargeClientProps) {
  const [channel, setChannel] = useState<(typeof PAYMENT_CHANNELS)[number]['id']>('alipay');
  const [amount, setAmount] = useState<string>(String(AMOUNT_OPTIONS[0]));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [order, setOrder] = useState<CreatedOrder | null>(null);

  const selectedChannel = useMemo(
    () => PAYMENT_CHANNELS.find((item) => item.id === channel) ?? PAYMENT_CHANNELS[0],
    [channel],
  );

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
        console.error('[recharge] poll error', pollError);
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
      const response = await fetch('/api/recharge/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: Number(amount), channel }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error ?? '下单失败，请稍后再试');
      }
      setOrder({
        id: payload.orderId,
        payUrl: payload.payUrl,
        status: 'PENDING',
        amount: payload.amount,
        channel: payload.channel,
      });
      setHint('订单已创建，请在 15 分钟内完成支付，系统会自动更新余额。');
    } catch (err: any) {
      setError(err?.message ?? '创建订单失败');
    } finally {
      setLoading(false);
    }
  };

  const qrImage = order?.payUrl ? `${QR_ENDPOINT}${encodeURIComponent(order.payUrl)}` : null;

  const copyLink = async () => {
    if (typeof window === 'undefined' || !order?.payUrl || !navigator?.clipboard) return;
    try {
      await navigator.clipboard.writeText(order.payUrl);
      setHint('支付链接已复制，可在浏览器中打开继续支付。');
    } catch {
      setError('无法复制链接，请手动打开支付页面。');
    }
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[320px,1fr]">
      <div className="space-y-6">
        <div className="rounded-[32px] border border-black/5 bg-white p-6 space-y-5">
          <div className="space-y-3">
            <p className="text-xs uppercase tracking-[0.4em] text-gray-500">选择支付方式</p>
            <div className="flex flex-wrap gap-3">
              {PAYMENT_CHANNELS.map((item) => {
                const active = item.id === channel;
                return (
                  <button
                    type="button"
                    key={item.id}
                    className={`flex-1 min-w-[140px] rounded-2xl border px-4 py-3 text-l transition ${
                      active
                        ? 'border-black text-black bg-black/10'
                        : 'border-black/10 text-gray-500 hover:text-black hover:border-orange/50'
                    }`}
                    onClick={() => {
                      setChannel(item.id);
                      setHint(null);
                      setError(null);
                    }}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
            <p className="text-sm text-gray-500">{selectedChannel.description}</p>
          </div>

          {/* <div
            className={`rounded-3xl border border-dashed border-black/15 bg-gradient-to-br ${selectedChannel.accent} p-6 text-center space-y-4`}
          >
            <p className="text-xl uppercase tracking-[0.4em] text-gray-600">扫码支付</p>
            {order && qrImage ? (
              <div className="mx-auto w-48 h-48 rounded-[30px] border border-black/10 bg-white/80 flex items-center justify-center p-3">
                <img src={qrImage} alt="支付二维码" className="h-full w-full object-contain" />
              </div>
            ) : (
              <div className="mx-auto h-48 w-48 rounded-[30px] border border-black/10 bg-white/70 flex items-center justify-center text-xs text-gray-400">
                创建订单后会显示二维码
              </div>
            )}
            <p className="text-xs text-gray-600">
              转账备注建议填写 Discord ID：<span className="font-mono text-sm">{username ?? '未登录'}</span>
            </p>
          </div> */}

          <div className="rounded-[24px] border border-black/5 bg-white p-5 space-y-3 text-left">
            <p className="text-xs uppercase tracking-[0.4em] text-gray-500">充值说明</p>
            <ol className="space-y-2 text-sm text-gray-600 list-decimal list-inside">
              <li>下方选择充值金额点击生成支付二维码，系统会生成专属支付二维码。</li>
              <li>使用支付宝完成支付，无需上传凭证。</li>
              <li>支付成功后，余额将自动增加。</li>
            </ol>
          </div>
        </div>
      </div>

      <form
        onSubmit={createOrder}
        className="rounded-[32px] border border-black/5 bg-white p-8 space-y-6"
      >
        <div className="space-y-3">
          <label className="text-xs uppercase tracking-[0.4em] text-gray-500">充值金额 *</label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
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
          className="w-full rounded-full bg-black px-6 py-3 text-sm uppercase tracking-[0.4em] text-white hover:bg-black/80 transition disabled:opacity-60"
        >
          {loading ? '创建订单中…' : '生成支付二维码'}
        </button>

        {error && <p className="text-sm text-red-500">{error}</p>}
        {hint && <p className="text-sm text-emerald-600">{hint}</p>}

        {order && (
          <div className="space-y-4 rounded-[24px] border border-black/5 bg-black/5 p-5">
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
              <p className="text-xs text-gray-500">到账时间：{new Date(order.paidAt).toLocaleString()}</p>
            ) : (
              <p className="text-xs text-gray-500">
                支付完成后请耐心等待 1-2 分钟，系统会自动确认。
              </p>
            )}
            <div className="flex flex-wrap gap-3 pt-2">
              <a
                href={order.payUrl}
                target="_blank"
                rel="noreferrer"
                className="flex-1 rounded-full border border-black/20 px-4 py-2 text-xs uppercase tracking-[0.4em] text-center hover:bg-black/5 transition"
              >
                打开支付页面
              </a>
              <button
                type="button"
                onClick={copyLink}
                className="flex-1 rounded-full border border-black/20 px-4 py-2 text-xs uppercase tracking-[0.4em] hover:bg-black/5 transition"
              >
                复制链接
              </button>
            </div>
          </div>
        )}

       
      </form>
    </div>
  );
}
