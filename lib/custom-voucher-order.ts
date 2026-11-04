import { Prisma, type PrismaClient } from '@prisma/client';
import { parseCustomVoucherRule } from './custom-voucher';
import { NEW_ENTITY_OPERATIONS_STARTED_AT } from './operating-entity-cutover';

type DiscountFailure =
  | 'order_not_found' | 'legacy_order' | 'not_order_host' | 'order_not_ended'
  | 'order_reverted' | 'already_used' | 'no_coupon' | 'no_fee' | 'insufficient_data';

export type CustomOrderDiscountResult =
  | { status: 'applied'; kind: 'coupon'; consumeAmount: Prisma.Decimal; couponId: string }
  | { status: DiscountFailure };

type Dependencies = {
  db: Pick<PrismaClient, 'pointShopGrant' | 'order'>;
  fetch: typeof fetch;
  internalHost?: string;
  internalPort?: string;
  internalToken?: string;
};

const failureStatuses = new Set<DiscountFailure>([
  'order_not_found', 'not_order_host', 'order_not_ended', 'order_reverted',
  'already_used', 'no_coupon', 'no_fee', 'insufficient_data',
]);

/** New rule-based vouchers share the Bot's audited settlement transaction.
 * null means a legacy voucher and allows the original Web path to continue.
 * The Web preflight never mutates a voucher or wallet, and RPCs are not retried.
 */
export async function tryApplyCustomOrderDiscount(
  deps: Dependencies,
  input: { orderId: string; dlmId: string; kind: 'coupon' | 'lottery'; couponId?: string },
): Promise<CustomOrderDiscountResult | null> {
  if (input.kind !== 'coupon' || !input.couponId) return null;
  const grant = await deps.db.pointShopGrant.findFirst({
    where: { id: input.couponId, dlmId: input.dlmId },
    select: { voucherRuleSnapshot: true, couponType: true },
  });
  if (!grant || grant.voucherRuleSnapshot === null) return null;
  const rule = parseCustomVoucherRule(grant.voucherRuleSnapshot);
  if (rule?.kind !== 'ORDER_DISCOUNT' || grant.couponType !== null) return { status: 'no_coupon' };

  const order = await deps.db.order.findUnique({
    where: { id: input.orderId },
    select: { createdAt: true, hostDlmId: true },
  });
  if (!order) return { status: 'order_not_found' };
  if (order.createdAt.getTime() <= NEW_ENTITY_OPERATIONS_STARTED_AT.getTime()) return { status: 'legacy_order' };
  if (order.hostDlmId !== input.dlmId) return { status: 'not_order_host' };
  if (!deps.internalPort || !deps.internalToken) return { status: 'insufficient_data' };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await deps.fetch(`http://${deps.internalHost ?? '127.0.0.1'}:${deps.internalPort}/internal/discount`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Internal-Token': deps.internalToken },
      signal: controller.signal,
      body: JSON.stringify({ orderId: input.orderId, userId: input.dlmId, kind: 'coupon', couponId: input.couponId }),
    });
    const data: unknown = await response.json().catch(() => null);
    if (!data || typeof data !== 'object') return { status: 'insufficient_data' };
    const result = data as Record<string, unknown>;
    if (!response.ok || result.ok !== true) {
      const status = result.error as DiscountFailure;
      return { status: failureStatuses.has(status) ? status : 'insufficient_data' };
    }
    if (result.kind !== 'coupon' || typeof result.amount !== 'string') return { status: 'insufficient_data' };
    const amount = new Prisma.Decimal(result.amount);
    if (!amount.isFinite() || amount.lte(0)) return { status: 'insufficient_data' };
    return { status: 'applied', kind: 'coupon', consumeAmount: amount, couponId: input.couponId };
  } catch {
    // A timeout may happen after commit. Never retry an ambiguous response here.
    return { status: 'insufficient_data' };
  } finally {
    clearTimeout(timeout);
  }
}
