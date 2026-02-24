import { Prisma, ReferralType } from '@prisma/client';
import { prisma } from '@/lib/prisma';

const REFERRAL_INVITEE_MAX_FLOW = new Prisma.Decimal(1000);

export type ReferralInviteeEligibility = {
  ok: boolean;
  totalSpent: Prisma.Decimal;
  totalEarn: Prisma.Decimal;
  limit: Prisma.Decimal;
  type: ReferralType;
  checkedField: 'totalSpent' | 'totalEarn';
  checkedValue: Prisma.Decimal;
};

export async function checkReferralInviteeEligibility(
  inviteeId: string,
  type: ReferralType,
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
  const checkedField = type === ReferralType.PEIWAN ? 'totalEarn' : 'totalSpent';
  const checkedValue = checkedField === 'totalEarn' ? totalEarn : totalSpent;
  const ok = checkedValue.lte(REFERRAL_INVITEE_MAX_FLOW);

  return {
    ok,
    totalSpent,
    totalEarn,
    limit: REFERRAL_INVITEE_MAX_FLOW,
    type,
    checkedField,
    checkedValue,
  };
}

export const buildReferralInviteeIneligibleMessage = (
  result: ReferralInviteeEligibility,
) => {
  const typeLabel = result.type === ReferralType.PEIWAN ? 'peiwan' : 'laoban';
  return `该用户无法绑定为被邀请人：类型=${typeLabel} 时校验 ${result.checkedField}，阈值为 ${result.limit.toFixed(2)}（当前 ${result.checkedField}=${result.checkedValue.toFixed(2)}；totalSpent=${result.totalSpent.toFixed(2)}，totalEarn=${result.totalEarn.toFixed(2)}）`;
};
