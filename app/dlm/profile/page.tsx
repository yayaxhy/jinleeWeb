import { redirect } from 'next/navigation';
import { getDlmPortalSession } from '@/lib/dlm-portal-session';
import { prisma } from '@/lib/prisma';

const money = (value: { toString(): string } | null | undefined) => Number(value?.toString() ?? 0).toFixed(2);
const dateTime = (value: Date) =>
  new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short', hour12: false }).format(value);

export default async function DlmPortalProfilePage() {
  const session = await getDlmPortalSession();
  if (!session) redirect('/dlm/login');

  const [user, ledgers, orders] = await Promise.all([
    prisma.dlmUser.findUnique({
      where: { dlmId: session.dlmId },
      include: { manualWechatBoss: true },
    }),
    prisma.individualTransaction.findMany({
      where: { dlmId: session.dlmId },
      orderBy: [{ timeCreatedAt: 'desc' }, { transactionId: 'desc' }],
      take: 1000,
    }),
    prisma.orderAudit.findMany({
      where: { hostDlmId: session.dlmId },
      orderBy: { createdAt: 'desc' },
      take: 500,
      select: { orderId: true, transactionOrderId: true, gross: true, pointsEarned: true, createdAt: true, workerId: true, peiwanId: true },
    }),
  ]);
  if (!user) redirect('/dlm/login');

  const displayName = user.manualWechatBoss?.displayName || user.wechatDisplayName || user.discordDisplayName || '老板';
  return (
    <main className="min-h-screen bg-[#020204] px-5 py-10 text-white sm:px-8">
      <section className="mx-auto max-w-6xl space-y-7">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs tracking-[0.35em] text-white/50">DLM CLUB · 只读个人中心</p>
            <h1 className="mt-2 text-3xl font-semibold">{displayName}</h1>
            <p className="mt-2 font-mono text-sm text-[#c4b5fd]">{user.dlmId}</p>
          </div>
          <form action="/api/dlm/logout" method="post">
            <button className="rounded-full border border-white/20 px-4 py-2 text-sm text-white/80 hover:bg-white/10">退出查询</button>
          </form>
        </header>

        <p className="rounded-2xl border border-amber-200/15 bg-amber-200/5 px-4 py-3 text-sm text-amber-100/85">
          此页面只能查看账户信息。充值、代打赏和代点单请联系管理员协助处理。
        </p>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {[
            ['可用余额', `¥${money(user.totalBalance)}`],
            ['充值余额', `¥${money(user.recharge)}`],
            ['收益余额', `¥${money(user.income)}`],
            ['累计消费', `¥${money(user.totalSpent)}`],
            ['点了么积分', money(user.loyaltyPoints)],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs text-white/55">{label}</p>
              <p className="mt-2 text-xl font-semibold">{value}</p>
            </div>
          ))}
        </div>

        <section className="rounded-3xl border border-white/10 bg-white/5 p-5 sm:p-6">
          <div className="mb-4 flex items-baseline justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold">账户流水</h2>
              <p className="mt-1 text-sm text-white/55">展示最近 1,000 条，以入账与扣款账本为准。</p>
            </div>
            <span className="text-sm text-white/50">{ledgers.length} 条</span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-white/10 text-xs text-white/50">
                <tr><th className="px-3 py-3">时间</th><th className="px-3 py-3">类型</th><th className="px-3 py-3">变动</th><th className="px-3 py-3">余额</th><th className="px-3 py-3">流水号</th></tr>
              </thead>
              <tbody>
                {ledgers.map((item) => (
                  <tr key={item.transactionId} className="border-b border-white/5 text-white/80">
                    <td className="whitespace-nowrap px-3 py-3 text-white/55">{dateTime(item.timeCreatedAt)}</td>
                    <td className="px-3 py-3">{item.typeOfTransaction}</td>
                    <td className="px-3 py-3 text-emerald-200">¥{money(item.amountChange)}</td>
                    <td className="px-3 py-3">¥{money(item.balanceAfter)}</td>
                    <td className="px-3 py-3 font-mono text-xs text-white/45">{item.transactionId}</td>
                  </tr>
                ))}
                {!ledgers.length ? <tr><td colSpan={5} className="px-3 py-8 text-center text-white/45">暂无流水</td></tr> : null}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/5 p-5 sm:p-6">
          <h2 className="text-xl font-semibold">已完成订单</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-white/10 text-xs text-white/50">
                <tr><th className="px-3 py-3">时间</th><th className="px-3 py-3">订单</th><th className="px-3 py-3">陪玩</th><th className="px-3 py-3">消费</th><th className="px-3 py-3">积分</th></tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.orderId} className="border-b border-white/5 text-white/80">
                    <td className="whitespace-nowrap px-3 py-3 text-white/55">{dateTime(order.createdAt)}</td>
                    <td className="px-3 py-3">#{order.transactionOrderId}</td>
                    <td className="px-3 py-3">陪玩 {order.peiwanId}</td>
                    <td className="px-3 py-3">¥{money(order.gross)}</td>
                    <td className="px-3 py-3">{money(order.pointsEarned)}</td>
                  </tr>
                ))}
                {!orders.length ? <tr><td colSpan={5} className="px-3 py-8 text-center text-white/45">暂无已完成订单</td></tr> : null}
              </tbody>
            </table>
          </div>
        </section>
      </section>
    </main>
  );
}
