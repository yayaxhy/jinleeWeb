import Link from 'next/link';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getServerSession } from '@/lib/session';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const formatNumber = (value: unknown) => {
  if (value === null || value === undefined) return '0';
  const num = Number(value);
  if (Number.isNaN(num)) return String(value);
  return num.toLocaleString('zh-CN', { maximumFractionDigits: 0 });
};

const resolveDisplayName = (record: { serverDisplayName: string | null; discordUserId: string }) =>
  record.serverDisplayName || record.discordUserId;

type Tier = { threshold: number; roles: string };

const HEART_ROLE_TIERS: Tier[] = [
  { threshold: 131, roles: '𝒍𝒗𝟏  ♡ 初遇锦缘 ♡ㅤ' },
  { threshold: 520, roles: '𝒍𝒗𝟐  ♡ 小有默契 ♡' },
  { threshold: 999, roles: '𝒍𝒗𝟑  ♡ 锦语呢喃 ♡' },
  { threshold: 1314, roles: '𝒍𝒗𝟒  ♡ 心有灵犀 ♡ㅤ' },
  { threshold: 3344, roles: '𝒍𝒗𝟓  ♡ 锦梦相随 ♡' },
  { threshold: 5210, roles: '𝒍𝒗𝟔  ♡ 情生锦夜 ♡' },
  { threshold: 6666, roles: '𝒍𝒗𝟕  ♡ 鱼跃心间 ♡' },
  { threshold: 9999, roles: '𝒍𝒗𝟖  ♡ 缘定锦心 ♡' },
  { threshold: 13140, roles: '𝒍𝒗𝟗  ♡ 锦瑶不负 ♡' },
  { threshold: 33440, roles: '𝒍𝒗𝟏𝟎  ♡ 永结锦缘 ♡' },
  { threshold: 52000, roles: '𝒍𝒗𝟏𝟏  ♡ 锦龙之契 ♡' },
  { threshold: 99999, roles: '𝒍𝒗𝟏𝟐  ♡ 缘生龙梦 ♡' },
  { threshold: 131400, roles: '𝒍𝒗𝟏𝟑  ♡ 锦御天心 ♡' },
  { threshold: 334400, roles: 'ㅤ𝒍𝒗𝟏𝟒  ♡ 锦耀星河 ♡' },
  { threshold: 999999, roles: '𝒍𝒗𝟏𝟓  ♡ 锦缘永恒 ♡ㅤ' },
];

export default async function HeartPage() {
  const session = await getServerSession();
  const discordId = session?.discordId;
  if (!discordId) {
    redirect('/');
  }

  const [receivedAgg, givenAgg, topSenders, topRecipients] = await Promise.all([
    prisma.heartCounter.aggregate({
      _max: { total: true },
      where: { toMemberId: discordId },
    }),
    prisma.heartCounter.aggregate({
      _max: { total: true },
      where: { fromMemberId: discordId },
    }),
    prisma.heartCounter.findMany({
      where: { toMemberId: discordId },
      orderBy: { total: 'desc' },
      take: 10,
      include: { fromMember: { select: { serverDisplayName: true, discordUserId: true } } },
    }),
    prisma.heartCounter.findMany({
      where: { fromMemberId: discordId },
      orderBy: { total: 'desc' },
      take: 10,
      include: { toMember: { select: { serverDisplayName: true, discordUserId: true } } },
    }),
  ]);

  const topSender = topSenders[0] ?? null;
  const topRecipient = topRecipients[0] ?? null;
  const receivedTotal = Number(topSender?.total ?? receivedAgg._max.total ?? 0);
  const givenTotal = Number(topRecipient?.total ?? givenAgg._max.total ?? 0);

  const resolveTier = (total: number) => {
    let current = HEART_ROLE_TIERS[0];
    let next: Tier | null = null;
    let prevThreshold = 0;

    for (const tier of HEART_ROLE_TIERS) {
      if (total >= tier.threshold) {
        current = tier;
        prevThreshold = tier.threshold;
      } else {
        next = tier;
        break;
      }
    }

    // If below first threshold, treat prev as 0 and next as first tier
    if (!next && current === HEART_ROLE_TIERS[0] && total < current.threshold) {
      prevThreshold = 0;
      next = HEART_ROLE_TIERS[0];
    }

    const nextThreshold = next?.threshold ?? prevThreshold;
    const span = Math.max(1, nextThreshold - prevThreshold);
    const progress = Math.min(1, Math.max(0, (total - prevThreshold) / span));
    return { current, next, progress, prevThreshold, nextThreshold };
  };

  const receivedTier = resolveTier(receivedTotal);
  const givenTier = resolveTier(givenTotal);

  return (
    <main className="min-h-screen bg-[#f7f3ef] text-[#171717] px-6 py-16">
      <section className="max-w-4xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.6em] text-gray-400"></p>
            <h1 className="text-3xl font-semibold tracking-wide">心动值总览</h1>
          </div>
          <Link
            href="/profile"
            className="text-xs uppercase tracking-[0.4em] text-gray-500 hover:text-black transition"
          >
            返回个人主页
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="rounded-3xl border border-black/10 bg-gradient-to-br from-[#fdfbff] to-[#f3efff] p-6 space-y-2">
            <p className="text-xs uppercase tracking-[0.4em] text-gray-500">我是陪玩</p>
            <p className="text-4xl font-semibold text-[#5c43a3]">{formatNumber(receivedTotal)}</p>
            <p className="text-sm text-gray-500">
              最高心动值对象
              {topSender ? `（来自 ${resolveDisplayName(topSender.fromMember ?? { serverDisplayName: null, discordUserId: '未知' })}）` : ''}
            </p>
            <div className="mt-3 space-y-1">
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>{receivedTier.current.roles}</span>
                <span>
                  {formatNumber(receivedTotal)} / {formatNumber(receivedTier.next?.threshold ?? receivedTier.prevThreshold)}
                </span>
              </div>
              
            </div>
          </div>
          <div className="rounded-3xl border border-black/10 bg-gradient-to-br from-[#fdfbff] to-[#e9f4ff] p-6 space-y-2">
            <p className="text-xs uppercase tracking-[0.4em] text-gray-500">我是老板</p>
            <p className="text-4xl font-semibold text-[#171717]">{formatNumber(givenTotal)}</p>
            <p className="text-sm text-gray-500">
              最高心动值对象
              {topRecipient ? `（送给 ${resolveDisplayName(topRecipient.toMember ?? { serverDisplayName: null, discordUserId: '未知' })}）` : ''}
            </p>
            <div className="mt-3 space-y-1">
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>{givenTier.current.roles}</span>
                <span>
                  {formatNumber(givenTotal)} / {formatNumber(givenTier.next?.threshold ?? givenTier.prevThreshold)}
                </span>
              </div>
              
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-3xl border border-black/10 bg-white p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold tracking-wide text-[#5c43a3]">Top 心动来源</h2>
              <span className="text-xs uppercase tracking-[0.4em] text-gray-400">我是陪玩</span>
            </div>
            {topSenders.length > 0 ? (
              <div className="space-y-3">
                {topSenders.map((item) => {
                  const tier = resolveTier(Number(item.total ?? 0));
                  return (
                    <div
                      key={`${item.fromMemberId}-${item.toMemberId}`}
                      className="rounded-2xl border border-black/5 px-4 py-3 bg-[#faf8ff]"
                    >
                      <div className="flex items-center justify-between">
                        <div className="text-sm text-[#171717]">
                          {item.fromMember ? resolveDisplayName(item.fromMember) : '未知用户'}
                        </div>
                        <div className="text-sm font-semibold text-[#5c43a3]">{formatNumber(item.total)}</div>
                      </div>
                  <div className="mt-2 space-y-1">
                    <div className="flex items-center justify-between text-[11px] text-gray-500">
                      <span>{tier.current.roles}</span>
                      <span>
                        {formatNumber(item.total)} / {formatNumber(tier.next?.threshold ?? tier.prevThreshold)}
                      </span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-gray-200 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-[#ff9acb] via-[#ff7fb3] to-[#ff5f9f]"
                        style={{ width: `${tier.progress * 100}%` }}
                        aria-hidden="true"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
            ) : (
              <p className="text-sm text-gray-400">还没有收到心动值，快去和大家互动吧。</p>
            )}
          </div>

          <div className="rounded-3xl border border-black/10 bg-white p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold tracking-wide text-[#5c43a3]">Top 心动陪玩</h2>
              <span className="text-xs uppercase tracking-[0.4em] text-gray-400">我是老板</span>
            </div>
            {topRecipients.length > 0 ? (
              <div className="space-y-3">
                {topRecipients.map((item) => {
                  const tier = resolveTier(Number(item.total ?? 0));
                  return (
                    <div
                      key={`${item.fromMemberId}-${item.toMemberId}`}
                      className="rounded-2xl border border-black/5 px-4 py-3 bg-[#f8fbff]"
                    >
                      <div className="flex items-center justify-between">
                        <div className="text-sm text-[#171717]">
                          {item.toMember ? resolveDisplayName(item.toMember) : '未知用户'}
                        </div>
                        <div className="text-sm font-semibold text-[#171717]">{formatNumber(item.total)}</div>
                      </div>
                  <div className="mt-2 space-y-1">
                    <div className="flex items-center justify-between text-[11px] text-gray-500">
                      <span>{tier.current.roles}</span>
                      <span>
                        {formatNumber(item.total)} / {formatNumber(tier.next?.threshold ?? tier.prevThreshold)}
                      </span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-gray-200 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-[#ff9acb] via-[#ff7fb3] to-[#ff5f9f]"
                        style={{ width: `${tier.progress * 100}%` }}
                        aria-hidden="true"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
              </div>
            ) : (
              <p className="text-sm text-gray-400">你还没有送出心动值。</p>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
