'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  calculateStripePrice,
  STRIPE_PRICING_CURRENCIES,
  STRIPE_PRICING_MARKUPS,
  STRIPE_PRICING_RMB_AMOUNTS,
  type StripePricingCurrency,
  type StripePricingRateSnapshot,
} from '@/lib/stripe-pricing-rates';

type RatesApiResponse = StripePricingRateSnapshot | { error?: string };

const CURRENCY_DETAILS: Record<StripePricingCurrency, { name: string; symbol: string }> = {
  GBP: { name: '英镑', symbol: '£' },
  EUR: { name: '欧元', symbol: '€' },
  USD: { name: '美元', symbol: 'US$' },
  CAD: { name: '加元', symbol: 'CA$' },
};

const formatRmb = (amount: number) => `¥${amount.toLocaleString('zh-CN')}`;
const formatPrice = (currency: StripePricingCurrency, amount: number) =>
  `${CURRENCY_DETAILS[currency].symbol}${amount.toFixed(2)}`;
const formatMarkup = (markup: number) => (markup === 0 ? '基准汇率' : `+${markup}%`);
const formatTimestamp = (timestamp: string) =>
  new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date(timestamp));

export function StripePricingCalculator() {
  const [snapshot, setSnapshot] = useState<StripePricingRateSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadRates = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/stripe-pricing/rates', { cache: 'no-store' });
      const data = (await response.json().catch(() => ({}))) as RatesApiResponse;
      if (!response.ok || !('rates' in data)) {
        throw new Error(('error' in data && typeof data.error === 'string' ? data.error : '获取汇率失败，请稍后重试。'));
      }
      setSnapshot(data);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : '获取汇率失败，请稍后重试。');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRates();
    const intervalId = window.setInterval(() => void loadRates(), 5 * 60 * 1000);
    return () => window.clearInterval(intervalId);
  }, [loadRates]);

  const priceTables = useMemo(() => {
    if (!snapshot) return [];
    return STRIPE_PRICING_CURRENCIES.map((currency) => ({
      currency,
      rate: snapshot.rates[currency],
      rows: STRIPE_PRICING_MARKUPS.map((markup) => ({
        markup,
        prices: STRIPE_PRICING_RMB_AMOUNTS.map((rmbAmount) =>
          calculateStripePrice(rmbAmount, snapshot.rates[currency], markup),
        ),
      })),
    }));
  }, [snapshot]);

  return (
    <div className="space-y-8 text-white">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold">Stripe 多币种定价</h2>
          <p className="text-sm text-white/65">按 CNY 参考汇率计算，金额均向上取整至 0.01。</p>
        </div>
        <button
          type="button"
          onClick={() => void loadRates()}
          disabled={isLoading}
          className="inline-flex items-center justify-center rounded-full border border-white/20 px-5 py-2 text-sm text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLoading ? '更新中…' : '刷新汇率'}
        </button>
      </div>

      {snapshot ? (
        <div className="grid gap-3 text-sm text-white/70 sm:grid-cols-3">
          <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
            <p className="text-xs text-white/45">汇率基准</p>
            <p className="mt-1 text-white">1 CNY</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
            <p className="text-xs text-white/45">参考汇率日期</p>
            <p className="mt-1 text-white">{snapshot.rateDate}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
            <p className="text-xs text-white/45">最后获取时间</p>
            <p className="mt-1 text-white">{formatTimestamp(snapshot.fetchedAt)}</p>
          </div>
        </div>
      ) : null}

      {error ? <p className="rounded-xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">{error}</p> : null}

      {snapshot ? (
        <div className="grid gap-6 2xl:grid-cols-2">
          {priceTables.map(({ currency, rate, rows }) => (
            <section key={currency} className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
              <div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
                <div>
                  <h3 className="text-lg font-semibold">{currency} / {CURRENCY_DETAILS[currency].name}</h3>
                  <p className="mt-1 text-xs text-white/55">1 CNY = {rate.toFixed(6)} {currency}</p>
                </div>
              </div>
              <div className="stripe-pricing-table-scroll overflow-x-auto">
                <table className="min-w-[680px] text-right text-sm">
                  <thead className="bg-white/[0.04] text-xs text-white/60">
                    <tr>
                      <th className="w-28 px-4 py-3 text-left font-medium">加价</th>
                      {STRIPE_PRICING_RMB_AMOUNTS.map((amount) => (
                        <th key={amount} className="px-4 py-3 font-medium">{formatRmb(amount)}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(({ markup, prices }) => (
                      <tr key={markup} className="border-t border-white/8 hover:bg-white/[0.025]">
                        <td className="px-4 py-3 text-left font-medium text-white/80">{formatMarkup(markup)}</td>
                        {prices.map((price, index) => (
                          <td key={STRIPE_PRICING_RMB_AMOUNTS[index]} className="px-4 py-3 font-mono text-white">
                            {formatPrice(currency, price)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>
      ) : isLoading ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-12 text-center text-sm text-white/60">正在获取最新参考汇率…</div>
      ) : null}

      <p className="text-xs text-white/45">参考汇率不包含 Stripe 手续费或 Stripe 实际换汇差价；创建新的 Stripe Price 前请再次确认。</p>
    </div>
  );
}
