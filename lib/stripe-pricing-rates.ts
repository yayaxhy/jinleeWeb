export const STRIPE_PRICING_CURRENCIES = ['GBP', 'EUR', 'USD', 'CAD'] as const;

export type StripePricingCurrency = (typeof STRIPE_PRICING_CURRENCIES)[number];

export const STRIPE_PRICING_RMB_AMOUNTS = [500, 1000, 2000, 5000] as const;
export const STRIPE_PRICING_MARKUPS = [0, 11, 11.5, 12, 13, 14, 15, 16] as const;

type FrankfurterLatestRatesPayload = {
  base?: unknown;
  date?: unknown;
  rates?: unknown;
};

export type StripePricingRateSnapshot = {
  base: 'CNY';
  rateDate: string;
  fetchedAt: string;
  rates: Record<StripePricingCurrency, number>;
};

export type StripePricingPreset = {
  rmbAmount: number;
  priceId: string;
  prices: Record<StripePricingCurrency, number>;
};

export type StripePricingSnapshot = StripePricingRateSnapshot & {
  presetPrices: StripePricingPreset[];
};

export type StripeCardOrigin = 'domestic' | 'international';

export const STRIPE_CANADA_STANDARD_CARD_PRICING = {
  processingRate: 0.029,
  internationalCardRate: 0.008,
  currencyConversionRate: 0.02,
  fixedFeeCad: 0.3,
} as const;

const FRANKFURTER_LATEST_URL =
  'https://api.frankfurter.dev/v1/latest?base=CNY&symbols=GBP,EUR,USD,CAD';

const isValidRate = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0;

export const parseStripePricingRateSnapshot = (
  payload: FrankfurterLatestRatesPayload,
  fetchedAt = new Date().toISOString(),
): StripePricingRateSnapshot => {
  if (payload.base !== 'CNY' || typeof payload.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(payload.date)) {
    throw new Error('汇率服务返回的数据格式不正确。');
  }

  const rawRates = payload.rates;
  if (!rawRates || typeof rawRates !== 'object') {
    throw new Error('汇率服务没有返回目标币种。');
  }

  const rates = {} as Record<StripePricingCurrency, number>;
  for (const currency of STRIPE_PRICING_CURRENCIES) {
    const rate = (rawRates as Record<string, unknown>)[currency];
    if (!isValidRate(rate)) {
      throw new Error(`汇率服务没有返回 ${currency} 的有效汇率。`);
    }
    rates[currency] = rate;
  }

  return {
    base: 'CNY',
    rateDate: payload.date,
    fetchedAt,
    rates,
  };
};

export const fetchStripePricingRateSnapshot = async (): Promise<StripePricingRateSnapshot> => {
  const response = await fetch(FRANKFURTER_LATEST_URL, {
    cache: 'no-store',
    signal: AbortSignal.timeout(8_000),
  });

  if (!response.ok) {
    throw new Error(`汇率服务暂不可用（HTTP ${response.status}）。`);
  }

  const payload = (await response.json()) as FrankfurterLatestRatesPayload;
  return parseStripePricingRateSnapshot(payload);
};

export const calculateStripePrice = (rmbAmount: number, rate: number, markupPercent: number) => {
  const rawAmount = rmbAmount * rate * (1 + markupPercent / 100);

  // Every supported currency has a two-decimal smallest unit. Always round upward
  // so the configured markup cannot be reduced by rounding.
  return Math.ceil(rawAmount * 100 - 1e-8) / 100;
};

export const calculatePercentageDifference = (value: number, baseline: number) => {
  if (!Number.isFinite(value) || !Number.isFinite(baseline) || baseline <= 0) return 0;
  return (value / baseline - 1) * 100;
};

export const calculateEstimatedStripeCadPayout = (input: {
  chargedAmount: number;
  chargedCurrency: StripePricingCurrency;
  rates: Record<StripePricingCurrency, number>;
  cardOrigin: StripeCardOrigin;
}) => {
  const grossCad =
    input.chargedCurrency === 'CAD'
      ? input.chargedAmount
      : input.chargedAmount * (input.rates.CAD / input.rates[input.chargedCurrency]);
  const percentageFeeRate =
    STRIPE_CANADA_STANDARD_CARD_PRICING.processingRate +
    (input.cardOrigin === 'international' ? STRIPE_CANADA_STANDARD_CARD_PRICING.internationalCardRate : 0) +
    (input.chargedCurrency === 'CAD' ? 0 : STRIPE_CANADA_STANDARD_CARD_PRICING.currencyConversionRate);
  const feeCad = grossCad * percentageFeeRate + STRIPE_CANADA_STANDARD_CARD_PRICING.fixedFeeCad;
  const netCad = Math.max(0, grossCad - feeCad);

  return {
    grossCad,
    percentageFeeRate,
    feeCad,
    netCad,
    netCny: netCad / input.rates.CAD,
  };
};
