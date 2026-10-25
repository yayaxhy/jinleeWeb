import { isAdminDiscordId } from '@/lib/admin';
import { loadGiftExecutionReview, prepareGiftExecutionAbandon } from '@/lib/gift-execution-review';
import { handleGiftExecutionAbandonRequest } from '@/lib/gift-execution-review-request';
import { prisma } from '@/lib/prisma';
import { getServerSession } from '@/lib/session';
import { postVoucherUseRequest } from '@/lib/voucher-internal-request';

export const dynamic = 'force-dynamic';
export const POST = (request: Request) => handleGiftExecutionAbandonRequest(request, {
  session: getServerSession, isAdmin: isAdminDiscordId,
  load: (session, isAdmin, requestId) => prisma.$transaction(tx => loadGiftExecutionReview(tx, session, isAdmin, requestId), { isolationLevel: 'RepeatableRead' }),
  prepareAbandon: (session, isAdmin, requestId, intent) => prisma.$transaction(tx => prepareGiftExecutionAbandon(tx, session, isAdmin, requestId, intent), { isolationLevel: 'RepeatableRead' }),
  abandon: input => {
    const host = process.env.INTERNAL_API_HOST ?? '127.0.0.1';
    const port = process.env.INTERNAL_API_PORT;
    const token = process.env.INTERNAL_API_TOKEN;
    if (!port || !token) throw new Error('internal_unavailable');
    return postVoucherUseRequest({ endpoint: `http://${host}:${port}/internal/gift-execution/abandon`, token, payload: input,
      unconfirmedMessage: '终止结果未确认，请继续只读查询原请求，勿重新赠礼。' });
  },
});
