import { Prisma } from '@prisma/client';
import type { Prisma as PrismaNamespace } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { applyDlmWalletDeltaTx, getDlmWalletSnapshotTx } from '@/lib/dlm-wallet';
import { createDiscountApplier } from '@/lib/order-discount-transaction';
export type { ApplyDiscountResult, DiscountKind } from '@/lib/order-discount-transaction';

const suppressRechargeNotifications = async (_tx: PrismaNamespace.TransactionClient) => {
  // No-op placeholder; keep signature for compatibility.
  void _tx;
};

const recordIndividualTransaction = async (
  tx: PrismaNamespace.TransactionClient,
  data: {
    dlmId: string;
    discordId?: string | null;
    thirdPartydiscordId: string;
    balanceBefore: Prisma.Decimal;
    amountChange: Prisma.Decimal;
    balanceAfter: Prisma.Decimal;
    typeOfTransaction: string;
    timeCreatedAt: Date;
  },
) => {
  return tx.individualTransaction.create({
    data: {
      discordId: data.discordId ?? null,
      dlmId: data.dlmId,
      thirdPartydiscordId: data.thirdPartydiscordId,
      balanceBefore: data.balanceBefore,
      amountChange: data.amountChange,
      balanceAfter: data.balanceAfter,
      typeOfTransaction: data.typeOfTransaction,
      timeCreatedAt: data.timeCreatedAt,
    },
  });
};

export const applyDiscountForOrder = createDiscountApplier({
  db: prisma, getWallet: getDlmWalletSnapshotTx, applyWallet: applyDlmWalletDeltaTx,
  record: recordIndividualTransaction, suppressNotifications: suppressRechargeNotifications,
});
