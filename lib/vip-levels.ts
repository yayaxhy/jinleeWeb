const VIP_LEVELS = [
  { vipLevel: 1, threshold: 500, name: '锦鲤' },
  { vipLevel: 2, threshold: 1500, name: '金锦' },
  { vipLevel: 3, threshold: 3000, name: '玉锦' },
  { vipLevel: 4, threshold: 5000, name: '瑞锦' },
  { vipLevel: 5, threshold: 10000, name: '祥锦' },
  { vipLevel: 6, threshold: 20000, name: '福锦' },
  { vipLevel: 7, threshold: 50000, name: '跃锦' },
  { vipLevel: 8, threshold: 120000, name: '龙门锦' },
  { vipLevel: 9, threshold: 210000, name: '化龙锦' },
  { vipLevel: 10, threshold: 340000, name: '隐龙锦' },
  { vipLevel: 11, threshold: 520000, name: '游龙锦' },
  { vipLevel: 12, threshold: 880000, name: '御龙锦' },
] as const;

export const getVipLevelName = (vipLevel: number | null | undefined) =>
  VIP_LEVELS.find((tier) => tier.vipLevel === vipLevel)?.name ?? null;

export const getVipLevelLabel = (vipLevel: number | null | undefined) => {
  const name = getVipLevelName(vipLevel);
  return name && vipLevel ? `VIP ${vipLevel} ${name}` : null;
};

export const getHighestVipLevelByTotalSpent = (value: number | string | null | undefined) => {
  const totalSpent = Number(value ?? 0);
  if (!Number.isFinite(totalSpent) || totalSpent <= 0) {
    return 0;
  }

  let level = 0;
  for (const tier of VIP_LEVELS) {
    if (totalSpent >= tier.threshold) {
      level = tier.vipLevel;
    } else {
      break;
    }
  }
  return level;
};
