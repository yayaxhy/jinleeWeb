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
  typeOfTransaction: string;
  timeCreatedAt: Date;
};
export type WalletLedgerMetadata = {
  /** Only when the business face value intentionally differs from wallet movement. */
  expectedWalletDelta?: LedgerMoney;
  walletBefore?: LedgerWalletSnapshot;
  walletAfter?: LedgerWalletSnapshot;
  correlationId?: string;
  reversalOfLedgerId?: string;
  reversalOfSourceTransactionId?: string;
  idempotencyKey?: string;
};

export const isWalletLedgerWriteEnabled = () => process.env.WALLET_LEDGER_WRITE_ENABLED === '1';
export const isWalletLedgerReadEnabled = () => process.env.WALLET_LEDGER_READ_ENABLED === '1';

const money = (value: LedgerMoney) => {
  const amount = new Prisma.Decimal(value);
  if (!amount.isFinite() || amount.decimalPlaces() > 4 || amount.abs().gte('1000000000000000')) {
    throw new Error('wallet_ledger_invalid_money');
  }
  return amount;
};

export function walletLedgerEventType(type: string, delta: Prisma.Decimal): string {
  if (type === '点单') return delta.lt(0) ? 'ORDER_PAYMENT' : delta.gt(0) ? 'ORDER_INCOME' : 'ORDER_ZERO';
  if (type === '订单撤销') return delta.gt(0) ? 'ORDER_REFUND' : delta.lt(0) ? 'ORDER_INCOME_REVERSAL' : 'ORDER_REVERSAL_ZERO';
  if (type === '打赏' || type === '客服代打赏') return delta.lt(0) ? 'GIFT_PAYMENT' : delta.gt(0) ? 'GIFT_INCOME' : 'GIFT_ZERO';
  if (type === '打赏撤销') return delta.gt(0) ? 'GIFT_REFUND' : delta.lt(0) ? 'GIFT_INCOME_REVERSAL' : 'GIFT_REVERSAL_ZERO';
  if (['充值', '人工充值', '网站充值', '微信Native充值', '信用卡/银行卡充值'].includes(type)) return 'RECHARGE';
  const events: Record<string, string> = {
    提现: 'WITHDRAWAL', 优惠返利: 'COUPON_REBATE', 红包发出: 'RED_ENVELOPE_SEND',
    红包收入: 'RED_ENVELOPE_RECEIVE', 红包退回: 'RED_ENVELOPE_REFUND',
  };
  return events[type] ?? 'LEGACY_OTHER';
}

export function createWalletLedgerEntryData(receipt: LedgerReceipt, metadata: WalletLedgerMetadata = {}) {
  const balanceBefore = money(receipt.balanceBefore);
  const balanceAfter = money(receipt.balanceAfter);
  const walletDelta = money(balanceAfter.sub(balanceBefore));
  const businessAmount = money(receipt.amountChange).abs();
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
  return {
    id: `WLE:${receipt.transactionId}`,
    sourceTransactionId: receipt.transactionId,
    dlmId: receipt.dlmId ?? null,
    discordId: receipt.discordId ?? null,
    counterpartyId: receipt.thirdPartydiscordId,
    walletDelta, businessAmount, balanceBefore, balanceAfter,
    currency: 'CNY',
    direction: walletDelta.gt(0) ? 'CREDIT' : walletDelta.lt(0) ? 'DEBIT' : 'NONE',
    legacyType: receipt.typeOfTransaction,
    eventType: walletLedgerEventType(receipt.typeOfTransaction, walletDelta),
    incomeDelta, rechargeDelta,
    totalSpentDelta: componentDelta('totalSpent'),
    loyaltyPointsDelta: componentDelta('loyaltyPoints'),
    correlationId: metadata.correlationId ?? null,
    reversalOfLedgerId: metadata.reversalOfLedgerId ?? null,
    reversalOfSourceTransactionId: metadata.reversalOfSourceTransactionId ?? null,
    idempotencyKey: metadata.idempotencyKey ?? null,
    source: 'LIVE',
    // VERIFIED checks internal arithmetic only; it is not external reconciliation.
    integrityStatus: !receipt.dlmId && !receipt.discordId ? 'UNVERIFIABLE'
      : walletDelta.abs().eq(businessAmount) ? 'VERIFIED' : 'REQUIRES_REVIEW',
    timeCreatedAt: receipt.timeCreatedAt,
    schemaVersion: 1,
  };
}

export type WalletDeltaSource = {
  balanceBefore: LedgerMoney | null;
  balanceAfter: LedgerMoney | null;
  walletLedgerEntry?: { walletDelta: LedgerMoney } | null;
};

/** Missing legacy balances are unknown, never silently interpreted as zero. */
export function resolveWalletDelta(row: WalletDeltaSource): Prisma.Decimal | null {
  if (row.walletLedgerEntry) return new Prisma.Decimal(row.walletLedgerEntry.walletDelta);
  if (row.balanceBefore === null || row.balanceAfter === null) return null;
  return new Prisma.Decimal(row.balanceAfter).sub(new Prisma.Decimal(row.balanceBefore));
}

/** Query ownership through the mutable receipt so merges retain historical reads. */
export const walletLedgerRelationSelection = () => isWalletLedgerReadEnabled()
  ? { walletLedgerEntry: { select: { walletDelta: true } } } as const : {};
