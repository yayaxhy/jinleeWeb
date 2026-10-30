import { Prisma } from '@prisma/client';

export { parseWalletLedgerToolOptions, validateWalletLedgerDatabaseTarget, walletLedgerToolErrorCode } from './wallet-ledger-tool-config';

export type LegacyLedgerFacts = {
  transactionId: string;
  dlmId: string | null;
  discordId: string | null;
  amountChange: Prisma.Decimal;
  balanceBefore: Prisma.Decimal;
  balanceAfter: Prisma.Decimal;
};

export function classifyLegacyLedgerFacts(facts: LegacyLedgerFacts) {
  const walletDelta = facts.balanceAfter.sub(facts.balanceBefore);
  const businessAmount = facts.amountChange.abs();
  if ([facts.balanceBefore, facts.balanceAfter, businessAmount, walletDelta]
    .some((amount) => !amount.isFinite() || amount.abs().gte('1000000000000000') || amount.decimalPlaces() > 4)) {
    throw new Error('ledger_invalid_source_money');
  }
  return {
    id: `WLE:${facts.transactionId}`,
    walletDelta,
    businessAmount,
    direction: walletDelta.gt(0) ? 'CREDIT' : walletDelta.lt(0) ? 'DEBIT' : 'NONE',
    integrityStatus: !facts.dlmId && !facts.discordId ? 'UNVERIFIABLE'
      : walletDelta.abs().eq(businessAmount) ? 'VERIFIED' : 'REQUIRES_REVIEW',
  } as const;
}

export type WalletLedgerSqlClient = Pick<Prisma.TransactionClient, '$queryRaw' | '$executeRaw'>;

export async function configureWalletLedgerReadOnlyTransaction(tx: WalletLedgerSqlClient) {
  await tx.$executeRaw`SET TRANSACTION READ ONLY`;
  await tx.$executeRaw`SET LOCAL statement_timeout = '30s'`;
  await tx.$executeRaw`SET LOCAL lock_timeout = '3s'`;
}

export async function hasWalletLedgerTable(tx: WalletLedgerSqlClient) {
  const [row] = await tx.$queryRaw<{ present: boolean }[]>`
    SELECT to_regclass('"WalletLedgerEntry"') IS NOT NULL AS present
  `;
  return row.present;
}

export async function walletLedgerProtectionStatus(tx: WalletLedgerSqlClient) {
  const [row] = await tx.$queryRaw<{ requiredTriggersEnabled: boolean }[]>`
    SELECT COUNT(*) = 4 AS "requiredTriggersEnabled"
    FROM pg_trigger g JOIN pg_class c ON c.oid = g.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = current_schema() AND g.tgenabled IN ('O', 'A') AND NOT g.tgisinternal
      AND ((c.relname = 'IndividualTransaction' AND g.tgname = 'IndividualTransaction_capture_wallet_ledger'
              AND g.tgdeferrable AND g.tginitdeferred)
        OR (c.relname = 'WalletLedgerEntry' AND g.tgname = 'WalletLedgerEntry_validate_source'
              AND g.tgdeferrable AND g.tginitdeferred)
        OR (c.relname = 'WalletLedgerEntry' AND g.tgname IN ('WalletLedgerEntry_no_update_or_delete', 'WalletLedgerEntry_no_truncate')))
  `;
  return row;
}

/** Account IDs and counterparty snapshots are intentionally not compared: account merge can change source ownership. */
export function walletLedgerMismatchPredicate() {
  return Prisma.sql`
    l."walletDelta" IS DISTINCT FROM t."balanceAfter" - t."balanceBefore"
    OR l."businessAmount" IS DISTINCT FROM ABS(t."amountChange")
    OR l."balanceBefore" IS DISTINCT FROM t."balanceBefore"
    OR l."balanceAfter" IS DISTINCT FROM t."balanceAfter"
    OR l."legacyType" IS DISTINCT FROM t."typeOfTransaction"
    OR l."eventType" IS DISTINCT FROM wallet_ledger_event_type(t."typeOfTransaction", t."balanceAfter" - t."balanceBefore")
    OR l."timeCreatedAt" IS DISTINCT FROM t."timeCreatedAt"
    OR l."currency" IS DISTINCT FROM 'CNY'
    OR l."direction" IS DISTINCT FROM CASE
      WHEN t."balanceAfter" > t."balanceBefore" THEN 'CREDIT'
      WHEN t."balanceAfter" < t."balanceBefore" THEN 'DEBIT'
      ELSE 'NONE' END
  `;
}

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
  const present = await hasWalletLedgerTable(tx);
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
      COALESCE(SUM(t."balanceAfter" - t."balanceBefore"), 0)::text AS "walletDelta",
      COALESCE(SUM(ABS(t."amountChange")), 0)::text AS "businessAmount"
    FROM "IndividualTransaction" t WHERE ${range}
  `;
  const groups = await tx.$queryRaw<Record<string, string>[]>`
    SELECT t."typeOfTransaction" AS "type", COUNT(*)::text AS "count",
      COALESCE(SUM(t."balanceAfter" - t."balanceBefore"), 0)::text AS "walletDelta",
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
      WHEN NULLIF(t."dlmId", '') IS NULL AND NULLIF(t."discordId", '') IS NULL THEN 'UNVERIFIABLE'
      ELSE 'REQUIRES_REVIEW' END AS category
    FROM "IndividualTransaction" t WHERE ${range}
      AND ((${walletLedgerInvalidMoneyPredicate()})
        OR (NULLIF(t."dlmId", '') IS NULL AND NULLIF(t."discordId", '') IS NULL)
        OR ABS(t."balanceAfter" - t."balanceBefore") <> ABS(t."amountChange"))
    ORDER BY t."transactionId" LIMIT 100
  `;
  let coverage: Record<string, string> | null = null;
  let protections: { requiredTriggersEnabled: boolean } | null = null;
  if (present) {
    protections = await walletLedgerProtectionStatus(tx);
    [coverage] = await tx.$queryRaw<Record<string, string>[]>`
      SELECT COUNT(l."sourceTransactionId")::text AS "coveredCount",
        COUNT(*) FILTER (WHERE l."sourceTransactionId" IS NULL)::text AS "missingCount",
        COUNT(*) FILTER (WHERE l."sourceTransactionId" IS NOT NULL AND (${walletLedgerMismatchPredicate()}))::text AS "baseFactMismatch",
        COUNT(*) FILTER (WHERE l."sourceTransactionId" IS NOT NULL AND
          (l."dlmId" IS DISTINCT FROM t."dlmId" OR l."discordId" IS DISTINCT FROM t."discordId"))::text AS "ownershipSnapshotChanges",
        COUNT(*) FILTER (WHERE l."integrityStatus" = 'REQUIRES_REVIEW')::text AS "requiresReview",
        COUNT(*) FILTER (WHERE l."integrityStatus" = 'UNVERIFIABLE')::text AS "unverifiable",
        COUNT(*) FILTER (WHERE l."source" = 'LIVE')::text AS "live",
        COUNT(*) FILTER (WHERE l."source" = 'COMPATIBILITY')::text AS "compatibility",
        COUNT(*) FILTER (WHERE l."source" = 'LEGACY_BACKFILL')::text AS "legacyBackfill",
        COALESCE(SUM(l."walletDelta"), 0)::text AS "ledgerWalletDelta",
        COALESCE(SUM(l."businessAmount"), 0)::text AS "ledgerBusinessAmount"
      FROM "IndividualTransaction" t LEFT JOIN "WalletLedgerEntry" l ON l."sourceTransactionId" = t."transactionId"
      WHERE ${range}
    `;
  }
  return {
    ledgerTablePresent: present, protections, totals, groups, identityLinks, coverage, anomalies,
    anomalySampleLimit: 100,
    verificationScope: 'Arithmetic consistency only; not proof of complete history, cash reconciliation, or business eligibility.',
    ownershipNote: 'Ownership snapshot changes can follow a valid account merge; they are not monetary mismatches.',
  };
}

export async function verifyWalletLedgerBatch(tx: WalletLedgerSqlClient, ids: string[]) {
  if (!ids.length) return;
  const [result] = await tx.$queryRaw<{ mismatchCount: string; invalidSourceMoney: string }[]>`
    SELECT COUNT(*) FILTER (WHERE l."sourceTransactionId" IS NOT NULL AND (${walletLedgerMismatchPredicate()}))::text AS "mismatchCount",
      COUNT(*) FILTER (WHERE ${walletLedgerInvalidMoneyPredicate()})::text AS "invalidSourceMoney"
    FROM "IndividualTransaction" t
    LEFT JOIN "WalletLedgerEntry" l ON l."sourceTransactionId" = t."transactionId"
    WHERE t."transactionId" IN (${Prisma.join(ids)})
  `;
  if (result.invalidSourceMoney !== '0') throw new Error('ledger_invalid_source_money');
  if (result.mismatchCount !== '0') throw new Error('ledger_existing_base_facts_mismatch');
}

/** Inserts only missing entries. Null component deltas preserve what is unknown in historical receipts. */
export function walletLedgerBackfillInsert(ids: string[]) {
  if (!ids.length) throw new Error('ledger_backfill_empty_batch');
  return Prisma.sql`
    INSERT INTO "WalletLedgerEntry" (
      "id", "sourceTransactionId", "dlmId", "discordId", "counterpartyId",
      "walletDelta", "businessAmount", "balanceBefore", "balanceAfter", "currency",
      "direction", "eventType", "legacyType", "source", "integrityStatus",
      "timeCreatedAt", "recordedAt", "schemaVersion"
    )
    SELECT 'WLE:' || t."transactionId", t."transactionId", t."dlmId", t."discordId", t."thirdPartydiscordId",
      t."balanceAfter" - t."balanceBefore", ABS(t."amountChange"), t."balanceBefore", t."balanceAfter", 'CNY',
      CASE WHEN t."balanceAfter" > t."balanceBefore" THEN 'CREDIT'
        WHEN t."balanceAfter" < t."balanceBefore" THEN 'DEBIT' ELSE 'NONE' END,
      wallet_ledger_event_type(t."typeOfTransaction", t."balanceAfter" - t."balanceBefore"),
      t."typeOfTransaction", 'LEGACY_BACKFILL', CASE
        WHEN NULLIF(t."dlmId", '') IS NULL AND NULLIF(t."discordId", '') IS NULL THEN 'UNVERIFIABLE'
        WHEN ABS(t."balanceAfter" - t."balanceBefore") = ABS(t."amountChange") THEN 'VERIFIED'
        ELSE 'REQUIRES_REVIEW' END,
      t."timeCreatedAt", CURRENT_TIMESTAMP, 1
    FROM "IndividualTransaction" t WHERE t."transactionId" IN (${Prisma.join(ids)})
    ON CONFLICT ("sourceTransactionId") DO NOTHING
  `;
}
