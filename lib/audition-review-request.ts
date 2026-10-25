import { validAuditionInviteId, type AuditionReview } from './audition-review';

type Dependencies = {
  session: () => Promise<{ discordId?: string | null } | null>;
  isAdmin: (discordId: string) => boolean;
  load: (inviteId: string) => Promise<AuditionReview | null>;
};
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

/** Injectable GET boundary. Authentication only reads the existing session. */
export async function handleAuditionReviewRequest(request: Request, deps: Dependencies) {
  if (request.method !== 'GET') return json({ ok: false, message: '此页面仅支持只读查询' }, 405);
  try {
    const session = await deps.session();
    if (!session?.discordId || !deps.isAdmin(session.discordId)) return json({ ok: false, message: '仅管理员可查询试音结果' }, 403);
    const params = new URL(request.url).searchParams;
    const inviteId = params.get('inviteId');
    if (params.getAll('inviteId').length !== 1 || [...params.keys()].some(key => key !== 'inviteId') || !validAuditionInviteId(inviteId)) {
      return json({ ok: false, message: '请输入 1–100 位有效邀请编号' }, 400);
    }
    const review = await deps.load(inviteId);
    if (!review) return json({ ok: false, message: '未找到该邀请；这不能证明未扣费，请核对编号并人工查账，勿重新扣费。' }, 404);
    return json({ ok: true, review });
  } catch {
    return json({ ok: false, message: '当前无法核实结果，请保留邀请编号并人工查账，勿再次发起扣费。' }, 503);
  }
}
