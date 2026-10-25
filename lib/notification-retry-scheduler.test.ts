import assert from 'node:assert/strict';
import test from 'node:test';
import { execFileSync, spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { NotificationRetryBatchError, retryNotifications, retrySchedulerConfig } from '../scripts/notification-retry-scheduler.mjs';

test('scheduler defaults to five minutes and chooses the notification-specific token', () => {
  const config = retrySchedulerConfig({ WEB_INTERNAL_NOTIFY_TOKEN: 'test-only-notification', INTERNAL_API_TOKEN: 'test-only-fallback' });
  assert.equal(config.intervalMs, 300_000);
  assert.equal(config.token, 'test-only-notification');
  assert.equal(config.url, 'http://127.0.0.1:3000/api/internal/notifications/retry');
  assert.equal(retrySchedulerConfig({ INTERNAL_API_TOKEN: 'test-only-fallback' }).token, 'test-only-fallback');
});

test('scheduler refuses missing token, bad intervals and cleartext remote destinations', () => {
  assert.throws(() => retrySchedulerConfig({}));
  for (const patch of [
    { NOTIFICATION_RETRY_STARTUP_DELAY_MS: '-1' },
    { NOTIFICATION_RETRY_URL: 'http://example.test/api/internal/notifications/retry' },
    { NOTIFICATION_RETRY_URL: 'https://example.test/another-api' },
  ]) assert.throws(() => retrySchedulerConfig({ INTERNAL_API_TOKEN: 'test-only', ...patch }));
});

test('offline scheduler sends only a bounded authenticated retry and refuses redirects', async () => {
  const config = retrySchedulerConfig({ INTERNAL_API_TOKEN: 'test-only' });
  const result = await retryNotifications(config, async (input, options) => {
    assert.equal(input, config.url);
    assert.equal(options?.method, 'POST');
    assert.equal(options?.redirect, 'error');
    assert.equal((options?.headers as Record<string, string>)['X-Internal-Token'], 'test-only');
    assert.equal(options?.body, '{"limit":100}');
    return Response.json({ ok: true, attempted: 2, uncertain: 1, channelErrors: 0, notificationErrors: 0, batchErrors: 0, processingErrors: 0 });
  });
  assert.deepEqual(result, { attempted: 2, uncertain: 1, channelErrors: 0, notificationErrors: 0, batchErrors: 0, processingErrors: 0 });
});

test('scheduler errors never include server response bodies or tokens', async () => {
  const config = retrySchedulerConfig({ INTERNAL_API_TOKEN: 'test-only' });
  await assert.rejects(retryNotifications(config, async () => new Response('secret-provider-body', { status: 503 })), /^Error: Notification retry HTTP 503$/);
});

test('scheduler reports a partial processing failure with safe counts even on HTTP 503', async () => {
  const config = retrySchedulerConfig({ INTERNAL_API_TOKEN: 'test-only' });
  await assert.rejects(retryNotifications(config, async () => Response.json({
    ok: false, attempted: 2, uncertain: 1, channelErrors: 1, notificationErrors: 1, batchErrors: 0, processingErrors: 2,
    error: 'secret-server-exception',
  }, { status: 503 })), (error: unknown) => {
    assert.ok(error instanceof NotificationRetryBatchError);
    assert.equal(error.summary.processingErrors, 2);
    assert.match(error.message, /channelErrors=1/);
    assert.ok(!error.message.includes('secret'));
    return true;
  });
});

test('scheduler never treats processing errors as a successful empty queue, even with HTTP 200', async () => {
  const config = retrySchedulerConfig({ INTERNAL_API_TOKEN: 'test-only' });
  await assert.rejects(retryNotifications(config, async () => Response.json({
    ok: true, attempted: 0, uncertain: 0, channelErrors: 3, notificationErrors: 0, batchErrors: 0, processingErrors: 3,
  })), NotificationRetryBatchError);
});

test('dry-run validates configuration and exits without any network request or timer loop', () => {
  const output = execFileSync(process.execPath, [
    '--import', 'data:text/javascript,globalThis.fetch=()=>{throw new Error("network forbidden in dry-run")}',
    path.resolve('scripts/notification-retry-scheduler.mjs'), '--dry-run',
  ], {
    cwd: tmpdir(), timeout: 3000, encoding: 'utf8',
    env: { NODE_ENV: 'test', INTERNAL_API_TOKEN: 'test-only', NOTIFICATION_RETRY_STARTUP_DELAY_MS: '0' },
  });
  assert.deepEqual(JSON.parse(output), { ok: true, dryRun: true, intervalMs: 300_000, startupDelayMs: 0 });
  assert.ok(!output.includes('test-only'));
});

test('once exits with failure and safe counts for a partial batch using only an injected response', () => {
  const stub = `globalThis.fetch=async()=>Response.json({ok:false,attempted:2,uncertain:1,channelErrors:1,notificationErrors:0,batchErrors:0,processingErrors:1,error:"secret-provider-body"},{status:503})`;
  const result = spawnSync(process.execPath, [
    '--import', `data:text/javascript,${encodeURIComponent(stub)}`,
    path.resolve('scripts/notification-retry-scheduler.mjs'), '--once',
  ], {
    cwd: tmpdir(), timeout: 3000, encoding: 'utf8',
    env: { NODE_ENV: 'test', INTERNAL_API_TOKEN: 'test-only', NOTIFICATION_RETRY_STARTUP_DELAY_MS: '0' },
  });
  assert.equal(result.error, undefined);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /channelErrors=1 attempted=2 uncertain=1/);
  assert.ok(!result.stdout.includes('attempted=0'));
  assert.ok(!`${result.stdout}${result.stderr}`.includes('test-only'));
  assert.ok(!`${result.stdout}${result.stderr}`.includes('secret-provider-body'));
});

test('old interval overrides cannot shorten or lengthen the five-minute policy', () => {
  for (const interval of ['1000', '900000', 'NaN']) assert.equal(retrySchedulerConfig({ INTERNAL_API_TOKEN: 'test-only', NOTIFICATION_RETRY_INTERVAL_MS: interval }).intervalMs, 300000);
});
