import { Prisma, type PrismaClient } from '@prisma/client';

export type DiscountIdentity = { dlmId: string; discordUserId: string | null };
export type DiscountWallet = { totalBalance: Prisma.Decimal; recharge: Prisma.Decimal; income: Prisma.Decimal; totalSpent: Prisma.Decimal };
export type DiscountWriterDependencies = {
  db: Pick<PrismaClient, '$transaction'>;
  now?: () => Date;
  getWallet: (tx: Prisma.TransactionClient, identity: DiscountIdentity) => Promise<DiscountWallet>;
  applyWallet: (tx: Prisma.TransactionClient, input: DiscountIdentity & { rechargeDelta: Prisma.Decimal; totalBalanceDelta: Prisma.Decimal }) => Promise<DiscountWallet>;
  record: (tx: Prisma.TransactionClient, input: {
    dlmId: string; discordId: string | null; thirdPartydiscordId: string;
    balanceBefore: Prisma.Decimal; balanceAfter: Prisma.Decimal; amountChange: Prisma.Decimal;
    typeOfTransaction: string; timeCreatedAt: Date;
  }) => Promise<{ transactionId: string }>;
  suppressNotifications: (tx: Prisma.TransactionClient) => Promise<unknown>;
};

export class OrderDiscountReviewError extends Error {
  constructor() { super('order_discount_requires_review'); }
}
const review = (): never => { throw new OrderDiscountReviewError(); };

/** Resolve an invocation once, without creating an account or taking wallet locks. */
export async function resolveDiscountRequesterTx(tx: Prisma.TransactionClient, id: string): Promise<DiscountIdentity> {
  const select = { dlmId: true, discordUserId: true } as const;
  const identity = await tx.dlmUser.findUnique({ where: { dlmId: id }, select }) ??
    await tx.dlmUser.findUnique({ where: { discordUserId: id }, select });
  return identity ?? review();
}

async function paymentOwners(tx: Prisma.TransactionClient, orderId: string) {
  const audit = await tx.orderAudit.findUnique({ where: { orderId } });
  if (!audit?.hostIndividualTransactionId || !audit.workerIndividualTransactionId ||
      audit.hostIndividualTransactionId === audit.workerIndividualTransactionId) return review();
  const [payment, host, worker] = await Promise.all([
    tx.transaction.findUnique({ where: { Transid: audit.paymentTransactionId } }),
    tx.individualTransaction.findUnique({ where: { transactionId: audit.hostIndividualTransactionId } }),
    tx.individualTransaction.findUnique({ where: { transactionId: audit.workerIndividualTransactionId } }),
  ]);
  if (!payment?.fromDlmId || !payment.toDlmId || !audit.gross.isFinite() || !audit.gross.gt(0) ||
      !audit.netAmount.isFinite() || audit.netAmount.lt(0) || !audit.feeAmount.isFinite() || audit.feeAmount.lt(0) ||
      !audit.netAmount.add(audit.feeAmount).eq(audit.gross) ||
      payment.orderID !== audit.transactionOrderId || payment.fromId !== audit.hostId || payment.toId !== audit.workerId ||
      !payment.amount.eq(audit.gross) || !payment.netAmount.eq(audit.netAmount) || !payment.feeAmount.eq(audit.feeAmount) ||
      host?.dlmId !== payment.fromDlmId || host.discordId !== audit.hostId || host.thirdPartydiscordId !== audit.workerId ||
      host.typeOfTransaction !== '点单' || !host.amountChange.eq(audit.gross) || !host.balanceBefore.sub(host.balanceAfter).eq(audit.gross) ||
      worker?.dlmId !== payment.toDlmId || worker.discordId !== audit.workerId || worker.thirdPartydiscordId !== (audit.hostId ?? 'SYSTEM') ||
      worker.typeOfTransaction !== '点单' || !worker.amountChange.eq(audit.netAmount) || !worker.balanceAfter.sub(worker.balanceBefore).eq(audit.netAmount)) return review();
  return { hostDlmId: payment.fromDlmId, workerDlmId: payment.toDlmId, workerId: audit.workerId, gross: audit.gross };
}

/** Caller holds Order FOR UPDATE. Acquire the complete wallet set before consuming a voucher. */
export async function lockOrderDiscountWalletsTx(
  tx: Prisma.TransactionClient,
  order: { id: string; hostDlmId: string | null; workerId: string },
  requester: DiscountIdentity,
) {
  const planned = await paymentOwners(tx, order.id);
  if (!order.hostDlmId || planned.hostDlmId !== order.hostDlmId || requester.dlmId !== planned.hostDlmId ||
      order.workerId !== planned.workerId) return review();
  const identities = new Map<string, DiscountIdentity>();
  for (const dlmId of [...new Set([planned.hostDlmId, planned.workerDlmId])].sort()) {
    const [identity] = await tx.$queryRaw<DiscountIdentity[]>`SELECT "dlmId", "discordUserId" FROM "DlmUser" WHERE "dlmId" = ${dlmId} FOR UPDATE`;
    if (!identity) return review();
    identities.set(dlmId, identity);
  }
  const discordIds = [...new Set([...identities.values()].flatMap(row => row.discordUserId ? [row.discordUserId] : []))].sort();
  for (const discordUserId of discordIds) {
    const [member] = await tx.$queryRaw<Array<{ discordUserId: string }>>`SELECT "discordUserId" FROM "Member" WHERE "discordUserId" = ${discordUserId} FOR UPDATE`;
    if (!member) return review();
  }
  for (const identity of identities.values()) {
    const current = await tx.dlmUser.findUnique({ where: { dlmId: identity.dlmId }, select: { discordUserId: true } });
    if (!current || current.discordUserId !== identity.discordUserId) return review();
  }
  const actual = await paymentOwners(tx, order.id);
  const owner = identities.get(planned.hostDlmId)!;
  const worker = identities.get(planned.workerDlmId)!;
  if (actual.hostDlmId !== planned.hostDlmId || actual.workerDlmId !== planned.workerDlmId ||
      actual.workerId !== planned.workerId || owner.discordUserId !== requester.discordUserId ||
      worker.discordUserId !== planned.workerId) return review();
  return { owner, worker };
}

export async function creditOrderDiscountTx(
  tx: Prisma.TransactionClient, deps: DiscountWriterDependencies,
  input: { orderId: string; owner: DiscountIdentity; worker: DiscountIdentity; voucherKind: 'coupon' | 'pointshop' | 'lottery'; voucherId: string; amount: Prisma.Decimal; now: Date },
) {
  const { orderId, owner, worker, voucherKind, voucherId, amount, now } = input;
  const row = voucherKind === 'coupon' ? await tx.coupon.findUnique({ where: { id: voucherId } }) :
    voucherKind === 'pointshop' ? await tx.pointShopGrant.findUnique({ where: { id: voucherId } }) :
    await tx.lotteryDraw.findUnique({ where: { id: voucherId }, include: { prize: true } });
  if (!row) return review();
  const consumedAt = 'consumeAt' in row ? row.consumeAt : row.consumedAt;
  const consumedOrder = voucherKind === 'coupon' && 'orderId' in row ? row.orderId : 'consumeOrderId' in row ? row.consumeOrderId : null;
  const status = 'couponStatus' in row ? row.couponStatus : row.status;
  const issuedAt = 'issuedAt' in row ? row.issuedAt : row.createdAt;
  const voucherType = 'prizeId' in row ? row.prizeId : 'couponType' in row ? row.couponType : row.type;
  const couponLabels: Record<string, string> = { DISCOUNT_90: '9折券', DISCOUNT_80: '8折券', DISCOUNT_70: '7折券', DISCOUNT_90_LOTTERY: '特殊9折券' };
  const voucherLabel = 'prize' in row ? row.prize?.name : voucherType ? couponLabels[voucherType] : null;
  if (row.dlmId !== owner.dlmId || status !== 'USED' || consumedOrder !== orderId ||
      ('deliveryStatus' in row && row.deliveryStatus !== 'DELIVERED') ||
      consumedAt?.getTime() !== now.getTime() || !row.expiresAt || row.expiresAt <= now || issuedAt > now ||
      row.consumeTargetDlmId !== worker.dlmId || row.consumeTargetId !== worker.discordUserId ||
      !row.consumeAmount?.eq(amount) || !amount.isFinite() || !amount.gt(0) || !voucherType || !voucherLabel || !worker.discordUserId) return review();
  const payment = await paymentOwners(tx, orderId);
  if (payment.hostDlmId !== owner.dlmId || payment.workerDlmId !== worker.dlmId || amount.gt(payment.gross)) return review();
  await deps.suppressNotifications(tx);
  const before = await deps.getWallet(tx, owner);
  const after = await deps.applyWallet(tx, { ...owner, rechargeDelta: amount, totalBalanceDelta: amount });
  if (!after.totalBalance.sub(before.totalBalance).eq(amount) || !after.recharge.sub(before.recharge).eq(amount) ||
      !after.income.eq(before.income) || !after.totalSpent.eq(before.totalSpent)) return review();
  const receipt = await deps.record(tx, {
    dlmId: owner.dlmId, discordId: owner.discordUserId, thirdPartydiscordId: worker.discordUserId,
    balanceBefore: before.totalBalance, balanceAfter: after.totalBalance, amountChange: amount,
    typeOfTransaction: '优惠返利', timeCreatedAt: now,
  });
  if (!receipt?.transactionId) return review();
  // Verify the persisted receipt, not a fabricated before + amount calculation.
  const saved = await tx.individualTransaction.findUnique({ where: { transactionId: receipt.transactionId } });
  if (saved?.dlmId !== owner.dlmId || saved.discordId !== owner.discordUserId || saved.thirdPartydiscordId !== worker.discordUserId ||
      saved.typeOfTransaction !== '优惠返利' || !saved.amountChange.eq(amount) ||
      !saved.balanceBefore.eq(before.totalBalance) || !saved.balanceAfter.eq(after.totalBalance)) return review();
  await tx.orderDiscountAudit.create({ data: {
    orderId, auditVersion: 1, voucherKind, voucherId, rebateTransactionId: receipt.transactionId,
    ownerDlmId: owner.dlmId, ownerDiscordId: owner.discordUserId, workerDlmId: worker.dlmId,
    workerDiscordId: worker.discordUserId, amount, rechargeDelta: after.recharge.sub(before.recharge),
    voucherIssuedAt: issuedAt, voucherExpiresAt: row.expiresAt, consumedAt: now, voucherType, voucherLabel,
  } });
}

/** No external effects in callbacks. Only an explicit DB-aborted conflict is replayed. */
export async function runDiscountTransaction<T>(db: DiscountWriterDependencies['db'], work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T | { status: 'requires_review' | 'outcome_unknown' }> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await db.$transaction(work, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (error instanceof OrderDiscountReviewError) return { status: 'requires_review' };
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
        if (attempt < 3) continue;
        return { status: 'requires_review' };
      }
      // Includes failures after the callback returned: the commit may have succeeded.
      return { status: 'outcome_unknown' };
    }
  }
}
