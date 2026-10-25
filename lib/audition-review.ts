import { Prisma } from '@prisma/client';
import { giftHistoryDlmMatches, giftHistoryPaymentOwnerMatches } from './gift-history-ownership';

const inviteSelect = {
  id: true, orderRequestId: true, bossId: true, workerId: true, peiwanId: true,
  bossDlmId: true, workerDlmId: true, bossDiscordIdSnapshot: true, workerDiscordIdSnapshot: true,
  quotedGross: true, status: true, transactionId: true, grossAmount: true, feeAmount: true, netAmount: true,
  createdAt: true, updatedAt: true, expiresAt: true, acceptedAt: true, declinedAt: true,
  joinedAt: true, chargedAt: true, fulfilledAt: true, canceledAt: true,
} satisfies Prisma.AuditionInviteSelect;
const paymentSelect = {
  Transid: true, orderID: true, fromId: true, toId: true, fromDlmId: true, toDlmId: true,
  amount: true, feeAmount: true, netAmount: true, createdAt: true,
} satisfies Prisma.TransactionSelect;
const auditSelect = {
  id: true, auditVersion: true, paymentTransactionId: true, individualTransactionId: true, orderId: true,
  giftName: true, quantity: true, unitPrice: true, gross: true, payable: true, feeAmount: true, netAmount: true,
  giverId: true, receiverId: true, giverDlmId: true, receiverDlmId: true, giverDiscordId: true,
  giverFromIncome: true, giverFromRecharge: true, receiverIncomeDelta: true, receiverRechargeDelta: true,
  receiverEarnDelta: true, receiverPeiwanId: true, heartApplied: true, createdAt: true,
  pointsEarned: true, spendBonusExtra: true, flowBonusExtra: true, voucherIds: true, couponIds: true, voucherConsumption: true,
} satisfies Prisma.GiftAuditSelect;
const ledgerSelect = {
  transactionId: true, discordId: true, dlmId: true, thirdPartydiscordId: true,
  typeOfTransaction: true, balanceBefore: true, amountChange: true, balanceAfter: true, timeCreatedAt: true,
} satisfies Prisma.IndividualTransactionSelect;
const commissionSelect = {
  transactionId: true, orderID: true, fromId: true, toId: true, fromDlmId: true, toDlmId: true,
  feeAmount: true, createdAt: true,
} satisfies Prisma.CommissionSelect;
const revertSelect = { id: true, originalTransactionId: true, status: true, createdAt: true } satisfies Prisma.RevertSelect;

type ReadDb = Pick<Prisma.TransactionClient, 'auditionInvite' | 'transaction' | 'giftAudit' | 'individualTransaction' | 'commission' | 'revert' | 'accountOwnership' | 'dlmUser' | 'detachedDiscordAccount'>;
type Invite = Prisma.AuditionInviteGetPayload<{ select: typeof inviteSelect }>;
type Payment = Prisma.TransactionGetPayload<{ select: typeof paymentSelect }>;
type Audit = Prisma.GiftAuditGetPayload<{ select: typeof auditSelect }>;
type Ledger = Prisma.IndividualTransactionGetPayload<{ select: typeof ledgerSelect }>;
type Commission = Prisma.CommissionGetPayload<{ select: typeof commissionSelect }>;
type Revert = Prisma.RevertGetPayload<{ select: typeof revertSelect }>;

export function validAuditionInviteId(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(value);
}
const decimal = (value: Prisma.Decimal | null) => value?.toString() ?? null;
const date = (value: Date | null) => value?.toISOString() ?? null;
const validAmount = (value: Prisma.Decimal | null): value is Prisma.Decimal =>
  value !== null && value.isFinite() && value.gte(0) && value.decimalPlaces() <= 4;
const equalAmount = (left: Prisma.Decimal | null, right: Prisma.Decimal | null) =>
  validAmount(left) && validAmount(right) && left.eq(right);
const emptyArray = (value: unknown) => Array.isArray(value) && value.length === 0;
function noVoucherFacts(value: Prisma.JsonValue | null) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return value.version === 1 && Object.keys(value).length === 2 && emptyArray(value.vouchers);
}

async function proofIssues(db: ReadDb, invite: Invite, payments: Payment[], audits: Audit[], ledgers: Ledger[], commissions: Commission[], reverts: Revert[]) {
  const issues: string[] = [];
  const { bossDlmId, workerDlmId, bossDiscordIdSnapshot: bossDiscord, workerDiscordIdSnapshot: workerDiscord, quotedGross } = invite;
  if (!bossDlmId || !workerDlmId || !bossDiscord || !workerDiscord || bossDlmId === workerDlmId || bossDiscord === workerDiscord ||
    !Number.isSafeInteger(invite.peiwanId) || invite.peiwanId! < 1 || invite.peiwanId! > 2_147_483_647 ||
    !validAmount(quotedGross) || quotedGross.decimalPlaces() > 2 || quotedGross.gte('1000000000000000')) {
    issues.push('邀请固定双方身份、陪玩编号或原始报价缺失或不符，不能从当前账户推断。');
  }
  if (!invite.transactionId) issues.push('邀请未关联原支付编号。');
  if (payments.length !== 1) issues.push('原支付记录缺失或不唯一。');
  if (audits.length !== 1) issues.push('关联的打赏审计缺失或不唯一。');
  if (ledgers.length !== 1) issues.push('审计关联的付款个人流水缺失或不唯一。');
  if (commissions.length !== 1) issues.push('关联的抽成记录缺失或不唯一。');
  const payment = payments[0]; const audit = audits[0]; const ledger = ledgers[0]; const commission = commissions[0];
  if (payment) {
    // Original invitation/audit identities stay immutable; payment and invitation
    // Member foreign keys move with approved account ownership. Read mapping only.
    const [payerMatches, workerMatches] = await Promise.all([
      giftHistoryPaymentOwnerMatches(db, { dlmId: bossDlmId, discordId: bossDiscord },
        { dlmId: payment.fromDlmId, memberKey: payment.fromId }),
      giftHistoryPaymentOwnerMatches(db, { dlmId: workerDlmId, discordId: workerDiscord },
        { dlmId: payment.toDlmId, memberKey: payment.toId }),
    ]);
    if (payment.Transid !== invite.transactionId || !payerMatches || !workerMatches ||
      payment.fromId !== invite.bossId || payment.toId !== invite.workerId) issues.push('原支付编号或双方身份与邀请快照及已确认归属不符。');
    if (!equalAmount(payment.amount, quotedGross) || !equalAmount(payment.amount, invite.grossAmount) ||
      !equalAmount(payment.feeAmount, invite.feeAmount) || !equalAmount(payment.netAmount, invite.netAmount) ||
      !validAmount(payment.feeAmount) || !validAmount(payment.netAmount) || !payment.feeAmount.add(payment.netAmount).eq(payment.amount)) {
      issues.push('邀请报价、实付、抽成或净收入金额不一致。');
    }
  }
  if (audit) {
    if (audit.auditVersion !== 2 || audit.giftName !== '真人试音' || !audit.quantity.eq(1) ||
      audit.paymentTransactionId !== invite.transactionId || audit.orderId !== payment?.orderID ||
      audit.giverDlmId !== bossDlmId || audit.receiverDlmId !== workerDlmId || audit.giverDiscordId !== bossDiscord ||
      audit.giverId !== bossDiscord || audit.receiverId !== workerDiscord || audit.receiverPeiwanId !== invite.peiwanId) {
      issues.push('打赏审计版本、试音类型、原款编号或固定双方身份不符。');
    }
    if (!equalAmount(audit.gross, quotedGross) || !equalAmount(audit.payable, quotedGross) || !equalAmount(audit.unitPrice, quotedGross) ||
      !equalAmount(audit.feeAmount, payment?.feeAmount ?? null) || !equalAmount(audit.netAmount, payment?.netAmount ?? null) ||
      !validAmount(audit.giverFromIncome) || !validAmount(audit.giverFromRecharge) ||
      !audit.giverFromIncome.add(audit.giverFromRecharge).eq(audit.payable)) issues.push('打赏审计金额或付款分仓与原款不符。');
    if (!validAmount(audit.receiverIncomeDelta) || !validAmount(audit.receiverRechargeDelta) ||
      !audit.receiverIncomeDelta.add(audit.receiverRechargeDelta).eq(audit.netAmount) ||
      !equalAmount(audit.receiverEarnDelta, quotedGross) || audit.heartApplied !== 0) {
      issues.push('收款分仓、实际流水增量或心动事实缺失或不符。');
    }
    if (![audit.pointsEarned, audit.spendBonusExtra, audit.flowBonusExtra].every(value => validAmount(value) && value.isZero()) ||
      !emptyArray(audit.voucherIds) || !emptyArray(audit.couponIds) || !noVoucherFacts(audit.voucherConsumption)) {
      issues.push('试音审计应无积分、翻倍或用券权益，现有凭证不符或缺失。');
    }
  }
  if (ledger && (ledger.transactionId !== audit?.individualTransactionId || ledger.dlmId !== payment?.fromDlmId || !await giftHistoryDlmMatches(db, bossDlmId, ledger.dlmId) ||
    ledger.discordId !== bossDiscord || ledger.thirdPartydiscordId !== workerDiscord || ledger.typeOfTransaction !== '试音花费' ||
    !equalAmount(ledger.amountChange, quotedGross) || !ledger.balanceBefore.isFinite() || !ledger.balanceAfter.isFinite() ||
    !ledger.balanceBefore.sub(ledger.balanceAfter).eq(ledger.amountChange))) issues.push('原付款个人流水的身份、金额或余额变化不符。');
  if (commission && (commission.transactionId !== invite.transactionId || commission.orderID !== payment?.orderID ||
    commission.fromDlmId !== payment?.fromDlmId || commission.toDlmId !== payment?.toDlmId || commission.fromId !== payment?.fromId ||
    commission.toId !== payment?.toId || !equalAmount(commission.feeAmount, payment?.feeAmount ?? null))) {
    issues.push('抽成记录的原款编号、双方身份或金额不符。');
  }
  if (!invite.chargedAt || !invite.fulfilledAt) issues.push('完成时间或扣款时间事实缺失。');
  if (reverts.some(row => row.status !== 'SUCCESS')) issues.push('存在尚未确认为成功的撤销记录，需核实处理结果。');
  return issues;
}

/** SELECTs only. The caller supplies one repeatable-read snapshot; no identity sync, wallet writes or inference of missing original facts. */
export async function loadAuditionReview(db: ReadDb, inviteId: string) {
  if (!validAuditionInviteId(inviteId)) throw new Error('invalid_invite_id');
  const invite = await db.auditionInvite.findUnique({ where: { id: inviteId }, select: inviteSelect });
  if (!invite) return null;
  const payments = invite.transactionId ? await db.transaction.findMany({ where: { Transid: invite.transactionId }, select: paymentSelect, take: 2 }) : [];
  const orderIds = payments.map(row => row.orderID);
  const audits = invite.transactionId ? await db.giftAudit.findMany({
    where: { OR: [{ paymentTransactionId: invite.transactionId }, { orderId: { in: orderIds } }] }, select: auditSelect, take: 2,
  }) : [];
  const receiptIds = [...new Set(audits.map(row => row.individualTransactionId))];
  const [ledgers, commissions, reverts] = await Promise.all([
    receiptIds.length ? db.individualTransaction.findMany({ where: { transactionId: { in: receiptIds } }, select: ledgerSelect, take: 2 }) : Promise.resolve([]),
    invite.transactionId ? db.commission.findMany({ where: { OR: [{ transactionId: invite.transactionId }, { orderID: { in: orderIds } }] }, select: commissionSelect, take: 2 }) : Promise.resolve([]),
    receiptIds.length ? db.revert.findMany({ where: { originalTransactionId: { in: receiptIds } }, select: revertSelect, take: 2 }) : Promise.resolve([]),
  ]);
  const issues = await proofIssues(db, invite, payments, audits, ledgers, commissions, reverts);
  const reversed = reverts.some(row => row.status === 'SUCCESS');
  const waiting = ['PENDING', 'ACCEPTED'].includes(invite.status);
  const outcome = reversed ? 'REVERTED' : invite.status === 'FULFILLED' && issues.length === 0 ? 'CONSISTENT' : waiting ? 'WAITING' : 'REQUIRES_REVIEW';
  return {
    outcome,
    summary: outcome === 'CONSISTENT' ? '完成凭证一致' : outcome === 'REVERTED' ? '原结算已撤销，退款凭证需核实' :
      outcome === 'WAITING' ? '邀请仍在等待处理，不能据此认定未扣费' : '结果需人工核实',
    issues: waiting && !payments.length && !audits.length ? ['当前尚未关联完整结算凭证；等待状态不能证明未扣费。'] : issues,
    scope: '仅核对本邀请关联的支付、打赏审计、付款个人流水与抽成记录。收款效果来自审计实际分仓；未核验独立收款流水、全部账务、退款细节或通知投递。请勿据此重新扣费。',
    invite: {
      id: invite.id, orderRequestId: invite.orderRequestId, status: invite.status, peiwanId: invite.peiwanId,
      bossDlmId: invite.bossDlmId, workerDlmId: invite.workerDlmId,
      bossDiscordId: invite.bossDiscordIdSnapshot, workerDiscordId: invite.workerDiscordIdSnapshot,
      currentBossDiscordId: invite.bossId, currentWorkerDiscordId: invite.workerId,
      quotedGross: decimal(invite.quotedGross), transactionId: invite.transactionId,
      grossAmount: decimal(invite.grossAmount), feeAmount: decimal(invite.feeAmount), netAmount: decimal(invite.netAmount),
      createdAt: date(invite.createdAt), updatedAt: date(invite.updatedAt), expiresAt: date(invite.expiresAt),
      acceptedAt: date(invite.acceptedAt), declinedAt: date(invite.declinedAt), joinedAt: date(invite.joinedAt),
      chargedAt: date(invite.chargedAt), fulfilledAt: date(invite.fulfilledAt), canceledAt: date(invite.canceledAt),
    },
    payments: payments.map(row => ({ transactionId: row.Transid, orderId: row.orderID, fromDlmId: row.fromDlmId, toDlmId: row.toDlmId,
      fromDiscordId: row.fromId, toDiscordId: row.toId, amount: decimal(row.amount), feeAmount: decimal(row.feeAmount), netAmount: decimal(row.netAmount), createdAt: date(row.createdAt) })),
    audits: audits.map(row => ({ id: row.id, auditVersion: row.auditVersion, paymentTransactionId: row.paymentTransactionId,
      individualTransactionId: row.individualTransactionId, orderId: row.orderId, giftName: row.giftName,
      giverDlmId: row.giverDlmId, receiverDlmId: row.receiverDlmId, giverDiscordId: row.giverDiscordId, receiverDiscordId: row.receiverId,
      receiverPeiwanId: row.receiverPeiwanId, gross: decimal(row.gross), payable: decimal(row.payable), feeAmount: decimal(row.feeAmount), netAmount: decimal(row.netAmount),
      giverFromIncome: decimal(row.giverFromIncome), giverFromRecharge: decimal(row.giverFromRecharge), receiverIncomeDelta: decimal(row.receiverIncomeDelta),
      receiverRechargeDelta: decimal(row.receiverRechargeDelta), receiverEarnDelta: decimal(row.receiverEarnDelta), heartApplied: row.heartApplied,
      pointsEarned: decimal(row.pointsEarned), spendBonusExtra: decimal(row.spendBonusExtra), flowBonusExtra: decimal(row.flowBonusExtra),
      createdAt: date(row.createdAt) })),
    payerLedgers: ledgers.map(row => ({ transactionId: row.transactionId, dlmId: row.dlmId, discordId: row.discordId,
      counterpartyDiscordId: row.thirdPartydiscordId, type: row.typeOfTransaction, amount: decimal(row.amountChange), balanceBefore: decimal(row.balanceBefore),
      balanceAfter: decimal(row.balanceAfter), createdAt: date(row.timeCreatedAt) })),
    commissions: commissions.map(row => ({ transactionId: row.transactionId, orderId: row.orderID, fromDlmId: row.fromDlmId, toDlmId: row.toDlmId,
      fromDiscordId: row.fromId, toDiscordId: row.toId, feeAmount: decimal(row.feeAmount), createdAt: date(row.createdAt) })),
    reverts: reverts.map(row => ({ id: row.id, originalTransactionId: row.originalTransactionId, status: row.status, createdAt: date(row.createdAt) })),
  };
}
export type AuditionReview = NonNullable<Awaited<ReturnType<typeof loadAuditionReview>>>;
