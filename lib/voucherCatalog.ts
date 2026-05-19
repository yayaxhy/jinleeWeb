import { CouponType, LotteryPrizeType } from '@prisma/client';

type CouponVoucherMeta = {
  prizeName: string;
  prizeType: LotteryPrizeType;
  giftName?: string;
  isDiscount?: boolean;
  isVanityCard?: boolean;
};

export type SpecialVoucherKind = 'simple' | 'commission' | 'flow' | 'spend' | 'peiwan_review';

export const COUPON_VOUCHER_META: Record<CouponType, CouponVoucherMeta> = {
  [CouponType.DISCOUNT_90]: { prizeName: '9折券', prizeType: LotteryPrizeType.COUPON, isDiscount: true },
  [CouponType.DISCOUNT_80]: { prizeName: '8折券', prizeType: LotteryPrizeType.COUPON, isDiscount: true },
  [CouponType.DISCOUNT_70]: { prizeName: '7折券', prizeType: LotteryPrizeType.COUPON, isDiscount: true },
  [CouponType.DISCOUNT_90_LOTTERY]: {
    prizeName: '特殊9折券',
    prizeType: LotteryPrizeType.COUPON,
    isDiscount: true,
  },
  [CouponType.CAKE_VOUCHER]: { prizeName: '小蛋糕代金券', prizeType: LotteryPrizeType.GIFT, giftName: '小蛋糕' },
  [CouponType.LOLLIPOP_VOUCHER]: { prizeName: '棒棒糖代金券', prizeType: LotteryPrizeType.GIFT, giftName: '棒棒糖' },
  [CouponType.PERFUME_VOUCHER]: { prizeName: '香水代金券', prizeType: LotteryPrizeType.GIFT, giftName: '香水' },
  [CouponType.CAROUSEL_VOUCHER]: { prizeName: '旋转木马代金券', prizeType: LotteryPrizeType.GIFT, giftName: '旋转木马' },
  [CouponType.PUMPKIN_CAR_VOUCHER]: {
    prizeName: '南瓜车代金券',
    prizeType: LotteryPrizeType.GIFT,
    giftName: '南瓜车',
  },
  [CouponType.PHONOGRAPH_VOUCHER]: { prizeName: '留声机代金券', prizeType: LotteryPrizeType.GIFT, giftName: '留声机' },
  [CouponType.CROWN_DAY_95_VOUCHER]: { prizeName: '一日冠95折券', prizeType: LotteryPrizeType.GIFT, giftName: '一日冠' },
  [CouponType.CROWN_DAY_92_VOUCHER]: { prizeName: '一日冠92折券', prizeType: LotteryPrizeType.GIFT, giftName: '一日冠' },
  [CouponType.CROWN_75_VOUCHER]: { prizeName: '一日冠75折券', prizeType: LotteryPrizeType.GIFT, giftName: '一日冠' },
  [CouponType.CROWN_DAY_90_VOUCHER]: { prizeName: '一日冠9折券', prizeType: LotteryPrizeType.GIFT, giftName: '一日冠' },
  [CouponType.CROWN_3DAY_92_VOUCHER]: { prizeName: '三日冠92折券', prizeType: LotteryPrizeType.GIFT, giftName: '三日冠' },
  [CouponType.CROWN_3DAY_90_VOUCHER]: { prizeName: '三日冠9折券', prizeType: LotteryPrizeType.GIFT, giftName: '三日冠' },
  [CouponType.CROWN_WEEK_92_VOUCHER]: { prizeName: '一周冠92折券', prizeType: LotteryPrizeType.GIFT, giftName: '一周冠' },
  [CouponType.CROWN_WEEK_90_VOUCHER]: { prizeName: '一周冠9折券', prizeType: LotteryPrizeType.GIFT, giftName: '一周冠' },
  [CouponType.CROWN_MONTH_92_VOUCHER]: { prizeName: '月冠名92折券', prizeType: LotteryPrizeType.GIFT, giftName: '月冠名' },
  [CouponType.CROWN_MONTH_90_VOUCHER]: { prizeName: '月冠名9折券', prizeType: LotteryPrizeType.GIFT, giftName: '月冠名' },
  [CouponType.LOTTERY_VOUCHER]: { prizeName: '抽奖代金券', prizeType: LotteryPrizeType.COUPON },
  [CouponType.BLOCK_STACK_VOUCHER]: { prizeName: '积木游戏代金券', prizeType: LotteryPrizeType.COUPON },
  [CouponType.CUSTOM_GIFT_VOUCHER]: { prizeName: '自定义礼物券', prizeType: LotteryPrizeType.COUPON },
  [CouponType.CUSTOM_TAG_VOUCHER]: { prizeName: '自定义tag券', prizeType: LotteryPrizeType.COUPON },
  [CouponType.COMMISSION_MINUS1_VOUCHER]: { prizeName: '抽成降1%券', prizeType: LotteryPrizeType.COUPON },
  [CouponType.DOUBLE_FLOW_5000_VOUCHER]: { prizeName: '双倍流水5000券', prizeType: LotteryPrizeType.COUPON },
  [CouponType.DOUBLE_SPEND_5000_VOUCHER]: { prizeName: '双倍消费5000券', prizeType: LotteryPrizeType.COUPON },
  [CouponType.SCRATCH_TICKET_VOUCHER]: { prizeName: '刮刮乐代金券', prizeType: LotteryPrizeType.COUPON },
  [CouponType.RENAME_CARD_3]: { prizeName: '3位数靓号卡', prizeType: LotteryPrizeType.SELFUSE, isVanityCard: true },
  [CouponType.RENAME_CARD]: { prizeName: '4位数靓号卡', prizeType: LotteryPrizeType.SELFUSE, isVanityCard: true },
  [CouponType.RENAME_CARD_5]: { prizeName: '5位数靓号卡', prizeType: LotteryPrizeType.SELFUSE, isVanityCard: true },
  [CouponType.PEIWAN_REVIEW_VOUCHER]: { prizeName: '陪玩评语券', prizeType: LotteryPrizeType.COUPON },
};

const prizeEntries = Object.entries(COUPON_VOUCHER_META) as Array<[CouponType, CouponVoucherMeta]>;
const LOTTERY_ONLY_GIFT_NAME_BY_PRIZE_NAME: Record<string, string> = {
  一日冠95折券: '一日冠',
  一日冠92折券: '一日冠',
  三日冠92折券: '三日冠',
  一周冠92折券: '一周冠',
  月冠名92折券: '月冠名',
};

export const COUPON_TYPE_BY_PRIZE_NAME: Record<string, CouponType> = prizeEntries.reduce(
  (acc, [couponType, meta]) => {
    acc[meta.prizeName] = couponType;
    return acc;
  },
  {} as Record<string, CouponType>,
);

export const GIFT_NAME_BY_PRIZE_NAME: Record<string, string> = prizeEntries.reduce(
  (acc, [, meta]) => {
    if (meta.prizeType === LotteryPrizeType.GIFT && meta.giftName) {
      acc[meta.prizeName] = meta.giftName;
    }
    return acc;
  },
  { ...LOTTERY_ONLY_GIFT_NAME_BY_PRIZE_NAME } as Record<string, string>,
);

export const inferPrizeTypeByPrizeName = (prizeName?: string | null): LotteryPrizeType => {
  const normalized = prizeName?.trim();
  if (!normalized) return LotteryPrizeType.COUPON;
  if (GIFT_NAME_BY_PRIZE_NAME[normalized]) return LotteryPrizeType.GIFT;
  if (VANITY_CARD_PRIZE_NAMES.has(normalized)) return LotteryPrizeType.SELFUSE;
  return LotteryPrizeType.COUPON;
};

const LEGACY_VANITY_CARD_PRIZE_NAMES = ['3位数靓号券', '4位数靓号券', '5位数靓号券'] as const;

export const VANITY_CARD_PRIZE_NAMES = new Set([
  ...prizeEntries.filter(([, meta]) => !!meta.isVanityCard).map(([, meta]) => meta.prizeName),
  ...LEGACY_VANITY_CARD_PRIZE_NAMES,
]);

export const DISCOUNT_COUPON_PRIZE_NAMES = new Set([
  ...prizeEntries.filter(([, meta]) => !!meta.isDiscount).map(([, meta]) => meta.prizeName),
  '特殊九折券',
]);

const SPECIAL_ACTION_PRIZE_NAMES = [
  '自定义礼物券',
  '自定义tag券',
  '抽成降1%券',
  '双倍流水5000券',
  '双倍消费5000券',
  '陪玩评语券',
] as const;

export const SPECIAL_ACTION_COUPON_TYPE_BY_PRIZE: Record<string, CouponType> = SPECIAL_ACTION_PRIZE_NAMES.reduce(
  (acc, prizeName) => {
    const couponType = COUPON_TYPE_BY_PRIZE_NAME[prizeName];
    if (couponType) {
      acc[prizeName] = couponType;
    }
    return acc;
  },
  {} as Record<string, CouponType>,
);

export const SPECIAL_ACTION_KIND_BY_PRIZE: Record<string, SpecialVoucherKind> = {
  自定义礼物券: 'simple',
  自定义tag券: 'simple',
  '抽成降1%券': 'commission',
  双倍流水5000券: 'flow',
  双倍消费5000券: 'spend',
  陪玩评语券: 'peiwan_review',
};
