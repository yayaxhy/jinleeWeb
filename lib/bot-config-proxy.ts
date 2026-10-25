import { parseBotSettings, type BotConfigState } from './bot-config';
import { isSameOriginKnowledgeWrite } from './knowledge-validation';

// Settings and the optional reason now arrive together. Each Bot command
// remains within its existing 8 KiB limit after splitting the request.
const MAX_BODY_BYTES = 10 * 1024;
const BOT_CONFIG_PATH = '/internal/bot-config';

type Dependencies = {
  session: () => Promise<{ discordId?: string | null } | null>;
  isAdmin: (discordId: string) => boolean;
  get: (path: string) => Promise<unknown>;
  post: (path: string, body: Record<string, unknown>) => Promise<unknown>;
  publicUrl?: string;
};

class RequestError extends Error {
  constructor(public status: number, public code: string) { super(code); }
}

type PublicationStatus = 'not_attempted' | 'rejected' | 'unconfirmed';
const fail = (status: number, error: string, message?: string, publicationStatus?: PublicationStatus) => Response.json({ ok: false, error, ...(message ? { message } : {}), ...(publicationStatus ? { publicationStatus, refreshRequired: true } : {}) }, {
  status, headers: { 'Cache-Control': 'no-store' },
});

async function readBoundedJson(request: Request): Promise<unknown> {
  if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') {
    throw new RequestError(415, 'unsupported_media_type');
  }
  const declaredLength = request.headers.get('content-length');
  if (declaredLength && (!/^\d+$/.test(declaredLength) || Number(declaredLength) > MAX_BODY_BYTES)) {
    throw new RequestError(413, 'payload_too_large');
  }
  if (!request.body) throw new RequestError(400, 'invalid_json');
  const reader = request.body.getReader();
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let bytes = 0;
  let text = '';
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > MAX_BODY_BYTES) {
        await reader.cancel().catch(() => undefined);
        throw new RequestError(413, 'payload_too_large');
      }
      text += decoder.decode(chunk.value, { stream: true });
    }
    text += decoder.decode();
    return JSON.parse(text);
  } catch (error) {
    if (error instanceof RequestError) throw error;
    throw new RequestError(400, 'invalid_json');
  } finally {
    reader.releaseLock();
  }
}

function commandFrom(value: unknown, actorDiscordId: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new RequestError(400, 'invalid_request');
  const body = value as Record<string, unknown>;
  if (!Number.isSafeInteger(body.expectedRevision) || Number(body.expectedRevision) < 0) throw new RequestError(400, 'invalid_request');
  const base = { action: body.action, expectedRevision: body.expectedRevision, actorDiscordId };
  const keys = ['action', 'expectedRevision', 'actorDiscordId'];
  if (body.action === 'save' || body.action === 'saveAndPublish') {
    const settings = parseBotSettings(body.settings);
    if (!settings || Object.keys(body).some((key) => ![...keys, 'settings', ...(body.action === 'saveAndPublish' ? ['reason'] : [])].includes(key))) throw new RequestError(400, 'invalid_request');
    if (body.action === 'saveAndPublish') {
      if (Number(body.expectedRevision) > Number.MAX_SAFE_INTEGER - 2) throw new RequestError(400, 'invalid_request');
      return { ...base, settings, reason: optionalReason(body.reason, '后台保存并发布（未填写原因）') };
    }
    return { ...base, settings };
  }
  if (body.action !== 'publish' && body.action !== 'rollback') throw new RequestError(400, 'invalid_request');
  const reason = optionalReason(body.reason, body.action === 'rollback' ? '后台回滚（未填写原因）' : '后台发布（未填写原因）');
  if (Object.keys(body).some((key) => ![...keys, 'reason', ...(body.action === 'rollback' ? ['targetVersion'] : [])].includes(key))) throw new RequestError(400, 'invalid_request');
  if (body.action === 'rollback') {
    if (!Number.isSafeInteger(body.targetVersion) || Number(body.targetVersion) < 1) throw new RequestError(400, 'invalid_request');
    return { ...base, reason, targetVersion: body.targetVersion };
  }
  return { ...base, reason };
}

function optionalReason(value: unknown, fallback: string): string {
  if (value !== undefined && (typeof value !== 'string' || value.trim().length > 300)) throw new RequestError(400, 'invalid_request');
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function stateFrom(value: unknown): BotConfigState {
  if (!value || typeof value !== 'object') throw new Error('invalid_bot_response');
  const result = value as BotConfigState;
  if (result.ok !== true || typeof result.enabled !== 'boolean' || !result.runtime || !result.effective || !result.poll) throw new Error('invalid_bot_response');
  // Select the documented public fields and never forward an internal error.
  const state: BotConfigState = {
    ok: true, enabled: result.enabled, guildId: result.guildId,
    runtime: { source: result.runtime.source, appliedVersion: result.runtime.appliedVersion, appliedAt: result.runtime.appliedAt },
    effective: result.effective,
    poll: { lastCheckedAt: result.poll.lastCheckedAt, lastError: result.poll.lastError ? 'bot_config_poll_failed' : null },
    ...(result.enabled ? {
      revision: result.revision, activeVersion: result.activeVersion, active: result.active,
      draft: result.draft, draftUpdatedBy: result.draftUpdatedBy, draftUpdatedAt: result.draftUpdatedAt,
      history: result.history, nextBeforeVersion: result.nextBeforeVersion,
    } : {}),
  };
  return state;
}

function responseFrom(value: unknown) {
  return Response.json(stateFrom(value), { headers: { 'Cache-Control': 'no-store' } });
}

/** No database or network dependencies are loaded by this injectable handler. */
export async function handleBotConfigRequest(request: Request, deps: Dependencies): Promise<Response> {
  let publicationStatus: PublicationStatus | undefined;
  try {
    if (request.method !== 'GET' && request.method !== 'POST') return fail(405, 'method_not_allowed');
    const session = await deps.session();
    if (!session?.discordId || !deps.isAdmin(session.discordId)) return fail(403, 'forbidden');
    if (request.method === 'POST') {
      if (!isSameOriginKnowledgeWrite(request, deps.publicUrl)) return fail(403, 'invalid_origin');
      const command = commandFrom(await readBoundedJson(request), session.discordId);
      if (command.action === 'saveAndPublish') {
        // Never publish a revision read back from inspect(): another admin may
        // already have changed it after our save committed. Only our exact next
        // revision can authorize the publish, with no automatic retries.
        const savedRevision = Number(command.expectedRevision) + 1;
        publicationStatus = 'not_attempted';
        const saved = stateFrom(await deps.post(BOT_CONFIG_PATH, {
          action: 'save', expectedRevision: command.expectedRevision,
          actorDiscordId: session.discordId, settings: command.settings,
        }));
        if (!saved.enabled || saved.revision !== savedRevision || saved.draftUpdatedBy !== session.discordId
          || JSON.stringify(parseBotSettings(saved.draft)) !== JSON.stringify(command.settings)) {
          throw new RequestError(409, 'config_conflict');
        }
        publicationStatus = 'unconfirmed';
        return responseFrom(await deps.post(BOT_CONFIG_PATH, {
          action: 'publish', expectedRevision: savedRevision,
          actorDiscordId: session.discordId, reason: command.reason,
        }));
      }
      if (command.action === 'publish' || command.action === 'rollback') publicationStatus = 'unconfirmed';
      return responseFrom(await deps.post(BOT_CONFIG_PATH, command));
    }
    const params = new URL(request.url).searchParams;
    const before = params.get('beforeVersion');
    if (before !== null && (params.getAll('beforeVersion').length !== 1 || !/^[1-9]\d*$/.test(before) || !Number.isSafeInteger(Number(before)))) {
      return fail(400, 'invalid_cursor');
    }
    return responseFrom(await deps.get(`${BOT_CONFIG_PATH}${before === null ? '' : `?beforeVersion=${Number(before)}`}`));
  } catch (error) {
    if (error instanceof RequestError) return fail(error.status, error.code, undefined, publicationStatus);
    const status = error && typeof error === 'object' && 'status' in error ? error.status : null;
    const markedSafe = error && typeof error === 'object' && 'safeMessage' in error && error.safeMessage === true;
    const rawMessage = error instanceof Error ? error.message : null;
    const message = markedSafe && rawMessage?.trim() && rawMessage.length <= 500 ? rawMessage.trim() : undefined;
    // Bot validation and concurrency errors remain distinguishable without
    // exposing its response body, request headers or connection details.
    if (publicationStatus === 'unconfirmed' && [400, 404, 409, 422].includes(Number(status))) publicationStatus = 'rejected';
    if (status === 409) return fail(409, 'config_conflict', message, publicationStatus);
    if (status === 400 || status === 422) return fail(400, 'config_rejected', message, publicationStatus);
    if (status === 404) return fail(404, 'version_not_found', message, publicationStatus);
    return fail(503, 'bot_unavailable', undefined, publicationStatus);
  }
}
