import { MemberStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';

export async function registerPeiwanProfile(discordUserId: string) {
  return prisma.$transaction(async (tx) => {
    const member = await tx.member.upsert({
      where: { discordUserId },
      update: {},
      create: { discordUserId },
      select: { discordUserId: true, VIPRoleOptOut: true },
    });

    await tx.member.update({
      where: { discordUserId: member.discordUserId },
      data: {
        status: MemberStatus.PEIWAN,
        VIPRoleOptOut: member.VIPRoleOptOut ?? false,
      },
    });

    await tx.$executeRaw`
      UPDATE "Member"
      SET "VIPRoleOptOut" = false
      WHERE "discordUserId" = ${member.discordUserId}
        AND ("VIPRoleOptOut"::text NOT IN ('true','false'));
    `;

    const peiwan = await tx.pEIWAN.findUnique({
      where: { discordUserId },
      select: { PEIWANID: true, defaultQuotationCode: true },
    });

    if (!peiwan) {
      throw new Error('尚未在陪玩表中找到该用户，请先写入数据。');
    }

    return peiwan;
  });
}
