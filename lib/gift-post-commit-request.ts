import type { SessionSnapshot } from '../types/session';
import { readAdminJsonWrite } from './admin-write-request';
import { normalizeGiftExecutionId, validGiftExecutionLookupId } from './gift-execution-review';
import { GiftPostCommitError, type GiftPostCommitView } from './gift-post-commit';

type Retry = { requestId: string; taskId: string; actorDiscordId: string };
export type GiftPostCommitRequestDeps = {
  session: () => Promise<SessionSnapshot | null>; isAdmin: (discordId: string) => boolean;
  load: (session: SessionSnapshot, isAdmin: boolean, requestId: string) => Promise<GiftPostCommitView>;
  prepare: (session: SessionSnapshot, isAdmin: boolean, requestId: string, taskId: string) => Promise<Retry>;
  retry: (input: Retry) => Promise<Record<string, unknown>>; publicUrl?: string;
};
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
const validTaskId = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 150 && value.trim() === value && !/[\u0000-\u001f\u007f]/.test(value);
const unknown = () => json({ ok: false, message: '后续任务状态暂时无法核实，请只读刷新。此提示不改变原打赏的资金凭证；勿重新打赏。' }, 503);
export async function handleGiftPostCommitRequest(request: Request, deps: GiftPostCommitRequestDeps) {
  if (!['GET', 'POST'].includes(request.method)) return json({ ok: false, message: '不支持此请求方式。' }, 405);
  try {
    const session = await deps.session();
    if (!session) return json({ ok: false, message: '请先登录。' }, 401);
    if (!session.discordId || !deps.isAdmin(session.discordId)) return json({ ok: false, message: '仅管理员可以核实和重试打赏后续任务。' }, 403);
    if (request.method === 'GET') {
      const params = new URL(request.url).searchParams;
      if (params.getAll('requestId').length !== 1 || [...params.keys()].some(key => key !== 'requestId') || !validGiftExecutionLookupId(params.get('requestId'))) {
        return json({ ok: false, message: '请输入有效的原请求编号。' }, 400);
      }
      const view = await deps.load(session, true, normalizeGiftExecutionId(params.get('requestId')!));
      return json({ ok: true, ...view });
    }
    const parsed = await readAdminJsonWrite(request, deps.publicUrl);
    if (!parsed.ok) return parsed.response;
    const body = parsed.body;
    if (Object.keys(body).length !== 2 || Object.keys(body).some(key => !['requestId', 'taskId'].includes(key)) || !validGiftExecutionLookupId(body.requestId) || !validTaskId(body.taskId)) {
      return json({ ok: false, message: '请明确选择原请求下的一项任务；不能指定执行内容或操作人。' }, 400);
    }
    const requestId = normalizeGiftExecutionId(body.requestId);
    const prepared = await deps.prepare(session, true, requestId, body.taskId);
    if (prepared.requestId !== requestId || prepared.taskId !== body.taskId || prepared.actorDiscordId !== session.discordId) return unknown();
    try {
      const result = await deps.retry({ requestId, taskId: body.taskId, actorDiscordId: session.discordId });
      if (result.ok !== true || result.requestId !== requestId || result.taskId !== body.taskId) return unknown();
      return json({ ok: true, requestId, taskId: body.taskId, message: '重试请求已受理，请只读刷新核实任务状态；这不代表消息已经送达。' });
    } catch { return unknown(); }
  } catch (error) {
    return error instanceof GiftPostCommitError ? json({ ok: false, message: error.message }, error.status) : unknown();
  }
}
