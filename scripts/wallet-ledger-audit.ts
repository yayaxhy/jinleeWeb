import {
  loadWalletLedgerToolDatabase,
  parseWalletLedgerToolOptions,
  walletLedgerToolErrorCode,
} from '../lib/wallet-ledger-tool-config';

async function main() {
  const options = parseWalletLedgerToolOptions(process.argv.slice(2), false);
  if (options.help) {
    console.log('Usage: npx tsx scripts/wallet-ledger-audit.ts [--env-file FILE] [--after-id ID --through-id ID]\nRead-only arithmetic and coverage audit. Existing DATABASE_URL takes precedence over .env.local. No wallet or ledger mutations.');
    return;
  }
  const database = loadWalletLedgerToolDatabase(options);
  process.env.DATABASE_URL = database.normalizedUrl;
  const { Prisma, PrismaClient } = await import('@prisma/client');
  const { auditWalletLedger, configureWalletLedgerReadOnlyTransaction } = await import('../lib/wallet-ledger-backfill');
  const prisma = new PrismaClient({ log: [], datasources: { db: { url: database.normalizedUrl } } });
  try {
    const result = await prisma.$transaction(async (tx) => {
      await configureWalletLedgerReadOnlyTransaction(tx);
      return auditWalletLedger(tx, options.afterId, options.throughId);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 120_000, maxWait: 5000 });
    console.log(JSON.stringify({ mode: 'read-only', target: database.target, ...result }, null, 2));
    if (result.totals.invalidSourceMoney !== '0' ||
      (result.coverage && result.coverage.baseFactMismatch !== '0')) process.exitCode = 2;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(JSON.stringify({ error: walletLedgerToolErrorCode(error) }));
  process.exitCode = 1;
});
