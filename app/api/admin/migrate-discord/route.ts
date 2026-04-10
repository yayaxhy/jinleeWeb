import { AccountProvider } from '@prisma/client';
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
  const newJinleeUser = await prisma.jinleeUser.findUnique({ where: { discordUserId: newId } });
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
  });
  if (newDiscordBinding) {
    return NextResponse.json({ error: '新 Discord ID 已存在绑定记录，不能覆盖' }, { status: 409 });
  }

  try {
    const changed: Record<string, number> = {};

    await prisma.$transaction(async (tx) => {
      // 1) 先创建新的 Member（复制旧数据），确保外键可指向新 ID
      const memberData = { ...oldMember };
      delete (memberData as { discordUserId?: string }).discordUserId;
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
        'FarmProfile',
        tx.$executeRaw`UPDATE "FarmProfile" SET "discordUserId" = ${newId} WHERE "discordUserId" = ${oldId}`,
      );
      await run(
        'FarmPlot.discordUserId',
        tx.$executeRaw`UPDATE "FarmPlot" SET "discordUserId" = ${newId} WHERE "discordUserId" = ${oldId}`,
      );
      await run(
        'FarmPlot.lastStolenBy',
        tx.$executeRaw`UPDATE "FarmPlot" SET "lastStolenBy" = ${newId} WHERE "lastStolenBy" = ${oldId}`,
      );
      await run(
        'FarmActionLog',
        tx.$executeRaw`UPDATE "FarmActionLog" SET "discordUserId" = ${newId} WHERE "discordUserId" = ${oldId}`,
      );
      await run(
        'FarmVisit.viewerDiscordId',
        tx.$executeRaw`UPDATE "FarmVisit" SET "viewerDiscordId" = ${newId} WHERE "viewerDiscordId" = ${oldId}`,
      );
      await run(
        'FarmVisit.targetDiscordId',
        tx.$executeRaw`UPDATE "FarmVisit" SET "targetDiscordId" = ${newId} WHERE "targetDiscordId" = ${oldId}`,
      );
      await run(
        'VoicePointSession',
        tx.$executeRaw`UPDATE "VoicePointSession" SET "discordUserId" = ${newId} WHERE "discordUserId" = ${oldId}`,
      );
      await run(
        'VoicePointLedger',
        tx.$executeRaw`UPDATE "VoicePointLedger" SET "discordUserId" = ${newId} WHERE "discordUserId" = ${oldId}`,
      );
      await run(
        'PageViewEvent.discordUserId',
        tx.$executeRaw`UPDATE "PageViewEvent" SET "discordUserId" = ${newId} WHERE "discordUserId" = ${oldId}`,
      );
      await run(
        'JinleeUser.discordUserId',
        tx.$executeRaw`UPDATE "JinleeUser" SET "discordUserId" = ${newId} WHERE "discordUserId" = ${oldId}`,
      );
      await run(
        'AccountBinding.DISCORD',
        tx.$executeRaw`UPDATE "AccountBinding" SET "providerUserId" = ${newId} WHERE "provider" = 'DISCORD' AND "providerUserId" = ${oldId}`,
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
        'OrderAudit.hostId',
        tx.$executeRaw`UPDATE "order_audit" SET "hostId" = ${newId} WHERE "hostId" = ${oldId}`,
      );
      await run(
        'OrderAudit.workerId',
        tx.$executeRaw`UPDATE "order_audit" SET "workerId" = ${newId} WHERE "workerId" = ${oldId}`,
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
        tx.$executeRaw`UPDATE "gift_audit" SET "giverId" = ${newId} WHERE "giverId" = ${oldId}`,
      );
      await run(
        'GiftAudit.receiverId',
        tx.$executeRaw`UPDATE "gift_audit" SET "receiverId" = ${newId} WHERE "receiverId" = ${oldId}`,
      );
      await run(
        'GiftAudit.bossReferralInviterId',
        tx.$executeRaw`UPDATE "gift_audit" SET "bossReferralInviterId" = ${newId} WHERE "bossReferralInviterId" = ${oldId}`,
      );
      await run(
        'GiftAudit.workerReferralInviterId',
        tx.$executeRaw`UPDATE "gift_audit" SET "workerReferralInviterId" = ${newId} WHERE "workerReferralInviterId" = ${oldId}`,
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
        'WithdrawalAccount',
        tx.$executeRaw`UPDATE "WithdrawalAccount" SET "discordUserId" = ${newId} WHERE "discordUserId" = ${oldId}`,
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
        'Expense.operatorId',
        tx.$executeRaw`UPDATE "Expense" SET "operatorId" = ${newId} WHERE "operatorId" = ${oldId}`,
      );
      await run(
        'Expense.targetId',
        tx.$executeRaw`UPDATE "Expense" SET "targetId" = ${newId} WHERE "targetId" = ${oldId}`,
      );
      await run(
        'PureProfit.operatorId',
        tx.$executeRaw`UPDATE "PureProfit" SET "operatorId" = ${newId} WHERE "operatorId" = ${oldId}`,
      );
      await run(
        'PureProfit.targetId',
        tx.$executeRaw`UPDATE "PureProfit" SET "targetId" = ${newId} WHERE "targetId" = ${oldId}`,
      );
      await run(
        'Coupon.discordId',
        tx.$executeRaw`UPDATE "Coupon" SET "discordId" = ${newId} WHERE "discordId" = ${oldId}`,
      );
      await run(
        'Coupon.consumeTargetId',
        tx.$executeRaw`UPDATE "Coupon" SET "consumeTargetId" = ${newId} WHERE "consumeTargetId" = ${oldId}`,
      );
      await run(
        'PointShopCart.discordUserId',
        tx.$executeRaw`UPDATE "PointShopCart" SET "discordUserId" = ${newId} WHERE "discordUserId" = ${oldId}`,
      );
      await run(
        'PointShopOrder.discordUserId',
        tx.$executeRaw`UPDATE "PointShopOrder" SET "discordUserId" = ${newId} WHERE "discordUserId" = ${oldId}`,
      );
      await run(
        'PointShopGrant.discordUserId',
        tx.$executeRaw`UPDATE "PointShopGrant" SET "discordUserId" = ${newId} WHERE "discordUserId" = ${oldId}`,
      );
      await run(
        'PointShopGrant.consumeTargetId',
        tx.$executeRaw`UPDATE "PointShopGrant" SET "consumeTargetId" = ${newId} WHERE "consumeTargetId" = ${oldId}`,
      );
      await run(
        'PointShopPointLedger.discordUserId',
        tx.$executeRaw`UPDATE "PointShopPointLedger" SET "discordUserId" = ${newId} WHERE "discordUserId" = ${oldId}`,
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
        'AutoCommissionBuff',
        tx.$executeRaw`UPDATE "auto_commission_buff" SET "user_id" = ${newId} WHERE "user_id" = ${oldId}`,
      );
      await run(
        'LotteryDraw',
        tx.$executeRaw`UPDATE "LotteryDraw" SET "userId" = ${newId} WHERE "userId" = ${oldId}`,
      );
      await run(
        'LotteryDraw.consumeTargetId',
        tx.$executeRaw`UPDATE "LotteryDraw" SET "consumeTargetId" = ${newId} WHERE "consumeTargetId" = ${oldId}`,
      );
      await run(
        'LotteryPity',
        tx.$executeRaw`UPDATE "LotteryPity" SET "userId" = ${newId} WHERE "userId" = ${oldId}`,
      );
      await run(
        'Revert.operatorId',
        tx.$executeRaw`UPDATE "revert" SET "operatorId" = ${newId} WHERE "operatorId" = ${oldId}`,
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
      await run(
        'BossProfile',
        tx.$executeRaw`UPDATE "BossProfile" SET "bossId" = ${newId} WHERE "bossId" = ${oldId}`,
      );
      await run(
        'BossChannelBinding',
        tx.$executeRaw`UPDATE "BossChannelBinding" SET "ownerId" = ${newId} WHERE "ownerId" = ${oldId}`,
      );
      await run(
        'PeiwanDeletion.deletedBy',
        tx.$executeRaw`UPDATE "PeiwanDeletion" SET "deletedBy" = ${newId} WHERE "deletedBy" = ${oldId}`,
      );
      await run(
        'PeiwanGameProfile',
        tx.$executeRaw`UPDATE "PeiwanGameProfile" SET "discordUserId" = ${newId} WHERE "discordUserId" = ${oldId}`,
      );
      await run(
        'BlockStackPlayer.userId',
        tx.$executeRaw`UPDATE "BlockStackPlayer" SET "userId" = ${newId} WHERE "userId" = ${oldId}`,
      );
      await run(
        'BlockStackDraw.userId',
        tx.$executeRaw`UPDATE "BlockStackDraw" SET "userId" = ${newId} WHERE "userId" = ${oldId}`,
      );
      await run(
        'ScratchTicket.ownerId',
        tx.$executeRaw`UPDATE "ScratchTicket" SET "ownerId" = ${newId} WHERE "ownerId" = ${oldId}`,
      );
      await run(
        'PeiwanReview.reviewerDiscordId',
        tx.$executeRaw`UPDATE "PeiwanReview" SET "reviewerDiscordId" = ${newId} WHERE "reviewerDiscordId" = ${oldId}`,
      );
      await run(
        'PeiwanReview.peiwanDiscordId',
        tx.$executeRaw`UPDATE "PeiwanReview" SET "peiwanDiscordId" = ${newId} WHERE "peiwanDiscordId" = ${oldId}`,
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
