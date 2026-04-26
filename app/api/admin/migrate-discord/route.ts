import { AccountProvider, Prisma } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { isAdminDiscordId } from '@/lib/admin';
import { isDiscordSnowflake } from '@/lib/discord-id';
import { prisma } from '@/lib/prisma';
import { getServerSession } from '@/lib/session';

const ensureAdminSession = async () => {
  const session = await getServerSession();
  if (!session?.discordId || !isAdminDiscordId(session.discordId)) {
    return null;
  }
  return session;
};

const MANUAL_DISCORD_ID_UPDATES = [
  {
    label: 'AccountBinding.DISCORD',
    sql: 'UPDATE "AccountBinding" SET "providerUserId" = $1 WHERE "provider" = \'DISCORD\' AND "providerUserId" = $2',
  },
  { label: 'FarmPlot.lastStolenBy', sql: 'UPDATE "FarmPlot" SET "lastStolenBy" = $1 WHERE "lastStolenBy" = $2' },
  {
    label: 'FarmVisit.viewerDiscordId',
    sql: 'UPDATE "FarmVisit" SET "viewerDiscordId" = $1 WHERE "viewerDiscordId" = $2',
  },
  {
    label: 'FarmVisit.targetDiscordId',
    sql: 'UPDATE "FarmVisit" SET "targetDiscordId" = $1 WHERE "targetDiscordId" = $2',
  },
  { label: 'OrderAudit.hostId', sql: 'UPDATE "order_audit" SET "hostId" = $1 WHERE "hostId" = $2' },
  { label: 'OrderAudit.workerId', sql: 'UPDATE "order_audit" SET "workerId" = $1 WHERE "workerId" = $2' },
  {
    label: 'OrderAudit.bossReferralInviterId',
    sql: 'UPDATE "order_audit" SET "bossReferralInviterId" = $1 WHERE "bossReferralInviterId" = $2',
  },
  {
    label: 'OrderAudit.workerReferralInviterId',
    sql: 'UPDATE "order_audit" SET "workerReferralInviterId" = $1 WHERE "workerReferralInviterId" = $2',
  },
  {
    label: 'PeiwanDeletion.discordUserId',
    sql: 'UPDATE "PeiwanDeletion" SET "discordUserId" = $1 WHERE "discordUserId" = $2',
  },
  { label: 'PeiwanDeletion.deletedBy', sql: 'UPDATE "PeiwanDeletion" SET "deletedBy" = $1 WHERE "deletedBy" = $2' },
  { label: 'RedEnvelope.creatorId', sql: 'UPDATE "RedEnvelope" SET "creatorId" = $1 WHERE "creatorId" = $2' },
  { label: 'GiftAudit.giverId', sql: 'UPDATE "gift_audit" SET "giverId" = $1 WHERE "giverId" = $2' },
  { label: 'GiftAudit.receiverId', sql: 'UPDATE "gift_audit" SET "receiverId" = $1 WHERE "receiverId" = $2' },
  {
    label: 'GiftAudit.bossReferralInviterId',
    sql: 'UPDATE "gift_audit" SET "bossReferralInviterId" = $1 WHERE "bossReferralInviterId" = $2',
  },
  {
    label: 'GiftAudit.workerReferralInviterId',
    sql: 'UPDATE "gift_audit" SET "workerReferralInviterId" = $1 WHERE "workerReferralInviterId" = $2',
  },
  { label: 'Recharge.toWhom', sql: 'UPDATE "Recharge" SET "toWhom" = $1 WHERE "toWhom" = $2' },
  { label: 'Recharge.fromWhom', sql: 'UPDATE "Recharge" SET "fromWhom" = $1 WHERE "fromWhom" = $2' },
  { label: 'Withdraw.discordId', sql: 'UPDATE "Withdraw" SET "discordId" = $1 WHERE "discordId" = $2' },
  {
    label: 'IndividualTransaction.discordId',
    sql: 'UPDATE "IndividualTransaction" SET "discordId" = $1 WHERE "discordId" = $2',
  },
  {
    label: 'IndividualTransaction.thirdPartydiscordId',
    sql: 'UPDATE "IndividualTransaction" SET "thirdPartydiscordId" = $1 WHERE "thirdPartydiscordId" = $2',
  },
  { label: 'Coupon.discordId', sql: 'UPDATE "Coupon" SET "discordId" = $1 WHERE "discordId" = $2' },
  { label: 'InteractionLog.memberId', sql: 'UPDATE "InteractionLog" SET "memberId" = $1 WHERE "memberId" = $2' },
  { label: 'CommissionBuff', sql: 'UPDATE "commission_buff" SET "user_id" = $1 WHERE "user_id" = $2' },
  { label: 'FlowBuff', sql: 'UPDATE "flow_buff" SET "user_id" = $1 WHERE "user_id" = $2' },
  { label: 'SpendBuff', sql: 'UPDATE "spend_buff" SET "user_id" = $1 WHERE "user_id" = $2' },
  { label: 'AutoCommissionBuff', sql: 'UPDATE "auto_commission_buff" SET "user_id" = $1 WHERE "user_id" = $2' },
  { label: 'Revert.operatorId', sql: 'UPDATE "revert" SET "operatorId" = $1 WHERE "operatorId" = $2' },
  { label: 'ReferralPolicy.inviterId', sql: 'UPDATE "ReferralPolicy" SET "inviterId" = $1 WHERE "inviterId" = $2' },
  { label: 'ReferralPayout.referralId', sql: 'UPDATE "ReferralPayout" SET "referralId" = $1 WHERE "referralId" = $2' },
  { label: 'GuildJoinRecord.userId', sql: 'UPDATE "GuildJoinRecord" SET "userId" = $1 WHERE "userId" = $2' },
  { label: 'BossChannelBinding.ownerId', sql: 'UPDATE "BossChannelBinding" SET "ownerId" = $1 WHERE "ownerId" = $2' },
  {
    label: 'PeiwanGameProfile.discordUserId',
    sql: 'UPDATE "PeiwanGameProfile" SET "discordUserId" = $1 WHERE "discordUserId" = $2',
  },
  { label: 'BlockStackPlayer.userId', sql: 'UPDATE "BlockStackPlayer" SET "userId" = $1 WHERE "userId" = $2' },
  { label: 'BlockStackDraw.userId', sql: 'UPDATE "BlockStackDraw" SET "userId" = $1 WHERE "userId" = $2' },
  { label: 'BlockStackGame.creatorId', sql: 'UPDATE "BlockStackGame" SET "creatorId" = $1 WHERE "creatorId" = $2' },
  {
    label: 'BlockStackGame.settledById',
    sql: 'UPDATE "BlockStackGame" SET "settledById" = $1 WHERE "settledById" = $2',
  },
  {
    label: 'BlockStackGame.collapsedById',
    sql: 'UPDATE "BlockStackGame" SET "collapsedById" = $1 WHERE "collapsedById" = $2',
  },
  {
    label: 'BlockStackGame.collapseRewardUserId',
    sql: 'UPDATE "BlockStackGame" SET "collapseRewardUserId" = $1 WHERE "collapseRewardUserId" = $2',
  },
] satisfies ReadonlyArray<{ label: string; sql: string }>;

type MigrateBody = { oldDiscordId?: string; newDiscordId?: string };

const toChangedCount = (value: unknown) => {
  if (typeof value === 'bigint') return Number(value);
  return Number(value ?? 0);
};

export async function POST(request: NextRequest) {
  const session = await ensureAdminSession();
  if (!session) {
    return NextResponse.json({ error: '无权访问' }, { status: 403 });
  }

  let body: MigrateBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '请求体无效' }, { status: 400 });
  }

  const oldId = String(body?.oldDiscordId ?? '').trim();
  const newId = String(body?.newDiscordId ?? '').trim();
  if (!oldId || !newId) {
    return NextResponse.json({ error: 'oldDiscordId 与 newDiscordId 均不能为空' }, { status: 400 });
  }
  if (!isDiscordSnowflake(oldId) || !isDiscordSnowflake(newId)) {
    return NextResponse.json({ error: 'Discord ID 格式无效，必须为 17-20 位纯数字雪花 ID' }, { status: 400 });
  }
  if (oldId === newId) {
    return NextResponse.json({ error: '新旧 Discord ID 不能相同' }, { status: 400 });
  }

  const oldMember = await prisma.member.findUnique({ where: { discordUserId: oldId }, select: { discordUserId: true } });
  if (!oldMember) {
    return NextResponse.json({ error: '未找到旧账号，无法迁移' }, { status: 404 });
  }

  const newMember = await prisma.member.findUnique({ where: { discordUserId: newId }, select: { discordUserId: true } });
  if (newMember) {
    return NextResponse.json({ error: '新 Discord ID 已存在，不能覆盖' }, { status: 409 });
  }

  const newJinleeUser = await prisma.jinleeUser.findUnique({ where: { discordUserId: newId }, select: { jinleeId: true } });
  if (newJinleeUser) {
    return NextResponse.json({ error: '新 Discord ID 已绑定到 Jinlee 用户，不能覆盖' }, { status: 409 });
  }

  const newDiscordBinding = await prisma.accountBinding.findUnique({
    where: {
      provider_providerUserId: {
        provider: AccountProvider.DISCORD,
        providerUserId: newId,
      },
    },
    select: { id: true },
  });
  if (newDiscordBinding) {
    return NextResponse.json({ error: '新 Discord ID 已存在绑定记录，不能覆盖' }, { status: 409 });
  }

  try {
    const changed: Record<string, number> = {};

    await prisma.$transaction(
      async (tx) => {
        const oldJinleeUser = await tx.jinleeUser.findUnique({
          where: { discordUserId: oldId },
          select: { jinleeId: true },
        });

        const memberChanged = await tx.$executeRaw`UPDATE "Member" SET "discordUserId" = ${newId} WHERE "discordUserId" = ${oldId}`;
        changed['Member.discordUserId'] = toChangedCount(memberChanged);
        if (changed['Member.discordUserId'] !== 1) {
          throw new Error('旧账号不存在或已被其他事务修改，请刷新后重试');
        }

        if (oldJinleeUser) {
          await tx.jinleeUser.update({
            where: { jinleeId: oldJinleeUser.jinleeId },
            data: { sessionVersion: { increment: 1 } },
          });
          changed['JinleeUser.sessionVersion'] = 1;
        } else {
          changed['JinleeUser.sessionVersion'] = 0;
        }

        for (const update of MANUAL_DISCORD_ID_UPDATES) {
          const result = await tx.$executeRawUnsafe(update.sql, newId, oldId);
          changed[update.label] = toChangedCount(result);
        }
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    return NextResponse.json(
      {
        success: true,
        message: '账号迁移完成',
        changed,
      },
      { status: 200 },
    );
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
