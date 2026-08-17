import fs from 'node:fs/promises';
import path from 'node:path';

const ENDPOINT =
  process.env.AUTH_LOGIN_AUDIT_PURGE_URL ||
  'http://127.0.0.1:3000/api/internal/auth-login-audit/purge';
const INTERVAL_MS = Number(process.env.AUTH_LOGIN_AUDIT_PURGE_INTERVAL_MS || 24 * 60 * 60 * 1000);
const STARTUP_DELAY_MS = Number(process.env.AUTH_LOGIN_AUDIT_PURGE_STARTUP_DELAY_MS || 30000);

async function loadEnvFile(fileName) {
  const filePath = path.join(process.cwd(), fileName);
  let raw = '';
  try {
    raw = await fs.readFile(filePath, 'utf8');
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
    return;
  }

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key]) continue;
    process.env[key] = rawValue.trim().replace(/^['"]|['"]$/g, '');
  }
}

const delay = (duration) => new Promise((resolve) => setTimeout(resolve, duration));

async function purge() {
  const token = process.env.AUTH_LOGIN_AUDIT_CRON_TOKEN || process.env.INTERNAL_API_TOKEN || '';
  if (!token) throw new Error('AUTH_LOGIN_AUDIT_CRON_TOKEN/INTERNAL_API_TOKEN is not configured');

  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'x-auth-login-audit-token': token },
  });
  const body = await response.text();
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${body}`);
  console.log(`[auth-login-audit] ${new Date().toISOString()} ${body}`);
}

await loadEnvFile('.env.local');
await loadEnvFile('.env');

if (process.argv.includes('--once')) {
  await purge();
  process.exit(0);
}

await delay(Math.max(0, STARTUP_DELAY_MS));
for (;;) {
  try {
    await purge();
  } catch (error) {
    console.error(`[auth-login-audit] purge failed: ${error instanceof Error ? error.message : String(error)}`);
  }
  await delay(Math.max(1000, INTERVAL_MS));
}
