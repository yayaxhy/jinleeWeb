/**
 * Stable, bundled artwork for vouchers shown in user-facing inventory views.
 * Keep these paths local so a card never depends on an expiring CDN attachment.
 */
export const LOCAL_VOUCHER_ART_BY_PRIZE_NAME: Readonly<Record<string, string>> = {
  香槟代金券: '/lottery-fusion/business/香槟代金券.png',
  棒棒糖代金券: '/lottery-fusion/business/棒棒糖代金券.png',
  蝴蝶代金券: '/lottery-fusion/business/蝴蝶代金券.png',
  抽奖代金券: '/lottery-fusion/business/抽奖代金券.PNG',
  特殊9折券: '/lottery-fusion/business/抽奖特殊9折券.PNG',
  特殊九折券: '/lottery-fusion/business/抽奖特殊9折券.PNG',
  积木游戏代金券: '/lottery-fusion/business/抽积木代金券.png',
  抽积木代金券: '/lottery-fusion/business/抽积木代金券.png',
  双倍消费5000券: '/lottery-fusion/business/双倍消费5000.PNG',
  双倍流水5000券: '/lottery-fusion/business/双倍流水5000.PNG',
  钢琴代金券: '/lottery-fusion/business/钢琴代金券.png',
  深海宝箱代金券: '/lottery-fusion/business/深海宝箱代金券.png',
  飞机代金券: '/lottery-fusion/business/飞机代金券.png',
  '7折券': '/lottery-fusion/business/7折券.PNG',
  '8折券': '/lottery-fusion/business/八折券.PNG',
  一日冠95折券: '/lottery-fusion/business/一日冠95折.PNG',
  一日冠92折券: '/lottery-fusion/business/一日冠92折.PNG',
  一日冠9折券: '/lottery-fusion/business/一日冠9折券.PNG',
  一日冠75折券: '/lottery-fusion/business/一日冠75折.PNG',
  三日冠92折券: '/lottery-fusion/business/三日冠92折.PNG',
  三日冠9折券: '/lottery-fusion/business/三日冠9折券.PNG',
  一周冠92折券: '/lottery-fusion/business/一周冠92折.PNG',
  一周冠9折券: '/lottery-fusion/business/一周冠9折.PNG',
  '3位数靓号卡': '/lottery-fusion/business/3位数靓号.PNG',
  '4位数靓号卡': '/lottery-fusion/business/4位数靓号.PNG',
  '5位数靓号卡': '/lottery-fusion/business/5位数靓号.PNG',
  自定义tag券: '/lottery-fusion/business/自定义tag.PNG',
  自定义礼物券: '/lottery-fusion/business/自定义礼物.PNG',
  小蛋糕代金券: '/lottery-fusion/business/小蛋糕.png',
  抽奖9折券: '/lottery-fusion/business/抽奖9折券.PNG',
  '抽成降1%': '/lottery-fusion/business/抽成降1%.PNG',
};

export const resolveLocalVoucherArt = (prizeName: string) => LOCAL_VOUCHER_ART_BY_PRIZE_NAME[prizeName] ?? null;
