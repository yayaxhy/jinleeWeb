"use client";

import Image from 'next/image';
import { useEffect, useMemo, useState, type FormEvent } from 'react';

const ROME_TIMEZONE = 'Europe/Rome';

const PAYMENT_CHANNELS = [
  {
    id: 'wechat_native',
    label: '微信支付',
    description: '使用微信官方扫码支付，1 小时内完成支付，系统确认成功后自动到账。',
    accent: 'from-[#bbf7d0] to-[#86efac]',
  },
  {
    id: 'alipay',
    label: '支付宝',
    description: '使用支付宝扫一扫完成支付，系统确认成功后自动到账。',
    accent: 'from-[#bfdbfe] to-[#93c5fd]',
  },
  {
    id: 'stripe',
    label: '信用卡/银行卡',
    description: '可使用 Visa、Mastercard、American Express、银联卡等银行卡，也可使用 Apple Pay，系统确认成功后自动到账。',
    accent: 'from-[#ddd6fe] to-[#c4b5fd]',
  },
] as const;
type PaymentChannel = (typeof PAYMENT_CHANNELS)[number];
type PaymentChannelId = PaymentChannel['id'];
const DEFAULT_VISIBLE_CHANNEL_IDS: readonly PaymentChannelId[] = ['wechat_native', 'alipay'];

const AMOUNT_OPTIONS = [100, 200, 300, 400, 500, 1000] as const;
const DEFAULT_STRIPE_AMOUNT_OPTIONS = [500, 1000, 2000, 5000] as const;
const DEFAULT_FIRST_STRIPE_AMOUNT_OPTIONS = [500] as const;
const STRIPE_CURRENCY_OPTIONS = [
  { code: 'gbp', label: '英镑', shortLabel: 'GBP' },
  { code: 'eur', label: '欧元', shortLabel: 'EUR' },
  { code: 'usd', label: '美元', shortLabel: 'USD' },
  { code: 'cad', label: '加币', shortLabel: 'CAD' },
  { code: 'cny', label: '人民币（银联卡）', shortLabel: 'CNY' },
] as const;
type StripeCurrencyCode = (typeof STRIPE_CURRENCY_OPTIONS)[number]['code'];
const DEFAULT_STRIPE_CURRENCY_OPTIONS: readonly StripeCurrencyCode[] = ['gbp', 'eur', 'usd', 'cad', 'cny'];

type RechargeClientProps = {
  username?: string | null;
  hasPriorRecharge?: boolean;
  initialChannel?: PaymentChannelId;
  visibleChannelIds?: readonly PaymentChannelId[];
  stripeAmountOptions?: readonly number[];
  stripeCurrencyOptions?: readonly StripeCurrencyCode[];
  stripeCurrenciesByAmount?: Partial<Record<number, readonly StripeCurrencyCode[]>>;
  stripeNotice?: string | null;
  paymentInstructionText?: string;
};

type CreatedOrder = {
  id: string;
  payUrl: string;
  qrCodeDataUrl?: string | null;
  status: 'PENDING' | 'PAID' | 'FAILED';
  amount: string;
  channel: string;
  displayMode?: 'qrcode' | 'redirect';
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

const getDefaultAmountForChannel = (channel: PaymentChannelId, stripeAmountOptions: readonly number[]) =>
  channel === 'stripe' ? stripeAmountOptions[0] ?? 1 : AMOUNT_OPTIONS[0];

export default function RechargeClient({
  username,
  hasPriorRecharge = false,
  initialChannel,
  visibleChannelIds = DEFAULT_VISIBLE_CHANNEL_IDS,
  stripeAmountOptions,
  stripeCurrencyOptions = DEFAULT_STRIPE_CURRENCY_OPTIONS,
  stripeCurrenciesByAmount,
  stripeNotice,
  paymentInstructionText,
}: RechargeClientProps) {
  const visibleChannels = useMemo(
    () => PAYMENT_CHANNELS.filter((item) => visibleChannelIds.includes(item.id)),
    [visibleChannelIds],
  );
  const effectiveStripeAmountOptions = useMemo(
    () =>
      stripeAmountOptions?.length
        ? stripeAmountOptions
        : hasPriorRecharge
          ? DEFAULT_STRIPE_AMOUNT_OPTIONS
          : DEFAULT_FIRST_STRIPE_AMOUNT_OPTIONS,
    [hasPriorRecharge, stripeAmountOptions],
  );
  const defaultChannel = visibleChannels.some((item) => item.id === initialChannel)
    ? initialChannel ?? 'alipay'
    : visibleChannels[0]?.id ?? 'alipay';
  const [channel, setChannel] = useState<PaymentChannelId>(defaultChannel);
  const [amount, setAmount] = useState<string>(String(getDefaultAmountForChannel(defaultChannel, effectiveStripeAmountOptions)));
  const [stripeCurrency, setStripeCurrency] = useState<StripeCurrencyCode>(stripeCurrencyOptions[0] ?? 'cny');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [order, setOrder] = useState<CreatedOrder | null>(null);

  const selectedChannel = useMemo(
    () => PAYMENT_CHANNELS.find((item) => item.id === channel) ?? PAYMENT_CHANNELS[0],
    [channel],
  );
  const amountOptions = channel === 'stripe' ? effectiveStripeAmountOptions : AMOUNT_OPTIONS;
  const currentStripeCurrencyOptions = useMemo(() => {
    if (channel !== 'stripe') return [];
    const amountNumber = Number(amount);
    const amountCurrencies = stripeCurrenciesByAmount?.[amountNumber];
    return amountCurrencies?.length ? amountCurrencies : stripeCurrencyOptions;
  }, [amount, channel, stripeCurrenciesByAmount, stripeCurrencyOptions]);
  const instructionText =
    paymentInstructionText ??
    (visibleChannelIds.includes('stripe')
      ? '使用支付宝、微信或信用卡/银行卡完成支付，无需上传凭证。'
      : '使用支付宝或微信完成支付，无需上传凭证。');

  useEffect(() => {
    if (visibleChannels.some((item) => item.id === channel)) return;
    const nextChannel = visibleChannels[0]?.id ?? 'alipay';
    setChannel(nextChannel);
    setAmount(String(getDefaultAmountForChannel(nextChannel, effectiveStripeAmountOptions)));
  }, [channel, effectiveStripeAmountOptions, visibleChannels]);

  useEffect(() => {
    if (channel !== 'stripe' || currentStripeCurrencyOptions.length === 0) return;
    if (currentStripeCurrencyOptions.includes(stripeCurrency)) return;
    setStripeCurrency(currentStripeCurrencyOptions[0]);
  }, [channel, currentStripeCurrencyOptions, stripeCurrency]);

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
      const endpoint =
        channel === 'stripe'
          ? '/api/stripe/recharge/order'
          : channel === 'wechat_native'
            ? '/api/wechat/pay/order'
            : '/api/recharge/order';
      const requestBody =
        channel === 'stripe'
          ? { amount: Number(amount), currency: stripeCurrency }
          : channel === 'wechat_native'
            ? { amount: Number(amount) }
            : { amount: Number(amount), channel };
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });
      const payload = await response.json();
      if (!response.ok) {
        if (payload?.error === 'stripe_first_recharge_limited') {
          throw new Error(`首次信用卡/银行卡充值仅支持 ¥${Number(payload.allowedAmount ?? 500).toFixed(0)}。`);
        }
        if (payload?.error === 'stripe_amount_too_small') {
          throw new Error(payload?.message ?? 'Stripe 最低付款金额约为 50 美分');
        }
        if (payload?.error === 'unsupported_stripe_currency') {
          throw new Error('暂不支持该 Stripe 支付币种。');
        }
        throw new Error(payload?.error ?? '下单失败，请稍后再试');
      }
      setOrder({
        id: payload.orderId,
        payUrl: payload.payUrl,
        qrCodeDataUrl: payload.qrCodeDataUrl ?? null,
        status: 'PENDING',
        amount: payload.amount,
        channel: payload.channel,
        displayMode: payload.displayMode ?? 'redirect',
        expiresAt: payload.expiresAt ?? null,
      });
      setHint(
        payload.displayMode === 'qrcode'
          ? '订单已创建，请在 1 小时内使用微信扫一扫完成支付，系统会自动更新余额。'
          : channel === 'stripe'
            ? '支付链接已创建，请完成付款，系统会自动更新余额。'
            : '订单已创建，请在 15 分钟内完成支付，系统会自动更新余额。',
      );
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
              {visibleChannels.map((item) => {
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
                      setAmount(String(getDefaultAmountForChannel(item.id, effectiveStripeAmountOptions)));
                      if (item.id === 'stripe') {
                        setStripeCurrency(stripeCurrencyOptions[0] ?? 'cny');
                      }
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
            {channel === 'stripe' ? (
              stripeNotice ? (
                <p className="text-xs text-gray-500">{stripeNotice}</p>
              ) : !hasPriorRecharge ? (
                <p className="text-xs text-gray-500">首次信用卡/银行卡充值仅开放 ¥500，完成首次到账后可选择更高档位。</p>
              ) : null
            ) : channel === 'wechat_native' ? (
              <p className="text-xs text-gray-500">微信官方支付无需填写转账备注。</p>
            ) : (
              <p className="text-xs text-gray-500">
                转账备注建议填写当前用户标识：<span className="font-mono">{username ?? '未登录'}</span>
              </p>
            )}
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
              <li>下方选择充值金额点击生成订单，系统会按支付方式生成二维码或支付链接。</li>
              <li>{instructionText}</li>
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
            {amountOptions.map((value) => {
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

        {channel === 'stripe' && currentStripeCurrencyOptions.length > 0 ? (
          <div className="space-y-3">
            <label className="text-xs uppercase tracking-[0.4em] text-gray-500">支付币种 *</label>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {currentStripeCurrencyOptions.map((currency) => {
                const meta = STRIPE_CURRENCY_OPTIONS.find((item) => item.code === currency);
                const active = stripeCurrency === currency;
                return (
                  <button
                    type="button"
                    key={currency}
                    className={`rounded-2xl border px-4 py-3 text-sm font-medium transition ${
                      active
                        ? 'border-black bg-black text-white'
                        : 'border-black/10 text-gray-600 hover:border-black hover:text-black'
                    }`}
                    onClick={() => {
                      setStripeCurrency(currency);
                      setHint(null);
                      setError(null);
                    }}
                  >
                    <span className="block">{meta?.shortLabel ?? currency.toUpperCase()}</span>
                    <span className={`mt-1 block text-xs ${active ? 'text-white/70' : 'text-gray-400'}`}>
                      {meta?.label ?? currency.toUpperCase()}
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-gray-500">付款页会显示所选币种对应的价格。</p>
          </div>
        ) : null}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-full bg-black px-6 py-3 text-sm uppercase tracking-[0.4em] text-white hover:bg-black/80 transition disabled:opacity-60"
        >
          {loading
            ? '创建订单中…'
            : channel === 'stripe'
              ? '前往信用卡/银行卡支付'
              : channel === 'wechat_native'
                ? '生成微信支付二维码'
                : '生成支付二维码'}
        </button>

        {error && <p className="text-sm text-red-500">{error}</p>}
        {hint && <p className="text-sm text-emerald-600">{hint}</p>}

        {order && (
          <div className="space-y-4 rounded-[24px] border border-black/5 bg-black/5 p-5">
            {order.displayMode === 'qrcode' && order.qrCodeDataUrl ? (
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
              <p className="text-xs text-gray-500">
                到账时间：
                {new Date(order.paidAt).toLocaleString('zh-CN', { timeZone: ROME_TIMEZONE })}
              </p>
            ) : order.status === 'PENDING' ? (
              <p className="text-xs text-gray-500">
                支付完成后请耐心等待 1-2 分钟，系统会自动确认。
              </p>
            ) : null}
            {order.expiresAt && order.status === 'PENDING' ? (
              <p className="text-xs text-gray-500">
                二维码有效至：
                {new Date(order.expiresAt).toLocaleString('zh-CN', { timeZone: ROME_TIMEZONE })}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-3 pt-2">
              {order.displayMode !== 'qrcode' ? (
                <a
                  href={order.payUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1 rounded-full border border-black/20 px-4 py-2 text-xs uppercase tracking-[0.4em] text-center hover:bg-black/5 transition"
                >
                  打开支付页面
                </a>
              ) : null}
              <button
                type="button"
                onClick={copyLink}
                className="flex-1 rounded-full border border-black/20 px-4 py-2 text-xs uppercase tracking-[0.4em] hover:bg-black/5 transition"
              >
                {order.displayMode === 'qrcode' ? '复制二维码链接' : '复制链接'}
              </button>
            </div>
          </div>
        )}

       
      </form>
    </div>
  );
}
