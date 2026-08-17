import { NextResponse } from 'next/server';
import { getCurrentJinleeUser } from '@/lib/current-jinlee-user';
import { summarizeJinleeUser } from '@/lib/jinlee-user';
import { revokeWechatProgramSession } from '@/lib/wechat-program-session';
import { getHomePendingTask, getHomeRecommendationIds, getMiniAvailability, getMiniNotificationSettings } from '@/lib/mini-program-account';

const buildMemberPayload = (
  member:
    | {
        discordUserId: string;
        status: string;
        serverDisplayName: string | null;
        totalBalance: { toString(): string };
        income: { toString(): string };
        recharge: { toString(): string };
        totalSpent: { toString(): string };
      }
    | null
    | undefined,
) => {
  if (!member) {
    return { linked: false };
  }

  return {
    linked: true,
    discordUserId: member.discordUserId,
    status: member.status,
    serverDisplayName: member.serverDisplayName ?? null,
    totalBalance: member.totalBalance.toString(),
    income: member.income.toString(),
    recharge: member.recharge.toString(),
    totalSpent: member.totalSpent.toString(),
  };
};

export async function GET(request: Request) {
  const currentUser = await getCurrentJinleeUser(request);
  if (!currentUser) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const [availability, pendingTask, recommendedPeiwanIds] = await Promise.all([
    getMiniAvailability(currentUser),
    getHomePendingTask(currentUser),
    getHomeRecommendationIds(currentUser),
  ]);

  return NextResponse.json({
    ok: true,
    sessionSource: currentUser.sessionSource,
    user: summarizeJinleeUser(currentUser.jinleeUser),
    member: buildMemberPayload(currentUser.jinleeUser.member),
    availability,
    pendingTask,
    notificationSettings: getMiniNotificationSettings(currentUser),
    recommendedPeiwanIds,
  });
}

export async function DELETE(request: Request) {
  await revokeWechatProgramSession(request);
  return NextResponse.json({ ok: true });
}
