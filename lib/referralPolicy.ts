import { Prisma, ReferralType } from '@prisma/client';
import { prisma } from '@/lib/prisma';

const DEFAULT_REFERRAL_RATE = new Prisma.Decimal(0.01);
const DEFAULT_REFERRAL_CAP = new Prisma.Decimal(1000);

export const getReferralSnapshotForBinding = async (
  inviterId: string,
  type: ReferralType,
  boundAt = new Date(),
) => {
  const baseWhere: Prisma.ReferralPolicyWhereInput = {
    inviterId,
    enabled: true,
    AND: [
      {
        OR: [{ startsAt: null }, { startsAt: { lte: boundAt } }],
      },
      {
        OR: [{ endsAt: null }, { endsAt: { gte: boundAt } }],
      },
    ],
  } as const;

  const policy =
    (await prisma.referralPolicy.findFirst({
      where: { ...baseWhere, referralType: type },
      orderBy: { createdAt: 'desc' },
    })) ??
    (await prisma.referralPolicy.findFirst({
      where: { ...baseWhere, referralType: null },
      orderBy: { createdAt: 'desc' },
    }));

  if (!policy) {
    return {
      payoutRate: DEFAULT_REFERRAL_RATE,
      payoutCap: DEFAULT_REFERRAL_CAP,
      policyApplied: false,
      policyRuleId: null,
      policyBoundAt: null,
    };
  }

  return {
    payoutRate: policy.rate,
    payoutCap: policy.capAmount,
    policyApplied: true,
    policyRuleId: policy.id,
    policyBoundAt: boundAt,
  };
};
