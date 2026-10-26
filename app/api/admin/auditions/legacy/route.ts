import { canManageGuildOperations } from '@/lib/admin';
import { getServerSession } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { handleAuditionLegacyRequest } from '@/lib/audition-legacy-request';
import { auditionLegacyEvidenceView, listAuditionLegacyInvites, prismaAuditionLegacyService } from '@/lib/audition-legacy-store';
export const dynamic = 'force-dynamic';
const handle = (request: Request) => handleAuditionLegacyRequest(request, {
  session: getServerSession, isAdmin: canManageGuildOperations, service: prismaAuditionLegacyService(prisma),
  list: cursor => prisma.$transaction(tx => listAuditionLegacyInvites(tx, cursor), { isolationLevel: 'RepeatableRead' }),
  evidence: id => prisma.$transaction(tx => auditionLegacyEvidenceView(tx, id), { isolationLevel: 'RepeatableRead' }),
});
export const GET = handle;
export const POST = handle;
