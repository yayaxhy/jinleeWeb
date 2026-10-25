import { Prisma } from '@prisma/client';
import { applyDlmWalletDeltaTx, getDlmWalletSnapshotTx } from './dlm-wallet';

export class WithdrawError extends Error {
  constructor(public code: string, public status = 400, public meta?: Record<string, unknown>) {
    super(code);
  }
}

/** Caller owns the transaction; account validation happens before taking locks. */
export async function createWithdrawalTx(
  tx: Prisma.TransactionClient,
  input: {
    dlmId: string;
    discordUserId: string | null;
    amount: Prisma.Decimal;
    method: string;
    cooldownMs: number;
  },
  now: () => number = Date.now,
) {
  // Match the existing wallet write order: DlmUser, then its Member mirror.
  // Take the lock before either eligibility read so a concurrent request sees
  // the first request's withdrawal and remaining funds after it commits.
  await tx.$executeRaw`SELECT 1 FROM "DlmUser" WHERE "dlmId" = ${input.dlmId} FOR UPDATE`;
  if (input.discordUserId) {
    await tx.$executeRaw`SELECT 1 FROM "Member" WHERE "discordUserId" = ${input.discordUserId} FOR UPDATE`;
  }

  const lastWithdraw = await tx.withdraw.findFirst({
    where: { dlmId: input.dlmId },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true },
  });
  if (lastWithdraw?.createdAt) {
    const nextAvailableAt = new Date(lastWithdraw.createdAt.getTime() + input.cooldownMs);
    if (nextAvailableAt.getTime() > now()) {
      throw new WithdrawError('withdraw_cooldown', 429, { nextAvailableAt: nextAvailableAt.toISOString() });
    }
  }

  const walletSnapshot = await getDlmWalletSnapshotTx(tx, input);
  const income = new Prisma.Decimal(walletSnapshot.income);
  const balance = new Prisma.Decimal(walletSnapshot.totalBalance);
  if (income.lt(input.amount) || balance.lt(input.amount)) throw new WithdrawError('insufficient_balance');

  const updatedWallet = await applyDlmWalletDeltaTx(tx, {
    dlmId: input.dlmId,
    discordUserId: input.discordUserId,
    incomeDelta: input.amount.negated(),
    totalBalanceDelta: input.amount.negated(),
  });
  const withdrawal = await tx.withdraw.create({
    data: { discordId: input.discordUserId, dlmId: input.dlmId, amount: input.amount, method: input.method },
    select: { id: true, createdAt: true, method: true },
  });
  await tx.individualTransaction.create({
    data: {
      discordId: input.discordUserId,
      dlmId: input.dlmId,
      thirdPartydiscordId: input.method,
      balanceBefore: balance,
      amountChange: input.amount.negated(),
      balanceAfter: new Prisma.Decimal(updatedWallet.totalBalance ?? 0),
      typeOfTransaction: '提现',
    },
  });

  return {
    withdrawalId: withdrawal.id,
    remainingIncome: updatedWallet.income?.toString() ?? '0',
    remainingBalance: updatedWallet.totalBalance?.toString() ?? '0',
    nextAvailableAt: new Date(now() + input.cooldownMs).toISOString(),
    notificationPayload: {
      userDiscordId: input.discordUserId ?? undefined,
      amount: input.amount.toFixed(2),
      requestedAt: withdrawal.createdAt.toISOString(),
      withdrawalId: withdrawal.id,
      note: withdrawal.method,
      remainingIncome: updatedWallet.income?.toString() ?? '0',
    },
  };
}
