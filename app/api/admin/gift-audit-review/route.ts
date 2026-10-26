import { canManageGuildOperations } from '@/lib/admin';
import { handleGiftAuditReviewRequest } from '@/lib/gift-audit-review-proxy';
import { getInternalBot, postInternalBot } from '@/lib/internal-bot';
import { getServerSession } from '@/lib/session';

export const dynamic = 'force-dynamic';
const dependencies = { session: getServerSession, isAdmin: canManageGuildOperations, get: getInternalBot, post: postInternalBot };
export const GET = (request: Request) => handleGiftAuditReviewRequest(request, dependencies);
export const POST = (request: Request) => handleGiftAuditReviewRequest(request, dependencies);
