import { NextResponse } from 'next/server';
import { canViewStripePricing } from '@/lib/admin';
import { fetchStripePricingRateSnapshot } from '@/lib/stripe-pricing-rates';
import { fetchStripeRechargePresetPrices, getStripeSecretKey } from '@/lib/stripe-recharge';
import { getServerSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getServerSession();
  if (!session?.discordId || !canViewStripePricing(session.discordId)) {
    return NextResponse.json({ error: '无权访问' }, { status: 403 });
  }

  try {
    const [snapshot, presetPrices] = await Promise.all([
      fetchStripePricingRateSnapshot(),
      fetchStripeRechargePresetPrices(getStripeSecretKey()),
    ]);
    return NextResponse.json({ ...snapshot, presetPrices }, {
      headers: {
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '获取汇率失败，请稍后重试。';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
