import { canManageGuildOperations } from '@/lib/admin';
import { loadAuditionReview } from '@/lib/audition-review';
import { handleAuditionReviewRequest } from '@/lib/audition-review-request';
import { prisma } from '@/lib/prisma';
import { getServerSession } from '@/lib/session';

export const dynamic = 'force-dynamic';
export const GET = (request: Request) => handleAuditionReviewRequest(request, {
  session: getServerSession,
  isAdmin: canManageGuildOperations,
  load: inviteId => prisma.$transaction(tx => loadAuditionReview(tx, inviteId), { isolationLevel: 'RepeatableRead' }),
});
