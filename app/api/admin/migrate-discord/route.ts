import { NextRequest, NextResponse } from 'next/server';
import { isAdminDiscordId } from '@/lib/admin';
import { prisma } from '@/lib/prisma';
import { getServerSession } from '@/lib/session';

const ensureAdminSession = async () => {
  const session = await getServerSession();
  if (!session?.discordId || !isAdminDiscordId(session.discordId)) {
    return null;
  }
  return session;
};

type MigrateBody = { oldDiscordId?: string; newDiscordId?: string };

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
  if (oldId === newId) {
    return NextResponse.json({ error: '新旧 Discord ID 不能相同' }, { status: 400 });
  }

  const oldMember = await prisma.member.findUnique({ where: { discordUserId: oldId } });
  if (!oldMember) {
    return NextResponse.json({ error: '未找到旧账号，无法迁移' }, { status: 404 });
  }
  const newMember = await prisma.member.findUnique({ where: { discordUserId: newId } });
  if (newMember) {
    return NextResponse.json({ error: '新 Discord ID 已存在，不能覆盖' }, { status: 409 });
  }

  try {
    const changed: Record<string, number> = {};

    await prisma.$transaction(async (tx) => {
      // 1) 先创建新的 Member（复制旧数据），确保外键可指向新 ID
      const { discordUserId: _old, ...memberData } = oldMember;
      await tx.member.create({
        data: {
          ...memberData,
          discordUserId: newId,
        },
      });

      const run = async (label: string, promise: Promise<unknown>) => {
        const result = await promise;
        const numeric = typeof result === 'bigint' ? Number(result) : Number(result ?? 0);
        changed[label] = numeric;
      };

      // 2) 逐表更新引用
      await run(
        'LoyaltyPoint',
        tx.$executeRaw`UPDATE "LoyaltyPoint" SET "discordUserId" = ${newId} WHERE "discordUserId" = ${oldId}`,
      );
      await run(
        'Transaction.fromId',
        tx.$executeRaw`UPDATE "Transaction" SET "fromId" = ${newId} WHERE "fromId" = ${oldId}`,
      );
      await run(
        'Transaction.toId',
        tx.$executeRaw`UPDATE "Transaction" SET "toId" = ${newId} WHERE "toId" = ${oldId}`,
      );
      await run(
        'DailySnapshot',
        tx.$executeRaw`UPDATE "DailySnapshot" SET "discordUserId" = ${newId} WHERE "discordUserId" = ${oldId}`,
      );
      await run(
        'Commission.fromId',
        tx.$executeRaw`UPDATE "Commission" SET "fromId" = ${newId} WHERE "fromId" = ${oldId}`,
      );
      await run(
        'Commission.toId',
        tx.$executeRaw`UPDATE "Commission" SET "toId" = ${newId} WHERE "toId" = ${oldId}`,
      );
      await run(
        'PeiwanGiftUnlock',
        tx.$executeRaw`UPDATE "PeiwanGiftUnlock" SET "discordUserId" = ${newId} WHERE "discordUserId" = ${oldId}`,
      );
      await run(
        'PeiwanGiftRewardClaim',
        tx.$executeRaw`UPDATE "PeiwanGiftRewardClaim" SET "discordUserId" = ${newId} WHERE "discordUserId" = ${oldId}`,
      );
      await run(
        'ZPayRechargeOrder',
        tx.$executeRaw`UPDATE "ZPayRechargeOrder" SET "discordUserId" = ${newId} WHERE "discordUserId" = ${oldId}`,
      );
      await run(
        'PEIWAN',
        tx.$executeRaw`UPDATE "PEIWAN" SET "discordUserId" = ${newId} WHERE "discordUserId" = ${oldId}`,
      );
      await run(
        'Order.hostId',
        tx.$executeRaw`UPDATE "Order" SET "hostId" = ${newId} WHERE "hostId" = ${oldId}`,
      );
      await run(
        'Order.workerId',
        tx.$executeRaw`UPDATE "Order" SET "workerId" = ${newId} WHERE "workerId" = ${oldId}`,
      );
      await run(
        'OrderRequestLog',
        tx.$executeRaw`UPDATE "OrderRequestLog" SET "ownerId" = ${newId} WHERE "ownerId" = ${oldId}`,
      );
      await run(
        'OrderRequestClick',
        tx.$executeRaw`UPDATE "OrderRequestClick" SET "workerId" = ${newId} WHERE "workerId" = ${oldId}`,
      );
      await run(
        'PeiwanDeletion',
        tx.$executeRaw`UPDATE "PeiwanDeletion" SET "discordUserId" = ${newId} WHERE "discordUserId" = ${oldId}`,
      );
      await run(
        'WorkerLock',
        tx.$executeRaw`UPDATE "WorkerLock" SET "workerId" = ${newId} WHERE "workerId" = ${oldId}`,
      );
      await run(
        'HeartCounter.fromMemberId',
        tx.$executeRaw`UPDATE "HeartCounter" SET "fromMemberId" = ${newId} WHERE "fromMemberId" = ${oldId}`,
      );
      await run(
        'HeartCounter.toMemberId',
        tx.$executeRaw`UPDATE "HeartCounter" SET "toMemberId" = ${newId} WHERE "toMemberId" = ${oldId}`,
      );
      await run(
        'RedEnvelope',
        tx.$executeRaw`UPDATE "RedEnvelope" SET "creatorId" = ${newId} WHERE "creatorId" = ${oldId}`,
      );
      await run(
        'GiftAudit.giverId',
        tx.$executeRaw`UPDATE "GiftAudit" SET "giverId" = ${newId} WHERE "giverId" = ${oldId}`,
      );
      await run(
        'GiftAudit.receiverId',
        tx.$executeRaw`UPDATE "GiftAudit" SET "receiverId" = ${newId} WHERE "receiverId" = ${oldId}`,
      );
      await run(
        'Recharge.toWhom',
        tx.$executeRaw`UPDATE "Recharge" SET "toWhom" = ${newId} WHERE "toWhom" = ${oldId}`,
      );
      await run(
        'Recharge.fromWhom',
        tx.$executeRaw`UPDATE "Recharge" SET "fromWhom" = ${newId} WHERE "fromWhom" = ${oldId}`,
      );
      await run(
        'Withdraw',
        tx.$executeRaw`UPDATE "Withdraw" SET "discordId" = ${newId} WHERE "discordId" = ${oldId}`,
      );
      await run(
        'IndividualTransaction.discordId',
        tx.$executeRaw`UPDATE "IndividualTransaction" SET "discordId" = ${newId} WHERE "discordId" = ${oldId}`,
      );
      await run(
        'IndividualTransaction.thirdPartydiscordId',
        tx.$executeRaw`UPDATE "IndividualTransaction" SET "thirdPartydiscordId" = ${newId} WHERE "thirdPartydiscordId" = ${oldId}`,
      );
      await run(
        'InteractionLog',
        tx.$executeRaw`UPDATE "InteractionLog" SET "memberId" = ${newId} WHERE "memberId" = ${oldId}`,
      );
      await run(
        'CommissionBuff',
        tx.$executeRaw`UPDATE "commission_buff" SET "user_id" = ${newId} WHERE "user_id" = ${oldId}`,
      );
      await run(
        'FlowBuff',
        tx.$executeRaw`UPDATE "flow_buff" SET "user_id" = ${newId} WHERE "user_id" = ${oldId}`,
      );
      await run(
        'SpendBuff',
        tx.$executeRaw`UPDATE "spend_buff" SET "user_id" = ${newId} WHERE "user_id" = ${oldId}`,
      );
      await run(
        'LotteryDraw',
        tx.$executeRaw`UPDATE "LotteryDraw" SET "userId" = ${newId} WHERE "userId" = ${oldId}`,
      );
      await run(
        'LotteryPity',
        tx.$executeRaw`UPDATE "LotteryPity" SET "userId" = ${newId} WHERE "userId" = ${oldId}`,
      );
      await run(
        'Referral.inviterId',
        tx.$executeRaw`UPDATE "Referral" SET "inviterId" = ${newId} WHERE "inviterId" = ${oldId}`,
      );
      await run(
        'Referral.inviteeId',
        tx.$executeRaw`UPDATE "Referral" SET "inviteeId" = ${newId} WHERE "inviteeId" = ${oldId}`,
      );
      await run(
        'ReferralPayout',
        tx.$executeRaw`UPDATE "ReferralPayout" SET "referralId" = ${newId} WHERE "referralId" = ${oldId}`,
      );
      await run(
        'InviteLinkUsage.inviterId',
        tx.$executeRaw`UPDATE "InviteLinkUsage" SET "inviterId" = ${newId} WHERE "inviterId" = ${oldId}`,
      );
      await run(
        'InviteLinkUsage.inviteeId',
        tx.$executeRaw`UPDATE "InviteLinkUsage" SET "inviteeId" = ${newId} WHERE "inviteeId" = ${oldId}`,
      );
      await run(
        'GuildJoinRecord',
        tx.$executeRaw`UPDATE "GuildJoinRecord" SET "userId" = ${newId} WHERE "userId" = ${oldId}`,
      );

      // 3) 清理旧 Member
      await tx.member.delete({ where: { discordUserId: oldId } });
    });

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
