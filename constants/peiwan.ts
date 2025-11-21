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

export const PEIWAN_QUOTATION_FIELDS = [
  'quotation_Q1',
  'quotation_Q2',
  'quotation_Q3',
  'quotation_Q4',
  'quotation_Q5',
  'quotation_Q6',
  'quotation_Q7',
] as const;
export type PeiwanQuotationField = (typeof PEIWAN_QUOTATION_FIELDS)[number];

export const PEIWAN_STATUS_OPTIONS = ['free', 'busy'] as const;
export type PeiwanStatusValue = (typeof PEIWAN_STATUS_OPTIONS)[number];

export const PEIWAN_SEX_OPTIONS = ['小姐姐', '小哥哥'] as const;
export type PeiwanSexValue = (typeof PEIWAN_SEX_OPTIONS)[number];

export const PEIWAN_TYPE_OPTIONS = ['娱乐陪玩', '技术陪玩', '大神陪玩'] as const;
export type PeiwanTypeValue = (typeof PEIWAN_TYPE_OPTIONS)[number];

export const PEIWAN_LEVEL_OPTIONS = ['优选陪玩', '明星陪玩', '殿堂陪玩'] as const;
export type PeiwanLevelValue = (typeof PEIWAN_LEVEL_OPTIONS)[number];
