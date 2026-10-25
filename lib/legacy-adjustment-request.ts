import { AdjustmentError } from './legacy-adjustment';
import { readAdminJsonWrite } from './admin-write-request';
import type { createLegacyAdjustmentService } from './legacy-adjustment-core';
type Service = ReturnType<typeof createLegacyAdjustmentService>;
type Dependencies = { session: () => Promise<{ discordId?: string | null } | null>; isAdmin: (id: string) => boolean; service: Service; publicUrl?: string };
export async function handleLegacyAdjustmentRequest(request: Request, deps: Dependencies) {
  const respond = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
  const session = await deps.session();
  if (!session?.discordId || !deps.isAdmin(session.discordId)) return respond({ ok: false, error: '仅管理员可访问人工账务处置' }, 403);
  try {
    if (request.method === 'GET') return respond({ ok: true, receipt: await deps.service.query(session.discordId, new URL(request.url).searchParams.get('requestId') ?? '') });
    if (request.method !== 'POST') return respond({ ok: false, error: '不支持的请求方法' }, 405);
    const parsed = await readAdminJsonWrite(request, deps.publicUrl);
    if (!parsed.ok) return parsed.response;
    const { action, command, previewHash, confirmed } = parsed.body;
    if (action === 'preview') return respond({ ok: true, preview: await deps.service.preview(session.discordId, command) });
    if (action === 'execute') return respond({ ok: true, receipt: await deps.service.execute(session.discordId, command, typeof previewHash === 'string' ? previewHash : '', confirmed === true) });
    return respond({ ok: false, error: '请选择预览或提交' }, 400);
  } catch (error) {
    if (error instanceof AdjustmentError) return respond({ ok: false, code: error.code, error: error.message }, error.status);
    // Do not leak SQL, internal hosts, credentials, or assume a transport failure
    // proves that a financial transaction did not commit.
    return respond({ ok: false, code: 'query_required', error: '操作未获得可靠回执，请按原请求编号查询；不要另建一笔退款。' }, 503);
  }
}
