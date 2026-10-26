import { canManageGuildOperations, isAdminDiscordId } from '@/lib/admin';
import { loadGiftExecutionReview } from '@/lib/gift-execution-review';
import { handleGiftExecutionReviewRequest } from '@/lib/gift-execution-review-request';
import { prisma } from '@/lib/prisma';
import { getServerSession } from '@/lib/session';

export const dynamic = 'force-dynamic';
export const GET = (request: Request) => handleGiftExecutionReviewRequest(request, {
  session: getServerSession, isAdmin: canManageGuildOperations,
  load: (session, isAdmin, requestId) => prisma.$transaction(tx => loadGiftExecutionReview(tx, session, isAdmin, requestId, isAdminDiscordId(session.discordId)), { isolationLevel: 'RepeatableRead' }),
});
