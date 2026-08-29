import assert from 'node:assert/strict';
import test from 'node:test';
import { canViewStripePricing } from './admin';

test('only the designated Discord user can view Stripe pricing', () => {
  assert.equal(canViewStripePricing('525770714574225408'), true);
  assert.equal(canViewStripePricing('794340158991237121'), false);
  assert.equal(canViewStripePricing(null), false);
});
