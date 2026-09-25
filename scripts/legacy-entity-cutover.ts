import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { gzip } from 'node:zlib';
import { config } from 'dotenv';
import { Prisma, PrismaClient } from '@prisma/client';
import { NEW_ENTITY_OPERATIONS_STARTED_AT } from '@/lib/operating-entity-cutover';

config({ path: '.env.local' });
config({ path: '.env' });

const prisma = new PrismaClient();
const gzipAsync = promisify(gzip);
const ZERO = new Prisma.Decimal(0);

const hasArg = (flag: string) => process.argv.includes(flag);

const getArg = (flag: string) => {
  const prefix = `${flag}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length) ?? null;
};

const toJson = (value: unknown) =>
  JSON.stringify(value, (_key, item) => {
    if (item instanceof Prisma.Decimal) return item.toString();
    if (typeof item === 'bigint') return item.toString();
    return item;
  });

const effectiveBalance = (user: {
  totalBalance: Prisma.Decimal;
  member: { totalBalance: Prisma.Decimal } | null;
}) => user.member?.totalBalance ?? user.totalBalance;

const getOutputDirectory = (cutoverAt: Date) => {
  const configured = getArg('--output-dir');
  if (configured) return path.resolve(configured);
  const stamp = cutoverAt.toISOString().replace(/[:.]/g, '-');
  return path.join(process.cwd(), 'artifacts', 'legacy-entity-cutover', stamp);
};

async function exportLegacyLedger(params: {
  cutoverAt: Date;
  outputDir: string;
  preCutoverWallets: unknown[];
  preCutoverPeiwanBalances: unknown[];
  settlement: {
    positiveBalanceCount: number;
    positiveBalanceTotal: string;
    negativeBalanceCount: number;
    negativeBalanceTotal: string;
    nonZeroIncomeCount: number;
  } | null;
}) {
  const cutoff = params.cutoverAt;
  const [
    individualTransactions,
    recharges,
    zpayRechargeOrders,
    stripePayments,
    wechatNativePayments,
    withdrawals,
    transfers,
    orders,
    giftAudits,
    orderAudits,
    commissions,
    expenses,
    pureProfits,
  ] = await Promise.all([
    prisma.individualTransaction.findMany({ where: { timeCreatedAt: { lte: cutoff } }, orderBy: { timeCreatedAt: 'asc' } }),
    prisma.recharge.findMany({ where: { createdAt: { lte: cutoff } }, orderBy: { createdAt: 'asc' } }),
    prisma.zPayRechargeOrder.findMany({ where: { createdAt: { lte: cutoff } }, orderBy: { createdAt: 'asc' } }),
    prisma.stripePayment.findMany({ where: { createdAt: { lte: cutoff } }, orderBy: { createdAt: 'asc' } }),
    prisma.wechatNativePayment.findMany({ where: { createdAt: { lte: cutoff } }, orderBy: { createdAt: 'asc' } }),
    prisma.withdraw.findMany({ where: { createdAt: { lte: cutoff } }, orderBy: { createdAt: 'asc' } }),
    prisma.transaction.findMany({ where: { createdAt: { lte: cutoff } }, orderBy: { createdAt: 'asc' } }),
    prisma.order.findMany({ where: { createdAt: { lte: cutoff } }, orderBy: { createdAt: 'asc' } }),
    prisma.giftAudit.findMany({ where: { createdAt: { lte: cutoff } }, orderBy: { createdAt: 'asc' } }),
    prisma.orderAudit.findMany({ where: { createdAt: { lte: cutoff } }, orderBy: { createdAt: 'asc' } }),
    prisma.commission.findMany({ where: { createdAt: { lte: cutoff } }, orderBy: { createdAt: 'asc' } }),
    prisma.expense.findMany({ where: { createdAt: { lte: cutoff } }, orderBy: { createdAt: 'asc' } }),
    prisma.pureProfit.findMany({ where: { createdAt: { lte: cutoff } }, orderBy: { createdAt: 'asc' } }),
  ]);

  const ledger = {
    generatedAt: new Date().toISOString(),
    cutoverAt: cutoff.toISOString(),
    scope: '旧主体账务归档；所有记录均不晚于切换时点。',
    settlement: params.settlement,
    preCutoverWallets: params.preCutoverWallets,
    preCutoverPeiwanBalances: params.preCutoverPeiwanBalances,
    records: {
      individualTransactions,
      recharges,
      zpayRechargeOrders,
      stripePayments,
      wechatNativePayments,
      withdrawals,
      transfers,
      orders,
      giftAudits,
      orderAudits,
      commissions,
      expenses,
      pureProfits,
    },
  };

  const json = toJson(ledger);
  const compressed = await gzipAsync(json, { level: 9 });
  const sha256 = createHash('sha256').update(compressed).digest('hex');
  await mkdir(params.outputDir, { recursive: true });
  await writeFile(path.join(params.outputDir, 'old-entity-ledger.json.gz'), compressed);
  await writeFile(
    path.join(params.outputDir, 'manifest.json'),
    toJson({
      cutoverAt: cutoff.toISOString(),
      archive: 'old-entity-ledger.json.gz',
      sha256,
      bytes: compressed.byteLength,
      recordCounts: Object.fromEntries(
        Object.entries(ledger.records).map(([name, rows]) => [name, rows.length]),
      ),
      settlement: params.settlement,
    }),
  );

  return { sha256, bytes: compressed.byteLength, counts: Object.fromEntries(Object.entries(ledger.records).map(([name, rows]) => [name, rows.length])) };
}

async function settleBalances(cutoverAt: Date) {
  return prisma.$transaction(
    async (tx) => {
      await tx.$executeRawUnsafe('LOCK TABLE "JinleeUser", "Member", "PEIWAN", "IndividualTransaction" IN SHARE ROW EXCLUSIVE MODE');

      const [users, peiwan] = await Promise.all([
        tx.jinleeUser.findMany({
          select: {
            jinleeId: true,
            discordUserId: true,
            totalBalance: true,
            income: true,
            recharge: true,
            totalSpent: true,
            loyaltyPoints: true,
            member: { select: { totalBalance: true, income: true, recharge: true, totalSpent: true } },
          },
          orderBy: { jinleeId: 'asc' },
        }),
        tx.pEIWAN.findMany({
          select: { PEIWANID: true, discordUserId: true, balance: true, totalEarn: true, member: { select: { totalBalance: true } } },
          orderBy: { PEIWANID: 'asc' },
        }),
      ]);

      const preCutoverWallets = users.map((user) => ({
        jinleeId: user.jinleeId,
        discordUserId: user.discordUserId,
        totalBalance: effectiveBalance(user).toString(),
        income: (user.member?.income ?? user.income).toString(),
        recharge: (user.member?.recharge ?? user.recharge).toString(),
        totalSpent: (user.member?.totalSpent ?? user.totalSpent).toString(),
        loyaltyPoints: user.loyaltyPoints.toString(),
      }));
      const preCutoverPeiwanBalances = peiwan.map((row) => ({
        peiwanId: row.PEIWANID,
        discordUserId: row.discordUserId,
        balance: row.balance.toString(),
        memberBalance: row.member.totalBalance.toString(),
        totalEarn: row.totalEarn.toString(),
      }));

      const settlementRows = users
        .map((user) => ({ user, balance: effectiveBalance(user) }))
        .filter(({ balance }) => !balance.eq(ZERO));
      const positive = settlementRows.filter(({ balance }) => balance.gt(ZERO));
      const negative = settlementRows.filter(({ balance }) => balance.lt(ZERO));
      const nonZeroIncomeCount = users.filter((user) => !(user.member?.income ?? user.income).eq(ZERO)).length;

      await tx.individualTransaction.createMany({
        data: settlementRows.map(({ user, balance }) => ({
          discordId: user.discordUserId,
          jinleeId: user.jinleeId,
          thirdPartydiscordId: user.discordUserId ?? 'SYSTEM',
          balanceBefore: balance,
          amountChange: balance.negated(),
          balanceAfter: ZERO,
          typeOfTransaction: balance.gt(ZERO) ? '锦鲤余额退回' : '锦鲤支出',
          timeCreatedAt: cutoverAt,
        })),
      });

      await Promise.all([
        tx.jinleeUser.updateMany({ data: { income: ZERO, recharge: ZERO } }),
        tx.member.updateMany({ data: { income: ZERO, recharge: ZERO } }),
        tx.pEIWAN.updateMany({ data: { balance: ZERO } }),
      ]);

      return {
        preCutoverWallets,
        preCutoverPeiwanBalances,
        settlement: {
          positiveBalanceCount: positive.length,
          positiveBalanceTotal: positive.reduce((total, { balance }) => total.add(balance), ZERO).toString(),
          negativeBalanceCount: negative.length,
          negativeBalanceTotal: negative.reduce((total, { balance }) => total.add(balance), ZERO).toString(),
          nonZeroIncomeCount,
        },
      };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 30_000, timeout: 120_000 },
  );
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');

  const execute = hasArg('--execute');
  const requestedCutover = getArg('--cutover-at');
  const cutoverAt = requestedCutover ? new Date(requestedCutover) : NEW_ENTITY_OPERATIONS_STARTED_AT;
  if (Number.isNaN(cutoverAt.getTime())) throw new Error('--cutover-at must be an ISO-8601 timestamp');
  if (cutoverAt.getTime() > Date.now()) throw new Error('Cutover time cannot be in the future');

  if (!execute) {
    console.log(JSON.stringify({ dryRun: true, cutoverAt: cutoverAt.toISOString(), command: 'Legacy cutover is already complete; this command is retained for an audited recovery workflow.' }));
    return;
  }

  const completedSettlementRows = await prisma.individualTransaction.count({
    where: {
      timeCreatedAt: cutoverAt,
      typeOfTransaction: { in: ['锦鲤余额退回', '锦鲤支出'] },
    },
  });
  if (completedSettlementRows > 0) {
    throw new Error(`Legacy cutover already completed (${completedSettlementRows} settlement rows at ${cutoverAt.toISOString()}).`);
  }

  const result = await settleBalances(cutoverAt);
  const outputDir = getOutputDirectory(cutoverAt);
  const archive = await exportLegacyLedger({ cutoverAt, outputDir, ...result });
  console.log(JSON.stringify({ executed: true, cutoverAt: cutoverAt.toISOString(), outputDir, settlement: result.settlement, archive }));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.stack ?? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
