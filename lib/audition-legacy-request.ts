import { readAdminJsonWrite } from './admin-write-request';
import { AuditionLegacyError, type createAuditionLegacyService } from './audition-legacy-transition';

type Deps = {
  session: () => Promise<{ discordId?: string | null; dlmId?: string | null } | null>;
  isAdmin: (id: string) => boolean; service: ReturnType<typeof createAuditionLegacyService>;
  list: (cursor?: string) => Promise<unknown>; evidence: (inviteId: string) => Promise<unknown>; publicUrl?: string;
};
const validId = (v: unknown): v is string => typeof v === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(v);
const respond = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
export async function handleAuditionLegacyRequest(request: Request, deps: Deps) {
  try {
    const session = await deps.session();
    if (!session?.discordId || !deps.isAdmin(session.discordId)) return respond({ ok: false, error: '仅管理员可核实旧试音邀请' }, 403);
    if (request.method === 'GET') {
      const params = new URL(request.url).searchParams;
      if ([...params.keys()].some(k => !['cursor', 'inviteId', 'requestId'].includes(k)) || [...params.keys()].some(k => params.getAll(k).length !== 1) || params.size > 1) {
        return respond({ ok: false, error: '请每次按一种编号查询' }, 400);
      }
      const receiptId = params.get('requestId');
      if (receiptId !== null) return respond({ ok: true, receipt: await deps.service.query(session.discordId, receiptId) });
      const inviteId = params.get('inviteId');
      if (inviteId !== null) {
        if (!validId(inviteId)) return respond({ ok: false, error: '邀请编号无效' }, 400);
        const evidence = await deps.evidence(inviteId);
        return evidence ? respond({ ok: true, evidence }) : respond({ ok: false, error: '未找到原邀请，请核实编号' }, 404);
      }
      const cursor = params.get('cursor');
      if (cursor !== null && !validId(cursor)) return respond({ ok: false, error: '分页编号无效' }, 400);
      return respond({ ok: true, list: await deps.list(cursor ?? undefined) });
    }
    if (request.method !== 'POST') return respond({ ok: false, error: '不支持的请求方法' }, 405);
    const parsed = await readAdminJsonWrite(request, deps.publicUrl); if (!parsed.ok) return parsed.response;
    if (Object.keys(parsed.body).some(k => !['action', 'command', 'previewHash', 'confirmed'].includes(k))) return respond({ ok: false, error: '请求字段无效' }, 400);
    const { action, command, previewHash, confirmed } = parsed.body;
    if (action === 'preview') return respond({ ok: true, preview: await deps.service.preview(session.discordId, command) });
    if (action === 'execute') return respond({ ok: true, receipt: await deps.service.execute(session.discordId, session.dlmId ?? null, command, typeof previewHash === 'string' ? previewHash : '', confirmed === true) });
    return respond({ ok: false, error: '请选择预览或确认补齐' }, 400);
  } catch (error) {
    if (error instanceof AuditionLegacyError) return respond({ ok: false, error: error.message, code: error.code }, error.status);
    return respond({ ok: false, code: 'query_required', error: '未获得可靠结果，请保留原请求编号并查询回执，不要重建请求或重新扣费。' }, 503);
  }
}
