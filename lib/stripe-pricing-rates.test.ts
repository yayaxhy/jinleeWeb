import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateStripePrice, parseStripePricingRateSnapshot } from './stripe-pricing-rates';

test('Stripe price calculator applies markup and rounds up to the smallest currency unit', () => {
  assert.equal(calculateStripePrice(500, 0.10901, 11), 60.51);
  assert.equal(calculateStripePrice(500, 0.1, 11.5), 55.75);
});

test('Stripe price calculator validates every configured target currency', () => {
  const snapshot = parseStripePricingRateSnapshot(
    {
      base: 'CNY',
      date: '2026-08-28',
      rates: { GBP: 0.10901, EUR: 0.12004, USD: 0.13912, CAD: 0.19022 },
    },
    '2026-08-29T01:23:45.000Z',
  );

  assert.equal(snapshot.rates.GBP, 0.10901);
  assert.equal(snapshot.rateDate, '2026-08-28');
  assert.throws(
    () =>
      parseStripePricingRateSnapshot({
        base: 'CNY',
        date: '2026-08-28',
        rates: { GBP: 0.10901, EUR: 0.12004, USD: 0.13912 },
      }),
    /CAD/,
  );
});
