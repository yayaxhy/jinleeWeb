import { getServerSession } from '@/lib/session';
import { deliverJoinApplication, handleJoinSubmission } from '@/lib/join-submit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  return handleJoinSubmission(request, {
    origin: process.env.NEXTAUTH_URL ?? new URL(request.url).origin,
    getSession: getServerSession,
    deliver: deliverJoinApplication,
  });
}
