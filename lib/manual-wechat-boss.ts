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

export const MANUAL_WECHAT_GIFT_REASONS = [
  '充值返现',
  '公会成本',
  'VIP福利',
  '老板赔偿',
  '其他',
] as const;

type ManualWechatGiftReason = typeof MANUAL_WECHAT_GIFT_REASONS[number];

const asManualWechatGiftReason = (value: unknown): ManualWechatGiftReason | null => {
  const reason = cleanText(value, 40);
  return MANUAL_WECHAT_GIFT_REASONS.includes(reason as ManualWechatGiftReason)
    ? reason as ManualWechatGiftReason
    : null;
};

const withCurrentBalance = async <T extends { dlmId?: string }>(result: T, fallbackDlmId: string) => {
  const dlmId = result.dlmId ?? fallbackDlmId;
  const user = await prisma.dlmUser.findUnique({
    where: { dlmId },
    select: { totalBalance: true },
  });
  return {
    ...result,
    currentBalance: user?.totalBalance.toFixed(2) ?? null,
  };
};

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
  receiptAccount?: string | null;
  note?: string | null;
}) => {
  const requestId = cleanText(params.requestId, 120);
  const operatorDiscordId = cleanText(params.operatorDiscordId, 32);
  const dlmId = cleanText(params.dlmId, 100);
  const receiptAccount = cleanText(params.receiptAccount, 120);
  const note = cleanText(params.note, 500) || null;
  const amount = asPositiveMoney(params.amount);
  if (!requestId || !operatorDiscordId || !dlmId || !amount || !receiptAccount) {
    throw new Error('请填写有效金额和微信收款账号。');
  }

  const previous = await prisma.dlmAdminOperation.findUnique({ where: { requestId } });
  if (previous) {
    if (previous.status === DlmAdminOperationStatus.COMPLETED && previous.result) {
      return {
        result: await withCurrentBalance({
          ...(previous.result as { dlmId?: string; amount?: string }),
          rechargeRequestId: previous.requestId,
        }, dlmId),
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
          typeOfTransaction: '人工充值',
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
          // The persisted column retains its legacy name, but its business
          // meaning is a receiving account and it may repeat across payments.
          receiptReference: receiptAccount,
          dlmId,
          operatorDiscordId,
          type: DlmAdminOperationType.MANUAL_WECHAT_RECHARGE,
          status: DlmAdminOperationStatus.COMPLETED,
          details: { amount: amount.toFixed(2), receiptAccount, note } as Prisma.InputJsonValue,
          result: resultPayload as Prisma.InputJsonValue,
        },
      });
      return resultPayload;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return { result, replayed: false };
  } catch (error: any) {
    // The request ID is the idempotency key for a single staff action. This
    // also covers a double-click that reaches the database concurrently.
    if (error?.code === 'P2002') {
      const racedRequest = await prisma.dlmAdminOperation.findUnique({ where: { requestId } });
      if (racedRequest?.status === DlmAdminOperationStatus.COMPLETED && racedRequest.result) {
        return {
          result: await withCurrentBalance({
            ...(racedRequest.result as { dlmId?: string; amount?: string }),
            rechargeRequestId: racedRequest.requestId,
          }, dlmId),
          replayed: true,
        };
      }
    }
    throw error;
  }
};

export const giftManualWechatBoss = async (params: {
  requestId: string;
  operatorDiscordId: string;
  dlmId: string;
  amount: unknown;
  reason: unknown;
}) => {
  const requestId = cleanText(params.requestId, 120);
  const operatorDiscordId = cleanText(params.operatorDiscordId, 32);
  const dlmId = cleanText(params.dlmId, 100);
  const reason = asManualWechatGiftReason(params.reason);
  const amount = asPositiveMoney(params.amount);
  if (!requestId || !operatorDiscordId || !dlmId || !amount || !reason) {
    throw new Error('请填写有效赠送金额和原因。');
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
          reason,
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
          typeOfTransaction: reason,
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
          dlmId,
          operatorDiscordId,
          type: DlmAdminOperationType.RECHARGE_CASHBACK,
          status: DlmAdminOperationStatus.COMPLETED,
          details: { reason } as Prisma.InputJsonValue,
          result: resultPayload as Prisma.InputJsonValue,
        },
      });
      return resultPayload;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return { result, replayed: false };
  } catch (error: any) {
    if (error?.code === 'P2002') {
      const existingGift = await prisma.dlmAdminOperation.findUnique({ where: { requestId } });
      if (
        existingGift?.type === DlmAdminOperationType.RECHARGE_CASHBACK &&
        existingGift.status === DlmAdminOperationStatus.COMPLETED &&
        existingGift.result &&
        existingGift.dlmId === dlmId
      ) {
        return { result: existingGift.result as { dlmId?: string; amount?: string }, replayed: true };
      }
    }
    throw error;
  }
};
