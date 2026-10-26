import { createSiteCopy, type SiteCopyRenderer } from "./site-copy";
import { enqueueNotificationTx, suppressGenericBalanceNoticeTx } from './notification-outbox';
import {
  DlmAdminOperationStatus,
  DlmAdminOperationType,
  Prisma,
} from '@prisma/client';
import { generateDlmId } from '@/lib/dlm-id';
import { applyDlmWalletDeltaTx, getDlmWalletSnapshotTx } from '@/lib/dlm-wallet';
import { manualOperationResultForCurrentAccount, replayManualWechatRechargeResult } from '@/lib/manual-wechat-operation-replay';
import { prisma } from '@/lib/prisma';

const DEC = (value: Prisma.Decimal | number | string) => new Prisma.Decimal(value);
const isUniqueConstraintError = (error: unknown) =>
  typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';

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

const readCurrentBalance = async (dlmId: string) => {
  const user = await prisma.dlmUser.findUnique({
    where: { dlmId },
    select: { totalBalance: true },
  });
  return user?.totalBalance.toFixed(2) ?? null;
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
      return {
        result: manualOperationResultForCurrentAccount({
          dlmId: previous.dlmId,
          result: previous.result as { dlmId?: string },
        }),
        replayed: true,
      };
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
  } catch (error: unknown) {
    if (isUniqueConstraintError(error)) throw new Error('该微信标识已经绑定了一个老板账户。');
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
}, copy: SiteCopyRenderer = createSiteCopy()) => {
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
        result: await replayManualWechatRechargeResult({
          dlmId: previous.dlmId,
          requestId: previous.requestId,
          result: previous.result as { dlmId?: string; amount?: string },
        }, readCurrentBalance),
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
      await suppressGenericBalanceNoticeTx(tx);
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
      await enqueueNotificationTx(tx, { dedupeKey: `manual-recharge:${requestId}`, recipientDlmId: dlmId,
        recipientDiscordId: boss.dlmUser.discordUserId, event: 'BALANCE_ADJUSTED', title: copy("site.lib.manual.wechat.boss.333c89553678"),
        body: copy("site.lib.manual.wechat.boss.f0c16910c207", {value1: String(amount.toFixed(2))}), href: '/console?tab=wallet' });
      return resultPayload;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return { result, replayed: false };
  } catch (error: unknown) {
    // The request ID is the idempotency key for a single staff action. This
    // also covers a double-click that reaches the database concurrently.
    if (isUniqueConstraintError(error)) {
      const racedRequest = await prisma.dlmAdminOperation.findUnique({ where: { requestId } });
      if (racedRequest?.status === DlmAdminOperationStatus.COMPLETED && racedRequest.result) {
        return {
          result: await replayManualWechatRechargeResult({
            dlmId: racedRequest.dlmId,
            requestId: racedRequest.requestId,
            result: racedRequest.result as { dlmId?: string; amount?: string },
          }, readCurrentBalance),
          replayed: true,
        };
      }
    }
    throw error;
  }
};

/**
 * Move one manual-WeChat recharge that was credited to the wrong boss.
 *
 * The original recharge is deliberately preserved. Instead, we append an
 * equal debit/credit pair so financial reports, wallet history, and the
 * administrator audit trail retain a complete explanation of the correction.
 */
export const correctManualWechatBossRecharge = async (params: {
  requestId: string;
  operatorDiscordId: string;
  sourceOperationId: string;
  targetDlmId: string;
  reason: string;
}, copy: SiteCopyRenderer = createSiteCopy()) => {
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
        select: {
          id: true,
          dlmId: true,
          type: true,
          status: true,
          sourceOperationId: true,
          receiptReference: true,
          result: true,
        },
      });
      if (
        !sourceOperation ||
        sourceOperation.type !== DlmAdminOperationType.MANUAL_WECHAT_RECHARGE ||
        sourceOperation.status !== DlmAdminOperationStatus.COMPLETED ||
        sourceOperation.sourceOperationId
      ) {
        throw new Error('未找到可更正的微信人工充值记录。');
      }
      if (sourceOperation.dlmId === targetDlmId) {
        throw new Error('原老板和正确老板不能是同一个账户。');
      }

      const sourceResult = sourceOperation.result as { amount?: unknown; rechargeId?: unknown } | null;
      const amount = asPositiveMoney(sourceResult?.amount);
      const originalRechargeId = cleanText(sourceResult?.rechargeId, 100);
      if (!amount || !originalRechargeId) {
        throw new Error('原充值记录缺少有效金额或编号，无法自动更正。');
      }

      const [sourceBoss, targetBoss, existingCorrection] = await Promise.all([
        tx.manualWechatBoss.findUnique({
          where: { dlmId: sourceOperation.dlmId },
          include: { dlmUser: { select: { discordUserId: true } } },
        }),
        tx.manualWechatBoss.findUnique({
          where: { dlmId: targetDlmId },
          include: { dlmUser: { select: { discordUserId: true } } },
        }),
        tx.dlmAdminOperation.findUnique({ where: { sourceOperationId } }),
      ]);
      if (!sourceBoss || !targetBoss) {
        throw new Error('原老板或正确老板账户不存在。');
      }
      if (existingCorrection) {
        throw new Error('该笔充值已更正，不能重复操作。');
      }

      for (const dlmId of [sourceOperation.dlmId, targetDlmId].sort()) {
        await tx.$executeRaw`SELECT 1 FROM "DlmUser" WHERE "dlmId" = ${dlmId} FOR UPDATE`;
      }

      await suppressGenericBalanceNoticeTx(tx);
      const sourceBefore = await getDlmWalletSnapshotTx(tx, {
        dlmId: sourceOperation.dlmId,
        discordUserId: sourceBoss.dlmUser.discordUserId,
      });
      if (sourceBefore.totalBalance.lt(amount)) {
        throw new Error(`原老板当前余额不足 ¥${amount.toFixed(2)}，不能更正；请先人工核实已使用金额。`);
      }
      if (sourceBefore.recharge.lt(amount)) {
        throw new Error('原老板累计充值余额不足，无法安全更正该笔充值。');
      }
      const targetBefore = await getDlmWalletSnapshotTx(tx, {
        dlmId: targetDlmId,
        discordUserId: targetBoss.dlmUser.discordUserId,
      });
      const sourceAfter = await applyDlmWalletDeltaTx(tx, {
        dlmId: sourceOperation.dlmId,
        discordUserId: sourceBoss.dlmUser.discordUserId,
        rechargeDelta: amount.negated(),
        totalBalanceDelta: amount.negated(),
      });
      const targetAfter = await applyDlmWalletDeltaTx(tx, {
        dlmId: targetDlmId,
        discordUserId: targetBoss.dlmUser.discordUserId,
        rechargeDelta: amount,
        totalBalanceDelta: amount,
      });

      const [sourceRecharge, targetRecharge, sourceLedger, targetLedger] = await Promise.all([
        tx.recharge.create({
          data: {
            amount: amount.negated(),
            dlmId: sourceOperation.dlmId,
            toWhom: sourceOperation.dlmId,
            fromWhom: operatorDiscordId,
          },
          select: { RechargeID: true },
        }),
        tx.recharge.create({
          data: {
            amount,
            dlmId: targetDlmId,
            toWhom: targetDlmId,
            fromWhom: operatorDiscordId,
          },
          select: { RechargeID: true },
        }),
        tx.individualTransaction.create({
          data: {
            discordId: sourceBoss.dlmUser.discordUserId,
            dlmId: sourceOperation.dlmId,
            thirdPartydiscordId: operatorDiscordId,
            balanceBefore: sourceBefore.totalBalance,
            amountChange: amount.negated(),
            balanceAfter: sourceAfter.totalBalance,
            typeOfTransaction: '充值更正转出',
          },
          select: { transactionId: true },
        }),
        tx.individualTransaction.create({
          data: {
            discordId: targetBoss.dlmUser.discordUserId,
            dlmId: targetDlmId,
            thirdPartydiscordId: operatorDiscordId,
            balanceBefore: targetBefore.totalBalance,
            amountChange: amount,
            balanceAfter: targetAfter.totalBalance,
            typeOfTransaction: '充值更正转入',
          },
          select: { transactionId: true },
        }),
      ]);

      const resultPayload = {
        amount: amount.toFixed(2),
        originalRechargeId,
        sourceDlmId: sourceOperation.dlmId,
        targetDlmId,
        sourceBalanceAfter: sourceAfter.totalBalance.toFixed(2),
        targetBalanceAfter: targetAfter.totalBalance.toFixed(2),
        sourceRechargeId: sourceRecharge.RechargeID,
        targetRechargeId: targetRecharge.RechargeID,
        sourceTransactionId: sourceLedger.transactionId,
        targetTransactionId: targetLedger.transactionId,
      };
      await tx.dlmAdminOperation.create({
        data: {
          requestId,
          sourceOperationId,
          receiptReference: sourceOperation.receiptReference,
          dlmId: targetDlmId,
          operatorDiscordId,
          // The existing enum has no correction value. `sourceOperationId` and
          // `details.action` make this a separately auditable correction while
          // avoiding a production schema migration for an enum-only label.
          type: DlmAdminOperationType.MANUAL_WECHAT_RECHARGE,
          status: DlmAdminOperationStatus.COMPLETED,
          details: {
            action: 'CORRECT_WRONG_BOSS_RECHARGE',
            reason,
            originalRechargeId,
            sourceDlmId: sourceOperation.dlmId,
            targetDlmId,
          } as Prisma.InputJsonValue,
          result: resultPayload as Prisma.InputJsonValue,
        },
      });
      await enqueueNotificationTx(tx, { dedupeKey: `manual-correction:${requestId}`, recipientDlmId: targetDlmId,
        recipientDiscordId: targetBoss.dlmUser.discordUserId, event: 'BALANCE_ADJUSTED', title: copy("site.lib.manual.wechat.boss.ee3080c6807e"),
        body: copy("site.lib.manual.wechat.boss.70d9c17d5c0c", {value1: String(amount.toFixed(2)), value2: String(targetAfter.totalBalance.toString())}), href: '/console?tab=wallet' });
      return resultPayload;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return { result, replayed: false };
  } catch (error: unknown) {
    if (isUniqueConstraintError(error)) {
      const racedRequest = await prisma.dlmAdminOperation.findUnique({ where: { requestId } });
      if (racedRequest?.status === DlmAdminOperationStatus.COMPLETED && racedRequest.result) {
        return { result: racedRequest.result as Record<string, string>, replayed: true };
      }
      const racedCorrection = await prisma.dlmAdminOperation.findUnique({ where: { sourceOperationId } });
      if (racedCorrection) throw new Error('该笔充值已更正，不能重复操作。');
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
}, copy: SiteCopyRenderer = createSiteCopy()) => {
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
      return {
        result: manualOperationResultForCurrentAccount({
          dlmId: previous.dlmId,
          result: previous.result as { dlmId?: string; amount?: string },
        }),
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
      await tx.member.upsert({
        where: { discordUserId: operatorDiscordId },
        create: { discordUserId: operatorDiscordId },
        update: {},
      });
      await suppressGenericBalanceNoticeTx(tx);
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
      await enqueueNotificationTx(tx, { dedupeKey: `manual-gift:${requestId}`, recipientDlmId: dlmId,
        recipientDiscordId: boss.dlmUser.discordUserId, event: 'BALANCE_ADJUSTED', title: copy("site.lib.manual.wechat.boss.1f323e4eedfb"),
        body: copy("site.lib.manual.wechat.boss.a53c46d4da12", {value1: String(amount.toFixed(2)), value2: reason ? `（${String(reason).slice(0, 40)}）` : ''}), href: '/console?tab=wallet' });
      return resultPayload;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return { result, replayed: false };
  } catch (error: unknown) {
    if (isUniqueConstraintError(error)) {
      const existingGift = await prisma.dlmAdminOperation.findUnique({ where: { requestId } });
      if (
        existingGift?.type === DlmAdminOperationType.RECHARGE_CASHBACK &&
        existingGift.status === DlmAdminOperationStatus.COMPLETED &&
        existingGift.result &&
        existingGift.dlmId === dlmId
      ) {
        return {
          result: manualOperationResultForCurrentAccount({
            dlmId: existingGift.dlmId,
            result: existingGift.result as { dlmId?: string; amount?: string },
          }),
          replayed: true,
        };
      }
    }
    throw error;
  }
};
