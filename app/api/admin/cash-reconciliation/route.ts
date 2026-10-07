import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import {
  SettlementCashExpenseStatus,
  SettlementPayoutStatus,
  SettlementReconciliationStatus,
  SettlementTransferStatus,
} from "@prisma/client";
import { newEntityOnlyTime } from "@/lib/operating-entity-cutover";
import { getAdminDiscordIds } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import {
  getSettlementReceiptStorageDir,
  isRmbCurrency,
  isSettlementFinance,
  normalizeCurrency,
  parsePositiveDecimal,
  resolveWithdrawalSettlementOwner,
  safeOriginalFileName,
  validateSettlementReceipt,
} from "@/lib/settlement-reconciliation";
import { getServerSession } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_REDIRECT = "/admin/cash-reconciliation";
const MANUAL_RECHARGE_OPERATOR_IDS = getAdminDiscordIds();

const readText = (formData: FormData, key: string) => {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
};

const redirectTo = (raw: string, kind: "error" | "notice", message: string) => {
  const target = raw.startsWith(DEFAULT_REDIRECT) ? raw : DEFAULT_REDIRECT;
  const url = new URL(target, "http://local");
  url.searchParams.set(kind, message);
  return new NextResponse(null, {
    status: 303,
    headers: { Location: `${url.pathname}${url.search}` },
  });
};

const financeOnly = (discordId?: string | null) => {
  if (!isSettlementFinance(discordId))
    throw new Error("只有财务管理员可以执行此操作。");
};

/** A responsible owner may act on their own account; main finance may operate any owner's queue. */
const assertOwnerOrFinance = (
  actualOwnerId: string | null | undefined,
  actorId: string,
) => {
  if (
    !actualOwnerId ||
    (actualOwnerId !== actorId && !isSettlementFinance(actorId))
  )
    throw new Error("只能操作自己负责的账号，或由主财务代办。");
};

/** Automated ZPay/Stripe credits belong to revenue reporting, not cash reconciliation. */
async function isAutomatedRechargeReference(reference: string) {
  const [zpay, stripe] = await Promise.all([
    prisma.zPayRechargeOrder.findFirst({
      where: {
        OR: [{ outTradeNo: reference }, { gatewayTradeNo: reference }],
      },
      select: { id: true },
    }),
    prisma.stripePayment.findFirst({
      where: {
        OR: [
          { outTradeNo: reference },
          { paymentIntentId: reference },
          { checkoutSessionId: reference },
        ],
      },
      select: { id: true },
    }),
  ]);
  return Boolean(zpay || stripe);
}

async function saveEvidence(
  file: File,
  reconciliationId: string,
  uploadedBy: string,
) {
  const image = await validateSettlementReceipt(file);
  const storageFileName = `${reconciliationId}-${randomUUID()}${image.extension}`;
  const directory = getSettlementReceiptStorageDir();
  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(path.join(directory, storageFileName), image.buffer, {
    flag: "wx",
  });
  return {
    storageFileName,
    originalFileName: safeOriginalFileName(file.name),
    mimeType: image.mimeType,
    byteSize: image.buffer.length,
    uploadedBy,
  };
}

async function financeConfirm(formData: FormData, actorId: string) {
  financeOnly(actorId);
  const rechargeId = readText(formData, "rechargeId");
  const accountId = readText(formData, "accountId");
  const adjustmentNote = readText(formData, "adjustmentNote");
  const financeNote = readText(formData, "financeNote");
  const redirect = readText(formData, "redirectTo");
  const receipt = formData.get("receipt");

  if (!rechargeId || !accountId) throw new Error("请选择收款账号。");
  const [recharge, account, existing] = await Promise.all([
    prisma.recharge.findFirst({
      where: {
        RechargeID: rechargeId,
        amount: { not: 0 },
        fromWhom: { in: [...MANUAL_RECHARGE_OPERATOR_IDS] },
        createdAt: newEntityOnlyTime(),
      },
      select: { RechargeID: true, amount: true, fromWhom: true },
    }),
    prisma.settlementAccount.findFirst({
      where: { id: accountId, active: true },
    }),
    prisma.settlementRechargeReconciliation.findUnique({
      where: { rechargeId },
      include: {
        evidence: { select: { id: true, storageFileName: true } },
      },
    }),
  ]);
  if (!recharge)
    throw new Error("该 cash 记录不在新开业后的有效待处理列表中。");
  if (await isAutomatedRechargeReference(recharge.fromWhom)) {
    throw new Error(
      "ZPay 或 Stripe 自动充值由收益页统计，不能进入人工充值对账。",
    );
  }
  if (!account) throw new Error("请选择有效的收款账号。");
  if (existing?.status === SettlementReconciliationStatus.OWNER_CONFIRMED) {
    throw new Error("负责人已确认收款，不能重新分配账号。");
  }

  const isNegativeAdjustment = recharge.amount.lt(0);
  if (isNegativeAdjustment && !adjustmentNote) {
    throw new Error("请填写本笔负数 cash 的扣减或调整原因。");
  }

  const originalReceivedAmount = isRmbCurrency(account.currency)
    ? recharge.amount
    : parsePositiveDecimal(readText(formData, "originalReceivedAmount"))?.mul(
        isNegativeAdjustment ? -1 : 1,
      );
  if (!originalReceivedAmount) {
    throw new Error(
      `${account.name} 为外币账号，请填写本笔实际原币金额${isNegativeAdjustment ? "（填写绝对值）" : ""}。`,
    );
  }

  if (!(receipt instanceof File) || receipt.size === 0) {
    if (!existing?.evidence.length)
      throw new Error("首次财务确认必须上传转账截图。");
  }

  const reconciliationId = existing?.id ?? `settlement-recon-${randomUUID()}`;
  let savedEvidence: Awaited<ReturnType<typeof saveEvidence>> | null = null;
  if (receipt instanceof File && receipt.size > 0) {
    savedEvidence = await saveEvidence(receipt, reconciliationId, actorId);
  }
  const evidenceToReplace = savedEvidence ? (existing?.evidence ?? []) : [];

  try {
    await prisma.$transaction(async (tx) => {
      const priorStatus = existing?.status ?? null;
      const data = {
        accountId: account.id,
        ownerDiscordId: account.ownerDiscordId,
        status: SettlementReconciliationStatus.FINANCE_CONFIRMED,
        rmbAmount: recharge.amount,
        originalReceivedAmount,
        originalReceivedCurrency: account.currency,
        exceptionReason: null,
        invalidReason: null,
        financeNote: financeNote ? financeNote.slice(0, 500) : null,
        invalidatedBy: null,
        invalidatedAt: null,
        financeConfirmedBy: actorId,
        financeConfirmedAt: new Date(),
      };
      const reconciliation = existing
        ? await tx.settlementRechargeReconciliation.update({
            where: { id: existing.id },
            data,
          })
        : await tx.settlementRechargeReconciliation.create({
            data: { id: reconciliationId, rechargeId, ...data },
          });
      if (savedEvidence) {
        if (evidenceToReplace.length) {
          await tx.settlementReceiptEvidence.deleteMany({
            where: { reconciliationId: reconciliation.id },
          });
        }
        await tx.settlementReceiptEvidence.create({
          data: { reconciliationId: reconciliation.id, ...savedEvidence },
        });
      }
      await tx.settlementReconciliationEvent.create({
        data: {
          reconciliationId: reconciliation.id,
          fromStatus: priorStatus,
          toStatus: SettlementReconciliationStatus.FINANCE_CONFIRMED,
          actorDiscordId: actorId,
          note: isNegativeAdjustment
            ? `财务已独立处理负数 cash：${adjustmentNote.slice(0, 500)}${financeNote ? `；财务备注：${financeNote.slice(0, 500)}` : ""}`
            : priorStatus === SettlementReconciliationStatus.INVALIDATED
              ? `财务已撤销无效并重新确认实收。${financeNote ? `备注：${financeNote.slice(0, 500)}` : ""}`
              : `财务已上传凭证并分配收款账号。${financeNote ? `备注：${financeNote.slice(0, 500)}` : ""}`,
        },
      });
    });
  } catch (error) {
    if (savedEvidence)
      await fs
        .unlink(
          path.join(
            getSettlementReceiptStorageDir(),
            savedEvidence.storageFileName,
          ),
        )
        .catch(() => undefined);
    throw error;
  }

  if (evidenceToReplace.length) {
    await Promise.all(
      evidenceToReplace.map(({ storageFileName }) => {
        if (path.basename(storageFileName) !== storageFileName)
          return Promise.resolve();
        return fs
          .unlink(path.join(getSettlementReceiptStorageDir(), storageFileName))
          .catch(() => undefined);
      }),
    );
  }

  return redirectTo(
    redirect,
    "notice",
    isNegativeAdjustment
      ? `已独立计入本笔扣减 ${recharge.amount.toString()}，等待账号负责人确认。`
      : existing?.status === SettlementReconciliationStatus.INVALIDATED
        ? "已撤销无效并重新计入实收，等待账号负责人确认。"
        : "已计入实收并等待账号负责人确认。",
  );
}

async function financeInvalidate(formData: FormData, actorId: string) {
  financeOnly(actorId);
  const rechargeId = readText(formData, "rechargeId");
  const reason = readText(formData, "reason");
  const redirect = readText(formData, "redirectTo");
  if (!rechargeId || !reason) throw new Error("请填写无效原因。");

  const [recharge, existing] = await Promise.all([
    prisma.recharge.findFirst({
      where: {
        RechargeID: rechargeId,
        amount: { not: 0 },
        fromWhom: { in: [...MANUAL_RECHARGE_OPERATOR_IDS] },
        createdAt: newEntityOnlyTime(),
      },
      select: { RechargeID: true, fromWhom: true },
    }),
    prisma.settlementRechargeReconciliation.findUnique({
      where: { rechargeId },
    }),
  ]);
  if (!recharge) throw new Error("未找到有效的 cash 记录。");
  if (await isAutomatedRechargeReference(recharge.fromWhom)) {
    throw new Error(
      "ZPay 或 Stripe 自动充值由收益页统计，不能进入人工充值对账。",
    );
  }
  if (existing?.status === SettlementReconciliationStatus.INVALIDATED) {
    throw new Error("该充值已被标记为无效。");
  }

  await prisma.$transaction(async (tx) => {
    const priorStatus = existing?.status ?? null;
    const reconciliation = existing
      ? await tx.settlementRechargeReconciliation.update({
          where: { id: existing.id },
          data: {
            status: SettlementReconciliationStatus.INVALIDATED,
            invalidReason: reason.slice(0, 500),
            invalidatedBy: actorId,
            invalidatedAt: new Date(),
          },
        })
      : await tx.settlementRechargeReconciliation.create({
          data: {
            rechargeId,
            status: SettlementReconciliationStatus.INVALIDATED,
            invalidReason: reason.slice(0, 500),
            invalidatedBy: actorId,
            invalidatedAt: new Date(),
          },
        });
    await tx.settlementReconciliationEvent.create({
      data: {
        reconciliationId: reconciliation.id,
        fromStatus: priorStatus,
        toStatus: SettlementReconciliationStatus.INVALIDATED,
        actorDiscordId: actorId,
        note: reason.slice(0, 500),
      },
    });
  });

  return redirectTo(
    redirect,
    "notice",
    "已将本笔 cash 标为无效；不会改动老板的平台余额。",
  );
}

/** Finance may keep a disputed receipt counted, but it must return to the owner
 * queue for a fresh confirmation instead of silently clearing the dispute. */
async function financeRetryConfirm(formData: FormData, actorId: string) {
  financeOnly(actorId);
  const reconciliationId = readText(formData, "reconciliationId");
  const note = readText(formData, "note");
  const redirect = readText(formData, "redirectTo");
  if (!reconciliationId || !note) throw new Error("请填写财务复核说明。");

  const reconciliation =
    await prisma.settlementRechargeReconciliation.findUnique({
      where: { id: reconciliationId },
    });
  if (!reconciliation) throw new Error("未找到该异常对账记录。");
  if (reconciliation.status !== SettlementReconciliationStatus.OWNER_DISPUTED) {
    throw new Error("只有负责人提出异常的记录可以重新复核。");
  }

  const priorFinanceNote = reconciliation.financeNote?.trim();
  const financeNote = [priorFinanceNote, `复核：${note.slice(0, 500)}`]
    .filter(Boolean)
    .join("\n")
    .slice(0, 500);
  await prisma.$transaction(async (tx) => {
    await tx.settlementRechargeReconciliation.update({
      where: { id: reconciliationId },
      data: {
        status: SettlementReconciliationStatus.FINANCE_CONFIRMED,
        exceptionReason: null,
        financeNote,
        financeConfirmedBy: actorId,
        financeConfirmedAt: new Date(),
      },
    });
    await tx.settlementReconciliationEvent.create({
      data: {
        reconciliationId,
        fromStatus: SettlementReconciliationStatus.OWNER_DISPUTED,
        toStatus: SettlementReconciliationStatus.FINANCE_CONFIRMED,
        actorDiscordId: actorId,
        note: `财务复核后仍计入实收，等待负责人再次确认。${note.slice(0, 500)}`,
      },
    });
  });
  return redirectTo(
    redirect,
    "notice",
    "已完成财务复核，款项仍计入实收，等待负责人再次确认。",
  );
}

async function createAccount(formData: FormData, actorId: string) {
  financeOnly(actorId);
  const name = readText(formData, "name");
  const ownerDiscordId = readText(formData, "ownerDiscordId");
  const kind = readText(formData, "kind").toUpperCase();
  const currency = normalizeCurrency(readText(formData, "currency"));
  const redirect = readText(formData, "redirectTo");
  if (!name || !/^\d{17,20}$/.test(ownerDiscordId) || !kind || !currency) {
    throw new Error("请填写账号名称、负责人 Discord ID、类型和币种。");
  }
  await prisma.settlementAccount.create({
    data: {
      name: name.slice(0, 80),
      ownerDiscordId,
      kind: kind.slice(0, 32),
      currency,
    },
  });
  return redirectTo(redirect, "notice", "收款账号已创建并绑定负责人。");
}

async function ownerConfirm(formData: FormData, actorId: string) {
  const reconciliationId = readText(formData, "reconciliationId");
  const redirect = readText(formData, "redirectTo");
  const reconciliation =
    await prisma.settlementRechargeReconciliation.findUnique({
      where: { id: reconciliationId },
    });
  if (!reconciliation) throw new Error("未找到该对账记录。");
  assertOwnerOrFinance(reconciliation.ownerDiscordId, actorId);
  if (
    reconciliation.status !== SettlementReconciliationStatus.FINANCE_CONFIRMED
  ) {
    throw new Error("只有待负责人确认的记录可以确认收款。");
  }
  await prisma.$transaction(async (tx) => {
    await tx.settlementRechargeReconciliation.update({
      where: { id: reconciliationId },
      data: {
        status: SettlementReconciliationStatus.OWNER_CONFIRMED,
        ownerConfirmedBy: actorId,
        ownerConfirmedAt: new Date(),
      },
    });
    await tx.settlementReconciliationEvent.create({
      data: {
        reconciliationId,
        fromStatus: SettlementReconciliationStatus.FINANCE_CONFIRMED,
        toStatus: SettlementReconciliationStatus.OWNER_CONFIRMED,
        actorDiscordId: actorId,
        note: "账号负责人确认已收到款项。",
      },
    });
  });
  return redirectTo(redirect, "notice", "已确认收到款项。");
}

async function ownerRevokeConfirmation(formData: FormData, actorId: string) {
  const reconciliationId = readText(formData, "reconciliationId");
  const redirect = readText(formData, "redirectTo");
  const reconciliation =
    await prisma.settlementRechargeReconciliation.findUnique({
      where: { id: reconciliationId },
    });
  if (!reconciliation) throw new Error("未找到该对账记录。");
  assertOwnerOrFinance(reconciliation.ownerDiscordId, actorId);
  if (
    reconciliation.status !== SettlementReconciliationStatus.OWNER_CONFIRMED
  ) {
    throw new Error("只有已确认收款的记录可以撤回确认。");
  }

  await prisma.$transaction(async (tx) => {
    await tx.settlementRechargeReconciliation.update({
      where: { id: reconciliationId },
      data: {
        status: SettlementReconciliationStatus.FINANCE_CONFIRMED,
        ownerConfirmedBy: null,
        ownerConfirmedAt: null,
      },
    });
    await tx.settlementReconciliationEvent.create({
      data: {
        reconciliationId,
        fromStatus: SettlementReconciliationStatus.OWNER_CONFIRMED,
        toStatus: SettlementReconciliationStatus.FINANCE_CONFIRMED,
        actorDiscordId: actorId,
        note: "撤回已确认收款，重新等待负责人确认。",
      },
    });
  });
  return redirectTo(
    redirect,
    "notice",
    "已撤回确认；这笔款项已回到待确认收款，暂时仍计入实收。",
  );
}

async function ownerDispute(formData: FormData, actorId: string) {
  const reconciliationId = readText(formData, "reconciliationId");
  const reason = readText(formData, "reason");
  const redirect = readText(formData, "redirectTo");
  if (!reason) throw new Error("请填写异常原因。");
  const reconciliation =
    await prisma.settlementRechargeReconciliation.findUnique({
      where: { id: reconciliationId },
    });
  if (!reconciliation) throw new Error("未找到该对账记录。");
  assertOwnerOrFinance(reconciliation.ownerDiscordId, actorId);
  if (
    reconciliation.status !== SettlementReconciliationStatus.FINANCE_CONFIRMED
  ) {
    throw new Error("该记录当前不能提出异常。");
  }
  await prisma.$transaction(async (tx) => {
    await tx.settlementRechargeReconciliation.update({
      where: { id: reconciliationId },
      data: {
        status: SettlementReconciliationStatus.OWNER_DISPUTED,
        exceptionReason: reason.slice(0, 500),
        ownerDisputedBy: actorId,
        ownerDisputedAt: new Date(),
      },
    });
    await tx.settlementReconciliationEvent.create({
      data: {
        reconciliationId,
        fromStatus: SettlementReconciliationStatus.FINANCE_CONFIRMED,
        toStatus: SettlementReconciliationStatus.OWNER_DISPUTED,
        actorDiscordId: actorId,
        note: reason.slice(0, 500),
      },
    });
  });
  return redirectTo(
    redirect,
    "notice",
    "异常已反馈给财务；金额暂时仍计入应有总额。",
  );
}

async function createCashExpense(formData: FormData, actorId: string) {
  financeOnly(actorId);
  const accountId = readText(formData, "accountId");
  const amount = parsePositiveDecimal(readText(formData, "amount"));
  const note = readText(formData, "note");
  const redirect = readText(formData, "redirectTo");
  if (!accountId || !amount || !note) {
    throw new Error("请选择支出账号，并填写金额和备注。");
  }
  const account = await prisma.settlementAccount.findFirst({
    where: { id: accountId, active: true },
  });
  if (!account) {
    throw new Error("请选择有效的收款账号。");
  }
  await prisma.settlementCashExpense.create({
    data: {
      accountId: account.id,
      ownerDiscordId: account.ownerDiscordId,
      amount,
      note: note.slice(0, 500),
      status: SettlementCashExpenseStatus.PENDING_OWNER_CONFIRMATION,
      createdBy: actorId,
    },
  });
  return redirectTo(
    redirect,
    "notice",
    "现金支出已登记并从负责人总额扣除，等待对应负责人确认。",
  );
}

async function confirmCashExpense(formData: FormData, actorId: string) {
  const expenseId = readText(formData, "expenseId");
  const redirect = readText(formData, "redirectTo");
  const expense = await prisma.settlementCashExpense.findUnique({
    where: { id: expenseId },
  });
  if (!expense) throw new Error("未找到该现金支出记录。");
  assertOwnerOrFinance(expense.ownerDiscordId, actorId);
  if (
    expense.status !== SettlementCashExpenseStatus.PENDING_OWNER_CONFIRMATION
  ) {
    throw new Error("该现金支出已经处理。");
  }
  await prisma.settlementCashExpense.update({
    where: { id: expenseId },
    data: {
      status: SettlementCashExpenseStatus.OWNER_CONFIRMED,
      ownerConfirmedBy: actorId,
      ownerConfirmedAt: new Date(),
    },
  });
  return redirectTo(
    redirect,
    "notice",
    "已确认现金支出；金额此前已在登记时从负责人应有总额扣除。",
  );
}

async function disputeCashExpense(formData: FormData, actorId: string) {
  const expenseId = readText(formData, "expenseId");
  const reason = readText(formData, "reason");
  const redirect = readText(formData, "redirectTo");
  if (!expenseId || !reason) throw new Error("请填写现金支出有误的原因。");
  const expense = await prisma.settlementCashExpense.findUnique({
    where: { id: expenseId },
  });
  if (!expense) throw new Error("未找到该现金支出记录。");
  assertOwnerOrFinance(expense.ownerDiscordId, actorId);
  if (
    expense.status !== SettlementCashExpenseStatus.PENDING_OWNER_CONFIRMATION
  ) {
    throw new Error("该现金支出已经处理。");
  }
  await prisma.settlementCashExpense.update({
    where: { id: expenseId },
    data: {
      status: SettlementCashExpenseStatus.OWNER_DISPUTED,
      ownerDisputedBy: actorId,
      ownerDisputedAt: new Date(),
      disputeReason: reason.slice(0, 500),
    },
  });
  return redirectTo(
    redirect,
    "notice",
    "已反馈现金支出错误给主财务；金额暂时仍从负责人总额扣除。",
  );
}

async function voidCashExpense(formData: FormData, actorId: string) {
  financeOnly(actorId);
  const expenseId = readText(formData, "expenseId");
  const reason = readText(formData, "reason");
  const redirect = readText(formData, "redirectTo");
  if (!expenseId || !reason) throw new Error("请填写撤销原因。");
  const updated = await prisma.settlementCashExpense.updateMany({
    where: {
      id: expenseId,
      status: {
        in: [
          SettlementCashExpenseStatus.PENDING_OWNER_CONFIRMATION,
          SettlementCashExpenseStatus.OWNER_DISPUTED,
        ],
      },
    },
    data: {
      status: SettlementCashExpenseStatus.VOIDED,
      voidedBy: actorId,
      voidedAt: new Date(),
      voidReason: reason.slice(0, 500),
    },
  });
  if (!updated.count) {
    throw new Error("该现金支出已经确认、撤销或不存在，不能再次撤销。");
  }
  return redirectTo(redirect, "notice", "已撤销现金支出，负责人总额已恢复。");
}

async function createTransfer(formData: FormData, actorId: string) {
  const fromAccountId = readText(formData, "fromAccountId");
  const toAccountId = readText(formData, "toAccountId");
  const amount = parsePositiveDecimal(readText(formData, "amount"));
  const redirect = readText(formData, "redirectTo");
  if (
    !fromAccountId ||
    !toAccountId ||
    fromAccountId === toAccountId ||
    !amount
  ) {
    throw new Error("请选择不同的转出、转入账号并填写有效金额。");
  }
  const accounts = await prisma.settlementAccount.findMany({
    where: { id: { in: [fromAccountId, toAccountId] }, active: true },
  });
  const from = accounts.find((account) => account.id === fromAccountId);
  const to = accounts.find((account) => account.id === toAccountId);
  if (
    !from ||
    !to ||
    !isRmbCurrency(from.currency) ||
    !isRmbCurrency(to.currency)
  ) {
    throw new Error("内部转账仅支持两个有效人民币账号。");
  }
  assertOwnerOrFinance(from.ownerDiscordId, actorId);
  if (from.ownerDiscordId === to.ownerDiscordId)
    throw new Error("仅支持转入其他负责人的账号。");
  await prisma.settlementAccountTransfer.create({
    data: { fromAccountId, toAccountId, amount, initiatedBy: actorId },
  });
  return redirectTo(redirect, "notice", "转账已提交，等待收款账号负责人确认。");
}

async function confirmTransfer(
  formData: FormData,
  actorId: string,
  disputed: boolean,
) {
  const transferId = readText(formData, "transferId");
  const reason = readText(formData, "reason");
  const redirect = readText(formData, "redirectTo");
  if (disputed && !reason) throw new Error("请填写未收到转账的原因。");
  const transfer = await prisma.settlementAccountTransfer.findUnique({
    where: { id: transferId },
    include: { toAccount: true },
  });
  if (!transfer) throw new Error("未找到转账记录。");
  assertOwnerOrFinance(transfer.toAccount.ownerDiscordId, actorId);
  if (
    transfer.status !== SettlementTransferStatus.PENDING_RECEIVER_CONFIRMATION
  ) {
    throw new Error("该转账已经处理。");
  }
  await prisma.settlementAccountTransfer.update({
    where: { id: transferId },
    data: disputed
      ? {
          status: SettlementTransferStatus.RECEIVER_DISPUTED,
          receiverDisputedBy: actorId,
          receiverDisputedAt: new Date(),
          disputeReason: reason.slice(0, 500),
        }
      : {
          status: SettlementTransferStatus.RECEIVER_CONFIRMED,
          receiverConfirmedBy: actorId,
          receiverConfirmedAt: new Date(),
        },
  });
  return redirectTo(
    redirect,
    "notice",
    disputed ? "已标记转账异常。" : "已确认收到内部转账。",
  );
}

async function recordForexRecovery(formData: FormData, actorId: string) {
  financeOnly(actorId);
  const fromAccountId = readText(formData, "fromAccountId");
  const toAccountId = readText(formData, "toAccountId");
  const foreignAmount = parsePositiveDecimal(
    readText(formData, "foreignAmount"),
  );
  const rmbAmount = parsePositiveDecimal(readText(formData, "rmbAmount"));
  const note = readText(formData, "note");
  const redirect = readText(formData, "redirectTo");
  if (!fromAccountId || !toAccountId || !foreignAmount || !rmbAmount) {
    throw new Error("请填写外币来源、人民币去向以及两种金额。");
  }
  const accounts = await prisma.settlementAccount.findMany({
    where: { id: { in: [fromAccountId, toAccountId] }, active: true },
  });
  const from = accounts.find((account) => account.id === fromAccountId);
  const to = accounts.find((account) => account.id === toAccountId);
  if (
    !from ||
    !to ||
    isRmbCurrency(from.currency) ||
    !isRmbCurrency(to.currency)
  ) {
    throw new Error("外汇归还必须从外币账号进入有效的人民币账号。");
  }
  await prisma.settlementForexRecovery.create({
    data: {
      fromAccountId,
      toAccountId,
      foreignAmount,
      foreignCurrency: from.currency,
      rmbAmount,
      recoveredAt: new Date(),
      note: note ? note.slice(0, 500) : null,
      recordedBy: actorId,
    },
  });
  return redirectTo(redirect, "notice", "外汇归还已记入目标人民币账号。");
}

async function markPayoutPaid(formData: FormData, actorId: string) {
  const withdrawalId = readText(formData, "withdrawalId");
  const redirect = readText(formData, "redirectTo");
  const withdrawal = await prisma.withdraw.findFirst({
    where: { id: withdrawalId, createdAt: newEntityOnlyTime() },
    select: { id: true, amount: true, method: true },
  });
  if (!withdrawal) throw new Error("未找到新开业后的提现申请。");
  const responsibleOwner = resolveWithdrawalSettlementOwner(withdrawal.method);
  if (!responsibleOwner)
    throw new Error("该提现方式不属于微信或支付宝负责人队列。");
  assertOwnerOrFinance(responsibleOwner, actorId);
  await prisma.settlementWithdrawalPayout.create({
    data: {
      withdrawalId,
      ownerDiscordId: responsibleOwner,
      amount: withdrawal.amount,
      status: SettlementPayoutStatus.PAID,
      paidBy: actorId,
    },
  });
  return redirectTo(
    redirect,
    "notice",
    "已标记提现发放；金额已从负责人应有总额扣除。",
  );
}

async function voidPayout(formData: FormData, actorId: string) {
  financeOnly(actorId);
  const payoutId = readText(formData, "payoutId");
  const reason = readText(formData, "reason");
  const redirect = readText(formData, "redirectTo");
  if (!payoutId || !reason) throw new Error("请填写撤销原因。");
  const updated = await prisma.settlementWithdrawalPayout.updateMany({
    where: { id: payoutId, status: SettlementPayoutStatus.PAID },
    data: {
      status: SettlementPayoutStatus.VOIDED,
      voidedBy: actorId,
      voidedAt: new Date(),
      voidReason: reason.slice(0, 500),
    },
  });
  if (!updated.count) throw new Error("该提现发放记录已经撤销或不存在。");
  return redirectTo(
    redirect,
    "notice",
    "提现发放已撤销，仅影响内部负责人对账。",
  );
}

export async function POST(request: NextRequest) {
  const session = await getServerSession();
  if (!session?.discordId)
    return NextResponse.json({ error: "无权访问" }, { status: 403 });
  const formData = await request.formData();
  const action = readText(formData, "action");
  const redirect = readText(formData, "redirectTo");
  try {
    switch (action) {
      case "finance-confirm":
        return await financeConfirm(formData, session.discordId);
      case "finance-invalidate":
        return await financeInvalidate(formData, session.discordId);
      case "finance-retry-confirm":
        return await financeRetryConfirm(formData, session.discordId);
      case "account-create":
        return await createAccount(formData, session.discordId);
      case "owner-confirm":
        return await ownerConfirm(formData, session.discordId);
      case "owner-revoke-confirm":
        return await ownerRevokeConfirmation(formData, session.discordId);
      case "owner-dispute":
        return await ownerDispute(formData, session.discordId);
      case "cash-expense-create":
        return await createCashExpense(formData, session.discordId);
      case "cash-expense-confirm":
        return await confirmCashExpense(formData, session.discordId);
      case "cash-expense-dispute":
        return await disputeCashExpense(formData, session.discordId);
      case "cash-expense-void":
        return await voidCashExpense(formData, session.discordId);
      case "transfer-create":
        return await createTransfer(formData, session.discordId);
      case "transfer-confirm":
        return await confirmTransfer(formData, session.discordId, false);
      case "transfer-dispute":
        return await confirmTransfer(formData, session.discordId, true);
      case "forex-recovery":
        return await recordForexRecovery(formData, session.discordId);
      case "payout-paid":
        return await markPayoutPaid(formData, session.discordId);
      case "payout-void":
        return await voidPayout(formData, session.discordId);
      default:
        throw new Error("未知操作。");
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "操作失败，请稍后再试。";
    return redirectTo(redirect, "error", message);
  }
}
