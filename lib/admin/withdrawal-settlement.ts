import { Prisma, SettlementPayoutStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { newEntityOnlyTime, NEW_ENTITY_OPERATIONS_STARTED_AT } from '@/lib/operating-entity-cutover';

type Payout = {
  id: string;
  amount: Prisma.Decimal;
  status: SettlementPayoutStatus;
  paidAt: Date;
  voidedAt: Date | null;
};

export type WithdrawalSettlementRow = {
  id: string;
  amount: Prisma.Decimal;
  createdAt: Date;
  settlementPayout: Payout | null;
};

export type PayoutReversalRow = {
  targetId: string;
  originalAt: Date | null;
  createdAt: Date;
};

/** Reconstruct payment cycles so a later void or repayment cannot erase a
 * previous month's payment. Withdraw.createdAt remains the wallet debit date. */
export function summarizeWithdrawalSettlement(
  withdrawals: readonly WithdrawalSettlementRow[],
  reversals: readonly PayoutReversalRow[],
  range: { start: Date; end: Date },
) {
  const history = new Map<string, PayoutReversalRow[]>();
  for (const reversal of reversals) {
    const rows = history.get(reversal.targetId) ?? [];
    rows.push(reversal);
    history.set(reversal.targetId, rows);
  }
  let requested = new Prisma.Decimal(0);
  let paid = new Prisma.Decimal(0);
  let reversed = new Prisma.Decimal(0);
  let pendingAtEnd = new Prisma.Decimal(0);
  const events: Array<{ withdrawalId: string; payoutId: string; kind: 'PAID' | 'VOIDED'; amount: Prisma.Decimal; occurredAt: Date }> = [];
  for (const withdrawal of withdrawals) {
    if (withdrawal.createdAt <= NEW_ENTITY_OPERATIONS_STARTED_AT || withdrawal.createdAt >= range.end) continue;
    if (withdrawal.createdAt >= range.start) requested = requested.add(withdrawal.amount);
    const payout = withdrawal.settlementPayout;
    let paidAtEnd = new Prisma.Decimal(0);
    if (payout) {
      const cycles = new Map<number, { paidAt: Date; voidedAt: Date | null }>();
      for (const reversal of history.get(payout.id) ?? []) {
        if (!reversal.originalAt) continue;
        cycles.set(reversal.originalAt.getTime(), { paidAt: reversal.originalAt, voidedAt: reversal.createdAt });
      }
      // A voided current cycle is also present in SettlementReversal. Add it
      // only once; voidedAt supplies compatibility with pre-audit records.
      if (!cycles.has(payout.paidAt.getTime())) {
        cycles.set(payout.paidAt.getTime(), {
          paidAt: payout.paidAt,
          voidedAt: payout.status === SettlementPayoutStatus.VOIDED ? payout.voidedAt : null,
        });
      }
      for (const cycle of cycles.values()) {
        if (cycle.paidAt >= range.end) continue;
        paidAtEnd = paidAtEnd.add(payout.amount);
        if (cycle.paidAt >= range.start) {
          paid = paid.add(payout.amount);
          events.push({ withdrawalId: withdrawal.id, payoutId: payout.id, kind: 'PAID', amount: payout.amount, occurredAt: cycle.paidAt });
        }
        if (cycle.voidedAt && cycle.voidedAt < range.end) {
          paidAtEnd = paidAtEnd.sub(payout.amount);
          if (cycle.voidedAt >= range.start) {
            reversed = reversed.add(payout.amount);
            events.push({ withdrawalId: withdrawal.id, payoutId: payout.id, kind: 'VOIDED', amount: payout.amount, occurredAt: cycle.voidedAt });
          }
        }
      }
    }
    pendingAtEnd = pendingAtEnd.add(withdrawal.amount.sub(paidAtEnd));
  }
  return { requested, paid, reversed, netOutflow: paid.sub(reversed), pendingAtEnd, events };
}

export async function getWithdrawalSettlementSummary(params: {
  start: Date;
  end: Date;
  excludeDlmIds?: string[];
  excludeDiscordIds?: string[];
}) {
  const exclusions: Prisma.WithdrawWhereInput[] = [];
  if (params.excludeDlmIds?.length) exclusions.push({ dlmId: { in: params.excludeDlmIds } });
  if (params.excludeDiscordIds?.length) exclusions.push({ discordId: { in: params.excludeDiscordIds } });
  return prisma.$transaction(async (tx) => {
    const withdrawals = await tx.withdraw.findMany({
      where: {
        createdAt: { ...newEntityOnlyTime(), lt: params.end },
        ...(exclusions.length ? { NOT: { OR: exclusions } } : {}),
      },
      select: {
        id: true, amount: true, createdAt: true,
        settlementPayout: { select: { id: true, amount: true, status: true, paidAt: true, voidedAt: true } },
      },
    });
    const payoutIds = withdrawals.flatMap(row => row.settlementPayout ? [row.settlementPayout.id] : []);
    const reversals = payoutIds.length ? await tx.settlementReversal.findMany({
      where: { kind: 'PAYOUT', targetId: { in: payoutIds } },
      select: { targetId: true, originalAt: true, createdAt: true },
    }) : [];
    return summarizeWithdrawalSettlement(withdrawals, reversals, params);
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
}
