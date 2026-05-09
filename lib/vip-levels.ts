const VIP_LEVELS = [
  { vipLevel: 1, threshold: 500 },
  { vipLevel: 2, threshold: 1500 },
  { vipLevel: 3, threshold: 3000 },
  { vipLevel: 4, threshold: 5000 },
  { vipLevel: 5, threshold: 10000 },
  { vipLevel: 6, threshold: 20000 },
  { vipLevel: 7, threshold: 50000 },
  { vipLevel: 8, threshold: 120000 },
  { vipLevel: 9, threshold: 210000 },
  { vipLevel: 10, threshold: 340000 },
  { vipLevel: 11, threshold: 520000 },
  { vipLevel: 12, threshold: 880000 },
] as const;

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
