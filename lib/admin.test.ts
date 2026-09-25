import assert from 'node:assert/strict';
import test from 'node:test';
import {
  canViewAdminHome,
  canViewStripePricing,
  canViewTraffic,
  getAdminDiscordIds,
  isBackofficeDiscordId,
} from './admin';

test('only configured Discord IDs have backoffice access', () => {
  assert.deepEqual(getAdminDiscordIds(), [
    '525770714574225408',
    '1008032640445710447',
    '1552030874076315777',
    '308164614846414851',
    '734159747367829636',
  ]);

  for (const discordId of ['example-discord-id', '123456789012345678']) {
    assert.equal(isBackofficeDiscordId(discordId), false);
    assert.equal(canViewAdminHome(discordId), false);
    assert.equal(canViewStripePricing(discordId), false);
    assert.equal(canViewTraffic(discordId), false);
  }

  assert.equal(canViewStripePricing(null), false);
});

test('only the designated Discord account can view Stripe pricing and traffic', () => {
  assert.equal(canViewStripePricing('525770714574225408'), true);
  assert.equal(canViewTraffic('525770714574225408'), true);

  assert.equal(canViewStripePricing('1008032640445710447'), false);
  assert.equal(canViewTraffic('1008032640445710447'), false);
});
