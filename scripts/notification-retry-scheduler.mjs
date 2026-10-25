import path from 'node:path';
import { pathToFileURL } from 'node:url';
import dotenv from 'dotenv';

/** @param {Record<string, string | undefined>} env */
export function retrySchedulerConfig(env = process.env) {
  const url = new URL(env.NOTIFICATION_RETRY_URL || 'http://127.0.0.1:3000/api/internal/notifications/retry');
  const loopback = ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname);
  if (url.username || url.password || (url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback)) || url.pathname !== '/api/internal/notifications/retry') {
    throw new Error('NOTIFICATION_RETRY_URL must be the HTTPS or loopback notification retry endpoint');
  }
  // Product rule: inspect every five minutes, irrespective of old overrides.
  const intervalMs = 300_000;
  const startupDelayMs = Number(env.NOTIFICATION_RETRY_STARTUP_DELAY_MS || 30_000);
  if (!Number.isFinite(startupDelayMs) || startupDelayMs < 0) {
    throw new Error('Invalid notification retry scheduler interval');
  }
  const token = env.WEB_INTERNAL_NOTIFY_TOKEN?.trim() || env.INTERNAL_API_TOKEN?.trim();
  if (!token) throw new Error('WEB_INTERNAL_NOTIFY_TOKEN/INTERNAL_API_TOKEN is not configured');
  return { url: url.toString(), token, intervalMs, startupDelayMs };
}

export class NotificationRetryBatchError extends Error {
  constructor(summary) {
    super(`Notification retry processing failed: batchErrors=${summary.batchErrors} notificationErrors=${summary.notificationErrors} channelErrors=${summary.channelErrors} attempted=${summary.attempted} uncertain=${summary.uncertain}`);
    this.summary = summary;
  }
}

export async function retryNotifications(config, fetcher = fetch) {
  const response = await fetcher(config.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Internal-Token': config.token },
    body: JSON.stringify({ limit: 100 }),
    signal: AbortSignal.timeout(30_000),
    redirect: 'error',
  });
  const result = await response.json().catch(() => null);
  const fields = ['attempted', 'uncertain', 'channelErrors', 'notificationErrors', 'batchErrors', 'processingErrors'];
  const valid = result && fields.every((field) => Number.isSafeInteger(result[field]) && result[field] >= 0)
    && result.uncertain <= result.attempted
    && result.processingErrors === result.channelErrors + result.notificationErrors + result.batchErrors;
  if (!valid) {
    if (!response.ok) throw new Error(`Notification retry HTTP ${response.status}`);
    throw new Error('Invalid notification retry response');
  }
  const summary = Object.fromEntries(fields.map((field) => [field, result[field]]));
  if (result.ok !== true || summary.processingErrors || !response.ok) throw new NotificationRetryBatchError(summary);
  return summary;
}

async function main() {
  // Load deployment files only when invoked, never when imported by offline tests.
  dotenv.config({ path: '.env.local', quiet: true });
  dotenv.config({ path: '.env', quiet: true });
  const config = retrySchedulerConfig();
  if (process.argv.includes('--dry-run')) {
    console.log(JSON.stringify({ ok: true, dryRun: true, intervalMs: config.intervalMs, startupDelayMs: config.startupDelayMs }));
    return;
  }
  const once = process.argv.includes('--once');
  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  if (!once) await delay(config.startupDelayMs);
  do {
    try {
      const result = await retryNotifications(config);
      console.log(`[notification-retry] attempted=${result.attempted} uncertain=${result.uncertain}`);
    } catch (error) {
      // Do not print request headers, provider bodies, URLs or underlying errors.
      console.error(error instanceof NotificationRetryBatchError
        ? `[notification-retry] ${error.message}`
        : '[notification-retry] request failed; inspect the notification monitor');
      if (once) process.exitCode = 1;
    }
    if (once) break;
    await delay(config.intervalMs);
  } while (true);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch(() => {
    console.error('[notification-retry] startup configuration failed');
    process.exitCode = 1;
  });
}
