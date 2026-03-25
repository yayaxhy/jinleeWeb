import type { FarmSeedTypeValue } from '@/lib/farmConfig';

export type FarmGrowthStage = 'SPROUT' | 'YOUNG' | 'MATURE' | 'READY';

export const FARM_SCENE_ASSETS = {
  manorBase: '/farm/generated/manor-base.webp',
  cloud: '/farm/cloud.svg',
  butterfly: '/farm/butterfly.svg',
  woodSign: '/farm/generated/wood-sign.webp',
  plotFrame: '/farm/generated/plot-frame.webp',
  plotEmpty: '/farm/generated/plot-empty.webp',
  plotHarvested: '/farm/generated/plot-harvested.webp',
  plotLocked: '/farm/locked-plot.svg',
} as const;

export const FARM_CROP_ASSETS: Record<FarmSeedTypeValue, Record<FarmGrowthStage, string>> = {
  WHEAT: {
    SPROUT: '/farm/generated/normalized/wheat-sprout.webp',
    YOUNG: '/farm/generated/normalized/wheat-young.webp',
    MATURE: '/farm/generated/normalized/wheat-mature.webp',
    READY: '/farm/generated/normalized/wheat-ready.webp',
  },
  ROSE: {
    SPROUT: '/farm/generated/normalized/rose-sprout.webp',
    YOUNG: '/farm/generated/normalized/rose-young.webp',
    MATURE: '/farm/generated/normalized/rose-mature.webp',
    READY: '/farm/generated/normalized/rose-ready.webp',
  },
  KOI_FLOWER: {
    SPROUT: '/farm/generated/normalized/koi-flower-sprout.webp',
    YOUNG: '/farm/generated/normalized/koi-flower-young.webp',
    MATURE: '/farm/generated/normalized/koi-flower-mature.webp',
    READY: '/farm/generated/normalized/koi-flower-ready.webp',
  },
  MYSTERY_FRUIT: {
    SPROUT: '/farm/generated/normalized/mystery-fruit-sprout.webp',
    YOUNG: '/farm/generated/normalized/mystery-fruit-young.webp',
    MATURE: '/farm/generated/normalized/mystery-fruit-mature.webp',
    READY: '/farm/generated/normalized/mystery-fruit-ready.webp',
  },
};

export const FARM_EFFECT_ASSETS = {
  // Reserve these names for future generated assets. The UI stays stable when files are swapped in.
  sceneBackdrop: '/farm/manor-base.svg',
  waterShimmer: null as string | null,
  readyGlow: null as string | null,
  harvestBurst: null as string | null,
  fallingLeaves: null as string | null,
} as const;
