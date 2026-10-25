import { renderSiteCopy } from "@/lib/site-copy-server";
import { NextResponse } from 'next/server';
import { getCurrentDlmUser } from '@/lib/current-dlm-user';
import {
  OPENING_BENEFIT,
  OpeningBenefitError,
  claimOpeningBenefit,
  type OpeningBenefitName,
} from '@/lib/opening-benefits';

const BENEFITS = new Set<string>(Object.values(OPENING_BENEFIT));

const errorResponse = (error: OpeningBenefitError) => {
  switch (error.code) {
    case 'already_claimed':
      return NextResponse.json(
        { error: '今日已领取，请明天再来。' },
        { status: 409 },
      );
    case 'weekly_crown_already_claimed':
      return NextResponse.json(
        { error: '日冠 75 折券在本次开业福利期间仅可领取一次。' },
        { status: 409 },
      );
    case 'two_order_task_already_claimed':
      return NextResponse.json(
        { error: '两单任务奖励在活动期间仅可领取一次。' },
        { status: 409 },
      );
    case 'weekly_spend_not_met':
      return NextResponse.json(
        { error: '一周内实际消费尚未满 ¥1,000。' },
        { status: 400 },
      );
    case 'two_order_task_not_eligible':
      return NextResponse.json(
        {
          error: '活动期间累计两笔点单或打赏，且每笔实付超过 ¥100 后才可领取。',
        },
        { status: 400 },
      );
    case 'campaign_inactive':
    default:
      return NextResponse.json(
        { error: '开业福利活动当前不可领取。' },
        { status: 400 },
      );
  }
};

export async function POST(request: Request) {
  const currentUser = await getCurrentDlmUser(request);
  if (!currentUser) {
    return NextResponse.json({ error: await renderSiteCopy("site.app.api.opening.benefits.claim.route.e8041a8c9358") }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    benefit?: unknown;
  };
  if (typeof body.benefit !== 'string' || !BENEFITS.has(body.benefit)) {
    return NextResponse.json({ error: await renderSiteCopy("site.app.api.opening.benefits.claim.route.37412307c1b6") }, { status: 400 });
  }

  try {
    const coupon = await claimOpeningBenefit({
      dlmId: currentUser.dlmId,
      benefit: body.benefit as OpeningBenefitName,
    });
    return NextResponse.json({
      ok: true,
      couponId: coupon.id,
      couponType: coupon.type,
      expiresAt: coupon.expiresAt.toISOString(),
    });
  } catch (error) {
    if (error instanceof OpeningBenefitError) return errorResponse(error);
    console.error('[opening-benefits] claim failed', error);
    return NextResponse.json(
      { error: await renderSiteCopy("site.app.api.opening.benefits.claim.route.ac02e61e853a") },
      { status: 500 },
    );
  }
}
