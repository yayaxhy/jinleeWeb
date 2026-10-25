import assert from 'node:assert/strict';
import test from 'node:test';
import crypto from 'node:crypto';
import { decodeSessionToken, encodeSessionToken, hasCurrentBrowserSessionIdentity, hasCurrentWechatProgramBinding, type SessionIdentity, type SessionPayload } from './session-validation';

const secret = 'offline-test-only-secret';
const NOW = 1792800000000;
const payload = (extra: Partial<SessionPayload> = {}): SessionPayload => ({ version: 1, dlmId: 'DLM-A', discordId: 'discord-a', username: 'name', issuedAt: NOW, expiresAt: NOW + 10000, ...extra });
const identity = (provider = 'DISCORD'): SessionIdentity => ({ dlmId: 'DLM-A', discordUserId: 'discord-a', sessionVersion: 1,
  accountBindings: [{ dlmId: 'DLM-A', provider, providerUserId: provider === 'DISCORD' ? 'discord-a' : 'wechat-open-id', createdAt: new Date(NOW - 1000) }] });

test('v1 cookies produced by the previous encoder remain byte-compatible and valid', () => {
  const original = payload(); // authProvider and sessionVersion used to be optional.
  const encoded = Buffer.from(JSON.stringify(original)).toString('base64url');
  const oldCookie = `${encoded}.${crypto.createHmac('sha256', secret).update(encoded).digest('base64url')}`;
  assert.equal(encodeSessionToken(original, secret), oldCookie);
  assert.deepEqual(decodeSessionToken(oldCookie, secret, NOW), original);
  assert.equal(hasCurrentBrowserSessionIdentity(original, identity()), true);
});

test('cookie signature, expiry and payload validation run before identity checks', () => {
  const cookie = encodeSessionToken(payload(), secret);
  assert.equal(decodeSessionToken(cookie, 'different', NOW), null);
  assert.equal(decodeSessionToken(cookie, secret, NOW + 10001), null);
  assert.equal(decodeSessionToken(cookie + '.extra', secret, NOW), null);
  const [encoded, signature] = cookie.split('.');
  assert.equal(decodeSessionToken(`${encoded}.${'中'.repeat(signature.length)}`, secret, NOW), null);
  assert.equal(decodeSessionToken('invalid', secret, NOW), null);
  assert.equal(decodeSessionToken(encodeSessionToken({ ...payload(), expiresAt: Number.NaN }, secret), secret, NOW), null);
});

test('ordinary Discord and Wechat web cookies remain valid without forced blanket logout', () => {
  assert.equal(hasCurrentBrowserSessionIdentity(payload({ authProvider: 'discord', sessionVersion: 1 }), identity()), true);
  assert.equal(hasCurrentBrowserSessionIdentity(payload({ authProvider: 'wechat_web' }), identity('WECHAT_WEB')), true);
  const unbound = identity('WECHAT_WEB'); unbound.discordUserId = null;
  assert.equal(hasCurrentBrowserSessionIdentity(payload({ authProvider: 'wechat_web', discordId: null }), unbound), true);
});

test('a browser authenticated by a removed channel cannot use a different remaining channel', () => {
  assert.equal(hasCurrentBrowserSessionIdentity(payload(), identity('WECHAT_WEB')), false);
  assert.equal(hasCurrentBrowserSessionIdentity(payload({ authProvider: 'wechat_web' }), identity()), false);
});

test('old cookies never inherit a newly bound Discord or survive ownership-version changes', () => {
  const changed = identity(); changed.discordUserId = 'new-admin-discord';
  changed.accountBindings[0].providerUserId = 'new-admin-discord';
  assert.equal(hasCurrentBrowserSessionIdentity(payload(), changed), false);
  const web = identity('WECHAT_WEB'); web.discordUserId = 'new-admin-discord';
  assert.equal(hasCurrentBrowserSessionIdentity(payload({ authProvider: 'wechat_web' }), web), false);
  const revoked = identity(); revoked.sessionVersion = 2;
  assert.equal(hasCurrentBrowserSessionIdentity(payload(), revoked), false);
});

test('binding ownership and binding creation time must still match the issued login', () => {
  const other = identity(); other.accountBindings[0].dlmId = 'DLM-B';
  assert.equal(hasCurrentBrowserSessionIdentity(payload(), other), false);
  const recreated = identity(); recreated.accountBindings[0].createdAt = new Date(NOW + 1);
  assert.equal(hasCurrentBrowserSessionIdentity(payload(), recreated), false);
  assert.equal(hasCurrentBrowserSessionIdentity(payload(), null), false);
});

test('legacy Discord-only cookies can resolve an existing binding but cannot create or acquire a later one', () => {
  const legacy = payload({ dlmId: null });
  assert.equal(hasCurrentBrowserSessionIdentity(legacy, identity()), true);
  const fresh = identity(); fresh.accountBindings[0].createdAt = new Date(NOW + 1);
  assert.equal(hasCurrentBrowserSessionIdentity(legacy, fresh), false);
  assert.equal(hasCurrentBrowserSessionIdentity(legacy, null), false);
  assert.equal(hasCurrentBrowserSessionIdentity(payload({ dlmId: null, authProvider: 'wechat_web' }), identity('WECHAT_WEB')), false);
});

const mini = () => ({ dlmId: 'DLM-A', providerAccountId: 'binding-a', dlmUser: { dlmId: 'DLM-A' }, providerAccount: { id: 'binding-a', dlmId: 'DLM-A', provider: 'WECHAT_MINIPROGRAM' } });
test('a valid existing mini-program bearer session keeps access', () => assert.equal(hasCurrentWechatProgramBinding(mini()), true));
test('mini-program tokens cannot follow a moved binding or a mismatched account', () => {
  const moved = mini(); moved.providerAccount.dlmId = 'DLM-B';
  assert.equal(hasCurrentWechatProgramBinding(moved), false);
  const wrongUser = mini(); wrongUser.dlmUser.dlmId = 'DLM-B';
  assert.equal(hasCurrentWechatProgramBinding(wrongUser), false);
  const wrongProvider = mini(); wrongProvider.providerAccount.provider = 'WECHAT_WEB';
  assert.equal(hasCurrentWechatProgramBinding(wrongProvider), false);
  assert.equal(hasCurrentWechatProgramBinding({ ...mini(), providerAccount: null }), false);
  assert.equal(hasCurrentWechatProgramBinding({ ...mini(), providerAccountId: null }), false);
});
