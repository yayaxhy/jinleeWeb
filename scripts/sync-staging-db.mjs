import { spawn } from 'node:child_process';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';

if (process.env.JINLEE_ENV !== 'staging') {
  throw new Error('sync-staging-db can only run with JINLEE_ENV=staging');
}

const databaseUrl = new URL(process.env.DATABASE_URL || '');
if (!['127.0.0.1', 'localhost', '::1'].includes(databaseUrl.hostname.toLowerCase())) {
  throw new Error('sync-staging-db only supports a local disposable database');
}

const prisma = new PrismaClient();
const sequences = [
  'Withdraw_id_seq',
  'IndividualTransaction_transactionId_seq',
  'Coupon_id_seq',
  'Recharge_RechargeID_seq',
];

try {
  for (const sequence of sequences) {
    await prisma.$executeRawUnsafe(`CREATE SEQUENCE IF NOT EXISTS "${sequence}"`);
  }
} finally {
  await prisma.$disconnect();
}

const prismaCommand = path.resolve(
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'prisma.cmd' : 'prisma',
);
const child = spawn(prismaCommand, ['db', 'push', '--skip-generate', '--accept-data-loss'], {
  stdio: 'inherit',
  env: process.env,
});

child.on('error', (error) => {
  console.error('[staging] Failed to synchronize the database schema:', error);
  process.exit(1);
});
child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});
