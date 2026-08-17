import fs from 'node:fs/promises';
import path from 'node:path';

const ENDPOINT =
  process.env.WECHAT_NATIVE_RECONCILE_URL ||
  'http://127.0.0.1:3000/api/internal/wechat-native/reconcile';
const INTERVAL_MS = Number(process.env.WECHAT_NATIVE_RECONCILE_INTERVAL_MS || 5 * 60 * 1000);
const STARTUP_DELAY_MS = Number(process.env.WECHAT_NATIVE_RECONCILE_STARTUP_DELAY_MS || 15000);

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

async function loadLocalEnv() {
  await loadEnvFile('.env.local');
  await loadEnvFile('.env');
}

const delay = (duration) => new Promise((resolve) => setTimeout(resolve, duration));

async function reconcile() {
  const token = process.env.WECHAT_NATIVE_RECONCILE_TOKEN || process.env.INTERNAL_API_TOKEN || '';
  if (!token) throw new Error('WECHAT_NATIVE_RECONCILE_TOKEN/INTERNAL_API_TOKEN is not configured');

  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'x-wechat-native-reconcile-token': token },
  });
  const body = await response.text();
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${body}`);
  console.log(`[wechat-native-reconcile] ${new Date().toISOString()} ${body}`);
}

await loadLocalEnv();

if (process.argv.includes('--once')) {
  await reconcile();
  process.exit(0);
}

await delay(Math.max(0, STARTUP_DELAY_MS));
for (;;) {
  try {
    await reconcile();
  } catch (error) {
    console.error(`[wechat-native-reconcile] failed: ${error instanceof Error ? error.message : String(error)}`);
  }
  await delay(Math.max(1000, INTERVAL_MS));
}
