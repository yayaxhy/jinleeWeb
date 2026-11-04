/** Versioned rules copied onto each grant. Never resolve an issued voucher from
 * its mutable shop listing or from its display name. Keep the Bot copy in sync. */
export type CustomVoucherRule =
  | { version: 1; kind: 'ORDER_DISCOUNT'; payRate: string; maxDiscountAmount: string }
  | { version: 1; kind: 'GIFT'; giftName: string; payRate: string };

export function normalizeVoucherDecimal(value: unknown): string | null {
  if (typeof value !== 'string' || !/^(?:0|[1-9]\d{0,14})(?:\.\d{1,4})?$/.test(value)) return null;
  const [whole, fraction = ''] = value.split('.');
  const trimmed = fraction.replace(/0+$/, '');
  return trimmed ? `${whole}.${trimmed}` : whole;
}

export function parseCustomVoucherRule(value: unknown): CustomVoucherRule | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (row.version !== 1) return null;
  const payRate = normalizeVoucherDecimal(row.payRate);
  if (payRate === null || Number(payRate) >= 1) return null;
  if (row.kind === 'ORDER_DISCOUNT') {
    const maxDiscountAmount = normalizeVoucherDecimal(row.maxDiscountAmount);
    if (Number(payRate) <= 0 || maxDiscountAmount === null || Number(maxDiscountAmount) <= 0) return null;
    if (Object.keys(row).some((key) => !['version', 'kind', 'payRate', 'maxDiscountAmount'].includes(key))) return null;
    return { version: 1, kind: 'ORDER_DISCOUNT', payRate, maxDiscountAmount };
  }
  if (row.kind === 'GIFT') {
    if (typeof row.giftName !== 'string' || !row.giftName.trim() || row.giftName !== row.giftName.trim() || row.giftName.length > 200) return null;
    if (Object.keys(row).some((key) => !['version', 'kind', 'giftName', 'payRate'].includes(key))) return null;
    return { version: 1, kind: 'GIFT', giftName: row.giftName, payRate };
  }
  return null;
}

/** Canonical identity for audit/reversal checks, independent of mutable labels. */
export function customVoucherRuleKey(rule: CustomVoucherRule): string {
  const normalized = parseCustomVoucherRule(rule);
  if (!normalized) throw new Error('invalid_custom_voucher_rule');
  return `CUSTOM_V1:${JSON.stringify(normalized)}`;
}
