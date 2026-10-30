import { Prisma } from '@prisma/client';

/** Shared with Bot/src/services/walletLedger.ts. All money stays decimal. */
export type LedgerMoney = Prisma.Decimal | string | number;
export type LedgerWalletSnapshot = {
  totalBalance: LedgerMoney;
  income?: LedgerMoney;
  recharge?: LedgerMoney;
  totalSpent?: LedgerMoney;
  loyaltyPoints?: LedgerMoney;
};
export type LedgerReceipt = {
  transactionId: string;
  dlmId?: string | null;
  discordId?: string | null;
  thirdPartydiscordId: string;
  balanceBefore: LedgerMoney;
  balanceAfter: LedgerMoney;
  amountChange: LedgerMoney;
  deltaAmount?: LedgerMoney | null;
  typeOfTransaction: string;
  timeCreatedAt: Date;
};
export type WalletLedgerMetadata = {
  /** Only when the business face value intentionally differs from wallet movement. */
  expectedWalletDelta?: LedgerMoney;
  walletBefore?: LedgerWalletSnapshot;
  walletAfter?: LedgerWalletSnapshot;
};

const money = (value: LedgerMoney) => {
  const amount = new Prisma.Decimal(value);
  if (!amount.isFinite() || amount.decimalPlaces() > 4 || amount.abs().gte('1000000000000000')) {
    throw new Error('wallet_ledger_invalid_money');
  }
  return amount;
};

/** Validate the persisted receipt, including the DB-generated signed delta.
 * amountChange retains its historical convention for reversal compatibility.
 */
export function validateWalletTransaction(receipt: LedgerReceipt, metadata: WalletLedgerMetadata = {}) {
  const balanceBefore = money(receipt.balanceBefore);
  const balanceAfter = money(receipt.balanceAfter);
  const walletDelta = money(balanceAfter.sub(balanceBefore));
  const businessAmount = money(receipt.amountChange).abs();
  if (receipt.deltaAmount === undefined || receipt.deltaAmount === null || !money(receipt.deltaAmount).eq(walletDelta)) {
    throw new Error('wallet_ledger_delta_mismatch');
  }
  if (metadata.expectedWalletDelta !== undefined) {
    if (!walletDelta.eq(money(metadata.expectedWalletDelta))) throw new Error('wallet_ledger_amount_mismatch');
  } else if (!walletDelta.abs().eq(businessAmount)) {
    throw new Error('wallet_ledger_amount_mismatch');
  }
  const { walletBefore, walletAfter } = metadata;
  if (Boolean(walletBefore) !== Boolean(walletAfter)) throw new Error('wallet_ledger_incomplete_snapshots');
  if (walletBefore && walletAfter &&
      (!money(walletBefore.totalBalance).eq(balanceBefore) || !money(walletAfter.totalBalance).eq(balanceAfter))) {
    throw new Error('wallet_ledger_snapshot_mismatch');
  }
  const componentDelta = (field: keyof LedgerWalletSnapshot) => {
    const before = walletBefore?.[field];
    const after = walletAfter?.[field];
    if ((before === undefined) !== (after === undefined)) throw new Error('wallet_ledger_incomplete_snapshots');
    return before === undefined || after === undefined ? null : money(money(after).sub(money(before)));
  };
  const incomeDelta = componentDelta('income');
  const rechargeDelta = componentDelta('recharge');
  if (incomeDelta !== null && rechargeDelta !== null && !incomeDelta.add(rechargeDelta).eq(walletDelta)) {
    throw new Error('wallet_ledger_components_mismatch');
  }
  componentDelta('totalSpent');
  componentDelta('loyaltyPoints');
  return walletDelta;
}

export type WalletDeltaSource = {
  balanceBefore: LedgerMoney | null;
  balanceAfter: LedgerMoney | null;
  deltaAmount?: LedgerMoney | null;
};

/** Missing legacy balances are unknown, never silently interpreted as zero. */
export function resolveWalletDelta(row: WalletDeltaSource): Prisma.Decimal | null {
  if (row.deltaAmount !== undefined && row.deltaAmount !== null) return money(row.deltaAmount);
  if (row.balanceBefore === null || row.balanceAfter === null) return null;
  return money(money(row.balanceAfter).sub(money(row.balanceBefore)));
}

/** Requires the additive column migration before deploying the new Prisma client. */
export const transactionDeltaSelection = () => ({ deltaAmount: true } as const);
