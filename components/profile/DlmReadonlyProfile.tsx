import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { formatAmountDown, parseNumeric } from '@/lib/numberFormat';
import { formatTransactionType } from '@/lib/transaction-display';

const ROME_TIMEZONE = 'Europe/Rome';
const TRANSACTIONS_PER_PAGE = 10;

const formatDate = (value?: Date | string | null) => {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('zh-CN', { timeZone: ROME_TIMEZONE });
};

const resolveAmountChange = (amountChange: unknown, balanceBefore: unknown, balanceAfter: unknown) => {
  const amount = parseNumeric(amountChange);
  const before = parseNumeric(balanceBefore);
  const after = parseNumeric(balanceAfter);
  if (before !== null && after !== null) return after - before;
  return amount;
};

const getAmountChangeMeta = (value: number | null, digits = 2) => {
  if (value === null) return { label: '—', className: 'text-gray-400' };
  if (value === 0) return { label: '0', className: 'text-gray-500' };
  return {
    label: `${value > 0 ? '+' : '-'}${formatAmountDown(Math.abs(value), digits)}`,
    className: value > 0 ? 'text-emerald-500' : 'text-rose-500',
  };
};

export async function DlmReadonlyProfile({ dlmId }: { dlmId: string }) {
  const [user, totalTransactions, transactions, orders] = await Promise.all([
    prisma.dlmUser.findUnique({
      where: { dlmId },
      include: { manualWechatBoss: true },
    }),
    prisma.individualTransaction.count({ where: { dlmId } }),
    prisma.individualTransaction.findMany({
      where: { dlmId },
      orderBy: [{ timeCreatedAt: 'desc' }, { transactionId: 'desc' }],
      take: TRANSACTIONS_PER_PAGE,
    }),
    prisma.orderAudit.findMany({
      where: { hostDlmId: dlmId },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        orderId: true,
        transactionOrderId: true,
        gross: true,
        pointsEarned: true,
        createdAt: true,
        workerId: true,
        peiwanId: true,
      },
    }),
  ]);
  if (!user) return null;

  const displayName = user.manualWechatBoss?.displayName || user.wechatDisplayName || user.discordDisplayName || '老板';
  const avatarLetter = displayName.trim().slice(0, 1).toUpperCase() || '老';
  const cardClass = 'bg-white rounded-[32px] border border-black/5 p-8 space-y-6 shadow-[0_10px_30px_rgba(17,24,39,0.04)]';
  const stats = [
    { label: '账户余额', value: user.totalBalance },
    { label: '累计消费', value: user.totalSpent },
    { label: '点了么积分', value: user.loyaltyPoints },
  ];

  return (
    <main className="min-h-screen bg-[#f7f3ef] px-6 py-16 text-[#171717]">
      <section className="mx-auto max-w-7xl space-y-8">
        <div id="profile-overview" className={`${cardClass} overflow-hidden`}>
          <div className="space-y-4">
            <p className="text-xs uppercase tracking-[0.6em] text-gray-400">My Profile</p>
            <div className="flex items-center gap-4">
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-[#d4b24c]/40 bg-gradient-to-br from-[#fff3cf] to-[#ead08a] text-3xl font-semibold text-[#8a6000]">
                {avatarLetter}
              </div>
              <div className="space-y-1">
                <p className="text-3xl font-semibold tracking-wide">{displayName}</p>
                <p className="text-xs uppercase tracking-[0.3em] text-gray-500">DLM ID: {user.dlmId}</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href="/"
                className="rounded-full border-2 border-black/15 px-5 py-2 text-xs font-semibold tracking-[0.22em] text-gray-600 transition hover:border-[#f8c84a] hover:bg-[#f8c84a]/12 hover:text-[#c18400]"
              >
                返回主页
              </Link>
              <form action="/api/dlm/logout" method="post">
                <button className="rounded-full border-2 border-black/15 px-5 py-2 text-xs font-semibold tracking-[0.22em] text-gray-600 transition hover:border-[#f8c84a] hover:bg-[#f8c84a]/12 hover:text-[#c18400]">
                  退出登录
                </button>
              </form>
            </div>
          </div>

          <p className="rounded-2xl border border-amber-200/70 bg-[#fff8e7] px-4 py-3 text-sm text-[#8a6000]">
            当前为只读账户。充值、余额赠送、代打赏和代点单请联系管理员协助处理。
          </p>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {stats.map((item) => (
              <div
                key={item.label}
                className="space-y-2 rounded-2xl border border-dashed border-black/10 bg-white/70 p-5 text-center"
              >
                <p className="text-xs tracking-[0.4em] text-gray-500">{item.label}</p>
                <p className="text-2xl font-mono">{formatAmountDown(item.value, 2)}</p>
              </div>
            ))}
          </div>
        </div>

        <section id="profile-tx" className={cardClass}>
          <div>
            <h2 className="text-2xl font-semibold tracking-wide text-[#8a6000]">流水记录</h2>
            <p className="text-sm text-gray-500">与账户关联的收支流水（最近 {TRANSACTIONS_PER_PAGE} 条，共 {totalTransactions} 条）</p>
          </div>
          {transactions.length ? (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-black/5 text-left uppercase tracking-[0.4em] text-gray-400">
                    <th className="py-3 pr-4">时间</th>
                    <th className="py-3 pr-4">类型</th>
                    <th className="py-3 pr-4">变动前余额</th>
                    <th className="py-3 pr-4">金额变动</th>
                    <th className="py-3 pr-4">变动后余额</th>
                    <th className="py-3 pr-4">流水号</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((transaction) => {
                    const change = resolveAmountChange(
                      transaction.amountChange,
                      transaction.balanceBefore,
                      transaction.balanceAfter,
                    );
                    const digits = change !== null && change !== 0 && Math.abs(change) < 0.01 ? 4 : 2;
                    const changeMeta = getAmountChangeMeta(change, digits);
                    return (
                      <tr key={transaction.transactionId} className="border-b border-black/5 last:border-0">
                        <td className="py-4 pr-4 font-mono">{formatDate(transaction.timeCreatedAt)}</td>
                        <td className="py-4 pr-4">{formatTransactionType(transaction.typeOfTransaction)}</td>
                        <td className="py-4 pr-4 font-mono">{formatAmountDown(transaction.balanceBefore, digits)}</td>
                        <td className={`py-4 pr-4 font-mono ${changeMeta.className}`}>{changeMeta.label}</td>
                        <td className="py-4 pr-4 font-mono">{formatAmountDown(transaction.balanceAfter, digits)}</td>
                        <td className="py-4 pr-4 font-mono text-xs text-gray-500">{transaction.transactionId}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-gray-500">暂时没有流水记录。</p>
          )}
        </section>

        <section className={cardClass}>
          <div>
            <h2 className="text-2xl font-semibold tracking-wide text-[#8a6000]">订单记录</h2>
            <p className="text-sm text-gray-500">管理员代点单完成后的订单记录</p>
          </div>
          {orders.length ? (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-black/5 text-left uppercase tracking-[0.4em] text-gray-400">
                    <th className="py-3 pr-4">时间</th>
                    <th className="py-3 pr-4">订单</th>
                    <th className="py-3 pr-4">陪玩</th>
                    <th className="py-3 pr-4">消费</th>
                    <th className="py-3 pr-4">积分</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <tr key={order.orderId} className="border-b border-black/5 last:border-0">
                      <td className="py-4 pr-4 font-mono">{formatDate(order.createdAt)}</td>
                      <td className="py-4 pr-4">#{order.transactionOrderId}</td>
                      <td className="py-4 pr-4">陪玩 {order.peiwanId}</td>
                      <td className="py-4 pr-4 font-mono">{formatAmountDown(order.gross, 2)}</td>
                      <td className="py-4 pr-4 font-mono">{formatAmountDown(order.pointsEarned, 2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-gray-500">暂时没有已完成订单。</p>
          )}
        </section>

        <section className={cardClass}>
          <div>
            <h2 className="text-2xl font-semibold tracking-wide text-[#8a6000]">个人信息</h2>
            <p className="text-sm text-gray-500">由客服登记和维护</p>
          </div>
          <dl className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-dashed border-black/10 bg-white/70 p-5">
              <dt className="text-xs tracking-[0.4em] text-gray-500">DLM ID</dt>
              <dd className="mt-2 break-all font-mono text-sm">{user.dlmId}</dd>
            </div>
            <div className="rounded-2xl border border-dashed border-black/10 bg-white/70 p-5">
              <dt className="text-xs tracking-[0.4em] text-gray-500">老板备注名</dt>
              <dd className="mt-2 text-sm">{user.manualWechatBoss?.displayName ?? '—'}</dd>
            </div>
          </dl>
        </section>
      </section>
    </main>
  );
}
