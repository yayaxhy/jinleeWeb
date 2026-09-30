import {
  DlmAdminOperationStatus,
  DlmAdminOperationType,
  Prisma,
} from '@prisma/client';
import { generateDlmId } from '@/lib/dlm-id';
import { applyDlmWalletDeltaTx, getDlmWalletSnapshotTx } from '@/lib/dlm-wallet';
import { prisma } from '@/lib/prisma';

const DEC = (value: Prisma.Decimal | number | string) => new Prisma.Decimal(value);

const asPositiveMoney = (value: unknown) => {
  const raw = String(value ?? '').trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(raw)) return null;
  const amount = DEC(raw);
  if (amount.lte(0) || amount.gt('1000000')) return null;
  return amount;
};

const cleanText = (value: unknown, maxLength: number) => String(value ?? '').trim().slice(0, maxLength);

export const createManualWechatBoss = async (params: {
  requestId: string;
  operatorDiscordId: string;
  wechatContact: string;
  displayName?: string | null;
}) => {
  const requestId = cleanText(params.requestId, 120);
  const operatorDiscordId = cleanText(params.operatorDiscordId, 32);
  const wechatContact = cleanText(params.wechatContact, 100);
  const displayName = cleanText(params.displayName, 100) || null;
  if (!requestId || !operatorDiscordId || !wechatContact || !displayName) {
    throw new Error('请填写老板微信号和老板备注名。');
  }

  const previous = await prisma.dlmAdminOperation.findUnique({ where: { requestId } });
  if (previous) {
    if (previous.status === DlmAdminOperationStatus.COMPLETED && previous.result) {
      return { result: previous.result as { dlmId?: string }, replayed: true };
    }
    throw new Error(`该请求已${previous.status === DlmAdminOperationStatus.PENDING ? '提交处理中' : '失败'}，请刷新页面后重新提交。`);
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const dlmId = generateDlmId();
      await tx.dlmUser.create({
        data: {
          dlmId,
          wechatDisplayName: displayName,
          manualWechatBoss: {
            create: {
              wechatContact,
              displayName,
              createdByDiscordId: operatorDiscordId,
            },
          },
        },
      });
      const resultPayload = { dlmId, wechatContact, displayName };
      await tx.dlmAdminOperation.create({
        data: {
          requestId,
          dlmId,
          operatorDiscordId,
          type: DlmAdminOperationType.MANUAL_WECHAT_BOSS_CREATE,
          status: DlmAdminOperationStatus.COMPLETED,
          details: { wechatContact, displayName } as Prisma.InputJsonValue,
          result: resultPayload as Prisma.InputJsonValue,
        },
      });
      return resultPayload;
    });
    return { result, replayed: false };
  } catch (error: any) {
    if (error?.code === 'P2002') throw new Error('该微信标识已经绑定了一个老板账户。');
    throw error;
  }
};

export const rechargeManualWechatBoss = async (params: {
  requestId: string;
  operatorDiscordId: string;
  dlmId: string;
  amount: unknown;
  receiptReference?: string | null;
  note?: string | null;
}) => {
  const requestId = cleanText(params.requestId, 120);
  const operatorDiscordId = cleanText(params.operatorDiscordId, 32);
  const dlmId = cleanText(params.dlmId, 100);
  const receiptReference = cleanText(params.receiptReference, 120);
  const note = cleanText(params.note, 500) || null;
  const amount = asPositiveMoney(params.amount);
  if (!requestId || !operatorDiscordId || !dlmId || !amount || !receiptReference) {
    throw new Error('请填写有效金额和微信收款号。');
  }

  const previous = await prisma.dlmAdminOperation.findUnique({ where: { requestId } });
  if (previous) {
    if (previous.status === DlmAdminOperationStatus.COMPLETED && previous.result) {
      return {
        result: {
          ...(previous.result as { dlmId?: string; amount?: string }),
          rechargeRequestId: previous.requestId,
        },
        replayed: true,
      };
    }
    throw new Error(`该请求已${previous.status === DlmAdminOperationStatus.PENDING ? '提交处理中' : '失败'}，请刷新页面后重新提交。`);
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const boss = await tx.manualWechatBoss.findUnique({
        where: { dlmId },
        include: { dlmUser: { select: { discordUserId: true } } },
      });
      if (!boss) throw new Error('未找到该微信老板账户。');

      await tx.$executeRaw`SELECT 1 FROM "DlmUser" WHERE "dlmId" = ${dlmId} FOR UPDATE`;
      const before = await getDlmWalletSnapshotTx(tx, {
        dlmId,
        discordUserId: boss.dlmUser.discordUserId,
      });
      const after = await applyDlmWalletDeltaTx(tx, {
        dlmId,
        discordUserId: boss.dlmUser.discordUserId,
        rechargeDelta: amount,
        totalBalanceDelta: amount,
      });
      const recharge = await tx.recharge.create({
        data: {
          amount,
          dlmId,
          toWhom: dlmId,
          fromWhom: operatorDiscordId,
        },
        select: { RechargeID: true },
      });
      const ledger = await tx.individualTransaction.create({
        data: {
          discordId: boss.dlmUser.discordUserId,
          dlmId,
          thirdPartydiscordId: operatorDiscordId,
          balanceBefore: before.totalBalance,
          amountChange: amount,
          balanceAfter: after.totalBalance,
          typeOfTransaction: '微信人工充值',
        },
        select: { transactionId: true },
      });
      const resultPayload = {
        dlmId,
        amount: amount.toFixed(2),
        balanceAfter: after.totalBalance.toFixed(2),
        rechargeId: recharge.RechargeID,
        transactionId: ledger.transactionId,
        // Keep the original operation ID so a later submission with the same
        // receipt can retry its channel notification without charging twice.
        rechargeRequestId: requestId,
      };
      await tx.dlmAdminOperation.create({
        data: {
          requestId,
          receiptReference,
          dlmId,
          operatorDiscordId,
          type: DlmAdminOperationType.MANUAL_WECHAT_RECHARGE,
          status: DlmAdminOperationStatus.COMPLETED,
          details: { amount: amount.toFixed(2), receiptReference, note } as Prisma.InputJsonValue,
          result: resultPayload as Prisma.InputJsonValue,
        },
      });
      return resultPayload;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return { result, replayed: false };
  } catch (error: any) {
    if (error?.code === 'P2002') {
      const existingReceipt = await prisma.dlmAdminOperation.findUnique({ where: { receiptReference } });
      if (
        existingReceipt?.type === DlmAdminOperationType.MANUAL_WECHAT_RECHARGE &&
        existingReceipt.status === DlmAdminOperationStatus.COMPLETED &&
        existingReceipt.result &&
        existingReceipt.dlmId === dlmId
      ) {
        return {
          result: {
            ...(existingReceipt.result as { dlmId?: string; amount?: string }),
            rechargeRequestId: existingReceipt.requestId,
          },
          replayed: true,
        };
      }
      throw new Error('该收款单号/操作请求已使用，未重复入账。');
    }
    throw error;
  }
};

export const cashbackManualWechatBossRecharge = async (params: {
  requestId: string;
  operatorDiscordId: string;
  dlmId: string;
  amount: unknown;
  sourceReceiptReference?: string | null;
  note?: string | null;
}) => {
  const requestId = cleanText(params.requestId, 120);
  const operatorDiscordId = cleanText(params.operatorDiscordId, 32);
  const dlmId = cleanText(params.dlmId, 100);
  const sourceReceiptReference = cleanText(params.sourceReceiptReference, 120);
  const note = cleanText(params.note, 500) || null;
  const amount = asPositiveMoney(params.amount);
  if (!requestId || !operatorDiscordId || !dlmId || !amount || !sourceReceiptReference) {
    throw new Error('请填写有效返现金额和原微信收款号。');
  }

  const previous = await prisma.dlmAdminOperation.findUnique({ where: { requestId } });
  if (previous) {
    if (previous.status === DlmAdminOperationStatus.COMPLETED && previous.result) {
      return { result: previous.result as { dlmId?: string; amount?: string }, replayed: true };
    }
    throw new Error(`该请求已${previous.status === DlmAdminOperationStatus.PENDING ? '提交处理中' : '失败'}，请刷新页面后重新提交。`);
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const sourceRecharge = await tx.dlmAdminOperation.findUnique({
        where: { receiptReference: sourceReceiptReference },
        select: { id: true, dlmId: true, type: true, status: true },
      });
      if (
        !sourceRecharge ||
        sourceRecharge.dlmId !== dlmId ||
        sourceRecharge.type !== DlmAdminOperationType.MANUAL_WECHAT_RECHARGE ||
        sourceRecharge.status !== DlmAdminOperationStatus.COMPLETED
      ) {
        throw new Error('未找到该老板已完成的原微信充值记录。');
      }

      const boss = await tx.manualWechatBoss.findUnique({
        where: { dlmId },
        include: { dlmUser: { select: { discordUserId: true } } },
      });
      if (!boss) throw new Error('未找到该微信老板账户。');

      await tx.$executeRaw`SELECT 1 FROM "DlmUser" WHERE "dlmId" = ${dlmId} FOR UPDATE`;
      await tx.member.upsert({
        where: { discordUserId: operatorDiscordId },
        create: { discordUserId: operatorDiscordId },
        update: {},
      });
      const before = await getDlmWalletSnapshotTx(tx, {
        dlmId,
        discordUserId: boss.dlmUser.discordUserId,
      });
      const after = await applyDlmWalletDeltaTx(tx, {
        dlmId,
        discordUserId: boss.dlmUser.discordUserId,
        rechargeDelta: amount,
        totalBalanceDelta: amount,
      });
      const expense = await tx.expense.create({
        data: {
          amount,
          operatorId: operatorDiscordId,
          reason: '充值返现',
        },
        select: { id: true },
      });
      const ledger = await tx.individualTransaction.create({
        data: {
          discordId: boss.dlmUser.discordUserId,
          dlmId,
          thirdPartydiscordId: operatorDiscordId,
          balanceBefore: before.totalBalance,
          amountChange: amount,
          balanceAfter: after.totalBalance,
          typeOfTransaction: '充值返现',
        },
        select: { transactionId: true },
      });
      const resultPayload = {
        dlmId,
        amount: amount.toFixed(2),
        balanceAfter: after.totalBalance.toFixed(2),
        expenseId: expense.id,
        transactionId: ledger.transactionId,
      };
      await tx.dlmAdminOperation.create({
        data: {
          requestId,
          sourceOperationId: sourceRecharge.id,
          dlmId,
          operatorDiscordId,
          type: DlmAdminOperationType.RECHARGE_CASHBACK,
          status: DlmAdminOperationStatus.COMPLETED,
          details: { sourceReceiptReference, note } as Prisma.InputJsonValue,
          result: resultPayload as Prisma.InputJsonValue,
        },
      });
      return resultPayload;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return { result, replayed: false };
  } catch (error: any) {
    if (error?.code === 'P2002') {
      const sourceRecharge = await prisma.dlmAdminOperation.findUnique({
        where: { receiptReference: sourceReceiptReference },
        select: { id: true, dlmId: true },
      });
      const existingCashback = sourceRecharge
        ? await prisma.dlmAdminOperation.findUnique({ where: { sourceOperationId: sourceRecharge.id } })
        : null;
      if (
        existingCashback?.type === DlmAdminOperationType.RECHARGE_CASHBACK &&
        existingCashback.status === DlmAdminOperationStatus.COMPLETED &&
        existingCashback.result &&
        existingCashback.dlmId === dlmId
      ) {
        return { result: existingCashback.result as { dlmId?: string; amount?: string }, replayed: true };
      }
      throw new Error('该原微信收款号已经发放过充值返现，未重复加余额。');
    }
    throw error;
  }
};
