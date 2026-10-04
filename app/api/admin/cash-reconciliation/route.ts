import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { NextRequest, NextResponse } from 'next/server';
import {
  SettlementPayoutStatus,
  SettlementReconciliationStatus,
  SettlementTransferStatus,
} from '@prisma/client';
import { newEntityOnlyTime } from '@/lib/operating-entity-cutover';
import { getAdminDiscordIds } from '@/lib/admin';
import { prisma } from '@/lib/prisma';
import {
  getSettlementReceiptStorageDir,
  isRmbCurrency,
  isSettlementFinance,
  normalizeCurrency,
  parsePositiveDecimal,
  resolveWithdrawalSettlementOwner,
  safeOriginalFileName,
  validateSettlementReceipt,
} from '@/lib/settlement-reconciliation';
import { getServerSession } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DEFAULT_REDIRECT = '/admin/cash-reconciliation';
const MANUAL_RECHARGE_OPERATOR_IDS = getAdminDiscordIds();

const readText = (formData: FormData, key: string) => {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : '';
};

const redirectTo = (raw: string, kind: 'error' | 'notice', message: string) => {
  const target = raw.startsWith(DEFAULT_REDIRECT) ? raw : DEFAULT_REDIRECT;
  const url = new URL(target, 'http://local');
  url.searchParams.set(kind, message);
  return NextResponse.redirect(url, { status: 303 });
};

const financeOnly = (discordId?: string | null) => {
  if (!isSettlementFinance(discordId)) throw new Error('只有财务管理员可以执行此操作。');
};

const assertOwner = (actualOwnerId: string | null | undefined, actorId: string) => {
  if (!actualOwnerId || actualOwnerId !== actorId) throw new Error('只能操作自己负责的账号。');
};

async function saveEvidence(file: File, reconciliationId: string, uploadedBy: string) {
  const image = await validateSettlementReceipt(file);
  const storageFileName = `${reconciliationId}-${randomUUID()}${image.extension}`;
  const directory = getSettlementReceiptStorageDir();
  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(path.join(directory, storageFileName), image.buffer, { flag: 'wx' });
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
  const rechargeId = readText(formData, 'rechargeId');
  const accountId = readText(formData, 'accountId');
  const rmbAmount = parsePositiveDecimal(readText(formData, 'rmbAmount'));
  const redirect = readText(formData, 'redirectTo');
  const receipt = formData.get('receipt');

  if (!rechargeId || !accountId || !rmbAmount) throw new Error('请填写支付账号和有效人民币入账金额。');
  const [recharge, account, existing] = await Promise.all([
    prisma.recharge.findFirst({
      where: {
        RechargeID: rechargeId,
        amount: { gt: 0 },
        fromWhom: { in: [...MANUAL_RECHARGE_OPERATOR_IDS] },
        createdAt: newEntityOnlyTime(),
      },
      select: { RechargeID: true, amount: true },
    }),
    prisma.settlementAccount.findFirst({ where: { id: accountId, active: true } }),
    prisma.settlementRechargeReconciliation.findUnique({
      where: { rechargeId },
      include: { evidence: { select: { id: true }, take: 1 } },
    }),
  ]);
  if (!recharge) throw new Error('该充值不在新开业后的有效待处理列表中。');
  if (!account) throw new Error('请选择有效的收款账号。');
  if (!rmbAmount.eq(recharge.amount)) {
    throw new Error('人民币入账金额必须与该笔老板充值金额一致。');
  }
  if (existing?.status === SettlementReconciliationStatus.INVALIDATED) {
    throw new Error('已标记无效的充值不能重新分配。');
  }
  if (existing?.status === SettlementReconciliationStatus.OWNER_CONFIRMED) {
    throw new Error('负责人已确认收款，不能重新分配账号。');
  }

  const originalReceivedAmount = isRmbCurrency(account.currency)
    ? rmbAmount
    : parsePositiveDecimal(readText(formData, 'originalReceivedAmount'));
  if (!originalReceivedAmount) {
    throw new Error(`${account.name} 为外币账号，请填写实际收到的原币金额。`);
  }

  if (!(receipt instanceof File) || receipt.size === 0) {
    if (!existing?.evidence.length) throw new Error('首次财务确认必须上传转账截图。');
  }

  const reconciliationId = existing?.id ?? `settlement-recon-${randomUUID()}`;
  let savedEvidence: Awaited<ReturnType<typeof saveEvidence>> | null = null;
  if (receipt instanceof File && receipt.size > 0) {
    savedEvidence = await saveEvidence(receipt, reconciliationId, actorId);
  }

  try {
    await prisma.$transaction(async (tx) => {
      const priorStatus = existing?.status ?? null;
      const data = {
        accountId: account.id,
        ownerDiscordId: account.ownerDiscordId,
        status: SettlementReconciliationStatus.FINANCE_CONFIRMED,
        rmbAmount,
        originalReceivedAmount,
        originalReceivedCurrency: account.currency,
        exceptionReason: null,
        financeConfirmedBy: actorId,
        financeConfirmedAt: new Date(),
      };
      const reconciliation = existing
        ? await tx.settlementRechargeReconciliation.update({ where: { id: existing.id }, data })
        : await tx.settlementRechargeReconciliation.create({ data: { id: reconciliationId, rechargeId, ...data } });
      if (savedEvidence) {
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
          note: '财务已上传凭证并分配收款账号。',
        },
      });
    });
  } catch (error) {
    if (savedEvidence) await fs.unlink(path.join(getSettlementReceiptStorageDir(), savedEvidence.storageFileName)).catch(() => undefined);
    throw error;
  }

  return redirectTo(redirect, 'notice', '已计入实收并等待账号负责人确认。');
}

async function financeInvalidate(formData: FormData, actorId: string) {
  financeOnly(actorId);
  const rechargeId = readText(formData, 'rechargeId');
  const reason = readText(formData, 'reason');
  const reversalRechargeId = readText(formData, 'reversalRechargeId');
  const redirect = readText(formData, 'redirectTo');
  if (!rechargeId || !reason) throw new Error('请填写无效原因。');

  const [recharge, existing, reversal] = await Promise.all([
    prisma.recharge.findFirst({
      where: {
        RechargeID: rechargeId,
        amount: { gt: 0 },
        fromWhom: { in: [...MANUAL_RECHARGE_OPERATOR_IDS] },
        createdAt: newEntityOnlyTime(),
      },
      select: { RechargeID: true, amount: true, toWhom: true, dlmId: true },
    }),
    prisma.settlementRechargeReconciliation.findUnique({ where: { rechargeId } }),
    reversalRechargeId
      ? prisma.recharge.findUnique({ where: { RechargeID: reversalRechargeId }, select: { RechargeID: true, amount: true, toWhom: true, dlmId: true } })
      : Promise.resolve(null),
  ]);
  if (!recharge) throw new Error('未找到有效的正向充值记录。');
  if (reversalRechargeId) {
    const rechargeOwner = recharge.toWhom ?? recharge.dlmId;
    const reversalOwner = reversal?.toWhom ?? reversal?.dlmId;
    if (!reversal || !reversal.amount.lt(0) || !reversal.amount.abs().eq(recharge.amount) || reversalOwner !== rechargeOwner) {
      throw new Error('关联冲正必须是同一老板、金额相等的反向充值。');
    }
  }
  if (existing?.status === SettlementReconciliationStatus.INVALIDATED) {
    throw new Error('该充值已被标记为无效。');
  }

  await prisma.$transaction(async (tx) => {
    const priorStatus = existing?.status ?? null;
    const reconciliation = existing
      ? await tx.settlementRechargeReconciliation.update({
          where: { id: existing.id },
          data: {
            status: SettlementReconciliationStatus.INVALIDATED,
            invalidReason: reason.slice(0, 500),
            reversalRechargeId: reversalRechargeId || null,
            invalidatedBy: actorId,
            invalidatedAt: new Date(),
          },
        })
      : await tx.settlementRechargeReconciliation.create({
          data: {
            rechargeId,
            status: SettlementReconciliationStatus.INVALIDATED,
            invalidReason: reason.slice(0, 500),
            reversalRechargeId: reversalRechargeId || null,
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

  return redirectTo(redirect, 'notice', '已标为无效；仅冲正内部对账，不会改动老板余额。');
}

async function createAccount(formData: FormData, actorId: string) {
  financeOnly(actorId);
  const name = readText(formData, 'name');
  const ownerDiscordId = readText(formData, 'ownerDiscordId');
  const kind = readText(formData, 'kind').toUpperCase();
  const currency = normalizeCurrency(readText(formData, 'currency'));
  const redirect = readText(formData, 'redirectTo');
  if (!name || !/^\d{17,20}$/.test(ownerDiscordId) || !kind || !currency) {
    throw new Error('请填写账号名称、负责人 Discord ID、类型和币种。');
  }
  await prisma.settlementAccount.create({
    data: { name: name.slice(0, 80), ownerDiscordId, kind: kind.slice(0, 32), currency },
  });
  return redirectTo(redirect, 'notice', '收款账号已创建并绑定负责人。');
}

async function ownerConfirm(formData: FormData, actorId: string) {
  const reconciliationId = readText(formData, 'reconciliationId');
  const redirect = readText(formData, 'redirectTo');
  const reconciliation = await prisma.settlementRechargeReconciliation.findUnique({ where: { id: reconciliationId } });
  if (!reconciliation) throw new Error('未找到该对账记录。');
  assertOwner(reconciliation.ownerDiscordId, actorId);
  if (reconciliation.status !== SettlementReconciliationStatus.FINANCE_CONFIRMED) {
    throw new Error('只有待负责人确认的记录可以确认收款。');
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
        note: '账号负责人确认已收到款项。',
      },
    });
  });
  return redirectTo(redirect, 'notice', '已确认收到款项。');
}

async function ownerDispute(formData: FormData, actorId: string) {
  const reconciliationId = readText(formData, 'reconciliationId');
  const reason = readText(formData, 'reason');
  const redirect = readText(formData, 'redirectTo');
  if (!reason) throw new Error('请填写异常原因。');
  const reconciliation = await prisma.settlementRechargeReconciliation.findUnique({ where: { id: reconciliationId } });
  if (!reconciliation) throw new Error('未找到该对账记录。');
  assertOwner(reconciliation.ownerDiscordId, actorId);
  if (reconciliation.status !== SettlementReconciliationStatus.FINANCE_CONFIRMED) {
    throw new Error('该记录当前不能提出异常。');
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
  return redirectTo(redirect, 'notice', '异常已反馈给财务；金额暂时仍计入应有总额。');
}

async function createTransfer(formData: FormData, actorId: string) {
  const fromAccountId = readText(formData, 'fromAccountId');
  const toAccountId = readText(formData, 'toAccountId');
  const amount = parsePositiveDecimal(readText(formData, 'amount'));
  const redirect = readText(formData, 'redirectTo');
  if (!fromAccountId || !toAccountId || fromAccountId === toAccountId || !amount) {
    throw new Error('请选择不同的转出、转入账号并填写有效金额。');
  }
  const accounts = await prisma.settlementAccount.findMany({ where: { id: { in: [fromAccountId, toAccountId] }, active: true } });
  const from = accounts.find((account) => account.id === fromAccountId);
  const to = accounts.find((account) => account.id === toAccountId);
  if (!from || !to || !isRmbCurrency(from.currency) || !isRmbCurrency(to.currency)) {
    throw new Error('内部转账仅支持两个有效人民币账号。');
  }
  assertOwner(from.ownerDiscordId, actorId);
  if (from.ownerDiscordId === to.ownerDiscordId) throw new Error('仅支持转入其他负责人的账号。');
  await prisma.settlementAccountTransfer.create({
    data: { fromAccountId, toAccountId, amount, initiatedBy: actorId },
  });
  return redirectTo(redirect, 'notice', '转账已提交，等待收款账号负责人确认。');
}

async function confirmTransfer(formData: FormData, actorId: string, disputed: boolean) {
  const transferId = readText(formData, 'transferId');
  const reason = readText(formData, 'reason');
  const redirect = readText(formData, 'redirectTo');
  if (disputed && !reason) throw new Error('请填写未收到转账的原因。');
  const transfer = await prisma.settlementAccountTransfer.findUnique({
    where: { id: transferId },
    include: { toAccount: true },
  });
  if (!transfer) throw new Error('未找到转账记录。');
  assertOwner(transfer.toAccount.ownerDiscordId, actorId);
  if (transfer.status !== SettlementTransferStatus.PENDING_RECEIVER_CONFIRMATION) {
    throw new Error('该转账已经处理。');
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
  return redirectTo(redirect, 'notice', disputed ? '已标记转账异常。' : '已确认收到内部转账。');
}

async function recordForexRecovery(formData: FormData, actorId: string) {
  financeOnly(actorId);
  const fromAccountId = readText(formData, 'fromAccountId');
  const toAccountId = readText(formData, 'toAccountId');
  const foreignAmount = parsePositiveDecimal(readText(formData, 'foreignAmount'));
  const rmbAmount = parsePositiveDecimal(readText(formData, 'rmbAmount'));
  const note = readText(formData, 'note');
  const redirect = readText(formData, 'redirectTo');
  if (!fromAccountId || !toAccountId || !foreignAmount || !rmbAmount) {
    throw new Error('请填写外币来源、人民币去向以及两种金额。');
  }
  const accounts = await prisma.settlementAccount.findMany({ where: { id: { in: [fromAccountId, toAccountId] }, active: true } });
  const from = accounts.find((account) => account.id === fromAccountId);
  const to = accounts.find((account) => account.id === toAccountId);
  if (!from || !to || isRmbCurrency(from.currency) || !isRmbCurrency(to.currency)) {
    throw new Error('外汇归还必须从外币账号进入有效的人民币账号。');
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
  return redirectTo(redirect, 'notice', '外汇归还已记入目标人民币账号。');
}

async function markPayoutPaid(formData: FormData, actorId: string) {
  const withdrawalId = readText(formData, 'withdrawalId');
  const redirect = readText(formData, 'redirectTo');
  const withdrawal = await prisma.withdraw.findFirst({
    where: { id: withdrawalId, createdAt: newEntityOnlyTime() },
    select: { id: true, amount: true, method: true },
  });
  if (!withdrawal) throw new Error('未找到新开业后的提现申请。');
  const responsibleOwner = resolveWithdrawalSettlementOwner(withdrawal.method);
  if (!responsibleOwner) throw new Error('该提现方式不属于微信或支付宝负责人队列。');
  assertOwner(responsibleOwner, actorId);
  await prisma.settlementWithdrawalPayout.create({
    data: {
      withdrawalId,
      ownerDiscordId: responsibleOwner,
      amount: withdrawal.amount,
      status: SettlementPayoutStatus.PAID,
      paidBy: actorId,
    },
  });
  return redirectTo(redirect, 'notice', '已标记提现发放；金额已从负责人应有总额扣除。');
}

async function voidPayout(formData: FormData, actorId: string) {
  financeOnly(actorId);
  const payoutId = readText(formData, 'payoutId');
  const reason = readText(formData, 'reason');
  const redirect = readText(formData, 'redirectTo');
  if (!payoutId || !reason) throw new Error('请填写撤销原因。');
  const updated = await prisma.settlementWithdrawalPayout.updateMany({
    where: { id: payoutId, status: SettlementPayoutStatus.PAID },
    data: {
      status: SettlementPayoutStatus.VOIDED,
      voidedBy: actorId,
      voidedAt: new Date(),
      voidReason: reason.slice(0, 500),
    },
  });
  if (!updated.count) throw new Error('该提现发放记录已经撤销或不存在。');
  return redirectTo(redirect, 'notice', '提现发放已撤销，仅影响内部负责人对账。');
}

export async function POST(request: NextRequest) {
  const session = await getServerSession();
  if (!session?.discordId) return NextResponse.json({ error: '无权访问' }, { status: 403 });
  const formData = await request.formData();
  const action = readText(formData, 'action');
  const redirect = readText(formData, 'redirectTo');
  try {
    switch (action) {
      case 'finance-confirm':
        return await financeConfirm(formData, session.discordId);
      case 'finance-invalidate':
        return await financeInvalidate(formData, session.discordId);
      case 'account-create':
        return await createAccount(formData, session.discordId);
      case 'owner-confirm':
        return await ownerConfirm(formData, session.discordId);
      case 'owner-dispute':
        return await ownerDispute(formData, session.discordId);
      case 'transfer-create':
        return await createTransfer(formData, session.discordId);
      case 'transfer-confirm':
        return await confirmTransfer(formData, session.discordId, false);
      case 'transfer-dispute':
        return await confirmTransfer(formData, session.discordId, true);
      case 'forex-recovery':
        return await recordForexRecovery(formData, session.discordId);
      case 'payout-paid':
        return await markPayoutPaid(formData, session.discordId);
      case 'payout-void':
        return await voidPayout(formData, session.discordId);
      default:
        throw new Error('未知操作。');
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : '操作失败，请稍后再试。';
    return redirectTo(redirect, 'error', message);
  }
}
