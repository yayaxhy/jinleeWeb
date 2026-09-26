import { NextResponse } from 'next/server';
import { getCurrentJinleeUser } from '@/lib/current-jinlee-user';
import { getOpeningBenefitsStatus } from '@/lib/opening-benefits';

export async function GET(request: Request) {
  const currentUser = await getCurrentJinleeUser(request);
  if (!currentUser) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  const status = await getOpeningBenefitsStatus({
    jinleeId: currentUser.jinleeId,
    discordUserId: currentUser.discordUserId,
  });
  return NextResponse.json(status);
}
