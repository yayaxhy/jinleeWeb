import {
  loadWalletLedgerToolDatabase,
  parseWalletLedgerToolOptions,
  walletLedgerToolErrorCode,
} from '../lib/wallet-ledger-tool-config';

async function main() {
  const options = parseWalletLedgerToolOptions(process.argv.slice(2), true);
  if (options.help) {
    console.log(`Usage: npx tsx scripts/wallet-ledger-backfill.ts [options]
  --env-file FILE              Optional env file; existing DATABASE_URL wins.
  --apply                     Insert missing ledger entries. Default: read-only dry run.
  --confirm-database NAME      Required with --apply; must match connected database.
  --batch-size N              1..5000, default 1000.
  --max-batches N             1..1000, default 100; bounds each invocation.
  --after-id ID --through-id ID Resume from a reported committed cursor and high-water mark.

Historical wallet, order, claim, and source transaction data are never modified.
Each committed batch prints its resume cursor. Ctrl-C stops after the active batch.
Unknown historical component deltas stay null; arithmetic anomalies are retained and flagged.`);
    return;
  }
  const database = loadWalletLedgerToolDatabase(options);
  process.env.DATABASE_URL = database.normalizedUrl;
  const { Prisma, PrismaClient } = await import('@prisma/client');
  const { auditWalletLedger, configureWalletLedgerReadOnlyTransaction, hasWalletLedgerTable,
    verifyWalletLedgerBatch, walletLedgerBackfillInsert, walletLedgerRangePredicate } = await import('../lib/wallet-ledger-backfill');
  const prisma = new PrismaClient({ log: [], datasources: { db: { url: database.normalizedUrl } } });
  let afterId = options.afterId;
  let throughId = options.throughId;
  let interrupted = false;
  let committedBatches = 0;
  let inserted = 0;
  let scanned = 0;
  const interrupt = () => { interrupted = true; };
  process.on('SIGINT', interrupt);
  process.on('SIGTERM', interrupt);
  try {
    const initial = await prisma.$transaction(async (tx) => {
      await configureWalletLedgerReadOnlyTransaction(tx);
      const [database] = await tx.$queryRaw<{ name: string }[]>`SELECT current_database() AS name`;
      if (options.apply && database.name !== options.confirmDatabase) throw new Error('ledger_database_confirmation_mismatch');
      return auditWalletLedger(tx, afterId, throughId);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 120_000, maxWait: 5000 });
    throughId ??= initial.totals.throughId ?? undefined;
    console.log(JSON.stringify({ mode: options.apply ? 'apply-preflight' : 'dry-run', target: database.target, afterId: afterId ?? null, throughId: throughId ?? null, ...initial }));
    if (!options.apply) return;
    if (initial.totals.invalidSourceMoney !== '0') throw new Error('ledger_invalid_source_money');
    if (!initial.ledgerTablePresent) throw new Error('ledger_migration_required');
    if (!initial.protections?.requiredTriggersEnabled) throw new Error('ledger_capture_protection_required');
    if (initial.coverage?.baseFactMismatch !== '0') throw new Error('ledger_existing_base_facts_mismatch');
    if (!throughId) return;

    let complete = false;
    while (!interrupted && committedBatches < options.maxBatches) {
      const result = await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SET LOCAL statement_timeout = '30s'`;
        await tx.$executeRaw`SET LOCAL lock_timeout = '3s'`;
        if (!(await hasWalletLedgerTable(tx))) throw new Error('ledger_migration_required');
        const rows = await tx.$queryRaw<{ id: string }[]>`
          SELECT t."transactionId" AS id FROM "IndividualTransaction" t
          WHERE ${walletLedgerRangePredicate(afterId, throughId)}
          ORDER BY t."transactionId" LIMIT ${options.batchSize} FOR SHARE OF t
        `;
        const ids = rows.map((row) => row.id);
        if (!ids.length) return { count: 0, inserted: 0, cursor: afterId };
        await verifyWalletLedgerBatch(tx, ids);
        const changed = await tx.$executeRaw(walletLedgerBackfillInsert(ids));
        await verifyWalletLedgerBatch(tx, ids);
        const [coverage] = await tx.$queryRaw<{ missingCount: string }[]>`
          SELECT COUNT(*)::text AS "missingCount" FROM "IndividualTransaction" t
          LEFT JOIN "WalletLedgerEntry" l ON l."sourceTransactionId" = t."transactionId"
          WHERE t."transactionId" IN (${Prisma.join(ids)}) AND l."sourceTransactionId" IS NULL
        `;
        if (coverage.missingCount !== '0') throw new Error('ledger_batch_coverage_incomplete');
        return { count: ids.length, inserted: changed, cursor: ids[ids.length - 1] };
      }, { timeout: 120_000, maxWait: 5000 });
      // Only advance the cursor after the transaction has committed, never from inside its callback.
      if (!result.count) { complete = true; break; }
      afterId = result.cursor;
      committedBatches += 1;
      inserted += result.inserted;
      scanned += result.count;
      console.log(JSON.stringify({ mode: 'batch-committed', committedBatches, inserted, scanned, afterId, throughId }));
      if (result.count < options.batchSize || afterId === throughId) { complete = true; break; }
    }
    console.log(JSON.stringify({ mode: 'finished', complete, interrupted, committedBatches, inserted, scanned, afterId, throughId }));
    if (interrupted) process.exitCode = 130;
  } catch (error) {
    console.error(JSON.stringify({ error: walletLedgerToolErrorCode(error), committedBatches, inserted, scanned, afterId: afterId ?? null, throughId: throughId ?? null }));
    process.exitCode = 1;
  } finally {
    process.off('SIGINT', interrupt);
    process.off('SIGTERM', interrupt);
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(JSON.stringify({ error: walletLedgerToolErrorCode(error) }));
  process.exitCode = 1;
});
