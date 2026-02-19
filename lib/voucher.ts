import { SPECIAL_ACTION_KIND_BY_PRIZE, type SpecialVoucherKind } from '@/lib/voucherCatalog';

type SpecialVoucherResult =
  | { kind: SpecialVoucherKind }
  | null;

export function resolveSpecialVoucher(prizeName: string): SpecialVoucherResult {
  const normalizedPrizeName = prizeName.trim();
  const kind = SPECIAL_ACTION_KIND_BY_PRIZE[normalizedPrizeName];
  if (kind) return { kind };
  return null;
}
