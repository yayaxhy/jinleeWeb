import { readAdminJsonWrite } from './admin-write-request';
import { isGiftRequestId } from './gift-execution-client';

export class GiftForwardRejected extends Error {
  constructor(message: string, public status = 400, public code?: string) { super(message); }
}
/** Only failures before send() may assert not_forwarded. Transport/HTTP errors
 * after that boundary never authorize a new financial request. */
export async function handleGiftExecutionForward<T>(request: Request, deps: {
  prepare: (body: Record<string, unknown>) => Promise<T>;
  send: (payload: T, requestId: string) => Promise<Record<string, unknown>>;
  publicUrl?: string;
}) {
  const parsed = await readAdminJsonWrite(request, deps.publicUrl);
  if (!parsed.ok) return parsed.response;
  if (!isGiftRequestId(parsed.body.requestId)) return Response.json({ ok: false, error: '打赏编号无效，请刷新页面或联系客服核实。' }, { status: 400 });
  const requestId = parsed.body.requestId.toLowerCase();
  let payload: T;
  try { payload = await deps.prepare(parsed.body); }
  catch (error) {
    console.error('[gift.forward] prepare failed', error);
    return Response.json({ ok: false, requestId, not_forwarded: true,
      error: error instanceof GiftForwardRejected ? error.message : '本次打赏尚未提交，请稍后再试或联系客服。',
      ...(error instanceof GiftForwardRejected && error.code ? { code: error.code } : {}),
    }, { status: error instanceof GiftForwardRejected ? error.status : 503, headers: { 'Cache-Control': 'no-store' } });
  }
  try {
    const data = await deps.send(payload, requestId);
    if (data.ok !== true) throw new Error('invalid_response');
    return Response.json({ ...data, requestId }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('[gift.forward] outcome unconfirmed', { requestId, error });
    return Response.json({ ok: false, requestId, error: '暂时无法确认打赏结果，请保留编号查询进度或联系客服，勿重复打赏。' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
