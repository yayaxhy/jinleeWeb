import { giftWallTransferHasEvidenceConflict } from './gift-wall-transfer-guard';
import { MemberStatus, OrderStatus, PeiwanStatus, Prisma, type PrismaClient } from '@prisma/client';
import { applyDlmWalletDeltaTx, getDlmWalletSnapshotTx } from '@/lib/dlm-wallet';
import { getHighestVipLevelByTotalSpent } from '@/lib/vip-levels';
import { DlmWalletIdentityChangedError, lockDlmWalletsTx } from '@/lib/dlm-wallet-lock';
import { syncAssetTransferBuffsTx } from '@/lib/admin-asset-transfer-buffs';
import { summarizeManualQuota, type ManualQuotaPeriod } from '@/lib/manual-quota-view';
import { lockManualQuotaOwnersTx, moveManualQuotaBatchesTx, moveManualQuotaRestorationsTx } from '@/lib/manual-quota-transfer';

const DEC = (value: Prisma.Decimal | number | string | null | undefined) =>
  value instanceof Prisma.Decimal ? value : new Prisma.Decimal(value ?? 0);

const DEFAULT_COMMISSION_RATE = new Prisma.Decimal('0.75');

type DbClient = PrismaClient | Prisma.TransactionClient;

type WalletSummary = {
  totalBalance: string;
  income: string;
  recharge: string;
  totalSpent: string;
  loyaltyPoints: string;
};

type CommissionSummary = {
  currentRate: string;
  baseRate: string;
  isPeiwan: boolean;
  peiwanId: number | null;
};

type PeiwanSummary = {
  exists: boolean;
  peiwanId: number | null;
  totalEarn: string;
  balance: string;
  hasMpUrl: boolean;
  hasVoicePreview: boolean;
  auditionInviteEnabled: boolean;
  status: string | null;
  exclusive: boolean;
  type: string | null;
  level: string | null;
  gameProfileCount: number;
};

type HeartSummary = {
  outgoingPairs: number;
  incomingPairs: number;
  maxSent: number;
  maxReceived: number;
};

type BuffSummary = {
  commissionBoostExpiresAt: string | null;
  flowRemaining: string;
  flowExpiresAt: string | null;
  flowPeriods: ManualQuotaPeriod[];
  spendRemaining: string;
  spendExpiresAt: string | null;
  spendPeriods: ManualQuotaPeriod[];
  autoCommissionActiveUntil: string | null;
};

export type AssetAccountSummary = {
  discordId: string;
  exists: boolean;
  memberExists: boolean;
  dlmId: string | null;
  serverDisplayName: string | null;
  memberStatus: string | null;
  wallet: WalletSummary;
  vip: {
    derivedLevel: number;
    lastSettledLevel: number;
    roleOptOut: boolean;
    announcementEnabled: boolean;
    hasDispatchImage: boolean;
  };
  heart: HeartSummary;
  commission: CommissionSummary;
  peiwan: PeiwanSummary;
  buffs: BuffSummary;
  hasTransferableData: boolean;
};

export type AssetTransferExecutionResult = {
  auditId: string;
  source: AssetAccountSummary;
  target: AssetAccountSummary;
  transferred: {
    totalBalance: string;
    income: string;
    recharge: string;
    totalSpent: string;
    loyaltyPoints: string;
    vipLevelAfter: number;
    peiwanTransferred: boolean;
    peiwanId: number | null;
    peiwanTotalEarn: string | null;
  };
  changed: Record<string, number>;
  warnings: string[];
};

export class AssetTransferValidationError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 404 | 409 = 400,
    readonly forceMergeSummaries?: { source: AssetAccountSummary; target: AssetAccountSummary },
  ) {
    super(message);
    this.name = 'AssetTransferValidationError';
  }
}

const hasNonDefaultVipState = (summary: AssetAccountSummary['vip']) =>
  summary.lastSettledLevel > 0 ||
  summary.roleOptOut ||
  !summary.announcementEnabled ||
  summary.hasDispatchImage;

const serializeWallet = (
  totalBalance: Prisma.Decimal | number | string | null | undefined,
  income: Prisma.Decimal | number | string | null | undefined,
  recharge: Prisma.Decimal | number | string | null | undefined,
  totalSpent: Prisma.Decimal | number | string | null | undefined,
  loyaltyPoints: Prisma.Decimal | number | string | null | undefined,
): WalletSummary => ({
  totalBalance: DEC(totalBalance).toString(),
  income: DEC(income).toString(),
  recharge: DEC(recharge).toString(),
  totalSpent: DEC(totalSpent).toString(),
  loyaltyPoints: DEC(loyaltyPoints).toString(),
});

export const loadAssetAccountSummary = async (
  client: DbClient,
  discordId: string,
): Promise<AssetAccountSummary> => {
  const now = new Date();

  const [
    member,
    dlmUser,
    loyaltyPoint,
    vipProfile,
    commissionBuff,
    flowBuff,
    spendBuff,
    quotaRestorations,
    ordinaryQuotaBatches,
    autoCommissionBuff,
    peiwan,
    outgoingPairs,
    incomingPairs,
    maxSent,
    maxReceived,
  ] =
    await Promise.all([
      client.member.findUnique({
        where: { discordUserId: discordId },
        select: {
          discordUserId: true,
          status: true,
          serverDisplayName: true,
          totalBalance: true,
          income: true,
          recharge: true,
          totalSpent: true,
          commissionRate: true,
          baseCommissionRate: true,
          peiwan: {
            select: {
              PEIWANID: true,
            },
          },
        },
      }),
      client.dlmUser.findUnique({
        where: { discordUserId: discordId },
        select: {
          dlmId: true,
          totalBalance: true,
          income: true,
          recharge: true,
          totalSpent: true,
          loyaltyPoints: true,
        },
      }),
      client.loyaltyPoint.findUnique({
        where: { discordUserId: discordId },
        select: { points: true },
      }),
      client.vipBenefitProfile.findUnique({
        where: { discordUserId: discordId },
        select: {
          roleOptOut: true,
          announcementEnabled: true,
          lastSettledVipLevel: true,
          dispatchImageUrl: true,
        },
      }),
      client.commissionBuff.findUnique({
        where: { userId: discordId },
        select: { boost: true, expiresAt: true },
      }),
      client.flowBuff.findUnique({
        where: { userId: discordId },
        select: { remainingExtra: true, expiresAt: true },
      }),
      client.spendBuff.findUnique({
        where: { userId: discordId },
        select: { remainingExtra: true, expiresAt: true },
      }),
      client.manualQuotaRestoration.findMany({ where: { userId: discordId } }),
      client.manualQuotaBatch.findMany({ where: { userId: discordId } }),
      client.autoCommissionBuff.findUnique({
        where: { userId: discordId },
        select: { activeUntil: true },
      }),
      client.pEIWAN.findUnique({
        where: { discordUserId: discordId },
        select: {
          PEIWANID: true,
          totalEarn: true,
          balance: true,
          MP_url: true,
          voicePreviewUrl: true,
          voicePreviewFilename: true,
          auditionInviteEnabled: true,
          status: true,
          exclusive: true,
          type: true,
          level: true,
          _count: {
            select: {
              gameProfiles: true,
            },
          },
        },
      }),
      client.heartCounter.count({ where: { fromMemberId: discordId } }),
      client.heartCounter.count({ where: { toMemberId: discordId } }),
      client.heartCounter.aggregate({
        where: { fromMemberId: discordId },
        _max: { total: true },
      }),
      client.heartCounter.aggregate({
        where: { toMemberId: discordId },
        _max: { total: true },
      }),
    ]);

  const wallet = serializeWallet(
    member?.totalBalance ?? dlmUser?.totalBalance,
    member?.income ?? dlmUser?.income,
    member?.recharge ?? dlmUser?.recharge,
    member?.totalSpent ?? dlmUser?.totalSpent,
    loyaltyPoint?.points ?? dlmUser?.loyaltyPoints,
  );

  const vipDerivedLevel = getHighestVipLevelByTotalSpent(wallet.totalSpent);
  const vip = {
    derivedLevel: vipDerivedLevel,
    lastSettledLevel: Math.max(0, vipProfile?.lastSettledVipLevel ?? 0),
    roleOptOut: vipProfile?.roleOptOut === true,
    announcementEnabled: vipProfile?.announcementEnabled !== false,
    hasDispatchImage: Boolean(vipProfile?.dispatchImageUrl),
  };

  const heart = {
    outgoingPairs: outgoingPairs,
    incomingPairs: incomingPairs,
    maxSent: Number(maxSent._max.total ?? 0),
    maxReceived: Number(maxReceived._max.total ?? 0),
  };

  const peiwanSummary = {
    exists: Boolean(peiwan),
    peiwanId: peiwan?.PEIWANID ?? null,
    totalEarn: DEC(peiwan?.totalEarn).toString(),
    balance: DEC(peiwan?.balance).toString(),
    hasMpUrl: Boolean(peiwan?.MP_url),
    hasVoicePreview: Boolean(peiwan?.voicePreviewUrl || peiwan?.voicePreviewFilename),
    auditionInviteEnabled: peiwan?.auditionInviteEnabled === true,
    status: peiwan?.status ?? null,
    exclusive: peiwan?.exclusive === true,
    type: peiwan?.type ?? null,
    level: peiwan?.level ?? null,
    gameProfileCount: peiwan?._count.gameProfiles ?? 0,
  } satisfies PeiwanSummary;

  const flowQuota = summarizeManualQuota(flowBuff, quotaRestorations.filter((row) => row.kind === 'flow'), now, ordinaryQuotaBatches.filter(row => row.kind === 'flow'));
  const spendQuota = summarizeManualQuota(spendBuff, quotaRestorations.filter((row) => row.kind === 'spend'), now, ordinaryQuotaBatches.filter(row => row.kind === 'spend'));
  const buffs = {
    commissionBoostExpiresAt: commissionBuff?.expiresAt && commissionBuff.expiresAt > now ? commissionBuff.expiresAt.toISOString() : null,
    flowRemaining: flowQuota.remaining,
    flowExpiresAt: flowQuota.nextExpiresAt,
    flowPeriods: flowQuota.periods,
    spendRemaining: spendQuota.remaining,
    spendExpiresAt: spendQuota.nextExpiresAt,
    spendPeriods: spendQuota.periods,
    autoCommissionActiveUntil:
      autoCommissionBuff?.activeUntil && autoCommissionBuff.activeUntil > now
        ? autoCommissionBuff.activeUntil.toISOString()
        : null,
  };

  const hasTransferableData =
    DEC(wallet.totalBalance).gt(0) ||
    DEC(wallet.totalSpent).gt(0) ||
    DEC(wallet.loyaltyPoints).gt(0) ||
    hasNonDefaultVipState(vip) ||
    heart.outgoingPairs > 0 ||
    heart.incomingPairs > 0 ||
    !DEC(member?.baseCommissionRate ?? DEFAULT_COMMISSION_RATE).eq(DEFAULT_COMMISSION_RATE) ||
    Boolean(buffs.commissionBoostExpiresAt) ||
    DEC(buffs.flowRemaining).gt(0) ||
    DEC(buffs.spendRemaining).gt(0) ||
    peiwanSummary.exists;

  return {
    discordId,
    exists: Boolean(member || dlmUser),
    memberExists: Boolean(member),
    dlmId: dlmUser?.dlmId ?? null,
    serverDisplayName: member?.serverDisplayName ?? null,
    memberStatus: member?.status ?? null,
    wallet,
    vip,
    heart,
    commission: {
      currentRate: DEC(member?.commissionRate ?? DEFAULT_COMMISSION_RATE).toString(),
      baseRate: DEC(member?.baseCommissionRate ?? DEFAULT_COMMISSION_RATE).toString(),
      isPeiwan: Boolean(member?.peiwan),
      peiwanId: member?.peiwan?.PEIWANID ?? null,
    },
    peiwan: peiwanSummary,
    buffs,
    hasTransferableData,
  };
};

const movePeiwanUniqueRowsTx = async <Row extends { id: string }, Key extends string>(
  rows: readonly Row[],
  existingKeys: ReadonlySet<Key>,
  keyOf: (row: Row) => Key,
  move: (row: Row) => Promise<unknown>,
  drop: (row: Row) => Promise<unknown>,
) => {
  const targetKeys = new Set(existingKeys);
  let moved = 0;
  let deduped = 0;

  for (const row of rows) {
    const key = keyOf(row);
    if (targetKeys.has(key)) {
      await drop(row);
      deduped += 1;
      continue;
    }

    await move(row);
    targetKeys.add(key);
    moved += 1;
  }

  return { moved, deduped };
};

const mergeHeartCountersTx = async (
  tx: Prisma.TransactionClient,
  sourceDiscordId: string,
  targetDiscordId: string,
) => {
  const rows = await tx.heartCounter.findMany({
    where: {
      OR: [{ fromMemberId: sourceDiscordId }, { toMemberId: sourceDiscordId }],
    },
    select: {
      id: true,
      fromMemberId: true,
      toMemberId: true,
      total: true,
    },
  });

  let createdPairs = 0;
  let mergedPairs = 0;
  let selfLoopsDropped = 0;

  for (const row of rows) {
    const nextFrom = row.fromMemberId === sourceDiscordId ? targetDiscordId : row.fromMemberId;
    const nextTo = row.toMemberId === sourceDiscordId ? targetDiscordId : row.toMemberId;

    if (nextFrom === nextTo) {
      selfLoopsDropped += 1;
      continue;
    }

    const existing = await tx.heartCounter.findUnique({
      where: {
        fromMemberId_toMemberId: {
          fromMemberId: nextFrom,
          toMemberId: nextTo,
        },
      },
      select: { id: true },
    });

    if (existing) {
      await tx.heartCounter.update({
        where: { id: existing.id },
        data: { total: { increment: row.total } },
      });
      mergedPairs += 1;
      continue;
    }

    await tx.heartCounter.create({
      data: {
        fromMemberId: nextFrom,
        toMemberId: nextTo,
        total: row.total,
      },
    });
    createdPairs += 1;
  }

  if (rows.length > 0) {
    await tx.heartCounter.deleteMany({
      where: {
        id: { in: rows.map((row) => row.id) },
      },
    });
  }

  return {
    sourceRows: rows.length,
    createdPairs,
    mergedPairs,
    selfLoopsDropped,
  };
};

const transferPeiwanIdentityTx = async (
  tx: Prisma.TransactionClient,
  sourceDiscordId: string,
  targetDiscordId: string,
  targetBalanceAfter: Prisma.Decimal,
) => {
  const [sourcePeiwan, targetPeiwan, activeWorkerOrders, workerLockCount] = await Promise.all([
    tx.pEIWAN.findUnique({
      where: { discordUserId: sourceDiscordId },
      select: {
        PEIWANID: true,
        discordUserId: true,
        status: true,
      },
    }),
    tx.pEIWAN.findUnique({
      where: { discordUserId: targetDiscordId },
      select: { PEIWANID: true },
    }),
    tx.order.count({
      where: {
        workerId: sourceDiscordId,
        status: { in: [OrderStatus.PENDING, OrderStatus.RUNNING] },
      },
    }),
    tx.workerLock.count({
      where: { workerId: sourceDiscordId },
    }),
  ]);

  if (!sourcePeiwan) {
    return {
      transferred: false,
      peiwanId: null,
      totalEarn: null as string | null,
      sourceStatusReset: 0,
      targetStatusUpdated: 0,
      mainRecordMoved: 0,
      gameProfilesReassigned: 0,
      giftUnlocksMoved: 0,
      giftUnlocksDeduped: 0,
      giftRewardClaimsMoved: 0,
      giftRewardClaimsDeduped: 0,
      reviewsReassigned: 0,
      deletionRecordsReassigned: 0,
    };
  }

  if (targetPeiwan) {
    throw new Error('源账号存在陪玩身份，但目标账号已经有独立陪玩档案，当前不支持自动合并两套陪玩身份。');
  }

  if (sourcePeiwan.status !== PeiwanStatus.free || activeWorkerOrders > 0 || workerLockCount > 0) {
    throw new Error('源账号当前存在进行中的陪玩订单或锁定状态，请先结束相关业务后再执行资产转移。');
  }

  const [sourceUnlocks, targetUnlocks, sourceRewardClaims, targetRewardClaims] = await Promise.all([
    tx.peiwanGiftUnlock.findMany({
      where: { discordUserId: sourceDiscordId },
      select: { id: true, giftName: true, ownerDlmIdSnapshot: true, peiwanIdSnapshot: true, giftAuditIdSnapshot: true },
    }),
    tx.peiwanGiftUnlock.findMany({
      where: { discordUserId: targetDiscordId },
      select: { giftName: true, ownerDlmIdSnapshot: true, peiwanIdSnapshot: true, giftAuditIdSnapshot: true },
    }),
    tx.peiwanGiftRewardClaim.findMany({
      where: { discordUserId: sourceDiscordId },
      select: { id: true, rewardKey: true, ownerDlmIdSnapshot: true, peiwanIdSnapshot: true, giftAuditIdSnapshot: true, couponIds: true, rewardSnapshot: true },
    }),
    tx.peiwanGiftRewardClaim.findMany({
      where: { discordUserId: targetDiscordId },
      select: { rewardKey: true, ownerDlmIdSnapshot: true, peiwanIdSnapshot: true, giftAuditIdSnapshot: true, couponIds: true, rewardSnapshot: true },
    }),
  ]);

  if (giftWallTransferHasEvidenceConflict(sourceUnlocks, targetUnlocks, 'giftName') ||
      giftWallTransferHasEvidenceConflict(sourceRewardClaims, targetRewardClaims, 'rewardKey')) {
    throw new AssetTransferValidationError('礼物墙存在带原始归属或奖励凭证的重复记录，需要先核实，不能自动删除合并。', 409);
  }

  const unlockMoveSummary = await movePeiwanUniqueRowsTx(
    sourceUnlocks,
    new Set(targetUnlocks.map((row) => row.giftName)),
    (row) => row.giftName,
    (row) =>
      tx.peiwanGiftUnlock.update({
        where: { id: row.id },
        data: { discordUserId: targetDiscordId },
      }),
    (row) => tx.peiwanGiftUnlock.delete({ where: { id: row.id } }),
  );

  const rewardClaimMoveSummary = await movePeiwanUniqueRowsTx(
    sourceRewardClaims,
    new Set(targetRewardClaims.map((row) => row.rewardKey)),
    (row) => row.rewardKey,
    (row) =>
      tx.peiwanGiftRewardClaim.update({
        where: { id: row.id },
        data: { discordUserId: targetDiscordId },
      }),
    (row) => tx.peiwanGiftRewardClaim.delete({ where: { id: row.id } }),
  );

  const [movedPeiwan, gameProfiles, reviews, deletions] = await Promise.all([
    tx.pEIWAN.update({
      where: { PEIWANID: sourcePeiwan.PEIWANID },
      data: {
        discordUserId: targetDiscordId,
        balance: targetBalanceAfter,
      },
      select: {
        PEIWANID: true,
        totalEarn: true,
      },
    }),
    tx.peiwanGameProfile.updateMany({
      where: { peiwanId: sourcePeiwan.PEIWANID },
      data: { discordUserId: targetDiscordId },
    }),
    tx.peiwanReview.updateMany({
      where: { peiwanDiscordId: sourceDiscordId },
      data: { peiwanDiscordId: targetDiscordId },
    }),
    tx.peiwanDeletion.updateMany({
      where: { peiwanId: sourcePeiwan.PEIWANID },
      data: { discordUserId: targetDiscordId },
    }),
  ]);

  await Promise.all([
    tx.member.update({
      where: { discordUserId: sourceDiscordId },
        data: { status: MemberStatus.LAOBAN },
    }),
    tx.member.update({
      where: { discordUserId: targetDiscordId },
        data: { status: MemberStatus.PEIWAN },
    }),
  ]);

  return {
    transferred: true,
    peiwanId: movedPeiwan.PEIWANID,
    totalEarn: DEC(movedPeiwan.totalEarn).toString(),
    sourceStatusReset: 1,
    targetStatusUpdated: 1,
    mainRecordMoved: 1,
    gameProfilesReassigned: gameProfiles.count,
    giftUnlocksMoved: unlockMoveSummary.moved,
    giftUnlocksDeduped: unlockMoveSummary.deduped,
    giftRewardClaimsMoved: rewardClaimMoveSummary.moved,
    giftRewardClaimsDeduped: rewardClaimMoveSummary.deduped,
    reviewsReassigned: reviews.count,
    deletionRecordsReassigned: deletions.count,
  };
};

const syncCommissionConfigTx = async (
  tx: Prisma.TransactionClient,
  sourceDiscordId: string,
  targetDiscordId: string,
  warnings: string[],
) => {
  const [sourceMember, targetMember] = await Promise.all([
    tx.member.findUnique({
      where: { discordUserId: sourceDiscordId },
      select: {
        commissionRate: true,
        baseCommissionRate: true,
        peiwan: { select: { PEIWANID: true } },
      },
    }),
    tx.member.findUnique({
      where: { discordUserId: targetDiscordId },
      select: {
        commissionRate: true,
        baseCommissionRate: true,
        peiwan: { select: { PEIWANID: true } },
      },
    }),
  ]);

  if (!sourceMember || !targetMember) {
    return {
      sourceReset: 0,
      targetUpdated: 0,
      sourcePeiwanReset: 0,
      targetPeiwanUpdated: 0,
    };
  }

  const sourceBase = DEC(sourceMember.baseCommissionRate ?? DEFAULT_COMMISSION_RATE);

  await tx.member.update({
    where: { discordUserId: targetDiscordId },
    data: {
      commissionRate: sourceBase,
      baseCommissionRate: sourceBase,
    },
  });

  await tx.member.update({
    where: { discordUserId: sourceDiscordId },
    data: {
      commissionRate: DEFAULT_COMMISSION_RATE,
      baseCommissionRate: DEFAULT_COMMISSION_RATE,
    },
  });

  let targetPeiwanUpdated = 0;
  let sourcePeiwanReset = 0;

  if (targetMember.peiwan) {
    await tx.pEIWAN.update({
      where: { discordUserId: targetDiscordId },
      data: {
        commissionRate: sourceBase,
        baseCommissionRate: sourceBase,
      },
    });
    targetPeiwanUpdated = 1;
  }

  if (sourceMember.peiwan) {
    await tx.pEIWAN.update({
      where: { discordUserId: sourceDiscordId },
      data: {
        commissionRate: DEFAULT_COMMISSION_RATE,
        baseCommissionRate: DEFAULT_COMMISSION_RATE,
      },
    });
    sourcePeiwanReset = 1;
  }

  if (sourceMember.peiwan && !targetMember.peiwan) {
    warnings.push('目标账号当前不是陪玩档案，已转移会员基础抽成，但未写入 PEIWAN 专属抽成镜像。');
  }

  return {
    sourceReset: 1,
    targetUpdated: 1,
    sourcePeiwanReset,
    targetPeiwanUpdated,
  };
};

export const executeAssetTransfer = async (
  tx: Prisma.TransactionClient,
  params: {
    operatorDiscordId: string | null;
    sourceDiscordId: string;
    targetDiscordId: string;
    forceMerge: boolean;
  },
): Promise<AssetTransferExecutionResult> => {
  const warnings: string[] = [];

  if (params.sourceDiscordId === params.targetDiscordId) {
    throw new AssetTransferValidationError('源账号和目标账号不能相同');
  }
  // Only discover identities before locks. Preview summaries from the route
  // cannot authorize a later transfer or provide its wallet before-values.
  const [sourceIdentity, targetIdentity] = await Promise.all([
    tx.dlmUser.findUnique({ where: { discordUserId: params.sourceDiscordId }, select: { dlmId: true, discordUserId: true } }),
    tx.dlmUser.findUnique({ where: { discordUserId: params.targetDiscordId }, select: { dlmId: true, discordUserId: true } }),
  ]);
  if (!sourceIdentity) throw new AssetTransferValidationError('源账号不存在，或尚未建立 DLMClub 身份', 404);
  if (!targetIdentity) throw new AssetTransferValidationError('目标账号不存在，或尚未建立 DLMClub 身份', 404);
  try {
    await lockDlmWalletsTx(tx, [sourceIdentity, targetIdentity]);
  } catch (error) {
    if (error instanceof DlmWalletIdentityChangedError) {
      throw new AssetTransferValidationError('账号绑定状态已变化，请刷新并重新核实后再转移资产。', 409);
    }
    throw error;
  }
  const quotaLocks = await lockManualQuotaOwnersTx(tx, [params.sourceDiscordId, params.targetDiscordId]);

  const [sourceSummaryBefore, targetSummaryBefore, sourceDlmUser, targetDlmUser, sourceVipProfile, targetVipProfile, sourceLoyaltyPoint] =
    await Promise.all([
      loadAssetAccountSummary(tx, params.sourceDiscordId),
      loadAssetAccountSummary(tx, params.targetDiscordId),
      tx.dlmUser.findUnique({
        where: { discordUserId: params.sourceDiscordId },
        select: { dlmId: true },
      }),
      tx.dlmUser.findUnique({
        where: { discordUserId: params.targetDiscordId },
        select: { dlmId: true },
      }),
      tx.vipBenefitProfile.findUnique({
        where: { discordUserId: params.sourceDiscordId },
      }),
      tx.vipBenefitProfile.findUnique({
        where: { discordUserId: params.targetDiscordId },
      }),
      tx.loyaltyPoint.findUnique({
        where: { discordUserId: params.sourceDiscordId },
        select: { points: true },
      }),
    ]);

  if (!sourceSummaryBefore.memberExists || !sourceDlmUser?.dlmId) {
    throw new AssetTransferValidationError('源账号不存在，或尚未建立 DLMClub 身份', 404);
  }
  if (!targetSummaryBefore.memberExists || !targetDlmUser?.dlmId) {
    throw new AssetTransferValidationError('目标账号不存在，或尚未建立 DLMClub 身份', 404);
  }
  if (sourceDlmUser.dlmId !== sourceIdentity.dlmId || targetDlmUser.dlmId !== targetIdentity.dlmId) {
    throw new AssetTransferValidationError('账号绑定状态已变化，请刷新并重新核实后再转移资产。', 409);
  }
  if (sourceSummaryBefore.peiwan.exists && targetSummaryBefore.peiwan.exists) {
    throw new AssetTransferValidationError('源账号和目标账号都存在独立陪玩档案，当前不支持自动合并两套陪玩身份。');
  }
  if (!sourceSummaryBefore.hasTransferableData) {
    throw new AssetTransferValidationError('源账号当前没有可转移的资产');
  }
  if (targetSummaryBefore.hasTransferableData && !params.forceMerge) {
    throw new AssetTransferValidationError(
      '目标账号已经有可转移资产。确认后会按规则合并钱包/消费额/积分，并覆盖基础抽成与 VIP 配置。',
      409,
      { source: sourceSummaryBefore, target: targetSummaryBefore },
    );
  }

  const sourceWalletBefore = await getDlmWalletSnapshotTx(tx, {
    dlmId: sourceDlmUser.dlmId,
    discordUserId: params.sourceDiscordId,
  });
  const targetWalletBefore = await getDlmWalletSnapshotTx(tx, {
    dlmId: targetDlmUser.dlmId,
    discordUserId: params.targetDiscordId,
  });

  const targetWalletAfter = await applyDlmWalletDeltaTx(tx, {
    dlmId: targetDlmUser.dlmId,
    discordUserId: params.targetDiscordId,
    totalBalanceDelta: sourceWalletBefore.totalBalance,
    incomeDelta: sourceWalletBefore.income,
    rechargeDelta: sourceWalletBefore.recharge,
    totalSpentDelta: sourceWalletBefore.totalSpent,
    loyaltyPointsDelta: sourceWalletBefore.loyaltyPoints,
  });

  const sourceWalletAfter = await applyDlmWalletDeltaTx(tx, {
    dlmId: sourceDlmUser.dlmId,
    discordUserId: params.sourceDiscordId,
    totalBalanceDelta: sourceWalletBefore.totalBalance.negated(),
    incomeDelta: sourceWalletBefore.income.negated(),
    rechargeDelta: sourceWalletBefore.recharge.negated(),
    totalSpentDelta: sourceWalletBefore.totalSpent.negated(),
    loyaltyPointsDelta: sourceWalletBefore.loyaltyPoints.negated(),
  });

  const peiwanChanged = await transferPeiwanIdentityTx(
    tx,
    params.sourceDiscordId,
    params.targetDiscordId,
    targetWalletAfter.totalBalance,
  );

  await tx.loyaltyPoint.upsert({
    where: { discordUserId: params.targetDiscordId },
    create: {
      discordUserId: params.targetDiscordId,
      dlmId: targetDlmUser.dlmId,
      points: targetWalletAfter.loyaltyPoints,
    },
    update: {
      dlmId: targetDlmUser.dlmId,
      points: targetWalletAfter.loyaltyPoints,
    },
  });

  if (sourceLoyaltyPoint) {
    await tx.loyaltyPoint.update({
      where: { discordUserId: params.sourceDiscordId },
      data: { points: new Prisma.Decimal(0) },
    });
  }

  if (sourceWalletBefore.totalBalance.gt(0)) {
    await tx.individualTransaction.create({
      data: {
        discordId: params.sourceDiscordId,
        dlmId: sourceDlmUser.dlmId,
        thirdPartydiscordId: params.targetDiscordId,
        balanceBefore: sourceWalletBefore.totalBalance,
        amountChange: sourceWalletBefore.totalBalance,
        balanceAfter: sourceWalletAfter.totalBalance,
        typeOfTransaction: '资产转出',
      },
    });

    await tx.individualTransaction.create({
      data: {
        discordId: params.targetDiscordId,
        dlmId: targetDlmUser.dlmId,
        thirdPartydiscordId: params.sourceDiscordId,
        balanceBefore: targetWalletBefore.totalBalance,
        amountChange: sourceWalletBefore.totalBalance,
        balanceAfter: targetWalletAfter.totalBalance,
        typeOfTransaction: '资产转入',
      },
    });
  }

  const derivedTargetVipLevel = getHighestVipLevelByTotalSpent(targetWalletAfter.totalSpent.toString());
  const sourceVipLevel = Math.max(0, sourceVipProfile?.lastSettledVipLevel ?? 0);
  const targetVipLevel = Math.max(0, targetVipProfile?.lastSettledVipLevel ?? 0);
  const targetSettledVipLevel = Math.max(sourceVipLevel, targetVipLevel, derivedTargetVipLevel);

  if (sourceVipProfile || targetVipProfile || derivedTargetVipLevel > 0) {
    await tx.vipBenefitProfile.upsert({
      where: { discordUserId: params.targetDiscordId },
      create: {
        discordUserId: params.targetDiscordId,
        roleOptOut: sourceVipProfile?.roleOptOut ?? targetVipProfile?.roleOptOut ?? false,
        announcementEnabled:
          sourceVipProfile?.announcementEnabled ?? targetVipProfile?.announcementEnabled ?? true,
        lastSettledVipLevel: targetSettledVipLevel,
        dispatchImageUrl: sourceVipProfile?.dispatchImageUrl ?? targetVipProfile?.dispatchImageUrl ?? null,
      },
      update: {
        roleOptOut: sourceVipProfile?.roleOptOut ?? targetVipProfile?.roleOptOut ?? false,
        announcementEnabled:
          sourceVipProfile?.announcementEnabled ?? targetVipProfile?.announcementEnabled ?? true,
        lastSettledVipLevel: targetSettledVipLevel,
        dispatchImageUrl: sourceVipProfile?.dispatchImageUrl ?? targetVipProfile?.dispatchImageUrl ?? null,
      },
    });
  }

  if (sourceVipProfile) {
    await tx.vipBenefitProfile.update({
      where: { discordUserId: params.sourceDiscordId },
      data: {
        roleOptOut: false,
        announcementEnabled: true,
        lastSettledVipLevel: 0,
        dispatchImageUrl: null,
      },
    });
  }

  const heartChanged = await mergeHeartCountersTx(tx, params.sourceDiscordId, params.targetDiscordId);
  const commissionChanged = await syncCommissionConfigTx(
    tx,
    params.sourceDiscordId,
    params.targetDiscordId,
    warnings,
  );
  const buffChanged = await syncAssetTransferBuffsTx(
    tx,
    params.sourceDiscordId,
    params.targetDiscordId,
    warnings,
  );
  const ordinaryChanged = await moveManualQuotaBatchesTx(tx, params.sourceDiscordId, params.targetDiscordId, quotaLocks);
  const restorationChanged = await moveManualQuotaRestorationsTx(tx, params.sourceDiscordId, params.targetDiscordId, quotaLocks);

  const sourceSummaryAfter = await loadAssetAccountSummary(tx, params.sourceDiscordId);
  const targetSummaryAfter = await loadAssetAccountSummary(tx, params.targetDiscordId);

  const changed = {
    walletBalanceTransferred: sourceWalletBefore.totalBalance.gt(0) ? 1 : 0,
    loyaltyPointRowReset: sourceLoyaltyPoint ? 1 : 0,
    vipTargetUpdated: sourceVipProfile || targetVipProfile || derivedTargetVipLevel > 0 ? 1 : 0,
    vipSourceReset: sourceVipProfile ? 1 : 0,
    peiwanIdentityTransferred: peiwanChanged.transferred ? 1 : 0,
    peiwanSourceStatusReset: peiwanChanged.sourceStatusReset,
    peiwanTargetStatusUpdated: peiwanChanged.targetStatusUpdated,
    peiwanMainRecordMoved: peiwanChanged.mainRecordMoved,
    peiwanGameProfilesReassigned: peiwanChanged.gameProfilesReassigned,
    peiwanGiftUnlocksMoved: peiwanChanged.giftUnlocksMoved,
    peiwanGiftUnlocksDeduped: peiwanChanged.giftUnlocksDeduped,
    peiwanGiftRewardClaimsMoved: peiwanChanged.giftRewardClaimsMoved,
    peiwanGiftRewardClaimsDeduped: peiwanChanged.giftRewardClaimsDeduped,
    peiwanReviewsReassigned: peiwanChanged.reviewsReassigned,
    peiwanDeletionRecordsReassigned: peiwanChanged.deletionRecordsReassigned,
    heartSourceRowsProcessed: heartChanged.sourceRows,
    heartPairsCreated: heartChanged.createdPairs,
    heartPairsMerged: heartChanged.mergedPairs,
    heartSelfLoopsDropped: heartChanged.selfLoopsDropped,
    ...commissionChanged,
    ...buffChanged,
    ...ordinaryChanged,
    ...restorationChanged,
  } satisfies Record<string, number>;

  const audit = await tx.assetTransferAudit.create({
    data: {
      operatorDiscordId: params.operatorDiscordId,
      sourceDiscordId: params.sourceDiscordId,
      targetDiscordId: params.targetDiscordId,
      sourceDlmId: sourceDlmUser.dlmId,
      targetDlmId: targetDlmUser.dlmId,
      forceMerge: params.forceMerge,
      sourceSnapshot: sourceSummaryBefore,
      targetSnapshot: targetSummaryBefore,
      transferred: {
        totalBalance: sourceWalletBefore.totalBalance.toString(),
        income: sourceWalletBefore.income.toString(),
        recharge: sourceWalletBefore.recharge.toString(),
        totalSpent: sourceWalletBefore.totalSpent.toString(),
        loyaltyPoints: sourceWalletBefore.loyaltyPoints.toString(),
        vipLevelAfter: derivedTargetVipLevel,
        peiwanTransferred: peiwanChanged.transferred,
        peiwanId: peiwanChanged.peiwanId,
        peiwanTotalEarn: peiwanChanged.totalEarn,
        sourceWalletAfter: {
          totalBalance: sourceWalletAfter.totalBalance.toString(),
          income: sourceWalletAfter.income.toString(),
          recharge: sourceWalletAfter.recharge.toString(),
          totalSpent: sourceWalletAfter.totalSpent.toString(),
          loyaltyPoints: sourceWalletAfter.loyaltyPoints.toString(),
        },
        targetWalletAfter: {
          totalBalance: targetWalletAfter.totalBalance.toString(),
          income: targetWalletAfter.income.toString(),
          recharge: targetWalletAfter.recharge.toString(),
          totalSpent: targetWalletAfter.totalSpent.toString(),
          loyaltyPoints: targetWalletAfter.loyaltyPoints.toString(),
        },
      },
      changed,
      warnings,
    },
    select: { id: true },
  });

  return {
    auditId: audit.id,
    source: sourceSummaryAfter,
    target: targetSummaryAfter,
    transferred: {
      totalBalance: sourceWalletBefore.totalBalance.toString(),
      income: sourceWalletBefore.income.toString(),
      recharge: sourceWalletBefore.recharge.toString(),
      totalSpent: sourceWalletBefore.totalSpent.toString(),
      loyaltyPoints: sourceWalletBefore.loyaltyPoints.toString(),
      vipLevelAfter: derivedTargetVipLevel,
      peiwanTransferred: peiwanChanged.transferred,
      peiwanId: peiwanChanged.peiwanId,
      peiwanTotalEarn: peiwanChanged.totalEarn,
    },
    changed,
    warnings,
  };
};
