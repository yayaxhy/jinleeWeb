import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { applyDlmWalletDeltaTx, getDlmWalletSnapshotTx, lockDlmWalletForUpdateTx } from '@/lib/dlm-wallet';
import { recordWalletTransaction } from '@/lib/wallet-ledger-write';

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
    if (orderProvider === 'stripe') await tx.$executeRaw`SELECT set_config('bot.skip_recharge_notify', 'true', true)`;
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

    const owner = await lockDlmWalletForUpdateTx(tx, { dlmId: orderDlmId }, { allowMissingMember: true });
    const currentDlmId = owner.dlmId;
    const currentMemberKey = owner.memberKey;

    if (currentMemberKey) {
      await tx.member.upsert({
        where: { discordUserId: currentMemberKey },
        create: {
          discordUserId: currentMemberKey,
          recharge: 0,
          totalBalance: 0,
        },
        update: {},
      });
    }

    const walletBefore = await getDlmWalletSnapshotTx(tx, {
      dlmId: currentDlmId,
      discordUserId: currentMemberKey,
    });

    const walletAfter = await applyDlmWalletDeltaTx(tx, {
      dlmId: currentDlmId,
      discordUserId: currentMemberKey,
      rechargeDelta: normalizedAmount,
      totalBalanceDelta: normalizedAmount,
    });

    await tx.recharge.create({
      data: {
        amount: normalizedAmount,
        toWhom: currentMemberKey,
        dlmId: currentDlmId,
        fromWhom: sourceReference,
      },
    });

    await recordWalletTransaction(tx, {
        discordId: currentMemberKey,
        dlmId: currentDlmId,
        thirdPartydiscordId: sourceReference,
        balanceBefore: new Prisma.Decimal(walletBefore.totalBalance),
        amountChange: normalizedAmount,
        balanceAfter: new Prisma.Decimal(walletAfter.totalBalance),
        typeOfTransaction: transactionType,
    }, { walletBefore, walletAfter });
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
