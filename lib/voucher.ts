import { SPECIAL_ACTION_KIND_BY_PRIZE, type SpecialVoucherKind } from '@/lib/voucherCatalog';

type SpecialVoucherResult =
  | { kind: SpecialVoucherKind }
  | null;

export function resolveSpecialVoucher(prizeName: string): SpecialVoucherResult {
  const kind = SPECIAL_ACTION_KIND_BY_PRIZE[prizeName];
  if (kind) return { kind };
  return null;
}
