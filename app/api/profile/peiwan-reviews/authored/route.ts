import { renderSiteCopy } from "@/lib/site-copy-server";
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from '@/lib/session';

type DeleteAuthoredReviewPayload = {
  reviewId?: string;
};

export async function DELETE(request: Request) {
  const session = await getServerSession();
  if (!session?.discordId) {
    return NextResponse.json({ error: await renderSiteCopy("site.app.api.profile.peiwan.reviews.authored.route.e8041a8c9358") }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as DeleteAuthoredReviewPayload;
  const reviewId = typeof body.reviewId === 'string' ? body.reviewId.trim() : '';
  if (!reviewId) {
    return NextResponse.json({ error: await renderSiteCopy("site.app.api.profile.peiwan.reviews.authored.route.6952b9a4d1b3") }, { status: 400 });
  }

  const review = await prisma.peiwanReview.findUnique({
    where: { id: reviewId },
    select: { id: true, reviewerDiscordId: true },
  });
  if (!review) {
    return NextResponse.json({ error: await renderSiteCopy("site.app.api.profile.peiwan.reviews.authored.route.5e51cdd0d2c6") }, { status: 404 });
  }
  if (review.reviewerDiscordId !== session.discordId) {
    return NextResponse.json({ error: await renderSiteCopy("site.app.api.profile.peiwan.reviews.authored.route.0b41a80369b8") }, { status: 403 });
  }

  await prisma.peiwanReview.delete({
    where: { id: reviewId },
  });

  return NextResponse.json({ ok: true });
}
