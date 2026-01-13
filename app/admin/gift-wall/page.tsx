import Link from 'next/link';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getServerSession } from '@/lib/session';
import { isAdminDiscordId } from '@/lib/admin';

const normalizeInput = (value: string | string[] | undefined) =>
  typeof value === 'string' ? value.trim() : Array.isArray(value) ? value[0]?.trim() ?? '' : '';

export const metadata = {
  title: '礼物墙管理',
};

export default async function AdminGiftWallPage(props: {
  searchParams?: Record<string, string | string[] | undefined> | Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getServerSession();
  if (!session?.discordId || !isAdminDiscordId(session.discordId)) {
    redirect('/');
  }

  const rawParams = await Promise.resolve(props.searchParams ?? {});
  const discordId = normalizeInput(rawParams.discordId);
  const peiwanIdRaw = normalizeInput(rawParams.peiwanId);

  let targetDiscordId: string | null = discordId || null;
  let peiwanRecord: { discordUserId: string; PEIWANID: number; serverDisplayName: string | null } | null = null;

  if (!targetDiscordId && peiwanIdRaw) {
    const peiwanId = Number.parseInt(peiwanIdRaw, 10);
    if (Number.isFinite(peiwanId) && peiwanId > 0) {
      peiwanRecord = await prisma.pEIWAN.findUnique({
        where: { PEIWANID: peiwanId },
        select: { discordUserId: true, PEIWANID: true, serverDisplayName: true },
      });
      targetDiscordId = peiwanRecord?.discordUserId ?? null;
    }
  }

  if (targetDiscordId && !peiwanRecord) {
    peiwanRecord = await prisma.pEIWAN.findUnique({
      where: { discordUserId: targetDiscordId },
      select: { discordUserId: true, PEIWANID: true, serverDisplayName: true },
    });
  }

  const memberRecord = targetDiscordId
    ? await prisma.member.findUnique({
        where: { discordUserId: targetDiscordId },
        select: { serverDisplayName: true, discordUserId: true },
      })
    : null;

  const gifts = targetDiscordId
    ? await prisma.gift.findMany({
        select: { GiftName: true, url_link: true },
        orderBy: { GiftName: 'asc' },
      })
    : [];
  const giftUnlocks = targetDiscordId
    ? await prisma.peiwanGiftUnlock.findMany({
        where: { discordUserId: targetDiscordId },
        select: { giftName: true },
      })
    : [];

  const unlockedGiftNames = new Set(giftUnlocks.map((row) => row.giftName));
  const giftWallItems = gifts.map((gift) => ({
    name: gift.GiftName,
    imageUrl: gift.url_link,
    unlocked: unlockedGiftNames.has(gift.GiftName),
  }));
  const giftWallUnlockedCount = giftWallItems.filter((item) => item.unlocked).length;

  const displayName =
    peiwanRecord?.serverDisplayName
    ?? memberRecord?.serverDisplayName
    ?? targetDiscordId
    ?? '未选择';

  return (
    <div className="space-y-6 text-white">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold">礼物墙管理</h2>
        <p className="text-sm text-white/60">查询陪玩礼物墙解锁情况</p>
      </div>

      <form className="grid gap-3 rounded-2xl border border-white/10 bg-white/5 p-5 md:grid-cols-4" action="/admin/gift-wall" method="get">
        <div className="space-y-1">
          <label className="text-xs uppercase tracking-[0.4em] text-white/50">陪玩 ID</label>
          <input
            name="peiwanId"
            defaultValue={peiwanIdRaw}
            className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
            placeholder="PEIWANID"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs uppercase tracking-[0.4em] text-white/50">Discord ID</label>
          <input
            name="discordId"
            defaultValue={discordId}
            className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
            placeholder="discord id"
          />
        </div>
        <div className="flex items-end md:col-span-2">
          <button
            type="submit"
            className="inline-flex w-full items-center justify-center rounded-xl bg-[#5c43a3] px-4 py-2 text-sm font-medium text-white hover:bg-[#4a3388]"
          >
            查询
          </button>
        </div>
      </form>

      {!targetDiscordId && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-white/60">
          请输入陪玩 ID 或 Discord ID 进行查询。
        </div>
      )}

      {targetDiscordId && !peiwanRecord && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-white/60">
          未找到对应陪玩。
        </div>
      )}

      {targetDiscordId && peiwanRecord && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="text-sm text-white/60">当前陪玩</div>
            <div className="text-lg font-semibold">{displayName}</div>
            <div className="text-xs text-white/50 font-mono">
              Discord ID: {targetDiscordId} · PEIWAN ID: {peiwanRecord.PEIWANID}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold">礼物墙</h3>
                <p className="text-sm text-white/60">
                  已解锁 {giftWallUnlockedCount} / {giftWallItems.length}
                </p>
              </div>
              <span className="text-xs uppercase tracking-[0.4em] text-white/40">礼物图鉴</span>
            </div>

            {giftWallItems.length === 0 ? (
              <p className="text-sm text-white/60">暂无礼物配置。</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                {giftWallItems.map((gift) => (
                  <div
                    key={gift.name}
                    className={`rounded-2xl border border-white/10 p-3 space-y-2 ${
                      gift.unlocked ? 'bg-white/10' : 'bg-black/40 opacity-60 grayscale'
                    }`}
                  >
                    <div className="relative aspect-square rounded-xl bg-black/30 overflow-hidden border border-white/10">
                      {gift.imageUrl ? (
                        <img
                          src={gift.imageUrl}
                          alt={gift.name}
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center text-xs text-white/40">
                          暂无图片
                        </div>
                      )}
                    </div>
                    <div className="text-sm font-medium text-white/80 truncate">{gift.name}</div>
                    <div className="text-xs text-white/50">
                      {gift.unlocked ? '已解锁' : '未解锁'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <Link
        href="/admin"
        className="inline-flex items-center justify-center rounded-full border border-white/20 px-6 py-2 text-sm tracking-[0.2em] text-white hover:bg-white/10"
      >
        返回后台首页
      </Link>
    </div>
  );
}
