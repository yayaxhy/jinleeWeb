import { Prisma } from '@prisma/client';

const DEC = (value: Prisma.Decimal | number | string | null | undefined) =>
  value instanceof Prisma.Decimal ? value : new Prisma.Decimal(value ?? 0);

type WalletTx = Prisma.TransactionClient;

export type DlmWalletIdentity = {
  dlmId: string;
  discordUserId?: string | null;
};

type WalletDeltaInput = DlmWalletIdentity & {
  totalBalanceDelta?: Prisma.Decimal | number | string;
  incomeDelta?: Prisma.Decimal | number | string;
  rechargeDelta?: Prisma.Decimal | number | string;
  totalSpentDelta?: Prisma.Decimal | number | string;
  loyaltyPointsDelta?: Prisma.Decimal | number | string;
};

export const getDlmWalletSnapshotTx = async (
  tx: WalletTx,
  identity: DlmWalletIdentity,
) => {
  const dlmUser = await tx.dlmUser.findUnique({
    where: { dlmId: identity.dlmId },
    select: {
      totalBalance: true,
      income: true,
      recharge: true,
      totalSpent: true,
      loyaltyPoints: true,
    },
  });

  if (!dlmUser) {
    throw new Error(`dlm_user_not_found:${identity.dlmId}`);
  }

  if (!identity.discordUserId) {
    return {
      totalBalance: DEC(dlmUser.totalBalance),
      income: DEC(dlmUser.income),
      recharge: DEC(dlmUser.recharge),
      totalSpent: DEC(dlmUser.totalSpent),
      loyaltyPoints: DEC(dlmUser.loyaltyPoints),
    };
  }

  const member = await tx.member.findUnique({
    where: { discordUserId: identity.discordUserId },
    select: {
      totalBalance: true,
      income: true,
      recharge: true,
      totalSpent: true,
    },
  });

  return {
    totalBalance: DEC(member?.totalBalance ?? dlmUser.totalBalance),
    income: DEC(member?.income ?? dlmUser.income),
    recharge: DEC(member?.recharge ?? dlmUser.recharge),
    totalSpent: DEC(member?.totalSpent ?? dlmUser.totalSpent),
    loyaltyPoints: DEC(dlmUser.loyaltyPoints),
  };
};

export const applyDlmWalletDeltaTx = async (
  tx: WalletTx,
  params: WalletDeltaInput,
) => {
  const totalBalanceDelta = DEC(params.totalBalanceDelta);
  const incomeDelta = DEC(params.incomeDelta);
  const rechargeDelta = DEC(params.rechargeDelta);
  const totalSpentDelta = DEC(params.totalSpentDelta);
  const loyaltyPointsDelta = DEC(params.loyaltyPointsDelta);

  const updatedDlmUser = await tx.dlmUser.update({
    where: { dlmId: params.dlmId },
    data: {
      totalBalance: { increment: totalBalanceDelta },
      income: { increment: incomeDelta },
      recharge: { increment: rechargeDelta },
      totalSpent: { increment: totalSpentDelta },
      loyaltyPoints: { increment: loyaltyPointsDelta },
    },
    select: {
      totalBalance: true,
      income: true,
      recharge: true,
      totalSpent: true,
      loyaltyPoints: true,
    },
  });

  let updatedMember:
    | {
        totalBalance: Prisma.Decimal;
        income: Prisma.Decimal;
        recharge: Prisma.Decimal;
        totalSpent: Prisma.Decimal;
      }
    | null = null;

  if (params.discordUserId) {
    updatedMember = await tx.member.update({
      where: { discordUserId: params.discordUserId },
      data: {
        totalBalance: { increment: totalBalanceDelta },
        income: { increment: incomeDelta },
        recharge: { increment: rechargeDelta },
        totalSpent: { increment: totalSpentDelta },
      },
      select: {
        totalBalance: true,
        income: true,
        recharge: true,
        totalSpent: true,
      },
    });

    if (!totalBalanceDelta.isZero()) {
      await tx.pEIWAN
        .update({
          where: { discordUserId: params.discordUserId },
          data: { balance: updatedMember.totalBalance },
        })
        .catch(() => {});
    }
  }

  return {
    totalBalance: DEC(updatedMember?.totalBalance ?? updatedDlmUser.totalBalance),
    income: DEC(updatedMember?.income ?? updatedDlmUser.income),
    recharge: DEC(updatedMember?.recharge ?? updatedDlmUser.recharge),
    totalSpent: DEC(updatedMember?.totalSpent ?? updatedDlmUser.totalSpent),
    loyaltyPoints: DEC(updatedDlmUser.loyaltyPoints),
  };
};
