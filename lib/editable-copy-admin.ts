import { COPY_MAX_BYTES } from './editable-copy-contract';
import { EditableCopyError, parseCopyScope, type CopyScope } from './editable-copy-service';
import { isSameOriginKnowledgeWrite } from './knowledge-validation';

type Dependencies = {
  session: () => Promise<{ discordId?: string | null } | null>;
  isAdmin: (id: string) => boolean;
  enabled: () => boolean;
  inspect: (scope: CopyScope, beforeVersion?: number) => Promise<unknown>;
  execute: (scope: CopyScope, value: unknown, actorId: string) => Promise<unknown>;
  publicUrl?: string;
};
const json = (value: unknown, status = 200) => Response.json(value, { status, headers: { 'Cache-Control': 'no-store' } });
async function readJson(request: Request) {
  if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') throw new EditableCopyError(415, '请使用 JSON 请求');
  if (!request.body) throw new EditableCopyError(400, '请求内容不能为空');
  const reader = request.body.getReader();
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let text = ''; let bytes = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > COPY_MAX_BYTES + 4096) { await reader.cancel(); throw new EditableCopyError(413, '文案请求超过大小限制'); }
      text += decoder.decode(chunk.value, { stream: true });
    }
    return JSON.parse(text + decoder.decode()) as unknown;
  } catch (error) {
    if (error instanceof EditableCopyError) throw error;
    throw new EditableCopyError(400, '请求不是有效的 JSON');
  } finally { reader.releaseLock(); }
}
export async function handleEditableCopyAdmin(request: Request, deps: Dependencies): Promise<Response> {
  try {
    if (request.method !== 'GET' && request.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405);
    const session = await deps.session();
    if (!session?.discordId || !deps.isAdmin(session.discordId)) return json({ ok: false, error: 'forbidden', message: '仅管理员可以编辑文案' }, 403);
    if (request.method === 'GET') {
      const params = new URL(request.url).searchParams;
      if (params.getAll('scope').length !== 1 || params.getAll('beforeVersion').length > 1 || [...params.keys()].some(key => !['scope', 'beforeVersion'].includes(key))) throw new EditableCopyError(400, '查询参数无效');
      const scope = parseCopyScope(params.get('scope'));
      const before = params.get('beforeVersion');
      if (before !== null && (!/^[1-9]\d*$/.test(before) || !Number.isSafeInteger(Number(before)))) throw new EditableCopyError(400, '分页编号无效');
      return json(await deps.inspect(scope, before === null ? undefined : Number(before)));
    }
    if (!isSameOriginKnowledgeWrite(request, deps.publicUrl)) return json({ ok: false, error: 'invalid_origin', message: '请从当前网站后台提交' }, 403);
    if (!deps.enabled()) throw new EditableCopyError(503, '文案配置尚未启用');
    const body = await readJson(request);
    const scope = parseCopyScope(body && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, unknown>).scope : null);
    return json({ ...await deps.execute(scope, body, session.discordId) as object, enabled: true });
  } catch (error) {
    if (error instanceof EditableCopyError) return json({ ok: false, error: error.status === 409 ? 'config_conflict' : 'copy_request_rejected', message: error.message }, error.status);
    console.error('[editable-copy] management request failed');
    return json({ ok: false, error: 'copy_unavailable', message: '暂时无法确认文案配置结果，请刷新核对。你的输入应保留。' }, 503);
  }
}
