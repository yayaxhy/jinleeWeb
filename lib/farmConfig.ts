export const BALANCE_TO_COINS_RATE = 100;
export const POINTS_TO_COINS_RATE = 10;
export const COINS_TO_POINTS_RATE = 0.01;
export const INITIAL_PLOTS = 4;
export const MAX_PLOTS = 8;

export const PLOT_UNLOCK_COSTS: Record<number, number> = {
  5: 3000,
  6: 6000,
  7: 12000,
  8: 24000,
};

export const FARM_SEED_ORDER = ['WHEAT', 'ROSE', 'KOI_FLOWER', 'MYSTERY_FRUIT'] as const;
export type FarmSeedTypeValue = (typeof FARM_SEED_ORDER)[number];

export type FarmSeedDefinition = {
  code: FarmSeedTypeValue;
  name: string;
  emoji: string;
  description: string;
  costCoins: number;
  minYieldCoins: number;
  maxYieldCoins: number;
  experience: number;
  durationMinutes: number;
  unlockLevel: number;
};

export const FARM_SEEDS: Record<FarmSeedTypeValue, FarmSeedDefinition> = {
  WHEAT: {
    code: 'WHEAT',
    name: '小麦',
    emoji: '🌾',
    description: '适合开荒，成熟快，收益稳定。',
    costCoins: 100,
    minYieldCoins: 112,
    maxYieldCoins: 118,
    experience: 2,
    durationMinutes: 60,
    unlockLevel: 1,
  },
  ROSE: {
    code: 'ROSE',
    name: '玫瑰',
    emoji: '🌹',
    description: '中周期作物，金币回报更高。',
    costCoins: 300,
    minYieldCoins: 336,
    maxYieldCoins: 354,
    experience: 6,
    durationMinutes: 180,
    unlockLevel: 2,
  },
  KOI_FLOWER: {
    code: 'KOI_FLOWER',
    name: '锦鲤花',
    emoji: '🌺',
    description: '高价值作物，适合长线收获。',
    costCoins: 800,
    minYieldCoins: 900,
    maxYieldCoins: 950,
    experience: 15,
    durationMinutes: 480,
    unlockLevel: 4,
  },
  MYSTERY_FRUIT: {
    code: 'MYSTERY_FRUIT',
    name: '神秘果',
    emoji: '🍑',
    description: '长周期高回报，后期主力作物。',
    costCoins: 1500,
    minYieldCoins: 1620,
    maxYieldCoins: 1800,
    experience: 30,
    durationMinutes: 720,
    unlockLevel: 6,
  },
};

export const FARM_LEVEL_THRESHOLDS = [0, 20, 60, 140, 280, 500, 800, 1200] as const;

export function getFarmLevel(experience: number) {
  let level = 1;
  for (let index = 0; index < FARM_LEVEL_THRESHOLDS.length; index += 1) {
    if (experience >= FARM_LEVEL_THRESHOLDS[index]) {
      level = index + 1;
    }
  }
  return level;
}

export function getNextFarmLevelExperience(experience: number) {
  return FARM_LEVEL_THRESHOLDS.find((threshold) => threshold > experience) ?? null;
}

export function getFarmSeedDurationLabel(minutes: number) {
  if (minutes % 60 === 0) {
    const hours = minutes / 60;
    return `${hours} 小时`;
  }
  return `${minutes} 分钟`;
}
