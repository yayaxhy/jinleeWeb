type SpecialVoucherResult =
  | { kind: 'simple' }
  | { kind: 'commission' }
  | { kind: 'flow' }
  | { kind: 'spend' }
  | null;

const SIMPLE_PRIZES = new Set(['自定义礼物券', '自定义tag券']);

export function resolveSpecialVoucher(prizeName: string): SpecialVoucherResult {
  if (SIMPLE_PRIZES.has(prizeName)) return { kind: 'simple' };
  if (prizeName === '抽成降1%券') return { kind: 'commission' };
  if (prizeName === '双倍流水5000券') return { kind: 'flow' };
  if (prizeName === '双倍消费5000券') return { kind: 'spend' };
  return null;
}
