'use client';

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import {
  calculateEstimatedStripeCadPayout,
  calculatePercentageDifference,
  calculateStripePrice,
  STRIPE_PRICING_CURRENCIES,
  STRIPE_PRICING_MARKUPS,
  STRIPE_PRICING_RMB_AMOUNTS,
  type StripeCardOrigin,
  type StripePricingCurrency,
  type StripePricingSnapshot,
} from '@/lib/stripe-pricing-rates';

type RatesApiResponse = StripePricingSnapshot | { error?: string };

const CURRENCY_DETAILS: Record<StripePricingCurrency, { name: string; symbol: string }> = {
  GBP: { name: '英镑', symbol: '£' },
  EUR: { name: '欧元', symbol: '€' },
  USD: { name: '美元', symbol: 'US$' },
  CAD: { name: '加元', symbol: 'CA$' },
};

const formatRmb = (amount: number) => `¥${amount.toLocaleString('zh-CN')}`;
const formatRmbWithCents = (amount: number) =>
  `¥${amount.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const formatCad = (amount: number) =>
  `CA$${amount.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const formatPrice = (currency: StripePricingCurrency, amount: number) =>
  `${CURRENCY_DETAILS[currency].symbol}${amount.toFixed(2)}`;
const formatMarkup = (markup: number) => (markup === 0 ? '实时汇率' : `+${markup}%`);
const formatPercent = (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
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

const isStripePricingSnapshot = (value: RatesApiResponse): value is StripePricingSnapshot =>
  typeof value === 'object' && value !== null && 'rates' in value && 'presetPrices' in value;

export function StripePricingCalculator() {
  const [snapshot, setSnapshot] = useState<StripePricingSnapshot | null>(null);
  const [cardOrigin, setCardOrigin] = useState<StripeCardOrigin>('international');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadRates = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/stripe-pricing/rates', { cache: 'no-store' });
      const data = (await response.json().catch(() => ({}))) as RatesApiResponse;
      if (!response.ok || !isStripePricingSnapshot(data)) {
        throw new Error(('error' in data && typeof data.error === 'string' ? data.error : '获取定价信息失败，请稍后重试。'));
      }
      setSnapshot(data);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : '获取定价信息失败，请稍后重试。');
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

    return STRIPE_PRICING_RMB_AMOUNTS.flatMap((rmbAmount) => {
      const preset = snapshot.presetPrices.find((item) => item.rmbAmount === rmbAmount);
      if (!preset) return [];

      return [{
        rmbAmount,
        preset,
        rows: STRIPE_PRICING_MARKUPS.map((markup) => ({
          markup,
          prices: STRIPE_PRICING_CURRENCIES.map((currency) => ({
            currency,
            price: calculateStripePrice(rmbAmount, snapshot.rates[currency], markup),
          })),
        })),
        payouts: STRIPE_PRICING_CURRENCIES.map((currency) => {
          const presetPrice = preset.prices[currency];
          const estimate = calculateEstimatedStripeCadPayout({
            chargedAmount: presetPrice,
            chargedCurrency: currency,
            rates: snapshot.rates,
            cardOrigin,
          });
          return {
            currency,
            presetPrice,
            markupPercent: calculatePercentageDifference(presetPrice, rmbAmount * snapshot.rates[currency]),
            netCad: estimate.netCad,
            netCny: estimate.netCny,
            netCnyMargin: calculatePercentageDifference(estimate.netCny, rmbAmount),
          };
        }),
      }];
    });
  }, [cardOrigin, snapshot]);

  const feeSummary = cardOrigin === 'international'
    ? '国际卡：2.9% + 0.8% + CA$0.30；非 CAD 再加 2% 换汇费。'
    : '加拿大卡：2.9% + CA$0.30；非 CAD 再加 2% 换汇费。';

  return (
    <div className="space-y-8 text-white">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold">Stripe 多币种定价</h2>
          <p className="text-sm text-white/65">Stripe 预设价格与最新参考汇率每 5 分钟重新读取。</p>
        </div>
        <button
          type="button"
          onClick={() => void loadRates()}
          disabled={isLoading}
          className="inline-flex items-center justify-center rounded-full border border-white/20 px-5 py-2 text-sm text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLoading ? '更新中…' : '刷新价格'}
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

      {snapshot ? (
        <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-4">
          {STRIPE_PRICING_CURRENCIES.map((currency) => (
            <div key={currency} className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
              <p className="text-xs text-white/45">{currency} / {CURRENCY_DETAILS[currency].name}</p>
              <p className="mt-1 text-sm text-white">1 {currency} = {(1 / snapshot.rates[currency]).toFixed(6)} CNY</p>
            </div>
          ))}
        </div>
      ) : null}

      {snapshot ? (
        <div className="flex flex-wrap items-center justify-between gap-4 border-y border-white/10 py-4">
          <div>
            <p className="text-sm font-medium text-white">CAD 到账估算</p>
            <p className="mt-1 text-xs text-white/55">{feeSummary}</p>
          </div>
          <div className="inline-flex overflow-hidden rounded-lg border border-white/15" role="group" aria-label="发卡地区">
            <button
              type="button"
              onClick={() => setCardOrigin('domestic')}
              className={`px-4 py-2 text-sm transition ${cardOrigin === 'domestic' ? 'bg-white text-black' : 'text-white/70 hover:bg-white/10'}`}
            >
              加拿大卡
            </button>
            <button
              type="button"
              onClick={() => setCardOrigin('international')}
              className={`border-l border-white/15 px-4 py-2 text-sm transition ${cardOrigin === 'international' ? 'bg-white text-black' : 'text-white/70 hover:bg-white/10'}`}
            >
              国际卡
            </button>
          </div>
        </div>
      ) : null}

      {error ? <p className="rounded-xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">{error}</p> : null}

      {snapshot ? (
        <div className="grid gap-6 2xl:grid-cols-2">
          {priceTables.map(({ rmbAmount, preset, rows, payouts }) => (
            <section key={rmbAmount} className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
              <div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
                <div>
                  <h3 className="text-lg font-semibold">{formatRmb(rmbAmount)} 充值</h3>
                  <p className="mt-1 text-xs text-white/55">对应锦鲤余额 {formatRmb(rmbAmount)} · {preset.priceId}</p>
                </div>
              </div>
              <div className="stripe-pricing-table-scroll overflow-x-auto">
                <table className="min-w-[620px] text-right text-sm">
                  <thead className="bg-white/[0.04] text-xs text-white/60">
                    <tr>
                      <th className="w-32 px-4 py-3 text-left font-medium">价格</th>
                      {STRIPE_PRICING_CURRENCIES.map((currency) => (
                        <th key={currency} className="px-4 py-3 font-medium">
                          {currency}<span className="ml-1 text-white/40">{CURRENCY_DETAILS[currency].name}</span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(({ markup, prices }) => (
                      <Fragment key={markup}>
                        <tr className="border-t border-white/8 hover:bg-white/[0.025]">
                          <td className="px-4 py-3 text-left font-medium text-white/80">{formatMarkup(markup)}</td>
                          {prices.map(({ currency, price }) => (
                            <td key={currency} className="px-4 py-3 font-mono text-white">
                              {formatPrice(currency, price)}
                            </td>
                          ))}
                        </tr>
                        {markup === 0 ? (
                          <tr className="border-t border-emerald-300/20 bg-emerald-300/[0.05]">
                            <td className="px-4 py-3 text-left font-medium text-emerald-100">Stripe 预设价格</td>
                            {payouts.map(({ currency, presetPrice, markupPercent }) => (
                              <td key={currency} className="px-4 py-3">
                                <p className="font-mono text-white">{formatPrice(currency, presetPrice)}</p>
                                <p className="mt-1 text-xs text-emerald-200">较实时 {formatPercent(markupPercent)}</p>
                              </td>
                            ))}
                          </tr>
                        ) : null}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="grid border-t border-white/10 sm:grid-cols-2 2xl:grid-cols-4">
                {payouts.map(({ currency, presetPrice, netCad, netCny, netCnyMargin }, index) => (
                  <div
                    key={currency}
                    className={`px-4 py-4 ${index > 0 ? 'border-t border-white/10 sm:border-l sm:border-t-0 2xl:border-t-0' : ''}`}
                  >
                    <p className="text-xs text-white/50">{currency} 预设 {formatPrice(currency, presetPrice)}</p>
                    <p className="mt-2 text-sm font-semibold text-white">预计到账 {formatCad(netCad)}</p>
                    <p className="mt-1 text-xs text-white/60">≈ {formatRmbWithCents(netCny)} · 较余额 {formatPercent(netCnyMargin)}</p>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : isLoading ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-12 text-center text-sm text-white/60">正在获取 Stripe 价格与最新参考汇率…</div>
      ) : null}

      <p className="text-xs text-white/45">
        按 Stripe 加拿大标准线上卡费估算：基础 2.9% + CA$0.30，国际卡另加 0.8%，非 CAD 再加 2% 换汇费。实际 Balance Transaction 仍以 Stripe 成功扣款后的记录为准。
      </p>
    </div>
  );
}
