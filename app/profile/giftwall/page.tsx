import type { Metadata } from "next";
import { localizeSiteMetadata } from "@/lib/site-copy-metadata";
import { getSiteCopy } from "@/lib/site-copy-server";

import { SiteText } from "@/components/SiteCopyProvider";
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getServerSession } from '@/lib/session';

const ROME_TIMEZONE = 'Europe/Rome';

const formatDate = (value?: Date | string | null) => {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('zh-CN', { timeZone: ROME_TIMEZONE });
};

const defaultMetadata = {
  title: '礼物墙',
};

export async function generateMetadata(): Promise<Metadata> {
  return localizeSiteMetadata(defaultMetadata, await getSiteCopy(), "site.app.profile.giftwall.page");
}


export default async function GiftWallPage() {
  const session = await getServerSession();
  const discordId = session?.discordId;

  if (!discordId) {
    redirect('/');
  }

  const member = await prisma.member.findUnique({
    where: { discordUserId: discordId },
    include: { peiwan: true },
  });

  if (!member) {
    return (
      <main className="min-h-screen bg-black text-white px-6 py-16 flex items-center justify-center">
        <div className="space-y-4 text-center">
          <p className="text-white/70"><SiteText copyKey="site.app.profile.giftwall.page.d7109d1f99b6" /></p>
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-full border border-white/30 px-6 py-2 text-sm uppercase tracking-[0.2em] hover:bg-white/10"
          ><SiteText copyKey="site.app.profile.giftwall.page.20b6e2fcece9" /></Link>
        </div>
      </main>
    );
  }

  const isPeiwanMember = member.status === 'PEIWAN';
  const displayName = session?.username ?? member.serverDisplayName ?? member.discordUserId;

  const [gifts, giftUnlocks] = isPeiwanMember
    ? await Promise.all([
        prisma.gift.findMany({
          select: { GiftName: true, price: true, active: true, giftImage: { select: { fileName: true, category: true } } },
          orderBy: { GiftName: 'asc' },
        }),
        prisma.peiwanGiftUnlock.findMany({
          where: { discordUserId: discordId },
          select: { giftName: true, unlockedAt: true },
        }),
      ])
    : [[], []];

  const unlockedMap = new Map(giftUnlocks.map((row) => [row.giftName, row.unlockedAt]));
  const giftWallItems = gifts
    .filter((gift) => gift.giftImage?.fileName)
    .map((gift) => ({
      name: gift.GiftName,
      priceValue: gift.price ? Number(gift.price.toString()) : 0,
      active: gift.active,
      imageUrl: gift.giftImage?.fileName ? `/gift-wall/${gift.giftImage.fileName}` : null,
      category: gift.giftImage?.category ?? '默认',
      unlocked: unlockedMap.has(gift.GiftName),
      unlockedAt: unlockedMap.get(gift.GiftName) ?? null,
    }));
  const visibleGiftWallItems = giftWallItems.filter((item) => item.category !== '老板');
  const giftWallUnlockedCount = visibleGiftWallItems.filter((item) => item.unlocked).length;
  const groupedGiftWall = visibleGiftWallItems.reduce((map, item) => {
    const group = map.get(item.category) ?? [];
    group.push(item);
    map.set(item.category, group);
    return map;
  }, new Map<string, typeof giftWallItems>());
  const groupedGiftWallList = Array.from(groupedGiftWall.entries())
    .map(([category, items]) => ({
      category,
      items: [...items].sort((a, b) => {
        if (a.priceValue !== b.priceValue) {
          return a.priceValue - b.priceValue;
        }
        return a.name.localeCompare(b.name, 'zh-Hans-CN');
      }),
    }))
    .sort((a, b) => a.category.localeCompare(b.category, 'zh-Hans-CN'));

  return (
    <main className="min-h-screen bg-[#f7f3ef] text-[#171717] px-6 py-16">
      <section className="max-w-5xl mx-auto space-y-8">
        <div className="bg-white rounded-[32px] border border-black/5 p-8 space-y-3">
          <p className="text-xs uppercase tracking-[0.5em] text-gray-400"><SiteText copyKey="site.app.profile.giftwall.page.c32deb700f9f" /></p>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-semibold tracking-wide"><SiteText copyKey="site.app.profile.giftwall.page.1e972bb1a1ad" /></h1>
              <p className="text-sm text-gray-500">{displayName}</p>
            </div>
            <Link
              href="/profile"
              className="inline-flex items-center justify-center rounded-full border border-black/10 px-4 py-2 text-xs uppercase tracking-[0.4em] text-gray-500 hover:bg-black/5 transition"
            ><SiteText copyKey="site.app.profile.giftwall.page.425652af65a9" /></Link>
          </div>
        </div>

        {!isPeiwanMember && (
          <div className="bg-white rounded-[32px] border border-black/5 p-8 text-sm text-gray-500"><SiteText copyKey="site.app.profile.giftwall.page.4be8c2cb510d" /></div>
        )}

        {isPeiwanMember && (
          <div className="bg-white rounded-[32px] border border-black/5 p-8 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold tracking-wide text-[#5c43a3]"><SiteText copyKey="site.app.profile.giftwall.page.55e6b5ef84d7" /></h2>
                <p className="text-sm text-gray-500"><SiteText copyKey="site.app.profile.giftwall.page.94b532274a29" />{giftWallUnlockedCount} / {giftWallItems.length}
                </p>
              </div>
              <span className="text-xs uppercase tracking-[0.4em] text-gray-400"><SiteText copyKey="site.app.profile.giftwall.page.77e31844cefb" /></span>
            </div>

            {visibleGiftWallItems.length === 0 ? (
              <p className="text-sm text-gray-500"><SiteText copyKey="site.app.profile.giftwall.page.c19c518ac843" /></p>
            ) : (
              <div className="space-y-8">
                {groupedGiftWallList.map((group) => (
                  <div key={group.category} className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-lg font-semibold text-gray-700">{group.category}</h3>
                      <span className="text-xs uppercase tracking-[0.3em] text-gray-400">
                        {group.items.length}<SiteText copyKey="site.app.profile.giftwall.page.04d7e6fc2cc7" /></span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                      {group.items.map((gift) => (
                        <div
                          key={gift.name}
                          className={`rounded-2xl border border-black/10 p-3 space-y-2 ${
                            gift.unlocked ? 'bg-white' : 'bg-gray-100/70 opacity-60 grayscale'
                          }`}
                        >
                          <div className="relative aspect-square rounded-xl bg-white/80 overflow-hidden border border-black/5">
                            {gift.imageUrl ? (
                              <img
                                src={gift.imageUrl}
                                alt={gift.name}
                                className="h-full w-full object-cover"
                                loading="lazy"
                              />
                            ) : (
                              <div className="h-full w-full flex items-center justify-center text-xs text-gray-400"><SiteText copyKey="site.app.profile.giftwall.page.56872a6c3b66" /></div>
                            )}
                          </div>
                          <div className="text-sm font-medium text-gray-700 truncate">{gift.name}</div>
                          <div className="text-xs text-gray-400">
                            {gift.unlocked ? <SiteText copyKey="site.app.profile.giftwall.page.df24da0d2639" values={{value1: String(formatDate(gift.unlockedAt))}} /> : <SiteText copyKey="site.app.profile.giftwall.page.b25a509d561f" />}
                            {!gift.active ? <SiteText copyKey="site.app.profile.giftwall.page.313fad352afe" /> : ''}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
