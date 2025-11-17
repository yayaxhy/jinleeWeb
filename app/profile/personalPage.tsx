import Image from 'next/image';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import WithdrawForm from '@/components/profile/WithdrawForm';
import { prisma } from '@/lib/prisma';
import { getServerSession } from '@/lib/session';

const GAME_TAG_FIELDS = [
  'LOL',
  'CSGO',
  'Valorant',
  'Naraka',
  'OW2',
  'APEX',
  'deltaForce',
  'marvel',
  'singer',
  'PUBG',
  'TFT',
  'R6',
  'tarkov',
  'chat',
  'steam',
  'DOTA',
  'COD',
] as const;

const TRANSACTIONS_PER_PAGE = 10;

const stringifyUnknown = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'bigint') return value.toString();
  if (typeof value === 'object' && value !== null && 'toString' in value) {
    const toStringFn = (value as { toString?: () => string }).toString;
    if (typeof toStringFn === 'function') {
      return toStringFn.call(value);
    }
  }
  return String(value);
};

const parseNumeric = (value: unknown): number | null => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') {
    return Number.isNaN(value) ? null : value;
  }
  if (typeof value === 'bigint') {
    return Number(value);
  }
  const numeric = Number(stringifyUnknown(value));
  return Number.isNaN(numeric) ? null : numeric;
};

const formatNumber = (value: unknown) => {
  if (value === null || value === undefined) return '—';
  const numeric = parseNumeric(value);
  if (numeric === null) {
    const fallback = stringifyUnknown(value);
    return fallback.length > 0 ? fallback : '—';
  }
  return numeric.toLocaleString('zh-CN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
};

const formatDate = (value?: Date | string | null) => {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('zh-CN');
};

const resolveAmountChange = (
  amountChange: unknown,
  balanceBefore: unknown,
  balanceAfter: unknown,
): number | null => {
  const amount = parseNumeric(amountChange);
  const before = parseNumeric(balanceBefore);
  const after = parseNumeric(balanceAfter);

  if (before !== null && after !== null) {
    const derived = after - before;
    if (amount === null) {
      return derived;
    }
    if (Math.sign(derived) !== Math.sign(amount) || Math.abs(derived - amount) > 0.0001) {
      return derived;
    }
    return amount;
  }

  return amount;
};

const getAmountChangeMeta = (value: number | null) => {
  if (value === null || value === undefined) {
    return { label: '—', className: 'text-gray-400' };
  }
  if (value === 0) {
    return { label: '0', className: 'text-gray-500' };
  }
  const prefix = value > 0 ? '+' : '-';
  return {
    label: `${prefix}${formatNumber(Math.abs(value))}`,
    className: value > 0 ? 'text-emerald-500' : 'text-rose-500',
  };
};

export type ProfilePageProps = {
  searchParams?: Record<string, string | string[] | undefined> | Promise<Record<string, string | string[] | undefined>>;
};

export default async function Profile(props: ProfilePageProps = {}) {
  const rawSearchParams = props.searchParams;
  const resolvedSearchParams =
    ((await Promise.resolve(rawSearchParams)) ?? {}) as Record<string, string | string[] | undefined>;

  const session = getServerSession();
  const discordId = session?.discordId;

  if (!discordId) {
    redirect('/');
  }

  const member = await prisma.member.findUnique({
    where: { discordUserId: discordId },
    include: {
      peiwan: true,
    },
  });

  if (!member) {
    return (
      <main className="min-h-screen bg-black text-white px-6 py-16 flex items-center justify-center">
        <div className="space-y-4 text-center">
          <p className="text-white/70">未找到该成员。</p>
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-full border border-white/30 px-6 py-2 text-sm uppercase tracking-[0.2em] hover:bg-white/10"
          >
            返回主页
          </Link>
        </div>
      </main>
    );
  }

  const peiwan = member.peiwan;
  const isPeiwanMember = member.status === 'PEIWAN';
  const level = peiwan?.level;
  const displayName = session?.username ?? member.discordUserId;
  const avatarUrl = session?.avatar
    ? `https://cdn.discordapp.com/avatars/${session.discordId}/${session.avatar}.${
        session.avatar.startsWith('a_') ? 'gif' : 'png'
      }`
    : undefined;
  const avatarLetter = displayName?.[0]?.toUpperCase?.() ?? 'M';
  const pageParam = resolvedSearchParams?.page;
  const parsedPage =
    typeof pageParam === 'string' ? Number.parseInt(pageParam, 10) : Number.parseInt(pageParam?.[0] ?? '1', 10);
  const currentPage = Number.isNaN(parsedPage) || parsedPage < 1 ? 1 : parsedPage;
  const skip = (currentPage - 1) * TRANSACTIONS_PER_PAGE;

  const couponsPromise = prisma.coupon.findMany({
    where: { discordId },
    orderBy: { issuedAt: 'desc' },
  });
  const totalTransactionsPromise = prisma.individualTransaction.count({
    where: { discordId },
  });
  const transactionsPromise = prisma.individualTransaction.findMany({
    where: { discordId },
    orderBy: { timeCreatedAt: 'desc' },
    skip,
    take: TRANSACTIONS_PER_PAGE,
  });

  const [coupons, totalTransactions, transactions] = await Promise.all([
    couponsPromise,
    totalTransactionsPromise,
    transactionsPromise,
  ]);
  const totalPages = Math.max(1, Math.ceil(totalTransactions / TRANSACTIONS_PER_PAGE));
  const hasPrevPage = currentPage > 1;
  const hasNextPage = currentPage < totalPages;
  const prevPage = Math.max(1, currentPage - 1);
  const nextPage = Math.min(totalPages, currentPage + 1);

  const balanceValue = peiwan?.balance ?? member.totalBalance;
  const withdrawMaxString = stringifyUnknown(balanceValue) || '0';
  const stats = [
    { label: '账户余额', value: member.totalBalance },
    { label: '可提现余额', value: balanceValue },
    { label: '累计消费', value: member.totalSpent },
    { label: '累计收入', value: peiwan?.totalEarn ?? null },
  ];

  const couponStatusLabel: Record<string, string> = {
    ACTIVE: '可用',
    USED: '已使用',
    EXPIRED: '已过期',
  };
  const couponTypeLabel: Record<string, string> = {
    DISCOUNT_90: '9折券',
  };

  return (
    <main className="min-h-screen bg-[#f7f3ef] text-[#171717] px-6 py-16">
      <section className="max-w-5xl mx-auto space-y-10">
        <div className="bg-white border border-black/5 rounded-[32px] shadow-sm overflow-hidden">
          <div className="relative flex flex-col items-center gap-3 py-12 text-center">
            <p className="text-xs uppercase tracking-[0.6em] text-gray-400">My Profile</p>
            <div className="relative w-28 h-28 rounded-2xl border border-black/10 bg-gradient-to-br from-[#f6f1ff] to-[#e1d5ff] flex items-center justify-center text-4xl font-semibold text-[#5c43a3] overflow-hidden">
              {avatarUrl ? (
                <Image
                  src={avatarUrl}
                  alt={`${displayName} avatar`}
                  fill
                  sizes="112px"
                  className="object-cover"
                  priority
                />
              ) : (
                avatarLetter
              )}
            </div>
            
            <p className="text-3xl font-semibold tracking-wide">{displayName}</p>
            
            <Link
              href="/"
              className="absolute left-8 top-8 text-xs uppercase tracking-[0.4em] text-gray-500 hover:text-black transition"
            >
              返回主页
            </Link>
            <span className="absolute right-8 top-8 text-xs uppercase tracking-[0.4em] text-gray-400">
              ID:{member.discordUserId}
            </span>
          </div>
          <div className="border-t border-dashed border-black/10">
            <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-dashed divide-black/10">
              {stats.map((item) => (
                <div key={item.label} className="p-6 text-center space-y-2">
                  <p className="text-xs tracking-[0.4em] text-gray-500">{item.label}</p>
                  <p className="text-2xl font-mono">{formatNumber(item.value)}</p>
                  {item.label === '可提现余额' && (
                    <div className="pt-2">
                      <WithdrawForm maxAmount={withdrawMaxString} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-2">
          <div className="bg-white rounded-[32px] border border-black/5 p-8 space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold tracking-wide">个人信息</h2>
            </div>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5 text-sm">
            
              <div>
                <dt className="text-gray-400 uppercase tracking-[0.4em] mb-1">陪玩等级</dt>
                <dd className="text-lg font-medium">{level}</dd>
              </div>
        
              <div>
                <dt className="text-gray-400 uppercase tracking-[0.4em] mb-1">抽成比例</dt>
                <dd className="text-lg font-medium">{member.commissionRate.toString()}</dd>
              </div>
              
            </dl>
            {isPeiwanMember && peiwan && (
              <div className="border-t border-dashed border-black/10 pt-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm uppercase tracking-[0.4em] text-gray-400">Game Tags</h3>
                  <span className="text-xs uppercase tracking-[0.4em] text-gray-400">PEIWAN</span>
                </div>
                <div className="flex flex-wrap gap-3">
                  {GAME_TAG_FIELDS.map((tag) => {
                    const active = peiwan[tag];
                    return (
                      <span
                        key={tag}
                        className={`px-4 py-1 rounded-full border text-sm tracking-wide ${
                          active ? 'border-[#5c43a3] text-[#5c43a3]' : 'border-black/5 text-gray-300'
                        }`}
                      >
                        {tag}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="bg-white rounded-[32px] border border-black/5 p-8 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold tracking-wide">我的优惠券</h2>
              <span className="text-xs uppercase tracking-[0.4em] text-gray-400">共 {coupons.length} 张</span>
            </div>
            {coupons.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {coupons.map((coupon) => {
                  const statusLabel = couponStatusLabel[coupon.status] ?? coupon.status;
                  const typeLabel = couponTypeLabel[coupon.type] ?? coupon.type;
                  const isUsed = coupon.status === 'USED';
                  return (
                    <div
                      key={coupon.id}
                      className={`rounded-2xl border border-dashed p-5 space-y-3 ${
                        isUsed
                          ? 'bg-gray-200 border-gray-200 text-gray-500'
                          : 'bg-gradient-to-br from-[#fdfbff] to-[#f2f1ff] border-black/10'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs uppercase tracking-[0.4em]">
                        
                        <span className={isUsed ? 'text-gray-500' : 'text-[#5c43a3]'}>{statusLabel}</span> 
                        
                      </div>
                      <p className="text-3xl font-semibold text-[#171717]">{typeLabel}</p>
                      <div className="text-xs text-gray-500 space-y-1">
                        <p>有效期至 {formatDate(coupon.expiresAt)}</p>

                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-gray-400 text-sm">暂无优惠券。</p>
            )}
          </div>
        </div>

        {isPeiwanMember && (
          <div className="bg-white rounded-[32px] border border-black/5 p-8 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-semibold tracking-wide text-[#5c43a3]">流水记录</h2>
                <p className="text-sm text-gray-500">与陪玩账户关联的收支流水</p>
              </div>
              
            </div>
            {transactions.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-400 uppercase tracking-[0.4em] border-b border-black/5">
                      <th className="py-3 pr-4">时间</th>
                      <th className="py-3 pr-4">类型</th>
                      <th className="py-3 pr-4">变动前余额</th>
                      <th className="py-3 pr-4">金额变动</th>
                      <th className="py-3 pr-4">变动后余额</th>
                      <th className="py-3 pr-4">备注</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((tx) => {
                      const resolvedChange = resolveAmountChange(tx.amountChange, tx.balanceBefore, tx.balanceAfter);
                      const changeMeta = getAmountChangeMeta(resolvedChange);
                      return (
                        <tr key={tx.transactionId} className="border-b border-black/5 last:border-0">
                          <td className="py-4 pr-4 font-mono">{formatDate(tx.timeCreatedAt)}</td>
                          <td className="py-4 pr-4">{tx.typeOfTransaction}</td>
                          <td className="py-4 pr-4 font-mono">{formatNumber(tx.balanceBefore)}</td>
                          <td className={`py-4 pr-4 font-mono ${changeMeta.className}`}>{changeMeta.label}</td>
                          <td className="py-4 pr-4 font-mono">{formatNumber(tx.balanceAfter)}</td>
                          <td className="py-4 pr-4 text-gray-500">{tx.thirdPartydiscordId ?? '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-4 text-sm text-gray-500">
                  <p>
                    第 {Math.min(currentPage, totalPages)} / {totalPages} 页 · 共 {totalTransactions} 条
                  </p>
                  <div className="flex gap-2">
                    <Link
                      href={`/profile?page=${prevPage}`}
                      scroll={false}
                      prefetch={false}
                      className={`px-4 py-2 rounded-full border text-xs uppercase tracking-[0.4em] ${
                        hasPrevPage ? 'hover:bg-black/5 border-black/20' : 'border-black/5 text-gray-300 pointer-events-none'
                      }`}
                      aria-disabled={!hasPrevPage}
                    >
                      上一页
                    </Link>
                    <Link
                      href={`/profile?page=${nextPage}`}
                      scroll={false}
                      prefetch={false}
                      className={`px-4 py-2 rounded-full border text-xs uppercase tracking-[0.4em] ${
                        hasNextPage ? 'hover:bg-black/5 border-black/20' : 'border-black/5 text-gray-300 pointer-events-none'
                      }`}
                      aria-disabled={!hasNextPage}
                    >
                      下一页
                    </Link>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-gray-500">暂时没有流水记录。</p>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
