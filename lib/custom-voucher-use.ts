import { parseCustomVoucherRule, type CustomVoucherRule } from './custom-voucher';

/** A present but invalid snapshot must never fall back to name-based legacy
 * behavior. Labels are content, not authority to choose an effect or gift.
 */
export function resolveCustomPointShopVoucher(grant: {
  voucherRuleSnapshot: unknown;
  couponType: string | null;
  itemName: string;
}): { rule: CustomVoucherRule | null; prizeName: string; prizeType: 'GIFT' | 'COUPON' } | null {
  if (grant.voucherRuleSnapshot == null) return null;
  const rule = grant.couponType === null ? parseCustomVoucherRule(grant.voucherRuleSnapshot) : null;
  return { rule, prizeName: grant.itemName, prizeType: rule?.kind === 'GIFT' ? 'GIFT' : 'COUPON' };
}
