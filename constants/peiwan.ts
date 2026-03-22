export const PEIWAN_GAME_OPTIONS = [
  { code: 'LOL', label: 'LoL' },
  { code: 'CSGO', label: 'CSGO' },
  { code: 'VAL', label: 'Valorant' },
  { code: 'NARAKA', label: 'Naraka' },
  { code: 'OW', label: 'OW' },
  { code: 'APEX', label: 'Apex' },
  { code: 'DELTA', label: '三角洲' },
  { code: 'MARVEL', label: '漫威争锋' },
  { code: 'TFT', label: 'TFT' },
  { code: 'TARKOV', label: '塔可夫' },
  { code: 'DOTA', label: 'Dota' },
  { code: 'COD', label: 'COD' },
  { code: 'CHAT', label: '哄睡语聊' },
  { code: 'SINGER', label: '歌手' },
] as const;

export type PeiwanGameCodeValue = (typeof PEIWAN_GAME_OPTIONS)[number]['code'];

export const PEIWAN_GAME_CODES = PEIWAN_GAME_OPTIONS.map((item) => item.code) as [
  PeiwanGameCodeValue,
  ...PeiwanGameCodeValue[],
];

export const PEIWAN_GAME_CODE_LABEL = Object.fromEntries(
  PEIWAN_GAME_OPTIONS.map((item) => [item.code, item.label]),
) as Record<PeiwanGameCodeValue, string>;

export const PEIWAN_GAME_TIERS = [
  { code: 'ENTERTAINMENT', label: '娱乐陪玩' },
  { code: 'TRAINEE', label: '见习技术陪玩' },
  { code: 'TECH', label: '技术陪玩' },
  { code: 'MASTER', label: '大神陪玩' },
  { code: 'DEMON_GUARD', label: '魔王护' },
] as const;

export type PeiwanGameTierValue = (typeof PEIWAN_GAME_TIERS)[number]['code'];

export const PEIWAN_GAME_TIER_LABEL = Object.fromEntries(
  PEIWAN_GAME_TIERS.map((item) => [item.code, item.label]),
) as Record<PeiwanGameTierValue, string>;

export const QUOTATION_CODES = ['Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6', 'Q7', 'Q8', 'Q9', 'Q10'] as const;
export type QuotationCodeValue = (typeof QUOTATION_CODES)[number];

export const QUOTATION_CODE_TO_FIELD = {
  Q1: 'quotation_Q1',
  Q2: 'lolPrice',
  Q3: 'valPrice',
  Q4: 'deltaPrice',
  Q5: 'csgoPrice',
  Q6: 'narakaPrice',
  Q7: 'apexPrice',
  Q8: 'owPrice',
  Q9: 'tftPrice',
  Q10: 'steamPrice',
} as const satisfies Record<QuotationCodeValue, string>;

export const PEIWAN_QUOTATION_FIELDS = Object.values(QUOTATION_CODE_TO_FIELD) as [
  (typeof QUOTATION_CODE_TO_FIELD)[keyof typeof QUOTATION_CODE_TO_FIELD],
  ...((typeof QUOTATION_CODE_TO_FIELD)[keyof typeof QUOTATION_CODE_TO_FIELD])[],
];
export type PeiwanQuotationField = (typeof PEIWAN_QUOTATION_FIELDS)[number];

export const PEIWAN_STATUS_OPTIONS = ['free', 'busy'] as const;
export type PeiwanStatusValue = (typeof PEIWAN_STATUS_OPTIONS)[number];

export const PEIWAN_SEX_OPTIONS = ['小姐姐', '小哥哥'] as const;
export type PeiwanSexValue = (typeof PEIWAN_SEX_OPTIONS)[number];

export const PEIWAN_TYPE_OPTIONS = ['娱乐陪玩', '技术陪玩', '大神陪玩'] as const;
export type PeiwanTypeValue = (typeof PEIWAN_TYPE_OPTIONS)[number];

export const PEIWAN_LEVEL_OPTIONS = ['优选陪玩', '明星陪玩', '殿堂陪玩'] as const;
export type PeiwanLevelValue = (typeof PEIWAN_LEVEL_OPTIONS)[number];
