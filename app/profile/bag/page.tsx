import Link from 'next/link';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getServerSession } from '@/lib/session';
import { DiscountUsageButton } from '@/components/profile/DiscountUsageButton';
import { GiftUsageButton, SelfUseButton } from '@/components/profile/GiftAndSelfUseButtons';

const ROME_TIMEZONE = 'Europe/Rome';

const formatDateOnly = (value?: Date | string | null) => {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleDateString('zh-CN', { timeZone: ROME_TIMEZONE });
};

export default async function BagPage() {
  const session = await getServerSession();
  if (!session?.discordId) {
    redirect('/');
  }

  const draws = await prisma.lotteryDraw.findMany({
    where: { userId: session.discordId },
    orderBy: { createdAt: 'desc' },
    include: {
      prize: {
        select: { name: true, pool: true, imageUrl: true, type: true },
      },
    },
    take: 200,
  });

  return (
    <main className="min-h-screen bg-[#f7f3ef] text-[#171717] px-6 py-16">
      <section className="max-w-5xl mx-auto space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.6em] text-gray-500">My Bag</p>
            <h1 className="text-3xl font-semibold tracking-wide">我的背包</h1>
            <p className="text-sm text-gray-500">展示你在 LotteryDraw 中的全部资产。</p>
          </div>
          <Link
            href="/profile"
            className="rounded-full border border-black/10 px-4 py-2 text-xs uppercase tracking-[0.4em] text-gray-600 hover:bg-black/5 transition"
          >
            返回个人主页
          </Link>
        </div>

        <div className="bg-white rounded-[32px] border border-black/5 p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-[#5c43a3]">Lottery 资产</h2>
            <span className="text-xs uppercase tracking-[0.4em] text-gray-500">共 {draws.length} 个</span>
          </div>

          {draws.length === 0 ? (
            <p className="text-gray-500 text-sm">暂无记录。</p>
          ) : (
            <div className="space-y-8">
              {[
                { title: '未使用', list: draws.filter((draw) => draw.status === 'UNUSED') },
                { title: '已使用', list: draws.filter((draw) => draw.status === 'USED') },
                { title: '已过期', list: draws.filter((draw) => draw.status === 'EXPIRED') },
              ].map(({ title, list }) => (
                <div key={title} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-semibold text-[#171717]">{title}</h3>
                      <span className="text-xs uppercase tracking-[0.3em] text-gray-400">{list.length} 个</span>
                    </div>
                  </div>
                  {list.length === 0 ? (
                    <p className="text-sm text-gray-400">暂无{title}记录。</p>
                  ) : (
                    <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                      {list.map((draw) => {
                        const prizeName = draw.prize?.name ?? '未中奖';
                        const prizeType = draw.prize?.type ?? 'COUPON';
                        const isUsed = draw.status === 'USED';
                        const status = draw.status === 'UNUSED' ? '未使用' : draw.status === 'USED' ? '已使用' : '已过期';
                        const metaTime =
                          draw.status === 'UNUSED'
                            ? formatDateOnly(draw.expiresAt)
                            : formatDateOnly(draw.consumeAt ?? draw.expiresAt);

                        return (
                            <div
                              key={draw.id}
                              className="rounded-2xl border border-dashed border-black/10 bg-gradient-to-br from-[#fdfbff] to-[#f6f1ff] p-5 space-y-3 shadow-sm"
                            >
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="px-3 py-1 rounded-full border border-black/10 bg-white/60 text-xs uppercase tracking-[0.3em] text-gray-600">
                                  {status}
                                </span>
                                {draw.status === 'UNUSED' ? (
                                  prizeType === 'COUPON' ? (
                                    <DiscountUsageButton kind="lottery" triggerLabel="使用" />
                                  ) : prizeType === 'GIFT' ? (
                                    <GiftUsageButton lotteryId={draw.id} prizeName={prizeName} />
                                  ) : prizeType === 'SELFUSE' ? (
                                    <SelfUseButton lotteryId={draw.id} prizeName={prizeName} />
                                  ) : null
                                ) : null}
                              </div>
                              <p className="text-lg font-semibold text-[#171717]">{prizeName}</p>
                              <p className="text-sm text-gray-500">{isUsed ? '使用时间' : '到期时间'}：{metaTime}</p>
                            </div>
                            </div>
                          );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
