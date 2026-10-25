import { prisma } from '@/lib/prisma';
import { getServerSession } from '@/lib/session';
import { isAdminDiscordId } from '@/lib/admin';
import { createLegacyAdjustmentService } from '@/lib/legacy-adjustment-core';
import { handleLegacyAdjustmentRequest } from '@/lib/legacy-adjustment-request';

export const dynamic = 'force-dynamic';
const service = createLegacyAdjustmentService({ db: prisma, isAdmin: isAdminDiscordId });
const dependencies = { session: getServerSession, isAdmin: isAdminDiscordId, service };
export const GET = (request: Request) => handleLegacyAdjustmentRequest(request, dependencies);
export const POST = (request: Request) => handleLegacyAdjustmentRequest(request, dependencies);
