import { DlmAdminOperationStatus, DlmAdminOperationType, Prisma } from '@prisma/client';

import { applyDlmWalletDeltaTx, getDlmWalletSnapshotTx } from '@/lib/dlm-wallet';
import { recordWalletTransaction } from '@/lib/wallet-ledger-write';
import { prisma } from '@/lib/prisma';

const DEC = (value: Prisma.Decimal | number | string) => new Prisma.Decimal(value);
const cleanText = (value: unknown, maxLength: number) => String(value ?? '').trim().slice(0, maxLength);
const isUniqueConstraintError = (error: unknown) =>
  typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';

const asPositiveMoney = (value: unknown) => {
  const raw = String(value ?? '').trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(raw)) return null;
  const amount = DEC(raw);
  return amount.gt(0) && amount.lte(1_000_000) ? amount : null;
};

/** Appends an auditable debit/credit pair; it never overwrites the original recharge. */
export const correctManualWechatBossRecharge = async (params: {
  requestId: string;
  operatorDiscordId: string;
  sourceOperationId: string;
  targetDlmId: string;
  reason: string;
}) => {
  const requestId = cleanText(params.requestId, 120);
  const operatorDiscordId = cleanText(params.operatorDiscordId, 32);
  const sourceOperationId = cleanText(params.sourceOperationId, 100);
  const targetDlmId = cleanText(params.targetDlmId, 100);
  const reason = cleanText(params.reason, 500);
  if (!requestId || !operatorDiscordId || !sourceOperationId || !targetDlmId || !reason) {
    throw new Error('请选择原充值记录和正确老板，并填写更正原因。');
  }

  const previous = await prisma.dlmAdminOperation.findUnique({ where: { requestId } });
  if (previous) {
    if (previous.status === DlmAdminOperationStatus.COMPLETED && previous.result) {
      return { result: previous.result as Record<string, string>, replayed: true };
    }
    throw new Error(`该请求已${previous.status === DlmAdminOperationStatus.PENDING ? '提交处理中' : '失败'}，请刷新页面后重新提交。`);
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const sourceOperation = await tx.dlmAdminOperation.findUnique({
        where: { id: sourceOperationId },
        select: { id: true, dlmId: true, type: true, status: true, sourceOperationId: true, receiptReference: true, result: true },
      });
      if (!sourceOperation || sourceOperation.type !== DlmAdminOperationType.MANUAL_WECHAT_RECHARGE ||
          sourceOperation.status !== DlmAdminOperationStatus.COMPLETED || sourceOperation.sourceOperationId) {
        throw new Error('未找到可更正的微信人工充值记录。');
      }
      if (sourceOperation.dlmId === targetDlmId) throw new Error('原老板和正确老板不能是同一个账户。');

      const sourceResult = sourceOperation.result as { amount?: unknown; rechargeId?: unknown } | null;
      const amount = asPositiveMoney(sourceResult?.amount);
      const originalRechargeId = cleanText(sourceResult?.rechargeId, 100);
      if (!amount || !originalRechargeId) throw new Error('原充值记录缺少有效金额或编号，无法自动更正。');

      const [sourceBoss, targetBoss, existingCorrection] = await Promise.all([
        tx.manualWechatBoss.findUnique({ where: { dlmId: sourceOperation.dlmId }, include: { dlmUser: { select: { discordUserId: true } } } }),
        tx.manualWechatBoss.findUnique({ where: { dlmId: targetDlmId }, include: { dlmUser: { select: { discordUserId: true } } } }),
        tx.dlmAdminOperation.findUnique({ where: { sourceOperationId } }),
      ]);
      if (!sourceBoss || !targetBoss) throw new Error('原老板或正确老板账户不存在。');
      if (existingCorrection) throw new Error('该笔充值已更正，不能重复操作。');

      for (const dlmId of [sourceOperation.dlmId, targetDlmId].sort()) {
        await tx.$executeRaw`SELECT 1 FROM "DlmUser" WHERE "dlmId" = ${dlmId} FOR UPDATE`;
      }

      const sourceBefore = await getDlmWalletSnapshotTx(tx, { dlmId: sourceOperation.dlmId, discordUserId: sourceBoss.dlmUser.discordUserId });
      if (sourceBefore.totalBalance.lt(amount)) throw new Error(`原老板当前余额不足 ¥${amount.toFixed(2)}，不能更正；请先人工核实已使用金额。`);
      if (sourceBefore.recharge.lt(amount)) throw new Error('原老板累计充值余额不足，无法安全更正该笔充值。');
      const targetBefore = await getDlmWalletSnapshotTx(tx, { dlmId: targetDlmId, discordUserId: targetBoss.dlmUser.discordUserId });
      const sourceAfter = await applyDlmWalletDeltaTx(tx, {
        dlmId: sourceOperation.dlmId, discordUserId: sourceBoss.dlmUser.discordUserId,
        rechargeDelta: amount.negated(), totalBalanceDelta: amount.negated(),
      });
      const targetAfter = await applyDlmWalletDeltaTx(tx, {
        dlmId: targetDlmId, discordUserId: targetBoss.dlmUser.discordUserId,
        rechargeDelta: amount, totalBalanceDelta: amount,
      });
      const [sourceRecharge, targetRecharge, sourceLedger, targetLedger] = await Promise.all([
        tx.recharge.create({ data: { amount: amount.negated(), dlmId: sourceOperation.dlmId, toWhom: sourceOperation.dlmId, fromWhom: operatorDiscordId }, select: { RechargeID: true } }),
        tx.recharge.create({ data: { amount, dlmId: targetDlmId, toWhom: targetDlmId, fromWhom: operatorDiscordId }, select: { RechargeID: true } }),
        recordWalletTransaction(tx, {
          discordId: sourceBoss.dlmUser.discordUserId, dlmId: sourceOperation.dlmId, thirdPartydiscordId: operatorDiscordId,
          balanceBefore: sourceBefore.totalBalance, amountChange: amount.negated(), balanceAfter: sourceAfter.totalBalance, typeOfTransaction: '充值更正转出',
        }, { walletBefore: sourceBefore, walletAfter: sourceAfter }),
        recordWalletTransaction(tx, {
          discordId: targetBoss.dlmUser.discordUserId, dlmId: targetDlmId, thirdPartydiscordId: operatorDiscordId,
          balanceBefore: targetBefore.totalBalance, amountChange: amount, balanceAfter: targetAfter.totalBalance, typeOfTransaction: '充值更正转入',
        }, { walletBefore: targetBefore, walletAfter: targetAfter }),
      ]);
      const resultPayload = {
        amount: amount.toFixed(2), originalRechargeId, sourceDlmId: sourceOperation.dlmId, targetDlmId,
        sourceBalanceAfter: sourceAfter.totalBalance.toFixed(2), targetBalanceAfter: targetAfter.totalBalance.toFixed(2),
        sourceRechargeId: sourceRecharge.RechargeID, targetRechargeId: targetRecharge.RechargeID,
        sourceTransactionId: sourceLedger.transactionId, targetTransactionId: targetLedger.transactionId,
      };
      await tx.dlmAdminOperation.create({
        data: {
          requestId, sourceOperationId, receiptReference: sourceOperation.receiptReference, dlmId: targetDlmId, operatorDiscordId,
          type: DlmAdminOperationType.MANUAL_WECHAT_RECHARGE, status: DlmAdminOperationStatus.COMPLETED,
          details: { action: 'CORRECT_WRONG_BOSS_RECHARGE', reason, originalRechargeId, sourceDlmId: sourceOperation.dlmId, targetDlmId } as Prisma.InputJsonValue,
          result: resultPayload as Prisma.InputJsonValue,
        },
      });
      return resultPayload;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return { result, replayed: false };
  } catch (error: unknown) {
    if (isUniqueConstraintError(error)) {
      const racedRequest = await prisma.dlmAdminOperation.findUnique({ where: { requestId } });
      if (racedRequest?.status === DlmAdminOperationStatus.COMPLETED && racedRequest.result) {
        return { result: racedRequest.result as Record<string, string>, replayed: true };
      }
      if (await prisma.dlmAdminOperation.findUnique({ where: { sourceOperationId } })) {
        throw new Error('该笔充值已更正，不能重复操作。');
      }
    }
    throw error;
  }
};
