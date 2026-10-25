import { createSiteCopy, type SiteCopyRenderer } from "./site-copy";
import { enqueueNotificationTx, suppressGenericBalanceNoticeTx } from './notification-outbox';
import { Prisma } from '@prisma/client';
import { applyDlmWalletDeltaTx, getDlmWalletSnapshotTx } from './dlm-wallet';
import { DlmWalletIdentityChangedError, lockDlmWalletsTx } from './dlm-wallet-lock';

export type RechargeOrderProvider = 'zpay' | 'stripe' | 'wechat_native';
export type SettleRechargeOrderInput = {
  outTradeNo: string;
  amount: Prisma.Decimal | number | string;
  orderProvider?: RechargeOrderProvider;
  gatewayTradeNo?: string | null;
  notifyPayload?: Prisma.InputJsonValue;
  payerReference?: string | null;
  transactionType?: string;
};

type RechargeOrder = {
  id: string;
  outTradeNo: string;
  status: string;
  amount: Prisma.Decimal;
  dlmId: string | null;
};

export type RechargeOrderSettlementResult =
  | { kind: 'paid'; dlmId: string }
  | { kind: 'already_paid' }
  | { kind: 'not_found' }
  | { kind: 'invalid_order'; reason: string }
  | { kind: 'amount_mismatch'; expected: string; received: string };

async function loadRechargeOrderTx(
  tx: Prisma.TransactionClient,
  outTradeNo: string,
  provider: RechargeOrderProvider,
): Promise<RechargeOrder | null> {
  const common = { id: true, outTradeNo: true, status: true, dlmId: true } as const;
  if (provider === 'stripe') {
    const order = await tx.stripePayment.findUnique({
      where: { outTradeNo }, select: { ...common, rechargeAmount: true },
    });
    return order ? { ...order, amount: order.rechargeAmount } : null;
  }
  if (provider === 'wechat_native') {
    const order = await tx.wechatNativePayment.findUnique({
      where: { outTradeNo }, select: { ...common, rechargeAmount: true },
    });
    return order ? { ...order, amount: order.rechargeAmount } : null;
  }
  return tx.zPayRechargeOrder.findUnique({
    where: { outTradeNo }, select: { ...common, amount: true },
  });
}

async function lockRechargeOrderTx(tx: Prisma.TransactionClient, outTradeNo: string, provider: RechargeOrderProvider) {
  if (provider === 'stripe') {
    await tx.$queryRaw`SELECT "id" FROM "StripePayment" WHERE "outTradeNo" = ${outTradeNo} FOR UPDATE`;
  } else if (provider === 'wechat_native') {
    await tx.$queryRaw`SELECT "id" FROM "WechatNativePayment" WHERE "outTradeNo" = ${outTradeNo} FOR UPDATE`;
  } else {
    await tx.$queryRaw`SELECT "id" FROM "ZPayRechargeOrder" WHERE "outTradeNo" = ${outTradeNo} FOR UPDATE`;
  }
}

/** The caller owns the transaction; identity changes must abort it, not resume
 * with another wallet after payment locks have already been acquired.
 */
export async function settleRechargeOrderPaymentTx(
  tx: Prisma.TransactionClient,
  input: SettleRechargeOrderInput, copy: SiteCopyRenderer = createSiteCopy()
): Promise<RechargeOrderSettlementResult> {
  const provider = input.orderProvider ?? 'zpay';
  // This first read is only a route to the wallet locks. No unlocked balance,
  // amount, status or historical Discord snapshot authorizes a credit.
  const routedOrder = await loadRechargeOrderTx(tx, input.outTradeNo, provider);
  if (!routedOrder) return { kind: 'not_found' };
  if (!routedOrder.dlmId) return { kind: 'invalid_order', reason: 'missing_dlm_id' };
  const expectedIdentity = await tx.dlmUser.findUnique({
    where: { dlmId: routedOrder.dlmId }, select: { dlmId: true, discordUserId: true },
  });
  if (!expectedIdentity) throw new DlmWalletIdentityChangedError();

  // Same global order as account merging: all DLM rows, then Members, then
  // business rows. There is no Member upsert before the DLM lock.
  const wallets = await lockDlmWalletsTx(tx, [expectedIdentity]);
  const identity = wallets.get(expectedIdentity.dlmId)!;
  await lockRechargeOrderTx(tx, input.outTradeNo, provider);
  const order = await loadRechargeOrderTx(tx, input.outTradeNo, provider);
  if (!order || order.id !== routedOrder.id || order.dlmId !== identity.dlmId) {
    throw new DlmWalletIdentityChangedError();
  }

  const normalizedAmount = new Prisma.Decimal(input.amount).toDecimalPlaces(2);
  if (!order.amount.equals(normalizedAmount)) {
    return { kind: 'amount_mismatch', expected: order.amount.toFixed(2), received: normalizedAmount.toFixed(2) };
  }
  if (order.status === 'PAID') return { kind: 'already_paid' };
  if (order.status !== 'PENDING') return { kind: 'invalid_order', reason: `unexpected_status:${order.status}` };

  const sourceReference = input.payerReference ?? input.gatewayTradeNo ?? input.outTradeNo;
  const paidAt = new Date();
  const credit = async () => {
    // The payment's Discord ID may predate a merge or unbind. Its current DLM
    // owner and locked current binding determine both wallet and ledger owner.
    await suppressGenericBalanceNoticeTx(tx);
    const before = await getDlmWalletSnapshotTx(tx, identity);
    const after = await applyDlmWalletDeltaTx(tx, {
      ...identity, rechargeDelta: normalizedAmount, totalBalanceDelta: normalizedAmount,
    });
    await tx.recharge.create({
      data: {
        amount: normalizedAmount, dlmId: identity.dlmId, toWhom: identity.discordUserId,
        fromWhom: sourceReference,
      },
    });
    await tx.individualTransaction.create({
      data: {
        discordId: identity.discordUserId, dlmId: identity.dlmId, thirdPartydiscordId: sourceReference,
        balanceBefore: before.totalBalance, amountChange: normalizedAmount, balanceAfter: after.totalBalance,
        typeOfTransaction: input.transactionType ?? '网站充值',
      },
    });
    await enqueueNotificationTx(tx, { dedupeKey: `recharge:${provider}:${order.outTradeNo}`,
      recipientDlmId: identity.dlmId, recipientDiscordId: identity.discordUserId, event: 'BALANCE_ADJUSTED',
      title: provider === 'stripe' ? copy("site.lib.recharge.order.transaction.62a89cc85f1f") : provider === 'wechat_native' ? copy("site.lib.recharge.order.transaction.00a17e777b24") : copy("site.lib.recharge.order.transaction.133a41b10227"),
      body: copy("site.lib.recharge.order.transaction.eb6422730363", {value1: String(normalizedAmount.toFixed(2)), value2: String(after.totalBalance.toString())}), href: '/console?tab=wallet' });
  };

  // Stripe eligibility is checked by the webhook's original lifecycle rule.
  // All providers still claim PENDING -> PAID atomically with the wallet credit.
  const claimed = provider === 'stripe'
    ? await tx.stripePayment.updateMany({
        where: { outTradeNo: order.outTradeNo, status: 'PENDING' },
        data: { status: 'PAID', paidAt },
      })
    : provider === 'wechat_native'
    ? await tx.wechatNativePayment.updateMany({
        where: { outTradeNo: order.outTradeNo, status: 'PENDING' },
        data: { status: 'PAID', paidAt },
      })
    : await tx.zPayRechargeOrder.updateMany({
        where: { outTradeNo: order.outTradeNo, status: 'PENDING' },
        data: {
          status: 'PAID', gatewayTradeNo: input.gatewayTradeNo ?? undefined,
          notifyPayload: input.notifyPayload, paidAt,
        },
      });
  if (claimed.count === 0) throw new Error('recharge_payment_claim_changed');
  await credit();
  return { kind: 'paid', dlmId: identity.dlmId };
}
