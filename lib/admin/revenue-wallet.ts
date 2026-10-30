import { activityTypes, incomeContribution, type IncomePolicy, type TransactionActivity } from '../transaction-activity';

const DISCOUNT_REBATE_POLICY: IncomePolicy = {
  incomeTypes: ['优惠返利'],
  incomeReversalTypes: ['优惠返利撤销'],
};

export const DISCOUNT_REBATE_TYPES = activityTypes(DISCOUNT_REBATE_POLICY);

/** Reporting net credits only; voucher expense accounting remains independent. */
export const discountRebateContribution = (row: TransactionActivity) =>
  incomeContribution(row, DISCOUNT_REBATE_POLICY);
