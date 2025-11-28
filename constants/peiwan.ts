export const PEIWAN_GAME_TAG_FIELDS = [
  'LOL',
  'CSGO',
  'Valorant',
  'Naraka',
  'OW2',
  'APEX',
  'deltaForce',
  'marvel',
  'singer',
  'PUBG',
  'TFT',
  'R6',
  'tarkov',
  'chat',
  'steam',
  'DOTA',
  'COD',
] as const;

export type PeiwanGameTag = (typeof PEIWAN_GAME_TAG_FIELDS)[number];

export const PEIWAN_FILTER_TAG_FIELDS = [...PEIWAN_GAME_TAG_FIELDS, 'techTag'] as const;
export type PeiwanFilterTag = (typeof PEIWAN_FILTER_TAG_FIELDS)[number];

export const QUOTATION_CODES = ['Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6', 'Q7'] as const;
export type QuotationCodeValue = (typeof QUOTATION_CODES)[number];

export const QUOTATION_CODE_TO_FIELD = {
  Q1: 'quotation_Q1',
  Q2: 'lolPrice',
  Q3: 'valPrice',
  Q4: 'deltaPrice',
  Q5: 'csgoPrice',
  Q6: 'narakaPrice',
  Q7: 'apexPrice',
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
