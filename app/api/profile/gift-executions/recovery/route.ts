import { isAdminDiscordId } from '@/lib/admin';
import { loadGiftRecoveryList } from '@/lib/gift-execution-recovery';
import { handleGiftRecoveryList } from '@/lib/gift-execution-recovery-request';
import { prisma } from '@/lib/prisma';
import { getServerSession } from '@/lib/session';

export const dynamic = 'force-dynamic';
export const GET = (request: Request) => handleGiftRecoveryList(request, {
  session: getServerSession, isAdmin: isAdminDiscordId,
  load: (session, kind, cursor) => prisma.$transaction(tx => loadGiftRecoveryList(tx, session, kind, cursor), { isolationLevel: 'RepeatableRead' }),
});
