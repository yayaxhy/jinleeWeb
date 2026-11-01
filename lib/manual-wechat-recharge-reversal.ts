import { DlmAdminOperationStatus, DlmAdminOperationType, Prisma, type PrismaClient } from '@prisma/client';

import { applyDlmWalletDeltaTx, getDlmWalletSnapshotTx, lockDlmWalletForUpdateTx } from './dlm-wallet';
import { prisma } from './prisma';
import { recordWalletTransaction } from './wallet-ledger-write';

export const MANUAL_WECHAT_REVERSAL_ACTION = 'REVERSE_MANUAL_WECHAT_OVERCHARGE';

export type ManualWechatReversalErrorCode =
  | 'INVALID_INPUT'
  | 'BOSS_NOT_FOUND'
  | 'INSUFFICIENT_BALANCE'
  | 'REQUEST_CONFLICT'
  | 'OPERATION_FAILED';

/** Internal codes are mapped to approved display copy at the API boundary. */
export class ManualWechatReversalError extends Error {
  constructor(public readonly code: ManualWechatReversalErrorCode) {
    super(code);
    this.name = 'ManualWechatReversalError';
  }
}

export type ManualWechatReversalInput = {
  requestId: string;
  operatorDiscordId: string;
  dlmId: string;
  amount: unknown;
  receiptAccount: string;
  reason?: string | null;
};

export type ManualWechatReversalResult = {
  requestId: string;
  dlmId: string;
  amount: string;
  balanceAfter: string;
  rechargeId: string;
  transactionId: string;
};

type ReversalDependencies = {
  db: Pick<PrismaClient, '$transaction'>;
  lockWallet: typeof lockDlmWalletForUpdateTx;
  readWallet: typeof getDlmWalletSnapshotTx;
  applyWallet: typeof applyDlmWalletDeltaTx;
  recordTransaction: typeof recordWalletTransaction;
};

const defaultDependencies: ReversalDependencies = {
  db: prisma,
  lockWallet: lockDlmWalletForUpdateTx,
  readWallet: getDlmWalletSnapshotTx,
  applyWallet: applyDlmWalletDeltaTx,
  recordTransaction: recordWalletTransaction,
};

const requiredText = (value: unknown, max: number) => {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  return text && text.length <= max ? text : null;
};

const errorCode = (error: unknown) =>
  typeof error === 'object' && error !== null && 'code' in error ? error.code : null;

const objectValue = (value: unknown): Record<string, unknown> | null =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;

/** Reverses a manual credit, preserving the original Recharge and every historical ledger row.
 * The caller supplies an approved, server-controlled personal-ledger label.
 * Main finance later confirms the new negative Recharge through the existing cash queue.
 */
export async function reverseManualWechatBossRecharge(
  params: ManualWechatReversalInput,
  options: { transactionType: string },
  dependencies: ReversalDependencies = defaultDependencies,
) {
  const requestId = requiredText(params.requestId, 120);
  const operatorDiscordId = requiredText(params.operatorDiscordId, 32);
  const dlmId = requiredText(params.dlmId, 100);
  const receiptAccount = requiredText(params.receiptAccount, 120);
  const reason = typeof params.reason === 'string' ? params.reason.trim() || null : null;
  const invalidReason = (params.reason !== undefined && params.reason !== null && typeof params.reason !== 'string') ||
    (reason !== null && reason.length > 500);
  const rawAmount = typeof params.amount === 'string' || typeof params.amount === 'number'
    ? String(params.amount).trim()
    : '';
  const amount = /^\d+(?:\.\d{1,2})?$/.test(rawAmount) && rawAmount.length <= 32
    ? new Prisma.Decimal(rawAmount)
    : null;
  if (!requestId || !operatorDiscordId || !dlmId || !receiptAccount || invalidReason ||
      !amount || amount.lte(0) || amount.gt(1_000_000)) {
    throw new ManualWechatReversalError('INVALID_INPUT');
  }
  if (!requiredText(options.transactionType, 100)) {
    throw new ManualWechatReversalError('OPERATION_FAILED');
  }

  const { db, lockWallet, readWallet, applyWallet, recordTransaction } = dependencies;
  const requestedAmount = amount.toFixed(2);
  const signedAmount = amount.negated();

  for (let attempt = 0; ; attempt++) {
    try {
      return await db.$transaction(async (tx) => {
        const previous = await tx.dlmAdminOperation.findUnique({ where: { requestId } });
        if (previous) {
          const details = objectValue(previous.details);
          if (previous.type !== DlmAdminOperationType.MANUAL_WECHAT_RECHARGE ||
              previous.dlmId !== dlmId || previous.operatorDiscordId !== operatorDiscordId ||
              previous.receiptReference !== receiptAccount ||
              details?.action !== MANUAL_WECHAT_REVERSAL_ACTION ||
              details.requestedAmount !== requestedAmount || details.receiptAccount !== receiptAccount ||
              details.reason !== reason) {
            throw new ManualWechatReversalError('REQUEST_CONFLICT');
          }
          const stored = objectValue(previous.result);
          if (previous.status !== DlmAdminOperationStatus.COMPLETED ||
              stored?.requestId !== requestId || stored.dlmId !== dlmId ||
              stored.amount !== signedAmount.toFixed(2) ||
              typeof stored.balanceAfter !== 'string' ||
              typeof stored.rechargeId !== 'string' || typeof stored.transactionId !== 'string') {
            throw new ManualWechatReversalError('OPERATION_FAILED');
          }
          const result = stored as ManualWechatReversalResult;
          const current = await readWallet(tx, { dlmId: result.dlmId });
          return { result: { ...result, currentBalance: current.totalBalance.toFixed(2) }, replayed: true };
        }

        const boss = await tx.manualWechatBoss.findUnique({ where: { dlmId }, select: { dlmId: true } });
        if (!boss) throw new ManualWechatReversalError('BOSS_NOT_FOUND');
        const owner = await lockWallet(tx, { dlmId });
        // A stale admin selection must not silently debit another account after a merge.
        if (owner.dlmId !== dlmId) throw new ManualWechatReversalError('BOSS_NOT_FOUND');
        const identity = { dlmId: owner.dlmId, discordUserId: owner.discordId };
        const before = await readWallet(tx, identity);
        if (before.totalBalance.lt(amount) || before.recharge.lt(amount)) {
          throw new ManualWechatReversalError('INSUFFICIENT_BALANCE');
        }

        await tx.$executeRaw`SELECT set_config('bot.skip_recharge_notify', 'true', true)`;
        const after = await applyWallet(tx, {
          ...identity,
          totalBalanceDelta: signedAmount,
          rechargeDelta: signedAmount,
        });
        const recharge = await tx.recharge.create({
          data: { amount: signedAmount, dlmId, toWhom: dlmId, fromWhom: operatorDiscordId },
          select: { RechargeID: true },
        });
        const ledger = await recordTransaction(tx, {
          discordId: owner.discordId,
          dlmId,
          thirdPartydiscordId: operatorDiscordId,
          balanceBefore: before.totalBalance,
          amountChange: signedAmount,
          balanceAfter: after.totalBalance,
          typeOfTransaction: options.transactionType,
        }, { walletBefore: before, walletAfter: after });
        const result: ManualWechatReversalResult = {
          requestId, dlmId, amount: signedAmount.toFixed(2), balanceAfter: after.totalBalance.toFixed(2),
          rechargeId: recharge.RechargeID, transactionId: ledger.transactionId,
        };
        await tx.dlmAdminOperation.create({
          data: {
            requestId, dlmId, operatorDiscordId, receiptReference: receiptAccount,
            type: DlmAdminOperationType.MANUAL_WECHAT_RECHARGE,
            status: DlmAdminOperationStatus.COMPLETED,
            details: { action: MANUAL_WECHAT_REVERSAL_ACTION, requestedAmount, receiptAccount, reason },
            result: result as Prisma.InputJsonValue,
          },
        });
        return { result: { ...result, currentBalance: after.totalBalance.toFixed(2) }, replayed: false };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      // PostgreSQL rolls back every wallet/ledger write before these retries.
      // A racing identical request is then observed and replayed in the next transaction.
      if (attempt < 2 && (errorCode(error) === 'P2034' || errorCode(error) === 'P2002')) continue;
      throw error;
    }
  }
}
