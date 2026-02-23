export const parseNumeric = (value: unknown): number | null => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return Number.isNaN(value) ? null : value;
  if (typeof value === 'bigint') return Number(value);
  if (typeof value === 'string') {
    const numeric = Number(value);
    return Number.isNaN(numeric) ? null : numeric;
  }
  if (typeof value === 'object' && value !== null && 'toString' in value) {
    const text = (value as { toString?: () => string }).toString?.();
    if (!text) return null;
    const numeric = Number(text);
    return Number.isNaN(numeric) ? null : numeric;
  }
  return null;
};

export const roundDownTo = (value: number, digits = 2): number => {
  const factor = 10 ** digits;
  if (value >= 0) return Math.floor((value + Number.EPSILON) * factor) / factor;
  return Math.ceil((value - Number.EPSILON) * factor) / factor;
};

export const formatAmountDown2 = (value: unknown, locale = 'zh-CN'): string => {
  const numeric = parseNumeric(value);
  if (numeric === null) return '—';
  const rounded = roundDownTo(numeric, 2);
  return rounded.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};
