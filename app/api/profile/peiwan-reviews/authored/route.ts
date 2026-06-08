import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from '@/lib/session';

type DeleteAuthoredReviewPayload = {
  reviewId?: string;
};

export async function DELETE(request: Request) {
  const session = await getServerSession();
  if (!session?.discordId) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as DeleteAuthoredReviewPayload;
  const reviewId = typeof body.reviewId === 'string' ? body.reviewId.trim() : '';
  if (!reviewId) {
    return NextResponse.json({ error: '缺少评语 ID' }, { status: 400 });
  }

  const review = await prisma.peiwanReview.findUnique({
    where: { id: reviewId },
    select: { id: true, reviewerDiscordId: true },
  });
  if (!review) {
    return NextResponse.json({ error: '评语不存在' }, { status: 404 });
  }
  if (review.reviewerDiscordId !== session.discordId) {
    return NextResponse.json({ error: '无权限删除该评语' }, { status: 403 });
  }

  await prisma.peiwanReview.delete({
    where: { id: reviewId },
  });

  return NextResponse.json({ ok: true });
}
