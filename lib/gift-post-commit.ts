import type { Prisma } from '@prisma/client';
import type { SessionSnapshot } from '../types/session';
import { normalizeGiftExecutionId, validGiftExecutionLookupId } from './gift-execution-review';

export type GiftPostCommitTaskView = {
  id: string; kind: string; taskKey: string; status: string; attempts: number;
  claimedAt: string | null; completedAt: string | null; updatedAt: string;
  errorCode: string | null; canRetry: boolean;
  retries: Array<{ actorDiscordId: string; createdAt: string }>;
};
export type GiftPostCommitView = {
  requestId: string; coverage: 'RECORDED' | 'NOT_RECORDED'; message: string; tasks: GiftPostCommitTaskView[];
};
export type GiftPostCommitDb = Pick<Prisma.TransactionClient, 'dlmUser' | 'giftExecutionRequest' | 'giftPostCommitTask'>;
export class GiftPostCommitError extends Error {
  constructor(message: string, public status: number) { super(message); }
}
const taskSelect = {
  id: true, requestId: true, kind: true, taskKey: true, status: true, attempts: true, claimToken: true,
  claimedAt: true, completedAt: true, createdAt: true, updatedAt: true, errorCode: true,
  retries: { orderBy: { createdAt: 'desc' as const }, select: { actorDiscordId: true, createdAt: true } },
} satisfies Prisma.GiftPostCommitTaskSelect;
const knownKinds = new Set(['GIFT_WALL', 'DISCORD_MESSAGE']);
export const canRetryGiftPostCommitTask = (task: { kind: string; status: string; attempts: number; claimToken: string | null; createdAt?: Date }, now = new Date()) =>
  knownKinds.has(task.kind) && task.status === 'FAILED' && Number.isSafeInteger(task.attempts) && task.attempts >= 1 && task.attempts < 3 && task.claimToken === null &&
  (task.kind !== 'DISCORD_MESSAGE' || (task.createdAt instanceof Date && Number.isFinite(task.createdAt.getTime()) && task.createdAt <= now && now.getTime() - task.createdAt.getTime() < 24 * 60 * 60_000));
const knownErrorCodes = new Set(['gift_post_commit_safe_failure', 'gift_post_commit_database_failed', 'gift_post_commit_requires_review',
  'gift_post_commit_send_unknown', 'gift_post_commit_stale_claim']);
const safeErrorCode = (code: string | null) => code === null ? null : knownErrorCodes.has(code) ? code : 'task_error_requires_review';
async function checkSession(db: GiftPostCommitDb, session: SessionSnapshot, isAdmin: boolean) {
  if (!isAdmin || !session.dlmId || !session.discordId) throw new GiftPostCommitError('无权管理打赏后续任务，请使用有效管理员账号。', 403);
  const user = await db.dlmUser.findUnique({ where: { dlmId: session.dlmId }, select: { discordUserId: true, sessionVersion: true, member: { select: { discordUserId: true } } } });
  if (!user || user.discordUserId !== session.discordId || user.member?.discordUserId !== session.discordId || user.sessionVersion !== (session.sessionVersion ?? 1)) {
    throw new GiftPostCommitError('登录身份已变化，请重新登录后核实。', 403);
  }
}
async function checkRequest(db: GiftPostCommitDb, requestId: string) {
  const request = await db.giftExecutionRequest.findUnique({ where: { requestId }, select: { requestId: true, status: true, giftAuditId: true } });
  if (!request) throw new GiftPostCommitError('未找到原请求，不能据此认定未扣费或外部动作未执行。', 404);
  if (request.requestId !== requestId || request.status !== 'COMPLETED' || !request.giftAuditId) {
    throw new GiftPostCommitError('原请求尚无已完成关联凭证，请先核实原打赏，不能重试后续任务。', 409);
  }
}
/** SELECT-only. Internal payload, results and claim tokens never leave this boundary. */
export async function loadGiftPostCommitTasks(db: GiftPostCommitDb, session: SessionSnapshot, isAdmin: boolean, rawRequestId: string): Promise<GiftPostCommitView> {
  if (!validGiftExecutionLookupId(rawRequestId)) throw new GiftPostCommitError('原请求编号无效。', 400);
  await checkSession(db, session, isAdmin);
  const requestId = normalizeGiftExecutionId(rawRequestId);
  await checkRequest(db, requestId);
  const rows = await db.giftPostCommitTask.findMany({ where: { requestId }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], select: taskSelect });
  if (rows.some(row => row.requestId !== requestId)) throw new GiftPostCommitError('任务关联不一致，需要管理员核实。', 409);
  return { requestId, coverage: rows.length ? 'RECORDED' : 'NOT_RECORDED',
    message: rows.length ? '仅展示已记录的礼物墙收集与单条 Discord 消息任务；不代表全部通知或角色同步已完成。礼物墙不再发放奖励，历史已发券及领奖记录保留。消息每 5 分钟检查，创建 24 小时内最多尝试 3 次；私信未知结果可补发，公告未知结果须核实。此处不会撤回已发消息。'
      : '原请求没有后续任务记录，可能属于未覆盖的历史请求；不能据此认定所有外部动作已经完成。',
    tasks: rows.map(row => ({ id: row.id, kind: row.kind, taskKey: row.taskKey, status: row.status, attempts: row.attempts,
      claimedAt: row.claimedAt?.toISOString() ?? null, completedAt: row.completedAt?.toISOString() ?? null, updatedAt: row.updatedAt.toISOString(),
      errorCode: safeErrorCode(row.errorCode), canRetry: canRetryGiftPostCommitTask(row),
      retries: row.retries.map(retry => ({ actorDiscordId: retry.actorDiscordId, createdAt: retry.createdAt.toISOString() })),
    })) };
}
/** Eligibility is re-read immediately before forwarding. Bot performs the final atomic claim/CAS. */
export async function prepareGiftPostCommitRetry(db: GiftPostCommitDb, session: SessionSnapshot, isAdmin: boolean, requestId: string, taskId: string) {
  const view = await loadGiftPostCommitTasks(db, session, isAdmin, requestId);
  const task = view.tasks.find(row => row.id === taskId);
  if (!task) throw new GiftPostCommitError('未找到属于该原请求的任务。', 404);
  if (!task.canRetry) throw new GiftPostCommitError('该任务当前不可安全重试，请刷新后核实；结果未知或正在执行时不会强制重发。', 409);
  return { requestId: view.requestId, taskId: task.id, actorDiscordId: session.discordId! };
}
