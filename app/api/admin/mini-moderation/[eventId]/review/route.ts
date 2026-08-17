import { NextResponse } from 'next/server';
import { canViewTransactions } from '@/lib/admin';
import { prisma } from '@/lib/prisma';
import { getServerSession } from '@/lib/session';

type Params = { eventId: string };

export async function POST(request: Request, context: { params: Promise<Params> }) {
  const session = await getServerSession();
  if (!session?.discordId || !canViewTransactions(session.discordId)) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
  }
  const { eventId } = await context.params;
  await prisma.miniMessageModerationEvent.update({
    where: { id: eventId },
    data: { reviewedAt: new Date() },
  });
  return NextResponse.redirect(new URL('/admin/mini-moderation', request.url), 303);
}
