import Link from 'next/link';
import { redirect } from 'next/navigation';
import { LotteryStatus } from '@prisma/client';
import { LotteryFusionClient } from '@/components/profile/LotteryFusionClient';
import { getCurrentJinleeUser } from '@/lib/current-jinlee-user';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function LotteryFusionPage() {
  const currentUser = await getCurrentJinleeUser();
  if (!currentUser) {
    redirect('/');
  }

  const now = new Date();
  const draws = await prisma.lotteryDraw.findMany({
    where: {
      jinleeId: currentUser.jinleeId,
      status: LotteryStatus.UNUSED,
      consumeAt: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    include: {
      prize: {
        select: {
          name: true,
          pool: true,
          type: true,
          imageUrl: true,
        },
      },
    },
    take: 200,
  });

  const initialItems = draws
    .filter((draw) => draw.prize)
    .map((draw) => ({
      id: draw.id,
      prizeName: draw.prize?.name ?? '未命名奖品',
      prizeType: draw.prize?.type ?? 'COUPON',
      pool: draw.prize?.pool ?? draw.pool,
      expiresAt: draw.expiresAt?.toISOString() ?? null,
      createdAt: draw.createdAt.toISOString(),
    }));

  return (
    <main className="min-h-screen bg-[#f7f3ef] px-6 py-16 text-[#171717]">
      <section className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/profile"
              className="rounded-full border border-black/10 px-4 py-2 text-xs uppercase tracking-[0.3em] text-gray-500 hover:bg-black/5"
            >
              返回个人主页
            </Link>
            <Link
              href="/profile/bag"
              className="rounded-full border border-black/10 px-4 py-2 text-xs uppercase tracking-[0.3em] text-gray-500 hover:bg-black/5"
            >
              返回背包
            </Link>
          </div>
        </div>

        <LotteryFusionClient initialItems={initialItems} />
      </section>
    </main>
  );
}
