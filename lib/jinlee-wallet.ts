import { Prisma } from '@prisma/client';

const DEC = (value: Prisma.Decimal | number | string | null | undefined) =>
  value instanceof Prisma.Decimal ? value : new Prisma.Decimal(value ?? 0);

type WalletTx = Prisma.TransactionClient;

export type JinleeWalletIdentity = {
  jinleeId: string;
  discordUserId?: string | null;
};

type WalletDeltaInput = JinleeWalletIdentity & {
  totalBalanceDelta?: Prisma.Decimal | number | string;
  incomeDelta?: Prisma.Decimal | number | string;
  rechargeDelta?: Prisma.Decimal | number | string;
  totalSpentDelta?: Prisma.Decimal | number | string;
  loyaltyPointsDelta?: Prisma.Decimal | number | string;
};

export const getJinleeWalletSnapshotTx = async (
  tx: WalletTx,
  identity: JinleeWalletIdentity,
) => {
  const jinleeUser = await tx.jinleeUser.findUnique({
    where: { jinleeId: identity.jinleeId },
    select: {
      totalBalance: true,
      income: true,
      recharge: true,
      totalSpent: true,
      loyaltyPoints: true,
    },
  });

  if (!jinleeUser) {
    throw new Error(`jinlee_user_not_found:${identity.jinleeId}`);
  }

  if (!identity.discordUserId) {
    return {
      totalBalance: DEC(jinleeUser.totalBalance),
      income: DEC(jinleeUser.income),
      recharge: DEC(jinleeUser.recharge),
      totalSpent: DEC(jinleeUser.totalSpent),
      loyaltyPoints: DEC(jinleeUser.loyaltyPoints),
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
    totalBalance: DEC(member?.totalBalance ?? jinleeUser.totalBalance),
    income: DEC(member?.income ?? jinleeUser.income),
    recharge: DEC(member?.recharge ?? jinleeUser.recharge),
    totalSpent: DEC(member?.totalSpent ?? jinleeUser.totalSpent),
    loyaltyPoints: DEC(jinleeUser.loyaltyPoints),
  };
};

export const applyJinleeWalletDeltaTx = async (
  tx: WalletTx,
  params: WalletDeltaInput,
) => {
  const totalBalanceDelta = DEC(params.totalBalanceDelta);
  const incomeDelta = DEC(params.incomeDelta);
  const rechargeDelta = DEC(params.rechargeDelta);
  const totalSpentDelta = DEC(params.totalSpentDelta);
  const loyaltyPointsDelta = DEC(params.loyaltyPointsDelta);

  const updatedJinleeUser = await tx.jinleeUser.update({
    where: { jinleeId: params.jinleeId },
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
    totalBalance: DEC(updatedMember?.totalBalance ?? updatedJinleeUser.totalBalance),
    income: DEC(updatedMember?.income ?? updatedJinleeUser.income),
    recharge: DEC(updatedMember?.recharge ?? updatedJinleeUser.recharge),
    totalSpent: DEC(updatedMember?.totalSpent ?? updatedJinleeUser.totalSpent),
    loyaltyPoints: DEC(updatedJinleeUser.loyaltyPoints),
  };
};
