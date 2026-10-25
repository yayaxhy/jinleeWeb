import { Prisma } from '@prisma/client';
import { asRecord, groupReportFacts, orderFromKey, stringId, uniqueIds, type ReportFactIssue } from './report-facts';
import { NEW_ENTITY_OPERATIONS_STARTED_AT } from '../operating-entity-cutover';

/** Reporting reads immutable settlement facts. Order amounts and ReferralPayout
 * are operational state: a reversal clears/deletes them and must not rewrite a
 * previously earned month's income or expense. No database singleton here. */
export type OrderRevenueSourceRow = {
  orderId: string | null;
  orderStatus: string | null;
  displayNo: number | null;
  endedAt: Date | null;
  paymentTransactionId?: string | null;
  auditId: string | null;
  auditOrderId: string | null;
  auditCreatedAt: Date | null;
  gross: Prisma.Decimal | null;
  netAmount: Prisma.Decimal | null;
  feeAmount: Prisma.Decimal | null;
  hostId: string | null;
  workerId: string | null;
  bossReferralInviterId: string | null;
  bossReferralAmount: Prisma.Decimal | null;
  workerReferralInviterId: string | null;
  workerReferralAmount: Prisma.Decimal | null;
  auditVersion: number | null;
  referralLedgerFacts: unknown;
};

export type OrderRevenueReversalSourceRow = OrderRevenueSourceRow & {
  revertId: string;
  originalTransactionId: string;
  revertCreatedAt: Date;
  revertStatus: string;
  details: unknown;
};

export type OrderRevenueParams = { start: Date; end: Date; excludeDiscordIds?: string[] };
type QueryClient = { $queryRaw<T>(query: Prisma.Sql): Promise<T> };
type Phase = 'original' | 'reversal';
type Kind = 'boss' | 'worker';
type Referral = { kind: Kind; inviterId: string; amount: Prisma.Decimal; transactionId: string | null };
export type OrderReferralPosting = {
  id: string;
  orderId: string;
  phase: Phase;
  kind: Kind;
  inviterId: string;
  amount: Prisma.Decimal;
  createdAt: Date;
  originalTransactionId: string | null;
  reversalTransactionId: string | null;
};

export class OrderRevenueFactsError extends Error {
  constructor(detail: string) {
    super(`订单收入或返佣审计资料不完整（${detail}），不能计算报表，请人工核实。`);
    this.name = 'OrderRevenueFactsError';
  }
}
const fail = (detail: string): never => { throw new OrderRevenueFactsError(detail); };
const record = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === 'object' && !Array.isArray(value));
const date = (value: Date | null, label: string): Date => {
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) return fail(label);
  return value;
};
const money = (value: unknown, label: string): Prisma.Decimal => {
  if (!(value instanceof Prisma.Decimal) && typeof value !== 'string') return fail(label);
  let result: Prisma.Decimal;
  try { result = new Prisma.Decimal(value); } catch { return fail(label); }
  if (!result.isFinite() || result.lt(0) || result.decimalPlaces() > 4) return fail(label);
  return result;
};
const inRange = (value: Date, params: OrderRevenueParams) => value >= params.start && value < params.end;

function readAudit(row: OrderRevenueSourceRow) {
  if (!row.auditId || !row.orderId || row.orderId !== row.auditOrderId || row.orderStatus !== 'ENDED') fail('缺少原结算审计或订单');
  const createdAt = date(row.auditCreatedAt, '原结算时间缺失');
  const gross = money(row.gross, '原订单金额缺失');
  const netAmount = money(row.netAmount, '原陪玩结算金额缺失');
  const feeAmount = money(row.feeAmount, '原抽成金额缺失');
  if (!gross.sub(netAmount).eq(feeAmount)) fail('原订单金额不一致');
  const referrals: Referral[] = [];
  const facts = record(row.referralLedgerFacts) ? row.referralLedgerFacts : null;
  if (row.auditVersion !== 1 && row.auditVersion !== 2) fail('未知结算审计版本');
  if (row.referralLedgerFacts !== null && (!facts || facts.version !== 1)) fail('未知返佣凭据版本');
  if ((row.auditVersion ?? 1) >= 2 && (!facts || facts.version !== 1)) fail('返佣流水凭据缺失');
  for (const kind of ['boss', 'worker'] as const) {
    const inviterId = kind === 'boss' ? row.bossReferralInviterId : row.workerReferralInviterId;
    const rawAmount = kind === 'boss' ? row.bossReferralAmount : row.workerReferralAmount;
    const receipt = facts?.[kind];
    // The legacy writer intentionally omitted BOTH fields when no award was
    // granted. A partially missing pair is not evidence of a zero award.
    if (inviterId === null && rawAmount === null) {
      if (facts && receipt !== null) fail('空返佣与流水凭据不一致');
      continue;
    }
    const amount = money(rawAmount, '返佣金额缺失');
    if (amount.isZero() && inviterId === null) {
      if (facts && receipt !== null) fail('零返佣与流水凭据不一致');
      continue;
    }
    if (!inviterId || amount.lte(0)) return fail('返佣收款人与金额不一致');
    const transactionId = record(receipt) && typeof receipt.transactionId === 'string' && receipt.transactionId
      ? receipt.transactionId : null;
    if (facts && !transactionId) fail('返佣流水凭据缺失');
    referrals.push({ kind, inviterId, amount, transactionId });
  }
  if (referrals.length === 2 && referrals[0].transactionId && referrals[0].transactionId === referrals[1].transactionId) fail('重复返佣流水凭据');
  return { orderId: row.orderId!, auditId: row.auditId!, displayNo: row.displayNo,
    hostId: row.hostId, workerId: row.workerId, createdAt, grossAmount: gross, netAmount, feeAmount, referrals };
}

function readReversalReferrals(row: OrderRevenueReversalSourceRow, audit: ReturnType<typeof readAudit>) {
  const details = row.details;
  if (!record(details) || details.orderId !== audit.orderId ||
      !money(details.gross, '撤销原金额缺失').eq(audit.grossAmount) ||
      !money(details.netAmount, '撤销结算金额缺失').eq(audit.netAmount)) return fail('撤销与原结算不一致');
  const rollbacks = details.referralRollbacks;
  // Older successful reversals did not persist actual referral clawbacks and
  // could clamp balances. Never infer a full recovery from a deleted payout.
  if (rollbacks === undefined && audit.referrals.length === 0) return [];
  if (!Array.isArray(rollbacks) || rollbacks.length !== audit.referrals.length) return fail('缺少实际返佣撤回凭据');
  const used = new Set<string>();
  return audit.referrals.map((referral) => {
    const matches = rollbacks.filter((value) => record(value) && value.kind === referral.kind);
    const value = matches[0];
    if (matches.length !== 1 || !record(value) || !referral.transactionId ||
        value.originalTransactionId !== referral.transactionId || value.originalInviterId !== referral.inviterId ||
        !money(value.amount, '返佣撤回金额缺失').eq(referral.amount) ||
        typeof value.reversalTransactionId !== 'string' || !value.reversalTransactionId ||
        used.has(value.reversalTransactionId) || audit.referrals.some((item) => item.transactionId === value.reversalTransactionId)) fail('返佣撤回凭据不一致');
    used.add(value.reversalTransactionId);
    return { ...referral, reversalTransactionId: value.reversalTransactionId };
  });
}

export function summarizeOrderRevenue(
  originalRows: OrderRevenueSourceRow[],
  reversals: OrderRevenueReversalSourceRow[],
  params: OrderRevenueParams,
) {
  const excluded = new Set(params.excludeDiscordIds ?? []);
  const orderRows: Array<Omit<ReturnType<typeof readAudit>, 'referrals'>> = [];
  const revertedOrderRows: Array<{
    orderId: string; auditId: string; revertId: string; originalTransactionId: string;
    createdAt: Date; originalCreatedAt: Date; grossAmount: Prisma.Decimal; netAmount: Prisma.Decimal; feeAmount: Prisma.Decimal;
  }> = [];
  const referralRows: OrderReferralPosting[] = [];
  const originalIds = new Set<string>();
  const reversalIds = new Set<string>();
  for (const row of originalRows) {
    const audit = readAudit(row);
    if (!inRange(audit.createdAt, params) || audit.createdAt <= NEW_ENTITY_OPERATIONS_STARTED_AT) continue;
    if (originalIds.has(audit.orderId)) fail('重复原订单审计');
    originalIds.add(audit.orderId);
    const { referrals, ...original } = audit;
    orderRows.push(original);
    for (const referral of referrals) {
      if (excluded.has(referral.inviterId)) continue;
      referralRows.push({ id: `${audit.auditId}:${referral.kind}`, orderId: audit.orderId, phase: 'original', kind: referral.kind,
        inviterId: referral.inviterId, amount: referral.amount, createdAt: audit.createdAt,
        originalTransactionId: referral.transactionId, reversalTransactionId: null });
    }
  }
  for (const row of reversals) {
    if (row.revertStatus !== 'SUCCESS' || !inRange(date(row.revertCreatedAt, '撤销时间缺失'), params)) continue;
    const audit = readAudit(row);
    if (audit.createdAt <= NEW_ENTITY_OPERATIONS_STARTED_AT) continue;
    if (row.originalTransactionId !== `ORDER:${audit.orderId}` || !row.revertId || reversalIds.has(row.originalTransactionId)) fail('重复或错误的订单撤销标记');
    reversalIds.add(row.originalTransactionId);
    if (row.revertCreatedAt < audit.createdAt) fail('撤销时间早于原结算');
    const referrals = readReversalReferrals(row, audit);
    revertedOrderRows.push({ orderId: audit.orderId, auditId: audit.auditId, revertId: row.revertId,
      originalTransactionId: row.originalTransactionId, createdAt: row.revertCreatedAt, originalCreatedAt: audit.createdAt,
      grossAmount: audit.grossAmount, netAmount: audit.netAmount, feeAmount: audit.feeAmount });
    for (const referral of referrals) {
      if (excluded.has(referral.inviterId)) continue;
      referralRows.push({ id: `${row.revertId}:${referral.kind}`, orderId: audit.orderId, phase: 'reversal', kind: referral.kind,
        inviterId: referral.inviterId, amount: referral.amount.neg(), createdAt: row.revertCreatedAt,
        originalTransactionId: referral.transactionId, reversalTransactionId: referral.reversalTransactionId });
    }
  }
  const sum = <T>(rows: T[], select: (row: T) => Prisma.Decimal) => rows.reduce((total, row) => total.add(select(row)), new Prisma.Decimal(0));
  const orderGross = sum(orderRows, (row) => row.grossAmount);
  const orderNet = sum(orderRows, (row) => row.netAmount);
  const orderFee = sum(orderRows, (row) => row.feeAmount);
  const revertedOrderGross = sum(revertedOrderRows, (row) => row.grossAmount);
  const revertedOrderNet = sum(revertedOrderRows, (row) => row.netAmount);
  const revertedOrderFee = sum(revertedOrderRows, (row) => row.feeAmount);
  return { orderRows, revertedOrderRows, referralRows,
    orderGross, orderNet, orderFee, revertedOrderGross, revertedOrderNet, revertedOrderFee,
    orderGrossNet: orderGross.sub(revertedOrderGross), orderNetNet: orderNet.sub(revertedOrderNet), orderFeeNet: orderFee.sub(revertedOrderFee),
    referralExpense: { reason: '邀请返现（订单）', count: referralRows.length, amount: sum(referralRows, (row) => row.amount) },
  };
}

const AUDIT_COLUMNS = Prisma.sql`
  o."id" AS "orderId", o."status" AS "orderStatus", o."displayNo", o."endedAt",
  oa."paymentTransactionId", oa."id" AS "auditId", oa."orderId" AS "auditOrderId", oa."createdAt" AS "auditCreatedAt",
  oa."gross", oa."netAmount", oa."feeAmount", oa."hostId", oa."workerId",
  oa."bossReferralInviterId", oa."bossReferralAmount", oa."workerReferralInviterId", oa."workerReferralAmount",
  oa."auditVersion", oa."referralLedgerFacts"`;

/** Inject the database query boundary so offline tests exercise these exact
 * production queries and aggregation, without importing or connecting Prisma. */
export async function loadOrderRevenueSources(client: QueryClient, params: OrderRevenueParams) {
  const [originals, reversals] = await Promise.all([
    client.$queryRaw<OrderRevenueSourceRow[]>(Prisma.sql`
      SELECT ${AUDIT_COLUMNS}
      FROM "order_audit" oa FULL OUTER JOIN "Order" o ON o."id" = oa."orderId"
      WHERE (oa."createdAt" >= ${params.start} AND oa."createdAt" < ${params.end})
        OR (o."status" = 'ENDED' AND o."endedAt" >= ${params.start} AND o."endedAt" < ${params.end})
      ORDER BY oa."createdAt" DESC
    `),
    client.$queryRaw<OrderRevenueReversalSourceRow[]>(Prisma.sql`
      SELECT ${AUDIT_COLUMNS}, r."id" AS "revertId", r."originalTransactionId",
        r."createdAt" AS "revertCreatedAt", r."status" AS "revertStatus", r."details"
      FROM "revert" r
      LEFT JOIN "order_audit" oa ON r."originalTransactionId" = CONCAT('ORDER:', oa."orderId")
      LEFT JOIN "Order" o ON o."id" = oa."orderId"
      WHERE r."status" = 'SUCCESS' AND r."originalTransactionId" LIKE 'ORDER:%'
        AND r."createdAt" >= ${params.start} AND r."createdAt" < ${params.end}
      ORDER BY r."createdAt" DESC
    `),
  ]);
  return { originals, reversals };
}

export async function loadOrderRevenue(client: QueryClient, params: OrderRevenueParams) {
  const { originals, reversals } = await loadOrderRevenueSources(client, params);
  return summarizeOrderRevenue(originals, reversals, params);
}


export function summarizeOrderRevenuePartial(originals: OrderRevenueSourceRow[], reversals: OrderRevenueReversalSourceRow[],
  params: OrderRevenueParams, blockedOrderIds: ReadonlySet<string> = new Set()) {
  type Item = { phase: 'original' | 'reversal'; row: OrderRevenueSourceRow | OrderRevenueReversalSourceRow };
  const items: Item[] = [...originals.map(row => ({ phase: 'original' as const, row })), ...reversals.map(row => ({ phase: 'reversal' as const, row }))];
  const orderIdsFor = ({ row }: Item) => uniqueIds([row.orderId, row.auditOrderId,
    'originalTransactionId' in row ? orderFromKey(row.originalTransactionId) : null]);
  const keysFor = (item: Item) => {
    const { row } = item; const facts = asRecord(row.referralLedgerFacts);
    const receipts = ['boss', 'worker'].map(kind => stringId(asRecord(facts?.[kind])?.transactionId));
    const rollbacks = 'details' in row ? asRecord(row.details)?.referralRollbacks : null;
    if (Array.isArray(rollbacks)) for (const value of rollbacks) receipts.push(stringId(asRecord(value)?.originalTransactionId), stringId(asRecord(value)?.reversalTransactionId));
    return [...orderIdsFor(item).map(id => `order:${id}`), ...uniqueIds([row.auditId]).map(id => `audit:${id}`),
      ...uniqueIds(receipts).map(id => `receipt:${id}`), ...('revertId' in row ? [`revert:${row.revertId}`] : [])];
  };
  const validOriginals: OrderRevenueSourceRow[] = []; const validReversals: OrderRevenueReversalSourceRow[] = [];
  const issues: ReportFactIssue[] = [];
  const blockedCommissionTransactionIds = new Set<string>();
  let commissionUnattributed = false;
  for (const group of groupReportFacts(items, keysFor)) {
    const orderIds = uniqueIds(group.flatMap(orderIdsFor));
    const ids = uniqueIds(group.flatMap(({ row }) => [row.orderId, row.auditId, 'revertId' in row ? row.revertId : null]));
    const groupOriginals = group.filter(item => item.phase === 'original').map(item => item.row);
    const groupReversals = group.filter(item => item.phase === 'reversal').map(item => item.row as OrderRevenueReversalSourceRow);
    try {
      if (orderIds.some(id => blockedOrderIds.has(id))) fail('同原单关联的折扣或撤销凭据待核实');
      // Shared audit/receipt identities cannot legitimately belong to different orders.
      if (orderIds.length > 1) fail('跨订单共用或冲突的审计／流水编号');
      const snapshots = new Map<string, string>();
      for (const { row } of group) {
        if (!row.auditId) continue;
        const snapshot = JSON.stringify([row.orderId, row.auditOrderId, row.auditCreatedAt, row.gross, row.netAmount,
          row.feeAmount, row.hostId, row.workerId, row.bossReferralInviterId, row.bossReferralAmount,
          row.workerReferralInviterId, row.workerReferralAmount, row.auditVersion, row.referralLedgerFacts]);
        if (snapshots.has(row.auditId) && snapshots.get(row.auditId) !== snapshot) fail('同一审计的原始与撤销快照不一致');
        snapshots.set(row.auditId, snapshot);
      }
      summarizeOrderRevenue(groupOriginals, groupReversals, params);
      validOriginals.push(...groupOriginals); validReversals.push(...groupReversals);
    } catch (error) {
      if (!(error instanceof OrderRevenueFactsError)) throw error;
      issues.push({ source: 'order', ids, orderIds, reason: error.message });
      for (const item of group) {
        if (item.row.paymentTransactionId) blockedCommissionTransactionIds.add(item.row.paymentTransactionId);
        else commissionUnattributed = true;
      }
    }
  }
  return { ...summarizeOrderRevenue(validOriginals, validReversals, params), issues,
    blockedOrderIds: new Set(issues.flatMap(issue => issue.orderIds)), blockedCommissionTransactionIds, commissionUnattributed };
}
