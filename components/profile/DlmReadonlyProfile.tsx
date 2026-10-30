
import { SiteText } from "@/components/SiteCopyProvider";
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { isDiscordSnowflake } from '@/lib/discord-id';
import { formatAmountDown } from '@/lib/numberFormat';
import { resolveWalletDelta } from '@/lib/wallet-ledger';
import { formatTransactionType } from '@/lib/transaction-display';

const ROME_TIMEZONE = 'Europe/Rome';
const TRANSACTIONS_PER_PAGE = 10;
const STAFF_OPERATED_TRANSACTION_TYPES = new Set([
  '人工充值',
  '微信人工充值',
  '充值返现',
  '公会成本',
  'VIP福利',
  '老板赔偿',
  '其他',
]);

const formatDate = (value?: Date | string | null) => {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('zh-CN', { timeZone: ROME_TIMEZONE });
};

const getAmountChangeMeta = (value: number | null, digits = 2) => {
  if (value === null) return { label: '—', className: 'text-gray-400' };
  if (value === 0) return { label: '0', className: 'text-gray-500' };
  return {
    label: `${value > 0 ? '+' : '-'}${formatAmountDown(Math.abs(value), digits)}`,
    className: value > 0 ? 'text-emerald-500' : 'text-rose-500',
  };
};

const getTransactionNote = (
  transaction: { typeOfTransaction: string; thirdPartydiscordId: string },
  counterpartyDisplayNames: Map<string, string | undefined>,
) => {
  if (STAFF_OPERATED_TRANSACTION_TYPES.has(transaction.typeOfTransaction)) return '客服';
  return counterpartyDisplayNames.get(transaction.thirdPartydiscordId.trim()) ?? transaction.thirdPartydiscordId ?? '—';
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

  // Use the same counterparty-name lookup as the regular Discord profile so
  // delegated gifts show the recipient instead of an internal ledger ID.
  const counterpartyDiscordIds = Array.from(
    new Set(
      transactions
        .map((transaction) => transaction.thirdPartydiscordId.trim())
        .filter(isDiscordSnowflake),
    ),
  );
  const counterparties = counterpartyDiscordIds.length
    ? await prisma.member.findMany({
        where: { discordUserId: { in: counterpartyDiscordIds } },
        select: { discordUserId: true, serverDisplayName: true },
      })
    : [];
  const counterpartyDisplayNames = new Map(
    counterparties
      .map((counterparty) => [counterparty.discordUserId, counterparty.serverDisplayName?.trim()] as const)
      .filter(([, displayName]) => Boolean(displayName)),
  );

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
            <p className="text-xs uppercase tracking-[0.6em] text-gray-400"><SiteText copyKey="site.components.profile.dlmreadonlyprofile.9ba8d391c59a" /></p>
            <div className="flex items-center gap-4">
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-[#d4b24c]/40 bg-gradient-to-br from-[#fff3cf] to-[#ead08a] text-3xl font-semibold text-[#8a6000]">
                {avatarLetter}
              </div>
              <div className="space-y-1">
                <p className="text-3xl font-semibold tracking-wide">{displayName}</p>
                <p className="text-xs uppercase tracking-[0.3em] text-gray-500"><SiteText copyKey="site.components.profile.dlmreadonlyprofile.9bd3d635c012" />{user.dlmId}</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href="/"
                className="rounded-full border-2 border-black/15 px-5 py-2 text-xs font-semibold tracking-[0.22em] text-gray-600 transition hover:border-[#f8c84a] hover:bg-[#f8c84a]/12 hover:text-[#c18400]"
              ><SiteText copyKey="site.components.profile.dlmreadonlyprofile.20b6e2fcece9" /></Link>
              <form action="/api/dlm/logout" method="post">
                <button className="rounded-full border-2 border-black/15 px-5 py-2 text-xs font-semibold tracking-[0.22em] text-gray-600 transition hover:border-[#f8c84a] hover:bg-[#f8c84a]/12 hover:text-[#c18400]"><SiteText copyKey="site.components.profile.dlmreadonlyprofile.094774b4a77b" /></button>
              </form>
            </div>
          </div>

          <p className="rounded-2xl border border-amber-200/70 bg-[#fff8e7] px-4 py-3 text-sm text-[#8a6000]"><SiteText copyKey="site.components.profile.dlmreadonlyprofile.f8864e421b6b" /></p>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {stats.map((item) => (
              <div
                key={item.label}
                className="space-y-2 rounded-2xl border border-dashed border-black/10 bg-white/70 p-5 text-center"
              >
                <p className="text-xs tracking-[0.4em] text-gray-500"><SiteText namespace="site.components.profile.dlmreadonlyprofile" value={item.label} /></p>
                <p className="text-2xl font-mono">{formatAmountDown(item.value, 2)}</p>
              </div>
            ))}
          </div>
        </div>

        <section id="profile-tx" className={cardClass}>
          <div>
            <h2 className="text-2xl font-semibold tracking-wide text-[#8a6000]"><SiteText copyKey="site.components.profile.dlmreadonlyprofile.7ca84917a2e1" /></h2>
            <p className="text-sm text-gray-500"><SiteText copyKey="site.components.profile.dlmreadonlyprofile.94d9ca770bce" />{TRANSACTIONS_PER_PAGE}<SiteText copyKey="site.components.profile.dlmreadonlyprofile.8e9dc075e770" />{totalTransactions}<SiteText copyKey="site.components.profile.dlmreadonlyprofile.372545bb9e8e" /></p>
          </div>
          {transactions.length ? (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-black/5 text-left uppercase tracking-[0.4em] text-gray-400">
                    <th className="py-3 pr-4"><SiteText copyKey="site.components.profile.dlmreadonlyprofile.89b4aa6364ce" /></th>
                    <th className="py-3 pr-4"><SiteText copyKey="site.components.profile.dlmreadonlyprofile.e4e46c7235d1" /></th>
                    <th className="py-3 pr-4"><SiteText copyKey="site.components.profile.dlmreadonlyprofile.90e514a4b554" /></th>
                    <th className="py-3 pr-4"><SiteText copyKey="site.components.profile.dlmreadonlyprofile.10b10e5e7f6b" /></th>
                    <th className="py-3 pr-4"><SiteText copyKey="site.components.profile.dlmreadonlyprofile.1646bf2ec192" /></th>
                    <th className="py-3 pr-4"><SiteText copyKey="site.components.profile.dlmreadonlyprofile.e0361480e3a5" /></th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((transaction) => {
                    const change = resolveWalletDelta(transaction)?.toNumber() ?? null;
                    const digits = change !== null && change !== 0 && Math.abs(change) < 0.01 ? 4 : 2;
                    const changeMeta = getAmountChangeMeta(change, digits);
                    return (
                      <tr key={transaction.transactionId} className="border-b border-black/5 last:border-0">
                        <td className="py-4 pr-4 font-mono">{formatDate(transaction.timeCreatedAt)}</td>
                        <td className="py-4 pr-4">{transaction.typeOfTransaction === 'Stripe充值' || transaction.typeOfTransaction === '微信人工充值' ? <SiteText namespace="site.lib.transaction.display" value={formatTransactionType(transaction.typeOfTransaction)} /> : formatTransactionType(transaction.typeOfTransaction)}</td>
                        <td className="py-4 pr-4 font-mono">{formatAmountDown(transaction.balanceBefore, digits)}</td>
                        <td className={`py-4 pr-4 font-mono ${changeMeta.className}`}>{changeMeta.label}</td>
                        <td className="py-4 pr-4 font-mono">{formatAmountDown(transaction.balanceAfter, digits)}</td>
                        <td className="py-4 pr-4 text-gray-500">
                          {getTransactionNote(transaction, counterpartyDisplayNames)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-gray-500"><SiteText copyKey="site.components.profile.dlmreadonlyprofile.96aafce775c3" /></p>
          )}
        </section>

        <section className={cardClass}>
          <div>
            <h2 className="text-2xl font-semibold tracking-wide text-[#8a6000]"><SiteText copyKey="site.components.profile.dlmreadonlyprofile.8c34454926c1" /></h2>
            <p className="text-sm text-gray-500"><SiteText copyKey="site.components.profile.dlmreadonlyprofile.637a63ce5122" /></p>
          </div>
          {orders.length ? (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-black/5 text-left uppercase tracking-[0.4em] text-gray-400">
                    <th className="py-3 pr-4"><SiteText copyKey="site.components.profile.dlmreadonlyprofile.89b4aa6364ce" /></th>
                    <th className="py-3 pr-4"><SiteText copyKey="site.components.profile.dlmreadonlyprofile.81b3798bebc6" /></th>
                    <th className="py-3 pr-4"><SiteText copyKey="site.components.profile.dlmreadonlyprofile.558072a553aa" /></th>
                    <th className="py-3 pr-4"><SiteText copyKey="site.components.profile.dlmreadonlyprofile.71d6df4130ec" /></th>
                    <th className="py-3 pr-4"><SiteText copyKey="site.components.profile.dlmreadonlyprofile.b3e2659e5f12" /></th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <tr key={order.orderId} className="border-b border-black/5 last:border-0">
                      <td className="py-4 pr-4 font-mono">{formatDate(order.createdAt)}</td>
                      <td className="py-4 pr-4">#{order.transactionOrderId}</td>
                      <td className="py-4 pr-4"><SiteText copyKey="site.components.profile.dlmreadonlyprofile.d395e3f6edae" />{order.peiwanId}</td>
                      <td className="py-4 pr-4 font-mono">{formatAmountDown(order.gross, 2)}</td>
                      <td className="py-4 pr-4 font-mono">{formatAmountDown(order.pointsEarned, 2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-gray-500"><SiteText copyKey="site.components.profile.dlmreadonlyprofile.69742bfe5140" /></p>
          )}
        </section>

        <section className={cardClass}>
          <div>
            <h2 className="text-2xl font-semibold tracking-wide text-[#8a6000]"><SiteText copyKey="site.components.profile.dlmreadonlyprofile.c241ef1b935c" /></h2>
            <p className="text-sm text-gray-500"><SiteText copyKey="site.components.profile.dlmreadonlyprofile.cf807aad82ef" /></p>
          </div>
          <dl className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-dashed border-black/10 bg-white/70 p-5">
              <dt className="text-xs tracking-[0.4em] text-gray-500"><SiteText copyKey="site.components.profile.dlmreadonlyprofile.86c67464ba78" /></dt>
              <dd className="mt-2 break-all font-mono text-sm">{user.dlmId}</dd>
            </div>
            <div className="rounded-2xl border border-dashed border-black/10 bg-white/70 p-5">
              <dt className="text-xs tracking-[0.4em] text-gray-500"><SiteText copyKey="site.components.profile.dlmreadonlyprofile.a66f25b36f20" /></dt>
              <dd className="mt-2 text-sm">{user.manualWechatBoss?.displayName ?? '—'}</dd>
            </div>
          </dl>
        </section>
      </section>
    </main>
  );
}
