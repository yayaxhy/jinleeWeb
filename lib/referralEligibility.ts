import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

const REFERRAL_INVITEE_MAX_FLOW = new Prisma.Decimal(500);

export type ReferralInviteeEligibility = {
  ok: boolean;
  totalSpent: Prisma.Decimal;
  totalEarn: Prisma.Decimal;
  limit: Prisma.Decimal;
};

export async function checkReferralInviteeEligibility(
  inviteeId: string,
): Promise<ReferralInviteeEligibility | null> {
  const member = await prisma.member.findUnique({
    where: { discordUserId: inviteeId },
    select: {
      totalSpent: true,
      peiwan: {
        select: { totalEarn: true },
      },
    },
  });

  if (!member) return null;

  const totalSpent = new Prisma.Decimal(member.totalSpent ?? 0);
  const totalEarn = new Prisma.Decimal(member.peiwan?.totalEarn ?? 0);
  const ok = totalSpent.lte(REFERRAL_INVITEE_MAX_FLOW) && totalEarn.lte(REFERRAL_INVITEE_MAX_FLOW);

  return {
    ok,
    totalSpent,
    totalEarn,
    limit: REFERRAL_INVITEE_MAX_FLOW,
  };
}

export const buildReferralInviteeIneligibleMessage = (
  result: ReferralInviteeEligibility,
) => {
  return `该用户无法绑定为被邀请人：消费流水(totalSpent)或收益流水(totalEarn)已超过 ${result.limit.toFixed(2)}（当前 totalSpent=${result.totalSpent.toFixed(2)}，totalEarn=${result.totalEarn.toFixed(2)}）`;
};
