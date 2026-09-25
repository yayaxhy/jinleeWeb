import assert from 'node:assert/strict';
import test from 'node:test';
import {
  canViewAdminHome,
  canViewStripePricing,
  canViewTraffic,
  getAdminDiscordIds,
  isBackofficeDiscordId,
} from './admin';

test('backoffice access is disabled until replacement IDs are approved', () => {
  assert.deepEqual(getAdminDiscordIds(), []);

  for (const discordId of ['example-discord-id', '123456789012345678']) {
    assert.equal(isBackofficeDiscordId(discordId), false);
    assert.equal(canViewAdminHome(discordId), false);
    assert.equal(canViewStripePricing(discordId), false);
    assert.equal(canViewTraffic(discordId), false);
  }

  assert.equal(canViewStripePricing(null), false);
});
