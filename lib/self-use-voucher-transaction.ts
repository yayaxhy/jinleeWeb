import { CouponStatus, LotteryStatus, PointShopDeliveryStatus, PointShopDeliveryType, type Prisma } from '@prisma/client';
import { lockDlmWalletsTx, type ExpectedDlmWalletIdentity } from './dlm-wallet-lock';
import { newEntityOnlyTime } from './operating-entity-cutover';

/** Direct self-use also validates the authenticated identity after lock waits.
 * The caller must keep this check and the voucher CAS in the same transaction.
 */
export async function consumeSelfUseVoucherTx(tx: Prisma.TransactionClient, input: {
  identity: ExpectedDlmWalletIdentity; source: 'coupon' | 'pointshop' | 'lottery'; voucherId: string;
}) {
  const identities = await lockDlmWalletsTx(tx, [input.identity]);
  const identity = identities.get(input.identity.dlmId)!;
  const now = new Date();
  const owner = { id: input.voucherId, dlmId: identity.dlmId };
  const target = { consumeTargetId: identity.discordUserId, consumeTargetDlmId: identity.dlmId };
  if (input.source === 'coupon') {
    return tx.coupon.updateMany({
      where: { ...owner, status: CouponStatus.ACTIVE, issuedAt: newEntityOnlyTime(), expiresAt: { gt: now }, consumedAt: null, orderId: null },
      data: { ...target, status: CouponStatus.USED, consumedAt: now, consumeAmount: 0 },
    });
  }
  if (input.source === 'pointshop') {
    return tx.pointShopGrant.updateMany({
      where: {
        ...owner, deliveryType: PointShopDeliveryType.COUPON, deliveryStatus: PointShopDeliveryStatus.DELIVERED,
        couponStatus: CouponStatus.ACTIVE, issuedAt: newEntityOnlyTime(), consumedAt: null, consumeOrderId: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      data: { ...target, couponStatus: CouponStatus.USED, consumedAt: now, consumeAmount: 0 },
    });
  }
  return tx.lotteryDraw.updateMany({
    where: { ...owner, status: LotteryStatus.UNUSED, createdAt: newEntityOnlyTime(), consumeAt: null, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
    data: { ...target, status: LotteryStatus.USED, consumeAt: now, requestId: 'SELFUSE' },
  });
}
