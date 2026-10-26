import type { SessionSnapshot } from '../types/session';
import type { GiftExecutionReview, GiftExecutionIntent } from './gift-execution-client';
import { readAdminJsonWrite } from './admin-write-request';
import { GiftExecutionReviewConflict, normalizeGiftExecutionId, validGiftExecutionLookupId } from './gift-execution-review';

type Prepared = { requestId: string; intent: GiftExecutionIntent; review: GiftExecutionReview | null };
type Dependencies = {
  session: () => Promise<SessionSnapshot | null>;
  isAdmin: (discordId: string) => boolean;
  load: (session: SessionSnapshot, isAdmin: boolean, requestId: string) => Promise<GiftExecutionReview | null>;
  prepareAbandon: (session: SessionSnapshot, isAdmin: boolean, requestId: string, intent?: unknown) => Promise<Prepared | null>;
  abandon: (input: { requestId: string; intent: GiftExecutionIntent }) => Promise<Record<string, unknown>>;
  publicUrl?: string;
};
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
const missing = () => json({ ok: false, message: '暂时无法查询这笔打赏，也无法确认是否已扣款，请保留编号并联系客服，勿重复打赏。' }, 404);
const unknown = (requestId?: string) => json({ ok: false, ...(requestId ? { requestId } : {}),
  message: '暂时无法确认打赏结果，请保留编号查询进度或联系客服，勿重复打赏。' }, 503);
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);

/** Authentication, reading and mutation forwarding are injected separately.
 * No browser-provided intent can override an existing server request. */
export async function handleGiftExecutionReviewRequest(request: Request, deps: Pick<Dependencies, 'session' | 'isAdmin' | 'load'>) {
  if (request.method !== 'GET') return json({ ok: false, message: '查询方式不正确，请刷新页面后再试。' }, 405);
  try {
    const session = await deps.session();
    if (!session) return json({ ok: false, message: '请先登录后查询原请求。' }, 401);
    const params = new URL(request.url).searchParams;
    const rawId = params.get('requestId');
    if (params.getAll('requestId').length !== 1 || [...params.keys()].some(key => key !== 'requestId') || !validGiftExecutionLookupId(rawId)) {
      return json({ ok: false, message: '请输入有效的原打赏请求编号。' }, 400);
    }
    const review = await deps.load(session, !!session.discordId && deps.isAdmin(session.discordId), normalizeGiftExecutionId(rawId));
    return review ? json({ ok: true, review }) : missing();
  } catch (error) { console.error('[gift.review] query failed', error); return unknown(); }
}

export async function handleGiftExecutionAbandonRequest(request: Request, deps: Dependencies) {
  if (request.method !== 'POST') return json({ ok: false, message: '请在页面中确认是否取消这笔打赏。' }, 405);
  const parsed = await readAdminJsonWrite(request, deps.publicUrl);
  if (!parsed.ok) return parsed.response;
  const body = parsed.body;
  if (Object.keys(body).some(key => !['requestId', 'intent'].includes(key)) || !validGiftExecutionLookupId(body.requestId)) {
    return json({ ok: false, message: '暂时无法取消这笔打赏，请保留编号并联系客服核实。' }, 400);
  }
  const requestId = normalizeGiftExecutionId(body.requestId);
  try {
    const session = await deps.session();
    if (!session) return json({ ok: false, message: '请先登录后核实原请求。' }, 401);
    const prepared = await deps.prepareAbandon(session, !!session.discordId && deps.isAdmin(session.discordId), requestId, body.intent);
    if (!prepared) return missing();
    if (prepared.requestId !== requestId) return unknown(requestId);
    if (prepared.review && ['COMPLETED', 'ABANDONED'].includes(prepared.review.status) && prepared.review.verified) {
      return json({ ok: true, requestId, status: prepared.review.status, review: prepared.review });
    }
    if (prepared.review && prepared.review.status !== 'PENDING') throw new GiftExecutionReviewConflict();
    // prepareAbandon selected the stored intent or authorized the complete local
    // v1 intent for a missing request. Never forward body.intent directly.
    const response = await deps.abandon({ requestId, intent: prepared.intent });
    if (response.ok !== true || response.requestId !== requestId || !['COMPLETED', 'ABANDONED'].includes(String(response.status))) return unknown(requestId);
    if (response.status === 'ABANDONED' && (response.giftAuditId !== null || response.result !== null)) return unknown(requestId);
    if (response.status === 'COMPLETED' && (typeof response.giftAuditId !== 'string' || !response.giftAuditId || !object(response.result))) return unknown(requestId);
    // The client follows with GET; the HTTP reply alone does not prove all audit facts.
    return json({ ok: true, requestId, status: response.status, message: '取消申请已收到，请查询打赏进度确认结果。' });
  } catch (error) {
    console.error('[gift.review] cancellation unconfirmed', { requestId, error });
    if (error instanceof GiftExecutionReviewConflict) return json({ ok: false, requestId, message: error.message }, 409);
    return unknown(requestId);
  }
}
