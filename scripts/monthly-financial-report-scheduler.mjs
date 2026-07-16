import fs from 'node:fs/promises';
import path from 'node:path';

const TIME_ZONE = process.env.REPORT_GENERATOR_TIME_ZONE || 'Europe/Rome';
const ENDPOINT =
  process.env.REPORT_GENERATOR_URL ||
  'http://127.0.0.1:3000/api/admin/revenue/files/generate-due';
const STARTUP_DELAY_MS = Number(process.env.REPORT_GENERATOR_STARTUP_DELAY_MS || 15000);
const MAX_TIMEOUT_MS = 2_147_000_000;

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
    const value = rawValue.trim().replace(/^['"]|['"]$/g, '');
    process.env[key] = value;
  }
}

async function loadLocalEnv() {
  await loadEnvFile('.env.local');
  await loadEnvFile('.env');
}

function getToken() {
  return process.env.ADMIN_REPORT_CRON_TOKEN || process.env.INTERNAL_API_TOKEN || '';
}

function getParts(date) {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  const parts = formatter.formatToParts(date);
  const value = (type) => Number(parts.find((part) => part.type === type)?.value || 0);
  return {
    year: value('year'),
    month: value('month'),
    day: value('day'),
    hour: value('hour'),
    minute: value('minute'),
    second: value('second'),
  };
}

function getTimeZoneOffsetMs(date) {
  const parts = getParts(date);
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second, 0);
  const actualUtc = Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
    date.getUTCHours(),
    date.getUTCMinutes(),
    date.getUTCSeconds(),
    0,
  );
  return asUtc - actualUtc;
}

function localToUtc(year, month, day, hour, minute, second) {
  const localMs = Date.UTC(year, month - 1, day, hour, minute, second, 0);
  let resolvedMs = localMs;

  for (let index = 0; index < 3; index += 1) {
    const offsetMs = getTimeZoneOffsetMs(new Date(resolvedMs));
    const nextMs = localMs - offsetMs;
    if (nextMs === resolvedMs) break;
    resolvedMs = nextMs;
  }

  return new Date(resolvedMs);
}

function nextMonth(year, month) {
  return month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
}

function getNextRunAt(referenceDate = new Date()) {
  const parts = getParts(referenceDate);
  const currentMonthFirst = localToUtc(parts.year, parts.month, 1, 0, 0, 0);
  if (currentMonthFirst.getTime() > referenceDate.getTime() + 1000) {
    return currentMonthFirst;
  }
  const next = nextMonth(parts.year, parts.month);
  return localToUtc(next.year, next.month, 1, 0, 0, 0);
}

function setLongTimeout(callback, delayMs) {
  if (delayMs <= MAX_TIMEOUT_MS) {
    return setTimeout(callback, delayMs);
  }
  return setTimeout(() => setLongTimeout(callback, delayMs - MAX_TIMEOUT_MS), MAX_TIMEOUT_MS);
}

async function callGenerator() {
  const token = getToken();
  const headers = token ? { 'x-admin-report-token': token } : {};
  const response = await fetch(ENDPOINT, { headers });
  const bodyText = await response.text();
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${bodyText}`);
  }
  console.log(`[financial-report] ${new Date().toISOString()} ${bodyText}`);
}

async function callGeneratorWithRetry() {
  const delays = [0, 5000, 30000, 60000];
  let lastError = null;

  for (const delay of delays) {
    if (delay) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
    try {
      await callGenerator();
      return;
    } catch (error) {
      lastError = error;
      console.error(`[financial-report] generate failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  throw lastError;
}

function scheduleNextRun() {
  const runAt = getNextRunAt();
  const delayMs = Math.max(1000, runAt.getTime() - Date.now());
  console.log(`[financial-report] next run at ${runAt.toISOString()} (${TIME_ZONE})`);
  setLongTimeout(async () => {
    try {
      await callGeneratorWithRetry();
    } catch (error) {
      console.error(`[financial-report] scheduled run failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      scheduleNextRun();
    }
  }, delayMs);
}

await loadLocalEnv();

if (process.argv.includes('--once')) {
  await callGeneratorWithRetry();
  process.exit(0);
}

setTimeout(async () => {
  try {
    await callGeneratorWithRetry();
  } catch (error) {
    console.error(`[financial-report] startup run failed: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    scheduleNextRun();
  }
}, Math.max(0, STARTUP_DELAY_MS));

