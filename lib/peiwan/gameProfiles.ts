import {
  PEIWAN_GAME_CODES,
  PEIWAN_GAME_CODE_LABEL,
  PEIWAN_GAME_TIER_LABEL,
  type PeiwanGameCodeValue,
  type PeiwanGameTierValue,
} from '@/constants/peiwan';

export type PeiwanGameProfileView = {
  gameCode: PeiwanGameCodeValue;
  tier: PeiwanGameTierValue;
  sourceRoleId?: string | null;
};

const GAME_ORDER = new Map(PEIWAN_GAME_CODES.map((code, index) => [code, index]));

export function sortPeiwanGameProfiles<T extends PeiwanGameProfileView>(profiles: readonly T[]) {
  return [...profiles].sort((a, b) => {
    const left = GAME_ORDER.get(a.gameCode) ?? Number.MAX_SAFE_INTEGER;
    const right = GAME_ORDER.get(b.gameCode) ?? Number.MAX_SAFE_INTEGER;
    return left - right;
  });
}

export function getPeiwanGameLabel(gameCode: PeiwanGameCodeValue) {
  return PEIWAN_GAME_CODE_LABEL[gameCode] ?? gameCode;
}

export function getPeiwanTierLabel(tier: PeiwanGameTierValue) {
  return PEIWAN_GAME_TIER_LABEL[tier] ?? tier;
}

export function formatPeiwanGameProfile(profile: PeiwanGameProfileView) {
  return `${getPeiwanGameLabel(profile.gameCode)} · ${getPeiwanTierLabel(profile.tier)}`;
}
