import { renderSiteCopy } from "@/lib/site-copy-server";
import { NextResponse } from 'next/server';
import { PeiwanReviewDisplayMode } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getServerSession } from '@/lib/session';

type UpdateDisplayModePayload = {
  reviewId?: string;
  mode?: PeiwanReviewDisplayMode;
};

const ALLOWED_MODES = new Set<PeiwanReviewDisplayMode>([
  PeiwanReviewDisplayMode.HIDDEN,
  PeiwanReviewDisplayMode.ANONYMOUS,
  PeiwanReviewDisplayMode.REALNAME,
]);

export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session?.discordId) {
    return NextResponse.json({ error: await renderSiteCopy("site.app.api.profile.peiwan.reviews.display.mode.route.e8041a8c9358") }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as UpdateDisplayModePayload;
  const reviewId = typeof body.reviewId === 'string' ? body.reviewId.trim() : '';
  const mode = body.mode;

  if (!reviewId || !mode || !ALLOWED_MODES.has(mode)) {
    return NextResponse.json({ error: await renderSiteCopy("site.app.api.profile.peiwan.reviews.display.mode.route.3e64edf2ea33") }, { status: 400 });
  }

  const review = await prisma.peiwanReview.findUnique({
    where: { id: reviewId },
    select: { id: true, peiwanDiscordId: true },
  });

  if (!review) {
    return NextResponse.json({ error: await renderSiteCopy("site.app.api.profile.peiwan.reviews.display.mode.route.5e51cdd0d2c6") }, { status: 404 });
  }
  if (review.peiwanDiscordId !== session.discordId) {
    return NextResponse.json({ error: await renderSiteCopy("site.app.api.profile.peiwan.reviews.display.mode.route.cf4872ff6ccc") }, { status: 403 });
  }

  await prisma.peiwanReview.update({
    where: { id: reviewId },
    data: { displayMode: mode },
  });

  return NextResponse.json({ ok: true });
}

