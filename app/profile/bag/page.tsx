
import { getSiteCopy } from "@/lib/site-copy-server";
import { SiteText } from "@/components/SiteCopyProvider";
import Link from 'next/link';
import Image from 'next/image';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getCurrentDlmUser } from '@/lib/current-dlm-user';
import { newEntityOnlyTime } from '@/lib/operating-entity-cutover';
import { DiscountUsageButton } from '@/components/profile/DiscountUsageButton';
import { GiftUsageButton, SelfUseButton } from '@/components/profile/GiftAndSelfUseButtons';
import {
  CommissionVoucherButton,
  FlowVoucherButton,
  PeiwanReviewVoucherButton,
  SimpleVoucherUseButton,
  SpendVoucherButton,
} from '@/components/profile/VoucherUseButtons';
import { resolveSpecialVoucher } from '@/lib/voucher';
import { resolveLocalVoucherArt } from '@/lib/local-voucher-art';
import { SITE_PRIZE_IMAGE_KEYS } from '@/lib/editable-image-catalog';
import {
  COUPON_VOUCHER_META,
  DISCOUNT_COUPON_PRIZE_NAMES,
  inferPrizeTypeByPrizeName,
  VANITY_CARD_PRIZE_NAMES,
} from '@/lib/voucherCatalog';
import { CouponStatus, CouponType, LotteryPrizeType, LotteryStatus, PointShopDeliveryStatus, PointShopDeliveryType } from '@prisma/client';

const ROME_TIMEZONE = 'Europe/Rome';
const BLOCK_STACK_PRIZE_NAMES = new Set(['积木游戏代金券', '抽积木代金券']);

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
  const siteCopy = await getSiteCopy();
  const currentUser = await getCurrentDlmUser();
  if (!currentUser) {
    redirect('/');
  }
  const nowTs = Date.parse(new Date().toISOString());

  const [draws, coupons, pointShopGrants] = await Promise.all([
    prisma.lotteryDraw.findMany({
      where: {
        dlmId: currentUser.dlmId,
        createdAt: newEntityOnlyTime(),
        OR: [
          { status: { not: LotteryStatus.USED } },
          { consumeAt: newEntityOnlyTime() },
        ],
      },
      orderBy: { createdAt: 'desc' },
      include: {
        prize: {
          select: { name: true, pool: true, type: true },
        },
      },
      take: 200,
    }),
    prisma.coupon.findMany({
      where: {
        dlmId: currentUser.dlmId,
        issuedAt: newEntityOnlyTime(),
        OR: [
          { status: { not: CouponStatus.USED } },
          { consumedAt: newEntityOnlyTime() },
        ],
      },
      orderBy: { issuedAt: 'desc' },
      take: 200,
    }),
    prisma.pointShopGrant.findMany({
      where: {
        dlmId: currentUser.dlmId,
        issuedAt: newEntityOnlyTime(),
        deliveryType: PointShopDeliveryType.COUPON,
        deliveryStatus: PointShopDeliveryStatus.DELIVERED,
        OR: [
          { couponStatus: null },
          { couponStatus: { not: CouponStatus.USED } },
          { consumedAt: newEntityOnlyTime() },
        ],
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
      prizeType: meta?.prizeType ?? inferPrizeTypeByPrizeName(grant.itemName),
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
            <p className="text-xs uppercase tracking-[0.6em] text-gray-500"><SiteText copyKey="site.app.profile.bag.page.0945e42ac05d" /></p>
            <h1 className="text-3xl font-semibold tracking-wide"><SiteText copyKey="site.app.profile.bag.page.afc3a43e5b41" /></h1>
            <p className="text-sm text-gray-500"><SiteText copyKey="site.app.profile.bag.page.ca56351fd6c2" /></p>
          </div>
          <Link
            href="/profile"
            className="rounded-full border border-black/10 px-4 py-2 text-xs uppercase tracking-[0.4em] text-gray-600 hover:bg-black/5 transition"
          ><SiteText copyKey="site.app.profile.bag.page.425652af65a9" /></Link>
        </div>

        <div className="bg-white rounded-[32px] border border-black/5 p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-[#5c43a3]"><SiteText copyKey="site.app.profile.bag.page.0c8254689746" /></h2>
            <span className="text-xs uppercase tracking-[0.4em] text-gray-500"><SiteText copyKey="site.app.profile.bag.page.497064be1f41" />{allItems.length}<SiteText copyKey="site.app.profile.bag.page.f7b2a6ee68ec" /></span>
          </div>

          {allItems.length === 0 ? (
            <p className="text-gray-500 text-sm"><SiteText copyKey="site.app.profile.bag.page.12cf516d9659" /></p>
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
                      <span className="text-xs uppercase tracking-[0.3em] text-gray-400">{list.length}<SiteText copyKey="site.app.profile.bag.page.f7b2a6ee68ec" /></span>
                    </div>
                  </div>
                  {list.length === 0 ? (
                    <p className="text-sm text-gray-400"><SiteText copyKey="site.app.profile.bag.page.5dbd015496af" />{title}<SiteText copyKey="site.app.profile.bag.page.11e2b0e36bc4" /></p>
                  ) : (
                    <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                      {list.map((item) => {
                        const prizeName = item.prizeName.trim();
                        const prizeType = item.prizeType ?? LotteryPrizeType.COUPON;
                        const originalArt = resolveLocalVoucherArt(prizeName);
                        const localArt = originalArt ? siteCopy.image(SITE_PRIZE_IMAGE_KEYS[prizeName] ?? '', originalArt) : null;
                        const isUsed = item.status === 'USED';
                        const isVanityCard = VANITY_CARD_PRIZE_NAMES.has(prizeName);
                        const isBlockStackVoucher = BLOCK_STACK_PRIZE_NAMES.has(prizeName);
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
                                    if (special?.kind === 'peiwan_review') {
                                      return (
                                        <PeiwanReviewVoucherButton
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
                              {localArt ? (
                                <div className="flex h-28 items-center justify-center overflow-hidden rounded-xl border border-black/5 bg-white/70 p-2">
                                  <Image
                                    src={localArt}
                                    alt={siteCopy.text(prizeName, "site.lib.vouchercatalog")}
                                    width={180}
                                    height={104}
                                    className="max-h-full w-auto object-contain"
                                  />
                                </div>
                              ) : null}
                              <p className="text-lg font-semibold text-[#171717]"><SiteText namespace="site.lib.vouchercatalog" value={prizeName} /></p>
                              <p className="text-sm text-gray-500">{isUsed ? <SiteText copyKey="site.app.profile.bag.page.03b2f370ae5c" /> : <SiteText copyKey="site.app.profile.bag.page.3144a998f054" />}：{metaTime}</p>
                              {isBlockStackVoucher ? (
                                <p className="text-xs text-[#7a5b14]"><SiteText copyKey="site.app.profile.bag.page.5001c27f2bab" /></p>
                              ) : null}
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
