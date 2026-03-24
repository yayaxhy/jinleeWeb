import type { FarmSeedTypeValue } from '@/lib/farmConfig';

export type FarmGrowthStage = 'SPROUT' | 'YOUNG' | 'MATURE' | 'READY';

export const FARM_SCENE_ASSETS = {
  manorBase: '/farm/manor-base.svg',
  cloud: '/farm/cloud.svg',
  butterfly: '/farm/butterfly.svg',
  woodSign: '/farm/wood-sign.svg',
  plotFrame: '/farm/plot-frame.svg',
  plotEmpty: '/farm/plot-empty.svg',
  plotHarvested: '/farm/plot-harvested.svg',
  plotLocked: '/farm/locked-plot.svg',
} as const;

export const FARM_CROP_ASSETS: Record<FarmSeedTypeValue, Record<FarmGrowthStage, string>> = {
  WHEAT: {
    SPROUT: '/farm/wheat-sprout.svg',
    YOUNG: '/farm/wheat-young.svg',
    MATURE: '/farm/wheat-mature.svg',
    READY: '/farm/wheat-ready.svg',
  },
  ROSE: {
    SPROUT: '/farm/rose-sprout.svg',
    YOUNG: '/farm/rose-young.svg',
    MATURE: '/farm/rose-mature.svg',
    READY: '/farm/rose-ready.svg',
  },
  KOI_FLOWER: {
    SPROUT: '/farm/koi-flower-sprout.svg',
    YOUNG: '/farm/koi-flower-young.svg',
    MATURE: '/farm/koi-flower-mature.svg',
    READY: '/farm/koi-flower-ready.svg',
  },
  MYSTERY_FRUIT: {
    SPROUT: '/farm/mystery-fruit-sprout.svg',
    YOUNG: '/farm/mystery-fruit-young.svg',
    MATURE: '/farm/mystery-fruit-mature.svg',
    READY: '/farm/mystery-fruit-ready.svg',
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
