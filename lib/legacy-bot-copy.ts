import { validateCopyTemplate, type EditableCopyEntry } from './editable-copy-contract';
import { InternalBotError } from './internal-bot';

export const LEGACY_BOT_COPY_KEYS = [
  'bot.dispatch.requestHint', 'bot.dispatch.selectedHint', 'bot.dispatch.endedHint',
  'bot.dispatch.closedHint', 'bot.dispatch.title', 'bot.dispatch.description',
  'bot.presentation.welcomeGreeting', 'bot.presentation.welcomeIntro', 'bot.presentation.completionNote',
] as const;

/** Read the Bot's actual guild and runtime state; the website does not infer either. */
export async function loadLegacyBotCopyOverrides(catalog: readonly EditableCopyEntry[], overrides: Record<string, string>) {
  const entries = new Map(catalog.map(entry => [entry.key, entry]));
  const missing = LEGACY_BOT_COPY_KEYS.filter(key => entries.has(key) && !Object.hasOwn(overrides, key));
  if (!missing.length) return {};
  const port = process.env.INTERNAL_API_PORT;
  const token = process.env.INTERNAL_API_TOKEN;
  if (!port || !token) throw new InternalBotError('internal_bot_not_configured');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(`http://${process.env.INTERNAL_API_HOST ?? '127.0.0.1'}:${port}/internal/bot-config`, {
      headers: { 'X-Internal-Token': token }, cache: 'no-store', signal: controller.signal,
    });
    if (!response.ok) throw new InternalBotError('internal_bot_unavailable', response.status);
    const data: unknown = await response.json();
    if (!data || typeof data !== 'object' || Array.isArray(data) || !('enabled' in data) || typeof data.enabled !== 'boolean') {
      throw new InternalBotError('invalid_bot_response');
    }
    if (!data.enabled) return {};
    if (!('overrides' in data) || !data.overrides || typeof data.overrides !== 'object' || Array.isArray(data.overrides)) {
      throw new InternalBotError('invalid_bot_response');
    }
    const values = data.overrides as Record<string, unknown>;
    const inherited: Record<string, string> = {};
    for (const key of LEGACY_BOT_COPY_KEYS) {
      const entry = entries.get(key);
      if (!entry || !Object.hasOwn(values, key)) throw new InternalBotError('invalid_bot_response');
      const value = validateCopyTemplate(entry, values[key]);
      if (!Object.hasOwn(overrides, key)) inherited[key] = value;
    }
    return inherited;
  } finally { clearTimeout(timeout); }
}
