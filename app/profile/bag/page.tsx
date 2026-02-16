import Link from 'next/link';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getServerSession } from '@/lib/session';
import { DiscountUsageButton } from '@/components/profile/DiscountUsageButton';
import { GiftUsageButton, SelfUseButton } from '@/components/profile/GiftAndSelfUseButtons';
import {
  CommissionVoucherButton,
  FlowVoucherButton,
  SimpleVoucherUseButton,
  SpendVoucherButton,
} from '@/components/profile/VoucherUseButtons';
import { resolveSpecialVoucher } from '@/lib/voucher';
import {
  COUPON_VOUCHER_META,
  DISCOUNT_COUPON_PRIZE_NAMES,
  VANITY_CARD_PRIZE_NAMES,
} from '@/lib/voucherCatalog';
import { CouponStatus, CouponType, LotteryPrizeType, LotteryStatus, PointShopDeliveryStatus, PointShopDeliveryType } from '@prisma/client';

const ROME_TIMEZONE = 'Europe/Rome';

const formatDateOnly = (value?: Date | string | null) => {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleDateString('zh-CN', { timeZone: ROME_TIMEZONE });
};

const toMillis = (value?: Date | string | null) => {
  if (!value) return 0;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
};

export default async function BagPage() {
  const session = await getServerSession();
  if (!session?.discordId) {
    redirect('/');
  }
  const nowTs = Date.parse(new Date().toISOString());

  const [draws, coupons, pointShopGrants] = await Promise.all([
    prisma.lotteryDraw.findMany({
      where: { userId: session.discordId },
      orderBy: { createdAt: 'desc' },
      include: {
        prize: {
          select: { name: true, pool: true, imageUrl: true, type: true },
        },
      },
      take: 200,
    }),
    prisma.coupon.findMany({
      where: { discordId: session.discordId },
      orderBy: { issuedAt: 'desc' },
      take: 200,
    }),
    prisma.pointShopGrant.findMany({
      where: {
        discordUserId: session.discordId,
        deliveryType: PointShopDeliveryType.COUPON,
        deliveryStatus: PointShopDeliveryStatus.DELIVERED,
      },
      orderBy: { issuedAt: 'desc' },
      take: 200,
    }),
  ]);

  type BagItem = {
    id: string;
    source: 'lottery' | 'coupon' | 'pointshop';
    status: LotteryStatus;
    prizeName: string;
    prizeType: LotteryPrizeType;
    expiresAt?: Date | string | null;
    consumeAt?: Date | string | null;
    lotteryId?: string;
    couponId?: string;
  };

  const couponItems: BagItem[] = coupons.map((coupon) => {
    const meta = COUPON_VOUCHER_META[coupon.type] ?? { prizeName: coupon.type, prizeType: LotteryPrizeType.COUPON };
    const isExpired = coupon.expiresAt ? new Date(coupon.expiresAt).getTime() <= nowTs : false;
    const status =
      coupon.status === CouponStatus.ACTIVE && !isExpired
        ? LotteryStatus.UNUSED
        : coupon.status === CouponStatus.USED
          ? LotteryStatus.USED
          : LotteryStatus.EXPIRED;
    return {
      id: coupon.id,
      source: 'coupon',
      status,
      prizeName: meta.prizeName,
      prizeType: meta.prizeType,
      expiresAt: coupon.expiresAt,
      consumeAt: coupon.consumedAt,
      couponId: coupon.id,
    };
  });

  const drawItems: BagItem[] = draws.map((draw) => {
    const drawExpired =
      draw.status === LotteryStatus.UNUSED && draw.expiresAt
        ? new Date(draw.expiresAt).getTime() <= nowTs
        : false;
    return {
      id: draw.id,
      source: 'lottery',
      status: drawExpired ? LotteryStatus.EXPIRED : draw.status,
      prizeName: draw.prize?.name ?? '未中奖',
      prizeType: draw.prize?.type ?? LotteryPrizeType.COUPON,
      expiresAt: draw.expiresAt,
      consumeAt: draw.consumeAt,
      lotteryId: draw.id,
    };
  });

  const pointShopItems: BagItem[] = pointShopGrants.map((grant) => {
    const type = grant.couponType as CouponType | null;
    const meta = type ? COUPON_VOUCHER_META[type] : null;
    const drawExpired =
      grant.couponStatus === CouponStatus.ACTIVE && grant.expiresAt
        ? new Date(grant.expiresAt).getTime() <= nowTs
        : false;
    const status =
      grant.couponStatus === CouponStatus.ACTIVE && !drawExpired
        ? LotteryStatus.UNUSED
        : grant.couponStatus === CouponStatus.USED
          ? LotteryStatus.USED
          : LotteryStatus.EXPIRED;

    return {
      id: grant.id,
      source: 'pointshop',
      status,
      prizeName: meta?.prizeName ?? grant.itemName ?? '积分商城券',
      prizeType: meta?.prizeType ?? LotteryPrizeType.COUPON,
      expiresAt: grant.expiresAt,
      consumeAt: grant.consumedAt,
      couponId: grant.id,
    };
  });

  const allItems = [...couponItems, ...drawItems, ...pointShopItems].sort((a, b) => {
    const aTime = toMillis(a.consumeAt ?? a.expiresAt);
    const bTime = toMillis(b.consumeAt ?? b.expiresAt);
    return bTime - aTime;
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
            <h2 className="text-xl font-semibold text-[#5c43a3]">我的资产</h2>
            <span className="text-xs uppercase tracking-[0.4em] text-gray-500">共 {allItems.length} 个</span>
          </div>

          {allItems.length === 0 ? (
            <p className="text-gray-500 text-sm">暂无记录。</p>
          ) : (
            <div className="space-y-8">
              {[
                { title: '未使用', list: allItems.filter((item) => item.status === 'UNUSED') },
                { title: '已使用', list: allItems.filter((item) => item.status === 'USED') },
                { title: '已过期', list: allItems.filter((item) => item.status === 'EXPIRED') },
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
                      {list.map((item) => {
                        const prizeName = item.prizeName;
                        const prizeType = item.prizeType ?? LotteryPrizeType.COUPON;
                        const isUsed = item.status === 'USED';
                        const isVanityCard = VANITY_CARD_PRIZE_NAMES.has(prizeName);
                        const status = item.status === 'UNUSED' ? '未使用' : item.status === 'USED' ? '已使用' : '已过期';
                        const metaTime =
                          item.status === 'UNUSED'
                            ? formatDateOnly(item.expiresAt)
                            : formatDateOnly(item.consumeAt ?? item.expiresAt);

                        return (
                            <div
                              key={`${item.source}:${item.id}`}
                              className="rounded-2xl border border-dashed border-black/10 bg-gradient-to-br from-[#fdfbff] to-[#f6f1ff] p-5 space-y-3 shadow-sm"
                            >
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="px-3 py-1 rounded-full border border-black/10 bg-white/60 text-xs uppercase tracking-[0.3em] text-gray-600">
                                  {status}
                                </span>
                                {item.status === 'UNUSED' ? (
                                  (() => {
                                    const special = resolveSpecialVoucher(prizeName);
                                    if (special?.kind === 'simple') {
                                      return (
                                        <SimpleVoucherUseButton
                                          prizeName={prizeName}
                                          lotteryId={item.lotteryId}
                                          couponId={item.couponId}
                                        />
                                      );
                                    }
                                    if (special?.kind === 'commission') {
                                      return (
                                        <CommissionVoucherButton
                                          prizeName={prizeName}
                                          lotteryId={item.lotteryId}
                                          couponId={item.couponId}
                                        />
                                      );
                                    }
                                    if (special?.kind === 'flow') {
                                      return (
                                        <FlowVoucherButton
                                          prizeName={prizeName}
                                          lotteryId={item.lotteryId}
                                          couponId={item.couponId}
                                        />
                                      );
                                    }
                                    if (special?.kind === 'spend') {
                                      return (
                                        <SpendVoucherButton
                                          prizeName={prizeName}
                                          lotteryId={item.lotteryId}
                                          couponId={item.couponId}
                                        />
                                      );
                                    }
                                    if (isVanityCard) {
                                      return (
                                        <SelfUseButton
                                          lotteryId={item.lotteryId}
                                          couponId={item.couponId}
                                          prizeName={prizeName}
                                        />
                                      );
                                    }
                                    if (prizeType === 'COUPON') {
                                      if (!DISCOUNT_COUPON_PRIZE_NAMES.has(prizeName)) {
                                        return null;
                                      }
                                      return (
                                        <DiscountUsageButton
                                          kind={item.source === 'lottery' ? 'lottery' : 'coupon'}
                                          triggerLabel="使用"
                                          lotteryId={item.lotteryId}
                                          couponId={item.couponId}
                                        />
                                      );
                                    }
                                    if (prizeType === 'GIFT') {
                                      return (
                                        <GiftUsageButton
                                          lotteryId={item.lotteryId}
                                          couponId={item.couponId}
                                          prizeName={prizeName}
                                        />
                                      );
                                    }
                                    if (prizeType === 'SELFUSE') {
                                      return (
                                        <SelfUseButton
                                          lotteryId={item.lotteryId}
                                          couponId={item.couponId}
                                          prizeName={prizeName}
                                        />
                                      );
                                    }
                                    return null;
                                  })()
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
