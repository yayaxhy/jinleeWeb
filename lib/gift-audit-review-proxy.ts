import { isSameOriginKnowledgeWrite } from './knowledge-validation';
import { parseGiftReviewCommand, validGiftReviewId } from './gift-audit-review';

type Dependencies = {
  session: () => Promise<{ discordId?: string | null } | null>;
  isAdmin: (discordId: string) => boolean;
  get: (path: string) => Promise<unknown>;
  post: (path: string, body: Record<string, unknown>) => Promise<unknown>;
  publicUrl?: string;
};
const PATH = '/internal/gift-audit-review';
const MAX_BYTES = 16 * 1024;
const fail = (status: number, message: string) => Response.json({ ok: false, message }, { status, headers: { 'Cache-Control': 'no-store' } });

async function readBody(request: Request): Promise<unknown> {
  if (!request.body) throw new Error('invalid_json');
  const reader = request.body.getReader();
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let bytes = 0;
  let text = '';
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > MAX_BYTES) { await reader.cancel().catch(() => undefined); throw new Error('too_large'); }
      text += decoder.decode(chunk.value, { stream: true });
    }
    text += decoder.decode();
    return JSON.parse(text);
  } finally { reader.releaseLock(); }
}

/** Pure injectable proxy. Admin identity is taken only from the authenticated session. */
export async function handleGiftAuditReviewRequest(request: Request, deps: Dependencies) {
  if (!['GET', 'POST'].includes(request.method)) return fail(405, '不支持的请求方式');
  try {
    const session = await deps.session();
    if (!session?.discordId || !deps.isAdmin(session.discordId)) return fail(403, '仅管理员可查看和补充核实记录');
    let result: unknown;
    if (request.method === 'GET') {
      const params = new URL(request.url).searchParams;
      const transactionId = params.get('transactionId');
      const before = params.get('beforeNoteId');
      if (params.getAll('transactionId').length !== 1 || params.getAll('beforeNoteId').length > 1 ||
        [...params.keys()].some((key) => !['transactionId', 'beforeNoteId'].includes(key)) ||
        !validGiftReviewId(transactionId) || (before !== null && !validGiftReviewId(before))) return fail(400, '查询参数无效');
      result = await deps.get(`${PATH}?transactionId=${encodeURIComponent(transactionId)}${before ? `&beforeNoteId=${encodeURIComponent(before)}` : ''}`);
    } else {
      if (!isSameOriginKnowledgeWrite(request, deps.publicUrl)) return fail(403, '请求来源不符，请从当前网站重新操作');
      if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') return fail(415, '请求格式错误');
      const length = request.headers.get('content-length');
      if (length && (!/^\d+$/.test(length) || Number(length) > MAX_BYTES)) return fail(413, '核实记录过长');
      let body: unknown;
      try { body = await readBody(request); } catch (error) {
        return fail(error instanceof Error && error.message === 'too_large' ? 413 : 400, '请求格式错误或内容过长');
      }
      const command = parseGiftReviewCommand(body);
      if (!command) return fail(400, '请核对流水编号、10–2000 字说明及最多 8 条凭证引用');
      result = await deps.post(PATH, { ...command, actorDiscordId: session.discordId });
    }
    if (!result || typeof result !== 'object' || !('ok' in result) || result.ok !== true ||
      !('automaticReversalAuthorized' in result) || result.automaticReversalAuthorized !== false) return fail(503, '核实服务响应无效');
    return Response.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const status = error && typeof error === 'object' && 'status' in error ? error.status : null;
    const safe = error && typeof error === 'object' && 'safeMessage' in error && error.safeMessage === true;
    const message = safe && error instanceof Error && error.message.length <= 500 ? error.message : '核实服务暂不可用，请查询确认提交结果后再重试';
    return fail(typeof status === 'number' && [400, 404, 409, 413, 415, 503].includes(status) ? status : 503, message);
  }
}
