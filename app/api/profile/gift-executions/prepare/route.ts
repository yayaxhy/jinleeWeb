import { isAdminDiscordId } from '@/lib/admin';
import { registerGiftRecovery } from '@/lib/gift-execution-recovery';
import { handleGiftRecoveryPrepare } from '@/lib/gift-execution-recovery-request';
import { prisma } from '@/lib/prisma';
import { getServerSession } from '@/lib/session';
import { createTargetConfirmationCodec } from '@/lib/target-confirmation';

export const dynamic = 'force-dynamic';
/** This route only persists a signed intent. No Bot call or financial action. */
export const POST = (request: Request) => handleGiftRecoveryPrepare(request, {
  session: getServerSession, isAdmin: isAdminDiscordId,
  verify: (token, caller, scope) => createTargetConfirmationCodec({ secret: process.env.SESSION_SECRET ?? process.env.NEXTAUTH_SECRET ?? '' }).verify(token, caller, scope),
  register: (session, requestId, prepared) => prisma.$transaction(tx => registerGiftRecovery(tx, session, requestId, prepared), { isolationLevel: 'Serializable' }),
});
