import assert from 'node:assert/strict';
import test from 'node:test';
import {
  decryptAuthAuditIp,
  encryptAuthAuditIp,
  getTrustedClientIp,
  getTrustedClientLocation,
} from '@/lib/auth-login-audit';

const withAuditKey = async (callback: () => void | Promise<void>) => {
  const previous = process.env.AUTH_LOGIN_AUDIT_ENCRYPTION_KEY;
  process.env.AUTH_LOGIN_AUDIT_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64');
  try {
    await callback();
  } finally {
    if (previous === undefined) delete process.env.AUTH_LOGIN_AUDIT_ENCRYPTION_KEY;
    else process.env.AUTH_LOGIN_AUDIT_ENCRYPTION_KEY = previous;
  }
};

test('login audit IP encryption round-trips only with the configured key', async () => {
  await withAuditKey(() => {
    const encrypted = encryptAuthAuditIp('203.0.113.42');
    assert.match(encrypted.encrypted, /^v1\./);
    assert.match(encrypted.hash, /^v1\./);
    assert.equal(decryptAuthAuditIp(encrypted.encrypted), '203.0.113.42');
  });
});

test('login audit only accepts a single X-Real-IP address', () => {
  assert.equal(getTrustedClientIp(new Request('https://jinlee.vip', { headers: { 'x-real-ip': '203.0.113.42' } })), '203.0.113.42');
  assert.equal(getTrustedClientIp(new Request('https://jinlee.vip', { headers: { 'x-real-ip': '203.0.113.42, 10.0.0.1' } })), null);
  assert.equal(getTrustedClientIp(new Request('https://jinlee.vip', { headers: { 'x-real-ip': 'not-an-ip' } })), null);
});

test('login audit reads coarse location only from reverse-proxy headers', () => {
  const location = getTrustedClientLocation(
    new Request('https://jinlee.vip', {
      headers: {
        'x-geo-country': 'Canada',
        'x-geo-region': 'Ontario',
        'x-geo-city': 'Toronto',
      },
    }),
  );

  assert.deepEqual(location, { country: 'Canada', region: 'Ontario', city: 'Toronto' });
  assert.deepEqual(getTrustedClientLocation(new Request('https://jinlee.vip')), {
    country: null,
    region: null,
    city: null,
  });
});
