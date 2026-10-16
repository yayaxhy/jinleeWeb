import Link from 'next/link';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getServerSession } from '@/lib/session';
import { canManageGifts } from '@/lib/admin';
import { GiftAdminManager } from '@/components/admin/GiftAdminManager';
import { DiscordGiftMenuManager } from '@/components/admin/DiscordGiftMenuManager';

export const metadata = {
  title: '礼物管理',
};

export default async function AdminGiftManagementPage({ searchParams }: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const session = await getServerSession();
  if (!session?.discordId || !canManageGifts(session.discordId)) {
    redirect('/');
  }

  const menuTab = (await searchParams).tab === 'discord-menu';
  const gifts = menuTab ? [] : await prisma.gift.findMany({
    select: {
      GiftName: true,
      price: true,
      url_link: true,
      rate: true,
      active: true,
      staffOnlyGift: true,
      giftImage: { select: { fileName: true, category: true } },
    },
    orderBy: { GiftName: 'asc' },
  });

  type GiftRecord = (typeof gifts)[number];

  const initialGifts = gifts.map((gift: GiftRecord) => ({
    name: gift.GiftName,
    price: gift.price?.toString() ?? '',
    urlLink: gift.url_link ?? '',
    rate: gift.rate?.toString() ?? '',
    active: gift.active,
    staffOnlyGift: gift.staffOnlyGift,
    category: gift.giftImage?.category ?? '默认',
    imageUrl: gift.giftImage?.fileName ? `/gift-wall/${gift.giftImage.fileName}` : null,
  }));

  return (
    <section className="min-h-screen bg-[#020204] text-white px-6 py-12">
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.6em] text-white/60">ADMIN</p>
            <h1 className="text-3xl font-semibold">礼物管理</h1>
            <p className="text-sm text-white/60">管理礼物资料与 Discord 名片的打赏选项。</p>
          </div>
          <Link
            href="/admin"
            className="inline-flex items-center justify-center rounded-full border border-white/20 px-4 py-2 text-sm text-white hover:bg-white/10"
          >
            返回后台
          </Link>
        </div>

        <nav aria-label="礼物管理分类" className="flex flex-wrap gap-2 border-b border-white/10 pb-3">
          {[{ label: '礼物资料', href: '/admin/gifts', active: !menuTab }, { label: '打赏下拉列表', href: '/admin/gifts?tab=discord-menu', active: menuTab }].map((tab) => (
            <Link key={tab.href} href={tab.href} aria-current={tab.active ? 'page' : undefined}
              className={`rounded-xl px-5 py-3 text-sm font-medium transition ${tab.active ? 'bg-[#5c43a3] text-white' : 'text-white/65 hover:bg-white/10 hover:text-white'}`}>
              {tab.label}
            </Link>
          ))}
        </nav>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-4 sm:p-6 space-y-4">
          {menuTab ? <DiscordGiftMenuManager /> : <>
          <p className="text-xs text-white/60">
            图片将保存到本地目录并用于礼物墙展示，支持 jpg / png / gif。
          </p>
          <p className="text-xs text-white/60">如果不需要上架礼物墙，则不需要上传图片。</p>
          <GiftAdminManager initialGifts={initialGifts} endpoint="/api/admin/gifts" />
          </>}
        </div>
      </div>
    </section>
  );
}
