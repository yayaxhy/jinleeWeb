import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';

const DEC = (value: Prisma.Decimal | number | string | null | undefined) =>
  value instanceof Prisma.Decimal ? value : new Prisma.Decimal(value ?? 0);

const requireMatched = (result: { count: number }) => {
  if (result.count !== 1) throw new Error('资产权益在转移期间发生变化，请刷新并重新核实后再转移。');
};

// Wallet locks do not cover every voucher issuer/consumer. Each write and source
// removal compares the values we actually read; concurrent changes abort the
// owning transaction instead of losing newly granted or consumed benefits.
export const syncAssetTransferBuffsTx = async (
  tx: Prisma.TransactionClient,
  sourceDiscordId: string,
  targetDiscordId: string,
  warnings: string[],
  now = new Date(),
) => {
  const [sourceCommissionBuff, targetCommissionBuff, sourceFlowBuff, sourceSpendBuff, sourceAutoCommissionBuff, targetAutoCommissionBuff] =
    await Promise.all([
      tx.commissionBuff.findUnique({ where: { userId: sourceDiscordId } }),
      tx.commissionBuff.findUnique({ where: { userId: targetDiscordId } }),
      tx.flowBuff.findUnique({ where: { userId: sourceDiscordId } }),
      tx.spendBuff.findUnique({ where: { userId: sourceDiscordId } }),
      tx.autoCommissionBuff.findUnique({ where: { userId: sourceDiscordId }, select: { activeUntil: true } }),
      tx.autoCommissionBuff.findUnique({ where: { userId: targetDiscordId }, select: { activeUntil: true } }),
    ]);

  const changed = {
    commissionBuffTransferred: 0,
    commissionBuffCleared: 0,
    flowBuffTransferred: 0,
    flowBuffCleared: 0,
    spendBuffTransferred: 0,
    spendBuffCleared: 0,
  };

  const sourceCommissionActive = Boolean(sourceCommissionBuff?.expiresAt && sourceCommissionBuff.expiresAt > now);
  const targetCommissionActive = Boolean(targetCommissionBuff?.expiresAt && targetCommissionBuff.expiresAt > now);
  if (sourceCommissionActive && sourceCommissionBuff) {
    const expiresAt =
      targetCommissionActive && targetCommissionBuff && targetCommissionBuff.expiresAt > sourceCommissionBuff.expiresAt
        ? targetCommissionBuff.expiresAt
        : sourceCommissionBuff.expiresAt;
    const data = { boost: sourceCommissionBuff.boost, expiresAt };
    if (targetCommissionBuff) {
      requireMatched(await tx.commissionBuff.updateMany({
        where: { userId: targetDiscordId, boost: targetCommissionBuff.boost, expiresAt: targetCommissionBuff.expiresAt },
        data,
      }));
    } else {
      await tx.commissionBuff.create({ data: { userId: targetDiscordId, ...data } });
    }
    changed.commissionBuffTransferred = 1;
  }
  if (sourceCommissionBuff) {
    requireMatched(await tx.commissionBuff.deleteMany({
      where: { userId: sourceDiscordId, boost: sourceCommissionBuff.boost, expiresAt: sourceCommissionBuff.expiresAt },
    }));
    changed.commissionBuffCleared = 1;
  }

  // Preserve legacy ordinary balances as separate ordinary batches. Neither
  // target legacy balances nor any expiry is merged, extended or revived.
  for (const [kind, source] of [['flow', sourceFlowBuff], ['spend', sourceSpendBuff]] as const) {
    if (!source) continue;
    const remaining = DEC(source.remainingExtra);
    if (!remaining.isFinite() || remaining.lt(0)) throw new Error('资产权益额度异常，请核实后再转移。');
    if (remaining.gt(0)) {
      await tx.manualQuotaBatch.create({ data: { id: randomUUID(), userId: targetDiscordId, kind,
        remainingExtra: remaining, expiresAt: source.expiresAt, createdAt: source.createdAt } });
      changed[kind === 'flow' ? 'flowBuffTransferred' : 'spendBuffTransferred'] = 1;
    }
    // Keep the locked anchor; a later grant must not recreate or renew it.
    const args = { where: { userId: sourceDiscordId, remainingExtra: source.remainingExtra, expiresAt: source.expiresAt }, data: { remainingExtra: new Prisma.Decimal(0) } };
    requireMatched(kind === 'flow' ? await tx.flowBuff.updateMany(args) : await tx.spendBuff.updateMany(args));
    changed[kind === 'flow' ? 'flowBuffCleared' : 'spendBuffCleared'] = 1;
  }

  if ((sourceAutoCommissionBuff?.activeUntil && sourceAutoCommissionBuff.activeUntil > now) || (targetAutoCommissionBuff?.activeUntil && targetAutoCommissionBuff.activeUntil > now)) {
    warnings.push('自动 91% 抽成未参与资产转移，仍按各账号自身历史收入窗口重算。');
  }

  return changed;
};
