import { NextResponse } from 'next/server';
import { getCurrentJinleeUser } from '@/lib/current-jinlee-user';
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
      return NextResponse.json({ error: '本周期已领取，请明天或下周再来。' }, { status: 409 });
    case 'weekly_spend_not_met':
      return NextResponse.json({ error: '本周实际消费尚未满 ¥1000。' }, { status: 400 });
    case 'new_user_task_not_eligible':
      return NextResponse.json({ error: '新用户首周完成两单后才可领取。' }, { status: 400 });
    case 'campaign_inactive':
    default:
      return NextResponse.json({ error: '开业福利活动当前不可领取。' }, { status: 400 });
  }
};

export async function POST(request: Request) {
  const currentUser = await getCurrentJinleeUser(request);
  if (!currentUser) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as { benefit?: unknown };
  if (typeof body.benefit !== 'string' || !BENEFITS.has(body.benefit)) {
    return NextResponse.json({ error: '未知福利类型' }, { status: 400 });
  }

  try {
    const coupon = await claimOpeningBenefit({
      jinleeId: currentUser.jinleeId,
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
    return NextResponse.json({ error: '领取失败，请稍后再试。' }, { status: 500 });
  }
}
