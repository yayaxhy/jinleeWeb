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

const TAG_LABEL_BY_ID: Record<string, string> = {
  '1478020917404893321': '三角洲魔王护',
  '1446160852473483315': '瓦 - 大神陪玩',
  '1446160838535942287': '三角洲大神陪玩',
  '1446164005189062819': 'CS大神陪玩',
  '1446160863089393736': 'Apex大神陪玩',
  '1446160854352531588': 'LoL大神陪玩',
  '1446160861977776128': 'TFT大神陪玩',
  '1446160853324791900': 'OW大神陪玩',
  '1446160737478119576': 'Naraka大神陪玩',
  '1446163998587228221': 'COD大神陪玩',
  '1446164001468973147': '塔可夫大神陪玩',
  '1446164003410673734': 'DOTA大神陪玩',
  '1446160901026873506': '漫威争锋大神陪玩',
  '1431709900811145391': '瓦 - 技术陪玩',
  '1431708824603201567': '三角洲技术陪玩',
  '1431717739776708939': 'CS技术陪玩',
  '1431714450158653550': 'Apex技术陪玩',
  '1431713191293096069': 'LoL技术陪玩',
  '1431716185048612894': 'TFT技术陪玩',
  '1431708158468030525': 'OW技术陪玩',
  '1431716876420907089': 'COD技术陪玩',
  '1431704913725096038': 'Naraka技术陪玩',
  '1436432836864250059': '塔可夫技术陪玩',
  '1431717320237256715': 'Dota技术陪玩',
  '1431714981669376050': '漫威争锋技术陪玩',
  '1470891285232619613': '瓦见习技术陪玩',
  '1431711303856292021': '哄睡语聊',
  '1431711832292200488': '歌手',
};

const GAME_ORDER = new Map(PEIWAN_GAME_CODES.map((code, index) => [code, index]));
const TIER_ORDER: Record<PeiwanGameTierValue, number> = {
  ENTERTAINMENT: 1,
  TRAINEE: 2,
  TECH: 3,
  MASTER: 4,
  DEMON_GUARD: 5,
};

export function sortPeiwanGameProfiles<T extends PeiwanGameProfileView>(profiles: readonly T[]) {
  return [...profiles].sort((a, b) => {
    const left = GAME_ORDER.get(a.gameCode) ?? Number.MAX_SAFE_INTEGER;
    const right = GAME_ORDER.get(b.gameCode) ?? Number.MAX_SAFE_INTEGER;
    if (left !== right) return left - right;

    const tierOrder = (TIER_ORDER[b.tier] ?? 0) - (TIER_ORDER[a.tier] ?? 0);
    if (tierOrder !== 0) return tierOrder;

    return (a.sourceRoleId ?? '').localeCompare(b.sourceRoleId ?? '');
  });
}

export function getPeiwanGameLabel(gameCode: PeiwanGameCodeValue) {
  return PEIWAN_GAME_CODE_LABEL[gameCode] ?? gameCode;
}

export function getPeiwanTierLabel(tier: PeiwanGameTierValue) {
  return PEIWAN_GAME_TIER_LABEL[tier] ?? tier;
}

export function formatPeiwanGameProfile(profile: PeiwanGameProfileView) {
  const sourceRoleId = profile.sourceRoleId?.trim();
  if (sourceRoleId && TAG_LABEL_BY_ID[sourceRoleId]) {
    return TAG_LABEL_BY_ID[sourceRoleId];
  }
  return `${getPeiwanGameLabel(profile.gameCode)} · ${getPeiwanTierLabel(profile.tier)}`;
}
