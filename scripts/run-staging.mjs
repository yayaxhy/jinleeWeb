import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';

const envPath = path.resolve(process.env.STAGING_ENV_FILE || '.env.staging.local');

if (!fs.existsSync(envPath)) {
  console.error(`[staging] Missing ${envPath}. Copy .env.staging.example and fill in test-only credentials.`);
  process.exit(1);
}

const loaded = dotenv.config({ path: envPath, override: true });
if (loaded.error) throw loaded.error;

if (process.env.JINLEE_ENV !== 'staging') {
  console.error('[staging] JINLEE_ENV must be exactly "staging".');
  process.exit(1);
}

function assertSafeDatabaseUrl(rawValue) {
  let databaseUrl;
  try {
    databaseUrl = new URL(rawValue || '');
  } catch {
    throw new Error('DATABASE_URL must be a valid PostgreSQL URL.');
  }

  if (!['postgres:', 'postgresql:'].includes(databaseUrl.protocol)) {
    throw new Error('DATABASE_URL must use PostgreSQL.');
  }

  const host = databaseUrl.hostname.toLowerCase();
  const database = databaseUrl.pathname.replace(/^\//, '').toLowerCase();
  const target = `${host}/${database}`;
  const isClearlyNonProduction = /(staging|stage|test|testing|dev|local)/.test(target);

  if (/(^|[./_-])(prod|production)([./_-]|$)/.test(target)) {
    throw new Error(`Refusing a production-looking database target: ${target}`);
  }
  if (!isClearlyNonProduction) {
    throw new Error(`Staging database must include staging/test/dev/local in its host or database name: ${target}`);
  }

  console.log(`[staging] Database safety check passed for ${host}/${database}.`);
}

try {
  assertSafeDatabaseUrl(process.env.DATABASE_URL);
} catch (error) {
  console.error(`[staging] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}

const internalToken = process.env.INTERNAL_API_TOKEN || '';
if (internalToken.length < 24) {
  console.error('[staging] INTERNAL_API_TOKEN must contain at least 24 characters.');
  process.exit(1);
}

const [command, ...args] = process.argv.slice(2);
if (!command) {
  console.error('[staging] No command supplied.');
  process.exit(1);
}

const executable = command === 'node'
  ? process.execPath
  : path.resolve('node_modules', '.bin', process.platform === 'win32' ? `${command}.cmd` : command);
const child = spawn(executable, args, {
  stdio: 'inherit',
  env: process.env,
});

child.on('error', (error) => {
  console.error(`[staging] Failed to start ${command}:`, error);
  process.exit(1);
});
child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});
