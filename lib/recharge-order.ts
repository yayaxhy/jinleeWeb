import { prisma } from '@/lib/prisma';
import { settleRechargeOrderPaymentTx, type SettleRechargeOrderInput } from '@/lib/recharge-order-transaction';
import { getSiteCopy } from './site-copy-server';

export const settleRechargeOrderPayment = async (input: SettleRechargeOrderInput) => {
  const copy = await getSiteCopy();
  // Capture copy before the transaction. A copy failure uses the original defaults.
  // Do not retry here: a later provider delivery rechecks the persisted payment claim.
  return prisma.$transaction((tx) => settleRechargeOrderPaymentTx(tx, input, copy));
};
