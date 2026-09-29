import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { applyDlmWalletDeltaTx, getDlmWalletSnapshotTx } from '@/lib/dlm-wallet';

const DEC = (value: Prisma.Decimal | number | string) =>
  value instanceof Prisma.Decimal ? value : new Prisma.Decimal(value);

type RechargeOrderProvider = 'zpay' | 'stripe' | 'wechat_native';

type SettleRechargeOrderInput = {
  outTradeNo: string;
  amount: Prisma.Decimal | number | string;
  orderProvider?: RechargeOrderProvider;
  gatewayTradeNo?: string | null;
  notifyPayload?: Prisma.InputJsonValue;
  payerReference?: string | null;
  transactionType?: string;
};

type RechargeOrderBase = {
  outTradeNo: string;
  status: string;
  amount: Prisma.Decimal;
  discordUserId: string | null;
  dlmId: string | null;
};

type RechargeOrderSettlementResult =
  | { kind: 'paid' }
  | { kind: 'already_paid' }
  | { kind: 'not_found' }
  | { kind: 'invalid_order'; reason: string }
  | { kind: 'amount_mismatch'; expected: string; received: string };

const loadRechargeOrder = async (
  outTradeNo: string,
  orderProvider: RechargeOrderProvider,
): Promise<RechargeOrderBase | null> => {
  if (orderProvider === 'stripe') {
    const order = await prisma.stripePayment.findUnique({
      where: { outTradeNo },
      select: {
        outTradeNo: true,
        status: true,
        rechargeAmount: true,
        discordUserId: true,
        dlmId: true,
      },
    });
    return order
      ? {
          ...order,
          amount: order.rechargeAmount,
        }
      : null;
  }

  if (orderProvider === 'wechat_native') {
    const order = await prisma.wechatNativePayment.findUnique({
      where: { outTradeNo },
      select: {
        outTradeNo: true,
        status: true,
        rechargeAmount: true,
        discordUserId: true,
        dlmId: true,
      },
    });
    return order
      ? {
          ...order,
          amount: order.rechargeAmount,
        }
      : null;
  }

  return prisma.zPayRechargeOrder.findUnique({
    where: { outTradeNo },
    select: {
      outTradeNo: true,
      status: true,
      amount: true,
      discordUserId: true,
      dlmId: true,
    },
  });
};

export const settleRechargeOrderPayment = async (
  input: SettleRechargeOrderInput,
): Promise<RechargeOrderSettlementResult> => {
  const orderProvider = input.orderProvider ?? 'zpay';
  const order = await loadRechargeOrder(input.outTradeNo, orderProvider);
  if (!order) {
    return { kind: 'not_found' };
  }

  const normalizedAmount = DEC(input.amount).toDecimalPlaces(2);
  if (!order.amount.equals(normalizedAmount)) {
    return {
      kind: 'amount_mismatch',
      expected: order.amount.toFixed(2),
      received: normalizedAmount.toFixed(2),
    };
  }

  if (!order.dlmId) {
    return { kind: 'invalid_order', reason: 'missing_dlm_id' };
  }

  if (order.status === 'PAID') {
    return { kind: 'already_paid' };
  }

  if (order.status !== 'PENDING') {
    return { kind: 'invalid_order', reason: `unexpected_status:${order.status}` };
  }

  const paidAt = new Date();
  const orderDlmId = order.dlmId;
  const sourceReference = input.payerReference ?? input.gatewayTradeNo ?? input.outTradeNo;
  const transactionType = input.transactionType ?? '网站充值';
  let applied = false;

  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const claimed =
      orderProvider === 'stripe'
        ? await tx.stripePayment.updateMany({
            where: {
              outTradeNo: order.outTradeNo,
              status: 'PENDING',
            },
            data: {
              status: 'PAID',
              paidAt,
            },
          })
        : orderProvider === 'wechat_native'
          ? await tx.wechatNativePayment.updateMany({
              where: {
                outTradeNo: order.outTradeNo,
                status: 'PENDING',
              },
              data: {
                status: 'PAID',
                paidAt,
              },
            })
        : await tx.zPayRechargeOrder.updateMany({
            where: {
              outTradeNo: order.outTradeNo,
              status: 'PENDING',
            },
            data: {
              status: 'PAID',
              gatewayTradeNo: input.gatewayTradeNo ?? undefined,
              notifyPayload: input.notifyPayload,
              paidAt,
            },
          });

    if (claimed.count === 0) {
      return;
    }

    applied = true;

    if (order.discordUserId) {
      await tx.member.upsert({
        where: { discordUserId: order.discordUserId },
        create: {
          discordUserId: order.discordUserId,
          recharge: 0,
          totalBalance: 0,
        },
        update: {},
      });
    }

    const walletBefore = await getDlmWalletSnapshotTx(tx, {
      dlmId: orderDlmId,
      discordUserId: order.discordUserId,
    });

    const walletAfter = await applyDlmWalletDeltaTx(tx, {
      dlmId: orderDlmId,
      discordUserId: order.discordUserId,
      rechargeDelta: normalizedAmount,
      totalBalanceDelta: normalizedAmount,
    });

    await tx.recharge.create({
      data: {
        amount: normalizedAmount,
        toWhom: order.discordUserId,
        dlmId: orderDlmId,
        fromWhom: sourceReference,
      },
    });

    await tx.individualTransaction.create({
      data: {
        discordId: order.discordUserId,
        dlmId: orderDlmId,
        thirdPartydiscordId: sourceReference,
        balanceBefore: new Prisma.Decimal(walletBefore.totalBalance),
        amountChange: normalizedAmount,
        balanceAfter: new Prisma.Decimal(walletAfter.totalBalance),
        typeOfTransaction: transactionType,
      },
    });
  });

  if (applied) {
    return { kind: 'paid' };
  }

  const latest = await loadRechargeOrder(input.outTradeNo, orderProvider);
  if (latest?.status === 'PAID') {
    return { kind: 'already_paid' };
  }

  return { kind: 'invalid_order', reason: `unexpected_status:${latest?.status ?? 'unknown'}` };
};
