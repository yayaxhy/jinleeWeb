import { NextResponse } from 'next/server';
import { getCurrentDlmUser } from '@/lib/current-dlm-user';
import { getOpeningBenefitsStatus } from '@/lib/opening-benefits';

export async function GET(request: Request) {
  const currentUser = await getCurrentDlmUser(request);
  if (!currentUser) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  const status = await getOpeningBenefitsStatus({
    dlmId: currentUser.dlmId,
    discordUserId: currentUser.discordUserId,
  });
  return NextResponse.json(status);
}
