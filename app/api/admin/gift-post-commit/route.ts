import { canManageGuildOperations } from '@/lib/admin';
import { loadGiftPostCommitTasks, prepareGiftPostCommitRetry } from '@/lib/gift-post-commit';
import { handleGiftPostCommitRequest } from '@/lib/gift-post-commit-request';
import { postInternalBot } from '@/lib/internal-bot';
import { prisma } from '@/lib/prisma';
import { getServerSession } from '@/lib/session';

export const dynamic = 'force-dynamic';
const handle = (request: Request) => handleGiftPostCommitRequest(request, {
  session: getServerSession, isAdmin: canManageGuildOperations,
  load: (session, isAdmin, requestId) => prisma.$transaction(tx => loadGiftPostCommitTasks(tx, session, isAdmin, requestId), { isolationLevel: 'RepeatableRead' }),
  prepare: (session, isAdmin, requestId, taskId) => prisma.$transaction(tx => prepareGiftPostCommitRetry(tx, session, isAdmin, requestId, taskId), { isolationLevel: 'RepeatableRead' }),
  retry: input => postInternalBot('/internal/gift-post-commit/retry', input),
});
export const GET = handle;
export const POST = handle;
