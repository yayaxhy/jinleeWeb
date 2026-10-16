export const DISCORD_GIFT_MENU_LIMIT = 25;

export type DiscordGiftMenuItem = {
  name: string;
  price: string;
  active: boolean;
  staffOnlyGift: boolean;
  position: number | null;
};

export type DiscordGiftMenuState = {
  gifts: DiscordGiftMenuItem[];
  giftNames: string[];
};

export function giftMenuUnavailableReason(gift: DiscordGiftMenuItem): string | null {
  if (!gift.active) return '已下架';
  if (gift.staffOnlyGift) return '仅客服可打赏';
  const price = Number(gift.price);
  if (!Number.isFinite(price) || price <= 0) return '价格无效';
  if (!gift.name.trim() || gift.name.length > 100 || `${gift.name}：¥${price.toFixed(2)}`.length > 100) {
    return '名称过长或为空';
  }
  return null;
}

export function isGiftMenuNameList(value: unknown): value is string[] {
  return Array.isArray(value)
    && value.length <= DISCORD_GIFT_MENU_LIMIT
    && value.every((name) => typeof name === 'string' && name.length > 0 && name.length <= 100 && name === name.trim())
    && new Set(value).size === value.length;
}
