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
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as UpdateDisplayModePayload;
  const reviewId = typeof body.reviewId === 'string' ? body.reviewId.trim() : '';
  const mode = body.mode;

  if (!reviewId || !mode || !ALLOWED_MODES.has(mode)) {
    return NextResponse.json({ error: '参数错误' }, { status: 400 });
  }

  const review = await prisma.peiwanReview.findUnique({
    where: { id: reviewId },
    select: { id: true, peiwanDiscordId: true },
  });

  if (!review) {
    return NextResponse.json({ error: '评语不存在' }, { status: 404 });
  }
  if (review.peiwanDiscordId !== session.discordId) {
    return NextResponse.json({ error: '无权限修改该评语' }, { status: 403 });
  }

  await prisma.peiwanReview.update({
    where: { id: reviewId },
    data: { displayMode: mode },
  });

  return NextResponse.json({ ok: true });
}

