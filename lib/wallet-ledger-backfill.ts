import { Prisma } from '@prisma/client';

export { parseWalletLedgerToolOptions, validateWalletLedgerDatabaseTarget, walletLedgerToolErrorCode } from './wallet-ledger-tool-config';

export type LegacyLedgerFacts = {
  transactionId: string;
  amountChange: Prisma.Decimal;
  balanceBefore: Prisma.Decimal;
  balanceAfter: Prisma.Decimal;
};

/** Preserve the original amount exactly; derive only the new signed delta. */
export function classifyLegacyLedgerFacts(facts: LegacyLedgerFacts) {
  const deltaAmount = facts.balanceAfter.sub(facts.balanceBefore);
  if ([facts.balanceBefore, facts.balanceAfter, facts.amountChange, deltaAmount]
    .some((amount) => !amount.isFinite() || amount.abs().gte('1000000000000000') || amount.decimalPlaces() > 4)) {
    throw new Error('ledger_invalid_source_money');
  }
  return { deltaAmount, originalAmountChange: facts.amountChange,
    amountMagnitudeMismatch: !deltaAmount.abs().eq(facts.amountChange.abs()) };
}

export type WalletLedgerSqlClient = Pick<Prisma.TransactionClient, '$queryRaw' | '$executeRaw'>;

export async function configureWalletLedgerReadOnlyTransaction(tx: WalletLedgerSqlClient) {
  await tx.$executeRaw`SET TRANSACTION READ ONLY`;
  await tx.$executeRaw`SET LOCAL statement_timeout = '30s'`;
  await tx.$executeRaw`SET LOCAL lock_timeout = '3s'`;
}

export async function transactionDeltaColumnStatus(tx: WalletLedgerSqlClient) {
  const [row] = await tx.$queryRaw<{ present: boolean; compatibleType: boolean }[]>`
    SELECT COUNT(*) = 1 AS present,
      COUNT(*) FILTER (WHERE data_type = 'numeric' AND numeric_precision = 19 AND numeric_scale = 4) = 1 AS "compatibleType"
    FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'IndividualTransaction' AND column_name = 'deltaAmount'
  `;
  return row;
}

export async function transactionDeltaProtectionStatus(tx: WalletLedgerSqlClient) {
  const [row] = await tx.$queryRaw<{ requiredProtectionEnabled: boolean }[]>`
    SELECT EXISTS (
      SELECT 1 FROM pg_trigger g JOIN pg_class c ON c.oid = g.tgrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = current_schema() AND c.relname = 'IndividualTransaction'
        AND g.tgname = 'IndividualTransaction_set_deltaAmount'
        AND g.tgenabled IN ('O', 'A') AND NOT g.tgisinternal
    ) AND EXISTS (
      SELECT 1 FROM pg_constraint k JOIN pg_class c ON c.oid = k.conrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = current_schema() AND c.relname = 'IndividualTransaction'
        AND k.conname = 'IndividualTransaction_deltaAmount_consistent' AND k.contype = 'c'
    ) AS "requiredProtectionEnabled"
  `;
  return row;
}

export const walletLedgerMismatchPredicate = () => Prisma.sql`
  t."deltaAmount" IS NOT NULL AND t."deltaAmount" IS DISTINCT FROM t."balanceAfter" - t."balanceBefore"
`;

export function walletLedgerRangePredicate(afterId?: string, throughId?: string) {
  return Prisma.sql`
    ${afterId ? Prisma.sql`t."transactionId" > ${afterId}` : Prisma.sql`TRUE`}
    AND ${throughId ? Prisma.sql`t."transactionId" <= ${throughId}` : Prisma.sql`TRUE`}
  `;
}

const nonFiniteMoney = () => Prisma.sql`
  t."balanceBefore"::text IN ('NaN', 'Infinity', '-Infinity')
  OR t."balanceAfter"::text IN ('NaN', 'Infinity', '-Infinity')
  OR t."amountChange"::text IN ('NaN', 'Infinity', '-Infinity')
`;
const deltaOutOfRange = () => Prisma.sql`
  (t."balanceAfter" - t."balanceBefore")::text NOT IN ('NaN', 'Infinity', '-Infinity')
  AND ABS(t."balanceAfter" - t."balanceBefore") >= 1000000000000000
`;
export const walletLedgerInvalidMoneyPredicate = () => Prisma.sql`(${nonFiniteMoney()}) OR (${deltaOutOfRange()})`;

/** Must be called inside a read-only transaction for a report. Uses Decimal/text, never float sums. */
export async function auditWalletLedger(tx: WalletLedgerSqlClient, afterId?: string, throughId?: string) {
  const range = walletLedgerRangePredicate(afterId, throughId);
  const column = await transactionDeltaColumnStatus(tx);
  const [totals] = await tx.$queryRaw<Record<string, string | null>[]>`
    SELECT COUNT(*)::text AS "sourceCount",
      MIN(t."transactionId") AS "firstId", MAX(t."transactionId") AS "throughId",
      COUNT(*) FILTER (WHERE t."balanceAfter" < t."balanceBefore")::text AS "debits",
      COUNT(*) FILTER (WHERE t."balanceAfter" > t."balanceBefore")::text AS "credits",
      COUNT(*) FILTER (WHERE t."balanceAfter" = t."balanceBefore")::text AS "zeroDelta",
      COUNT(*) FILTER (WHERE ABS(t."balanceAfter" - t."balanceBefore") <> ABS(t."amountChange"))::text AS "magnitudeMismatch",
      COUNT(*) FILTER (WHERE NULLIF(t."dlmId", '') IS NULL AND NULLIF(t."discordId", '') IS NULL)::text AS "missingIdentity",
      COUNT(*) FILTER (WHERE t."balanceAfter" = t."balanceBefore" AND t."amountChange" <> 0)::text AS "zeroDeltaNonzeroAmount",
      COUNT(*) FILTER (WHERE ${nonFiniteMoney()})::text AS "nonFiniteSourceMoney",
      COUNT(*) FILTER (WHERE ${deltaOutOfRange()})::text AS "deltaOutOfRange",
      COUNT(*) FILTER (WHERE ${walletLedgerInvalidMoneyPredicate()})::text AS "invalidSourceMoney",
      COALESCE(SUM(t."balanceAfter" - t."balanceBefore"), 0)::text AS "derivedDeltaAmount",
      COALESCE(SUM(t."amountChange"), 0)::text AS "originalAmountChangeSum"
    FROM "IndividualTransaction" t WHERE ${range}
  `;
  const groups = await tx.$queryRaw<Record<string, string>[]>`
    SELECT t."typeOfTransaction" AS "type", COUNT(*)::text AS "count",
      COALESCE(SUM(t."balanceAfter" - t."balanceBefore"), 0)::text AS "derivedDeltaAmount",
      COUNT(*) FILTER (WHERE ABS(t."balanceAfter" - t."balanceBefore") <> ABS(t."amountChange"))::text AS "magnitudeMismatch"
    FROM "IndividualTransaction" t WHERE ${range}
    GROUP BY t."typeOfTransaction" ORDER BY COUNT(*) DESC, t."typeOfTransaction"
  `;
  // Aggregate only: do not print user names, Discord IDs, wallet values, or connection details.
  const [identityLinks] = await tx.$queryRaw<Record<string, string>[]>`
    SELECT COUNT(*) FILTER (WHERE t."dlmId" IS NOT NULL AND u."dlmId" IS NULL)::text AS "missingCurrentOwner",
      COUNT(*) FILTER (WHERE t."dlmId" IS NULL AND t."discordId" IS NOT NULL)::text AS "discordOnlyRows",
      COUNT(*) FILTER (WHERE t."discordId" IS NOT NULL AND u."discordUserId" IS NOT NULL
        AND t."discordId" <> u."discordUserId")::text AS "ownerDiscordDiffers"
    FROM "IndividualTransaction" t LEFT JOIN "DlmUser" u ON u."dlmId" = t."dlmId"
    WHERE ${range}
  `;
  const anomalies = await tx.$queryRaw<{ sourceTransactionId: string; category: string }[]>`
    SELECT t."transactionId" AS "sourceTransactionId", CASE
      WHEN ${walletLedgerInvalidMoneyPredicate()} THEN 'INVALID_SOURCE_MONEY'
      WHEN NULLIF(t."dlmId", '') IS NULL AND NULLIF(t."discordId", '') IS NULL THEN 'MISSING_IDENTITY'
      ELSE 'ORIGINAL_AMOUNT_MAGNITUDE_MISMATCH' END AS category
    FROM "IndividualTransaction" t WHERE ${range}
      AND ((${walletLedgerInvalidMoneyPredicate()})
        OR (NULLIF(t."dlmId", '') IS NULL AND NULLIF(t."discordId", '') IS NULL)
        OR ABS(t."balanceAfter" - t."balanceBefore") <> ABS(t."amountChange"))
    ORDER BY t."transactionId" LIMIT 100
  `;
  let coverage: Record<string, string> | null = null;
  let protections: { requiredProtectionEnabled: boolean } | null = null;
  let deltaMismatches: { sourceTransactionId: string }[] = [];
  if (column.present) {
    protections = await transactionDeltaProtectionStatus(tx);
    [coverage] = await tx.$queryRaw<Record<string, string>[]>`
      SELECT COUNT(*) FILTER (WHERE t."deltaAmount" IS NOT NULL)::text AS "filledCount",
        COUNT(*) FILTER (WHERE t."deltaAmount" IS NULL)::text AS "missingCount",
        COUNT(*) FILTER (WHERE ${walletLedgerMismatchPredicate()})::text AS "deltaMismatch",
        COALESCE(SUM(t."deltaAmount"), 0)::text AS "storedDeltaAmount"
      FROM "IndividualTransaction" t WHERE ${range}
    `;
    deltaMismatches = await tx.$queryRaw<{ sourceTransactionId: string }[]>`
      SELECT t."transactionId" AS "sourceTransactionId" FROM "IndividualTransaction" t
      WHERE ${range} AND (${walletLedgerMismatchPredicate()}) ORDER BY t."transactionId" LIMIT 100
    `;
  }
  return {
    deltaColumnPresent: column.present, compatibleColumnType: column.compatibleType,
    protections, totals, groups, identityLinks, coverage, anomalies, deltaMismatches, anomalySampleLimit: 100,
    verificationScope: 'Arithmetic consistency only, not full financial reconciliation. amountChange retains its original meaning and value.',
  };
}

export async function verifyWalletLedgerBatch(tx: WalletLedgerSqlClient, ids: string[]) {
  if (!ids.length) return;
  const [result] = await tx.$queryRaw<{ mismatchCount: string; invalidSourceMoney: string }[]>`
    SELECT COUNT(*) FILTER (WHERE ${walletLedgerMismatchPredicate()})::text AS "mismatchCount",
      COUNT(*) FILTER (WHERE ${walletLedgerInvalidMoneyPredicate()})::text AS "invalidSourceMoney"
    FROM "IndividualTransaction" t
    WHERE t."transactionId" IN (${Prisma.join(ids)})
  `;
  if (result.invalidSourceMoney !== '0') throw new Error('ledger_invalid_source_money');
  if (result.mismatchCount !== '0') throw new Error('ledger_existing_delta_mismatch');
}

/** Fill only the new nullable column. Original facts, wallets and nonnull deltas never change. */
export function walletLedgerBackfillUpdate(ids: string[]) {
  if (!ids.length) throw new Error('ledger_backfill_empty_batch');
  return Prisma.sql`
    UPDATE "IndividualTransaction" t
    SET "deltaAmount" = t."balanceAfter" - t."balanceBefore"
    WHERE t."transactionId" IN (${Prisma.join(ids)}) AND t."deltaAmount" IS NULL
  `;
}
