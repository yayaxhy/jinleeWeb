import { Prisma, type PrismaClient } from '@prisma/client';
import { giftMenuUnavailableReason, isGiftMenuNameList, type DiscordGiftMenuState } from './discord-gift-menu';

type GiftReader = Pick<PrismaClient, 'gift'>;

export class GiftMenuError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

export async function readDiscordGiftMenu(db: GiftReader): Promise<DiscordGiftMenuState> {
  const rows = await db.gift.findMany({
    select: { GiftName: true, price: true, active: true, staffOnlyGift: true, discordMenuOrder: true },
    orderBy: { GiftName: 'asc' },
  });
  const gifts = rows.map((gift) => ({
    name: gift.GiftName,
    price: gift.price?.toString() ?? '',
    active: gift.active,
    staffOnlyGift: gift.staffOnlyGift,
    position: gift.discordMenuOrder,
  }));
  return {
    gifts,
    giftNames: gifts.filter((gift) => gift.position !== null)
      .sort((a, b) => a.position! - b.position! || a.name.localeCompare(b.name))
      .map((gift) => gift.name),
  };
}

export async function saveDiscordGiftMenu(db: Pick<PrismaClient, '$transaction'>, body: unknown) {
  if (!body || typeof body !== 'object') throw new GiftMenuError('列表格式不正确', 400);
  const { giftNames, expectedGiftNames } = body as Record<string, unknown>;
  if (!isGiftMenuNameList(giftNames) || !isGiftMenuNameList(expectedGiftNames)) {
    throw new GiftMenuError('列表最多可选 25 个礼物，名称不能为空或重复', 400);
  }

  return db.$transaction(async (tx) => {
    const current = await readDiscordGiftMenu(tx);
    if (JSON.stringify(current.giftNames) !== JSON.stringify(expectedGiftNames)) {
      throw new GiftMenuError('列表已被修改，请重新加载后再保存', 409);
    }
    const giftsByName = new Map(current.gifts.map((gift) => [gift.name, gift]));
    for (const name of giftNames) {
      const gift = giftsByName.get(name);
      if (!gift) throw new GiftMenuError(`礼物不存在：${name}`, 400);
      const reason = giftMenuUnavailableReason(gift);
      if (reason) throw new GiftMenuError(`${name}：${reason}，请移出列表后保存`, 400);
    }

    await tx.gift.updateMany({
      where: { discordMenuOrder: { not: null } },
      data: { discordMenuOrder: null },
    });
    for (const [position, name] of giftNames.entries()) {
      await tx.gift.update({ where: { GiftName: name }, data: { discordMenuOrder: position } });
    }
    return readDiscordGiftMenu(tx);
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
