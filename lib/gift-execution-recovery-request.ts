import type { SessionSnapshot } from '../types/session';
import { readAdminJsonWrite } from './admin-write-request';
import { TargetConfirmationError, normalizeTargetConfirmationScope, type ConfirmationIdentity, type TargetConfirmationScope, type TargetConfirmationEvidence } from './target-confirmation';
import { buildGiftRecoveryPreparation, GiftRecoveryConflict, isRecoveryKind, isWebGiftRequestId, type GiftRecoveryPreparation, type RecoveryKind } from './gift-execution-recovery';
import type { GiftRecoveryRecord } from './gift-execution-client';
const headers = { 'Cache-Control': 'no-store' };
const errorResponse = (error: unknown) => Response.json({ ok: false,
  error: error instanceof GiftRecoveryConflict || error instanceof TargetConfirmationError ? error.message : '暂时无法确认登记结果，请保留原编号查询赠礼记录。',
}, { status: error instanceof GiftRecoveryConflict || error instanceof TargetConfirmationError ? error.status : 503, headers });
type Access = { session: () => Promise<SessionSnapshot | null>; isAdmin: (discordId: string | null | undefined) => boolean };
async function sessionFor(deps: Access, kind: RecoveryKind) {
  const session = await deps.session();
  if (!session?.dlmId || !session.discordId) throw new GiftRecoveryConflict('请登录后操作。', 401);
  if (kind === 'DELEGATED_GIFT' && !deps.isAdmin(session.discordId)) throw new GiftRecoveryConflict('无权访问。', 403);
  return session;
}
export async function handleGiftRecoveryPrepare(request: Request, deps: Access & {
  verify: (token: unknown, caller: ConfirmationIdentity, scope: TargetConfirmationScope) => TargetConfirmationEvidence;
  register: (session: SessionSnapshot, requestId: string, prepared: GiftRecoveryPreparation) => Promise<{ record: GiftRecoveryRecord; created: boolean }>;
  publicUrl?: string;
}) {
  const parsed = await readAdminJsonWrite(request, deps.publicUrl);
  if (!parsed.ok) return parsed.response;
  try {
    const body = parsed.body;
    if (Object.keys(body).some(key => !['requestId', 'kind', 'confirmationToken', 'scope'].includes(key)) || !isWebGiftRequestId(body.requestId) || !isRecoveryKind(body.kind)) throw new GiftRecoveryConflict('登记参数无效。', 400);
    const session = await sessionFor(deps, body.kind);
    const scope = normalizeTargetConfirmationScope(body.scope);
    const proof = deps.verify(body.confirmationToken, { dlmId: session.dlmId!, discordUserId: session.discordId! }, scope);
    const name = session.username.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 256) || session.dlmId!;
    const prepared = buildGiftRecoveryPreparation(proof, body.kind, name);
    const result = await deps.register(session, body.requestId.toLowerCase(), prepared);
    return Response.json({ ok: true, ...result }, { headers });
  } catch (error) { return errorResponse(error); }
}
export async function handleGiftRecoveryList(request: Request, deps: Access & {
  load: (session: SessionSnapshot, kind: RecoveryKind, cursor: string | null) => Promise<{ records: GiftRecoveryRecord[]; nextCursor: string | null }>;
}) {
  try {
    const params = new URL(request.url).searchParams;
    const kind = params.get('kind');
    if (Array.from(params.keys()).some(key => !['kind', 'cursor'].includes(key)) || params.getAll('kind').length !== 1 || params.getAll('cursor').length > 1 || !isRecoveryKind(kind)) throw new GiftRecoveryConflict('查询参数无效。', 400);
    const session = await sessionFor(deps, kind);
    const result = await deps.load(session, kind, params.get('cursor'));
    return Response.json({ ok: true, ...result }, { headers });
  } catch (error) { return errorResponse(error); }
}
