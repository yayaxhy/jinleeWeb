/**
 * Approved DLMClub artwork. Keep this catalog identical in Bot and jinleeWeb.
 * Only presentation changes: never infer prize eligibility or prices from artwork.
 * Assets are served by jinleeWeb/public/brand/dlm-v1 (no expiring attachment URLs).
 */
export const BRAND_ARTWORK_BASE_PATH = '/brand/dlm-v1';

const operation = (file: string) => `${BRAND_ARTWORK_BASE_PATH}/operations/${file}`;
const prize = (file: string) => `${BRAND_ARTWORK_BASE_PATH}/prizes/${file}`;

export const OPERATION_ART = {
  orderDispatch: operation('01-order-dispatch.png'),
  redEnvelope: operation('02-guild-red-envelope.png'),
  spendingLeaderboard: operation('03-spending-leaderboard.png'),
  incomeLeaderboard: operation('04-income-leaderboard.png'),
  scratchThumbnail: operation('05-scratch-thumbnail.png'),
  scratchPending: operation('06-scratch-pending.png'),
  scratchThanks: operation('07-scratch-thanks.png'),
  scratch5: operation('08-scratch-5.png'),
  scratch20: operation('09-scratch-20.png'),
  scratch30: operation('10-scratch-30.png'),
  scratch50: operation('11-scratch-50.png'),
  scratch99: operation('12-scratch-99.png'),
  scratch150: operation('13-scratch-150.png'),
  lotterySilver: operation('14-lottery-silver.png'),
  lotteryGold: operation('15-lottery-gold.png'),
  lotteryAdvanced: operation('16-lottery-advanced.png'),
  lotterySpecial: operation('17-lottery-special.png'),
  thankBoss: operation('18-thankBoss.gif'),
} as const;

export const LOTTERY_POOL_ART = {
  NORMAL: OPERATION_ART.lotterySilver,
  MEDIUM: OPERATION_ART.lotteryGold,
  ADVANCED: OPERATION_ART.lotteryAdvanced,
  SPECIAL: OPERATION_ART.lotterySpecial,
} as const;

export const PRIZE_ART_BY_NAME: Readonly<Record<string, string>> = {
  小蛋糕代金券: prize('01-cupcake-voucher.png'),
  棒棒糖代金券: prize('02-lollipop-voucher.png'),
  香槟代金券: prize('03-champagne-voucher.png'),
  蝴蝶代金券: prize('04-butterfly-voucher.png'),
  钢琴代金券: prize('05-piano-voucher.png'),
  飞机代金券: prize('06-airplane-voucher.png'),
  深海宝箱代金券: prize('07-deep-sea-chest-voucher.png'),
  抽奖代金券: prize('08-lottery-voucher.png'),
  积木游戏代金券: prize('09-block-game-voucher.png'),
  抽积木代金券: prize('09-block-game-voucher.png'),
  '7折券': prize('10-7-zhe-voucher.png'),
  '8折券': prize('11-8-zhe-voucher.png'),
  抽奖9折券: prize('12-lottery-9-zhe-voucher.png'),
  特殊9折券: prize('13-special-9-zhe-voucher.png'),
  特殊九折券: prize('13-special-9-zhe-voucher.png'),
  一日冠95折券: prize('14-day-crown-95-voucher.png'),
  一日冠92折券: prize('15-day-crown-92-voucher.png'),
  一日冠9折券: prize('16-day-crown-9-voucher.png'),
  一日冠75折券: prize('17-day-crown-75-voucher.png'),
  三日冠92折券: prize('18-three-day-crown-92-voucher.png'),
  三日冠9折券: prize('19-three-day-crown-9-voucher.png'),
  一周冠92折券: prize('20-week-crown-92-voucher.png'),
  一周冠9折券: prize('21-week-crown-9-voucher.png'),
  '3位数靓号卡': prize('22-three-digit-card.png'),
  '3位数靓号券': prize('22-three-digit-card.png'),
  '4位数靓号卡': prize('23-four-digit-card.png'),
  '4位数靓号券': prize('23-four-digit-card.png'),
  '5位数靓号卡': prize('24-five-digit-card.png'),
  '5位数靓号券': prize('24-five-digit-card.png'),
  自定义tag券: prize('25-custom-tag-voucher.png'),
  自定义礼物券: prize('26-custom-gift-voucher.png'),
  '抽成降1%券': prize('27-commission-minus-one.png'),
  '抽成降1%': prize('27-commission-minus-one.png'),
  双倍流水5000券: prize('28-double-flow-5000.png'),
  双倍消费5000券: prize('29-double-spend-5000.png'),
  陪玩评语券: prize('30-peiwan-review-voucher.png'),
  香水代金券: prize('31-perfume-voucher.png'),
  旋转木马代金券: prize('32-carousel-voucher.png'),
  南瓜车代金券: prize('33-pumpkin-car-voucher.png'),
  留声机代金券: prize('34-phonograph-voucher.png'),
  月冠名92折券: prize('35-month-crown-92-voucher.png'),
  月冠名9折券: prize('36-month-crown-9-voucher.png'),
};

export function getPrizeArtworkPath(name?: string | null): string | null {
  const key = name?.trim();
  return key && Object.prototype.hasOwnProperty.call(PRIZE_ART_BY_NAME, key)
    ? PRIZE_ART_BY_NAME[key]
    : null;
}

export function getVipArtworkPath(level: number): string {
  if (!Number.isInteger(level) || level < 1 || level > 12) {
    throw new RangeError('VIP artwork level must be an integer from 1 to 12');
  }
  return `${BRAND_ARTWORK_BASE_PATH}/vip/VIP${level}.png`;
}
