import { Prisma } from '@prisma/client';
import { resolveWalletDelta, type WalletDeltaSource } from './wallet-ledger';

export type TransactionActivity = WalletDeltaSource & { typeOfTransaction: string };
export type SpendPolicy = {
  readonly spendTypes: readonly string[];
  readonly refundTypes: readonly string[];
  readonly refundReversalTypes: readonly string[];
};
export type IncomePolicy = {
  readonly incomeTypes: readonly string[];
  readonly incomeReversalTypes: readonly string[];
};

const CUSTOMER_PAYMENT_TYPES = ['点单', '打赏', '客服代打赏', '红包发出', '试音花费'] as const;
const PAYMENT_REFUND_TYPES = ['订单撤销', '打赏撤销'] as const;
const NET_SPEND_REFUND_TYPES = [...PAYMENT_REFUND_TYPES, '红包退回', '优惠返利'] as const;
const NET_SPEND_REFUND_REVERSAL_TYPES = ['优惠返利撤销'] as const;

export const OPENING_SPEND_POLICY: SpendPolicy = {
  spendTypes: CUSTOMER_PAYMENT_TYPES,
  refundTypes: NET_SPEND_REFUND_TYPES,
  refundReversalTypes: NET_SPEND_REFUND_REVERSAL_TYPES,
};

/** Preserve the leaderboard's existing lottery inclusion and refund coverage. */
export const LEADERBOARD_SPEND_POLICY: SpendPolicy = {
  spendTypes: [...CUSTOMER_PAYMENT_TYPES, '抽奖消费'],
  refundTypes: PAYMENT_REFUND_TYPES,
  refundReversalTypes: [],
};

/** Optional net policy: rebate credits and their reversals must move together. */
export const NET_LEADERBOARD_SPEND_POLICY: SpendPolicy = {
  spendTypes: LEADERBOARD_SPEND_POLICY.spendTypes,
  refundTypes: NET_SPEND_REFUND_TYPES,
  refundReversalTypes: NET_SPEND_REFUND_REVERSAL_TYPES,
};

export const LEADERBOARD_INCOME_POLICY: IncomePolicy = {
  incomeTypes: ['点单', '打赏', '客服代打赏', '红包收入', '试音收入'],
  incomeReversalTypes: PAYMENT_REFUND_TYPES,
};

/** This benefit explicitly measures workers' earnings, not customer spending. */
export const AUTO_COMMISSION_INCOME_POLICY: IncomePolicy = {
  incomeTypes: ['点单', '打赏', '客服代打赏', '红包收入'],
  incomeReversalTypes: PAYMENT_REFUND_TYPES,
};

/** Use the same policy for the database whitelist and in-memory classification. */
export function activityTypes(policy: SpendPolicy | IncomePolicy): string[] {
  return [...new Set('spendTypes' in policy
    ? [...policy.spendTypes, ...policy.refundTypes, ...policy.refundReversalTypes]
    : [...policy.incomeTypes, ...policy.incomeReversalTypes])];
}

/** A signed contribution to net customer spend; callers own windowing/clamping.
 * Shared order/gift labels never make a worker credit or its debit reversal
 * customer spending. The account's role is irrelevant when it actually pays.
 */
export function spendContribution(row: TransactionActivity, policy: SpendPolicy): Prisma.Decimal {
  const delta = resolveWalletDelta(row);
  if (delta === null || delta.isZero()) return new Prisma.Decimal(0);
  if (delta.lt(0) && (policy.spendTypes.includes(row.typeOfTransaction) ||
      policy.refundReversalTypes.includes(row.typeOfTransaction))) return delta.negated();
  if (delta.gt(0) && policy.refundTypes.includes(row.typeOfTransaction)) return delta.negated();
  return new Prisma.Decimal(0);
}

/** Earned-income rules remain independent of the spending policies. */
export function incomeContribution(row: TransactionActivity, policy: IncomePolicy): Prisma.Decimal {
  const delta = resolveWalletDelta(row);
  if (delta === null || delta.isZero()) return new Prisma.Decimal(0);
  if (delta.gt(0) && policy.incomeTypes.includes(row.typeOfTransaction)) return delta;
  if (delta.lt(0) && policy.incomeReversalTypes.includes(row.typeOfTransaction)) return delta;
  return new Prisma.Decimal(0);
}
