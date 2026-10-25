import { DEFAULT_RUNTIME_PRESENTATION, validateRuntimePresentation, type RuntimePresentation } from './runtime-presentation';
import { DEFAULT_ORDER_REQUEST_COPY, validateOrderRequestCopy, type OrderRequestCopy } from './order-request-copy';

type ChannelSettings = {
  orderBroadcastChannelIds: string[];
  orderAnonChannelId: string;
  orderPublicAcceptChannelIds: string[];
};

export type BotSettings = ChannelSettings & ({
  schemaVersion: 1;
} | {
  schemaVersion: 2;
  orderRequestCopy: OrderRequestCopy;
} | {
  schemaVersion: 3;
  orderRequestCopy: OrderRequestCopy;
  presentation: RuntimePresentation;
});
export type CurrentBotSettings = ChannelSettings & { schemaVersion: 3; orderRequestCopy: OrderRequestCopy; presentation: RuntimePresentation };

export const copyFromSettings = (settings: BotSettings): OrderRequestCopy =>
  settings.schemaVersion === 1 ? { ...DEFAULT_ORDER_REQUEST_COPY } : { ...settings.orderRequestCopy };

export const presentationFromSettings = (settings: BotSettings): RuntimePresentation =>
  settings.schemaVersion === 3 ? { ...settings.presentation } : { ...DEFAULT_RUNTIME_PRESENTATION };

export type BotConfigVersion = {
  guildId: string;
  version: number;
  settings: BotSettings;
  createdBy: string;
  reason: string;
  rollbackOf: number | null;
  createdAt: string;
};

export type BotConfigState = {
  ok: true;
  enabled: boolean;
  guildId: string;
  revision?: number;
  activeVersion?: number;
  active?: BotConfigVersion | null;
  draft?: BotSettings | null;
  draftUpdatedBy?: string | null;
  draftUpdatedAt?: string | null;
  history?: BotConfigVersion[];
  nextBeforeVersion?: number | null;
  runtime: { source: 'environment' | 'published'; appliedVersion: number | null; appliedAt: string | null };
  effective: BotSettings;
  poll: { lastCheckedAt: string | null; lastError: string | null };
};

const SETTING_KEYS = ['schemaVersion', 'orderBroadcastChannelIds', 'orderAnonChannelId', 'orderPublicAcceptChannelIds'];
const isChannelId = (value: unknown): value is string => typeof value === 'string' && /^\d{17,20}$/.test(value);

/** Shared write validation; runtime environment values may still be incomplete. */
export function parseBotSettings(value: unknown): CurrentBotSettings | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const settings = value as Record<string, unknown>;
  const keys = [...SETTING_KEYS, ...(settings.schemaVersion === 2 || settings.schemaVersion === 3 ? ['orderRequestCopy'] : []), ...(settings.schemaVersion === 3 ? ['presentation'] : [])];
  if (Object.keys(settings).some((key) => !keys.includes(key)) || (settings.schemaVersion !== 1 && settings.schemaVersion !== 2 && settings.schemaVersion !== 3)) return null;
  const validList = (list: unknown, minimum: number): list is string[] =>
    Array.isArray(list) && list.length >= minimum && list.length <= 10 && list.every(isChannelId) && new Set(list).size === list.length;
  if (!validList(settings.orderBroadcastChannelIds, 1) || !isChannelId(settings.orderAnonChannelId) || !validList(settings.orderPublicAcceptChannelIds, 0)) return null;
  let orderRequestCopy: OrderRequestCopy;
  let presentation: RuntimePresentation;
  try {
    orderRequestCopy = settings.schemaVersion === 1 ? { ...DEFAULT_ORDER_REQUEST_COPY } : validateOrderRequestCopy(settings.orderRequestCopy);
    presentation = settings.schemaVersion === 3 ? validateRuntimePresentation(settings.presentation) : { ...DEFAULT_RUNTIME_PRESENTATION };
  }
  catch { return null; }
  return {
    schemaVersion: 3,
    orderBroadcastChannelIds: [...settings.orderBroadcastChannelIds],
    orderAnonChannelId: settings.orderAnonChannelId,
    orderPublicAcceptChannelIds: [...settings.orderPublicAcceptChannelIds],
    orderRequestCopy,
    presentation,
  };
}
