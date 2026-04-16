import { MemberStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';

export async function registerPeiwanProfile(discordUserId: string) {
  return prisma.$transaction(async (tx) => {
    await tx.member.upsert({
      where: { discordUserId },
      update: {},
      create: { discordUserId },
    });

    await tx.member.update({
      where: { discordUserId },
      data: {
        status: MemberStatus.PEIWAN,
      },
    });

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
