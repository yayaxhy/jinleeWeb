import { MAX_JOIN_BODY_BYTES, validateJoinApplication, validateJoinImages, type JoinApplication, type JoinImage } from './join-application';

export class JoinDeliveryError extends Error {
  constructor(public code: string, public status = 503, public applicationId?: string) { super(code); }
}
export type JoinReceipt = { applicationId: string; submittedAt: string };
export type JoinSubmitDependencies = {
  origin: string;
  getSession: () => Promise<{ discordId?: string | null } | null>;
  deliver: (application: JoinApplication, images: JoinImage[]) => Promise<JoinReceipt>;
};
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

export async function handleJoinSubmission(request: Request, deps: JoinSubmitDependencies): Promise<Response> {
  let origin: string;
  try { origin = new URL(deps.origin).origin; } catch { return json({ error: '申请服务配置异常，请联系 HR。' }, 503); }
  if (request.headers.get('origin') !== origin || request.headers.get('sec-fetch-site') === 'cross-site') return json({ error: '请求来源无效，请从官网重新打开申请表。' }, 403);
  const session = await deps.getSession().catch(() => null);
  if (!session?.discordId || !/^\d{17,20}$/.test(session.discordId)) return json({ error: '请先通过 Discord 登录后再提交。', code: 'login_required' }, 401);
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) return json({ error: '申请数据格式不正确。' }, 415);
  if (Number(request.headers.get('content-length')) > MAX_JOIN_BODY_BYTES) return json({ error: '图片处理异常，请重新选择图片后重试。' }, 413);
  const reader = request.body?.getReader();
  if (!reader) return json({ error: '申请内容为空。' }, 400);
  const chunks: Uint8Array[] = [];
  let size = 0;
  let raw: unknown;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_JOIN_BODY_BYTES) { await reader.cancel(); return json({ error: '图片处理异常，请重新选择图片后重试。' }, 413); }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    raw = JSON.parse(new TextDecoder().decode(bytes));
  } catch { return json({ error: '申请数据不完整，请重试。' }, 400); }
  const body = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
  // The browser cannot choose the applicant identity; always use the signed session.
  const application = validateJoinApplication(body.application, session.discordId);
  const images = validateJoinImages(body.images, application.data.assessment);
  const errors = { ...application.errors, ...images.errors };
  if (Object.keys(errors).length) return json({ error: '请检查并补全申请资料。', fields: errors }, 400);
  try {
    const receipt = await deps.deliver(application.data, images.images);
    return json({ ok: true, ...receipt });
  } catch (error) {
    if (error instanceof JoinDeliveryError) {
      const messages: Record<string, string> = {
        recruitment_cooldown: '你刚刚提交过申请，请等待 10 分钟再提交修改后的资料。',
        delivery_uncertain: '暂时无法确认发送结果。请联系 HR 并提供下方申请编号，避免重复提交。',
        delivery_in_progress: '申请正在发送，请稍后重试；系统会避免重复发送。',
        recruitment_unavailable: 'HR 接收服务暂时不可用，请稍后重试。',
        discord_membership_required: '请先加入 DLM Discord 服务器，再回来提交申请。已填写的资料会保留在当前页面，无需刷新。',
        discord_membership_check_failed: '暂时无法确认你是否已加入 DLM 服务器，请稍后使用相同内容重试。',
      };
      return json({ error: messages[error.code] ?? '申请尚未确认送达，请稍后使用相同内容重试。', code: error.code, applicationId: error.applicationId }, error.status);
    }
    return json({ error: '申请尚未确认送达，请稍后使用相同内容重试。' }, 503);
  }
}

export async function deliverJoinApplication(application: JoinApplication, images: JoinImage[]): Promise<JoinReceipt> {
  const host = process.env.INTERNAL_API_HOST ?? '127.0.0.1';
  const port = process.env.INTERNAL_API_PORT;
  const token = process.env.INTERNAL_API_TOKEN;
  if (!port || !token) throw new JoinDeliveryError('recruitment_unavailable');
  let response: Response;
  try {
    response = await fetch(`http://${host}:${port}/internal/recruitment/applications`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Internal-Token': token },
      body: JSON.stringify({ application, images }), signal: AbortSignal.timeout(45000), cache: 'no-store',
    });
  } catch { throw new JoinDeliveryError('recruitment_unavailable'); }
  const body = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok || body.ok !== true) {
    const status = body.error === 'discord_membership_required' && response.status === 403 ? 403 : [409, 429].includes(response.status) ? response.status : 503;
    throw new JoinDeliveryError(typeof body.error === 'string' ? body.error : 'recruitment_unavailable', status, typeof body.applicationId === 'string' ? body.applicationId : undefined);
  }
  if (typeof body.applicationId !== 'string' || !/^JOIN-[a-f0-9]{16}$/.test(body.applicationId) || typeof body.submittedAt !== 'string') throw new JoinDeliveryError('recruitment_unavailable');
  return { applicationId: body.applicationId, submittedAt: body.submittedAt };
}
