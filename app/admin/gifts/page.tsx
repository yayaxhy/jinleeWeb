import Link from 'next/link';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getServerSession } from '@/lib/session';
import { isAdminDiscordId } from '@/lib/admin';
import { GiftAdminManager } from '@/components/admin/GiftAdminManager';

export const metadata = {
  title: '礼物管理',
};

export default async function AdminGiftManagementPage() {
  const session = await getServerSession();
  if (!session?.discordId || !isAdminDiscordId(session.discordId)) {
    redirect('/');
  }

  const gifts = await prisma.gift.findMany({
    select: {
      GiftName: true,
      price: true,
      url_link: true,
      rate: true,
      active: true,
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
            <p className="text-sm text-white/60">创建礼物、更新价格、上架状态与分类，并上传礼物图片。</p>
          </div>
          <Link
            href="/admin"
            className="inline-flex items-center justify-center rounded-full border border-white/20 px-4 py-2 text-sm text-white hover:bg-white/10"
          >
            返回后台
          </Link>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-6 space-y-4">
          <p className="text-xs text-white/60">
            图片将保存到本地目录并用于礼物墙展示，支持 jpg / png / gif。
          </p>
          <p className="text-xs text-white/60">如果不需要上架礼物墙，则不需要上传图片。</p>
          <GiftAdminManager initialGifts={initialGifts} endpoint="/api/admin/gifts" />
        </div>
      </div>
    </section>
  );
}
