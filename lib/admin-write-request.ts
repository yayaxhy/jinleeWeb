import { isSameOriginKnowledgeWrite } from './knowledge-validation';

type JsonWriteResult = { ok: true; body: Record<string, unknown> } | { ok: false; response: Response };
const reject = (status: number, error: string): JsonWriteResult => ({ ok: false,
  response: Response.json({ ok: false, error }, { status, headers: { 'Cache-Control': 'no-store' } }),
});

/** Authentication remains the caller's responsibility. No writes occur while parsing. */
export async function readAdminJsonWrite(request: Request, publicUrl?: string): Promise<JsonWriteResult> {
  if (!isSameOriginKnowledgeWrite(request, publicUrl)) return reject(403, '请求来源不符，请从当前网站重新操作');
  if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') {
    return reject(415, '请使用 JSON 请求');
  }
  if (!request.body) return reject(400, '请求内容不能为空');
  const reader = request.body.getReader();
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let text = '';
  let bytes = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > 16 * 1024) { await reader.cancel(); return reject(413, '请求内容过长'); }
      text += decoder.decode(chunk.value, { stream: true });
    }
    const body: unknown = JSON.parse(text + decoder.decode());
    if (!body || typeof body !== 'object' || Array.isArray(body)) return reject(400, '请求内容必须是 JSON 对象');
    return { ok: true, body: body as Record<string, unknown> };
  } catch { return reject(400, '请求内容不是有效的 JSON'); }
  finally { reader.releaseLock(); }
}

export function notificationRetryLimit(body: Record<string, unknown>): number | null {
  return typeof body.limit === 'number' && Number.isFinite(body.limit) && body.limit > 0 ? body.limit : null;
}
