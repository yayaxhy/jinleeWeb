import Link from 'next/link';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getServerSession } from '@/lib/session';
import { isAdminDiscordId } from '@/lib/admin';

const stringify = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'bigint') return value.toString();
  if (typeof value === 'object' && value !== null && 'toString' in value) {
    const fn = (value as { toString?: () => string }).toString;
    if (typeof fn === 'function') return fn.call(value);
  }
  return String(value);
};

const parseNumber = (value: unknown): number | null => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return Number.isNaN(value) ? null : value;
  if (typeof value === 'bigint') return Number(value);
  const numeric = Number(stringify(value));
  return Number.isNaN(numeric) ? null : numeric;
};

const formatNumber = (value: unknown) => {
  const numeric = parseNumber(value);
  if (numeric === null) return '—';
  return numeric.toLocaleString('zh-CN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
};

const formatDate = (value?: Date | string | null) => {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('zh-CN');
};

const resolveAmountChange = (amountChange: unknown, balanceBefore: unknown, balanceAfter: unknown): number | null => {
  const amount = parseNumber(amountChange);
  const before = parseNumber(balanceBefore);
  const after = parseNumber(balanceAfter);

  if (before !== null && after !== null) {
    const derived = after - before;
    if (amount === null) return derived;
    if (Math.sign(derived) !== Math.sign(amount) || Math.abs(derived - amount) > 0.0001) {
      return derived;
    }
    return amount;
  }

  return amount;
};

const changeMeta = (value: number | null) => {
  if (value === null) return { label: '—', className: 'text-gray-400' };
  if (value === 0) return { label: '0', className: 'text-gray-500' };
  const prefix = value > 0 ? '+' : '-';
  return {
    label: `${prefix}${formatNumber(Math.abs(value))}`,
    className: value > 0 ? 'text-emerald-400' : 'text-rose-400',
  };
};

export const metadata = {
  title: '查询流水',
};

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>> | Record<string, string | string[] | undefined>;
};

export default async function AdminTransactionsPage(props: PageProps = {}) {
  const session = await getServerSession();
  if (!session?.discordId || !isAdminDiscordId(session.discordId)) {
    redirect('/');
  }

  const rawParams = await Promise.resolve(props.searchParams);
  const searchParams = rawParams ?? {};
  const discordIdParam = searchParams.discordId;
  const discordId =
    typeof discordIdParam === 'string'
      ? discordIdParam.trim()
      : Array.isArray(discordIdParam)
        ? discordIdParam[0]?.trim()
        : '';

  const member = discordId
    ? await prisma.member.findUnique({
        where: { discordUserId: discordId },
        select: { discordUserId: true, serverDisplayName: true },
      })
    : null;

  const transactions = discordId
    ? await prisma.individualTransaction.findMany({
        where: { discordId },
        orderBy: { timeCreatedAt: 'desc' },
      })
    : [];

  return (
    <section className="min-h-screen bg-[#020204] text-white px-6 py-12">
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.6em] text-white/60">ADMIN</p>
            <h1 className="text-3xl font-semibold">查询流水</h1>
            <p className="text-sm text-white/60">输入 Discord ID，查看该用户的 individual transactions。</p>
          </div>
          <Link
            href="/admin"
            className="inline-flex items-center justify-center rounded-full border border-white/20 px-4 py-2 text-sm text-white hover:bg-white/10"
          >
            返回后台
          </Link>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-6 space-y-4">
          <form className="space-y-3" action="/admin/transactions" method="get">
            <label className="text-sm text-white/80">Discord ID</label>
            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                type="text"
                name="discordId"
                defaultValue={discordId}
                placeholder="请输入 Discord ID"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-[#5c43a3]"
              />
              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-full bg-[#5c43a3] px-6 py-3 text-sm tracking-[0.2em] text-white hover:bg-[#4a3388]"
              >
                查询
              </button>
            </div>
            <p className="text-xs text-white/60">查询结果按时间倒序显示。</p>
          </form>
        </div>

        {discordId ? (
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold">查询结果</h2>
                <p className="text-sm text-white/60">
                  用户：{member?.serverDisplayName ?? '—'}（{discordId}）
                </p>
              </div>
              <span className="text-xs uppercase tracking-[0.4em] text-white/50">共 {transactions.length} 条</span>
            </div>

            {transactions.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-white/60 uppercase tracking-[0.3em] border-b border-white/10">
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
                      const change = resolveAmountChange(tx.amountChange, tx.balanceBefore, tx.balanceAfter);
                      const meta = changeMeta(change);
                      return (
                        <tr key={tx.transactionId} className="border-b border-white/10 last:border-0">
                          <td className="py-3 pr-4 font-mono text-white/90">{formatDate(tx.timeCreatedAt)}</td>
                          <td className="py-3 pr-4 text-white/90">{tx.typeOfTransaction}</td>
                          <td className="py-3 pr-4 font-mono text-white/80">{formatNumber(tx.balanceBefore)}</td>
                          <td className={`py-3 pr-4 font-mono ${meta.className}`}>{meta.label}</td>
                          <td className="py-3 pr-4 font-mono text-white/80">{formatNumber(tx.balanceAfter)}</td>
                          <td className="py-3 pr-4 text-white/60">{tx.thirdPartydiscordId ?? '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-white/60">暂无流水记录或未找到该用户。</p>
            )}
          </div>
        ) : (
          <div className="rounded-3xl border border-dashed border-white/10 bg-white/5 p-6 text-sm text-white/60">
            输入 Discord ID 后点击查询，将显示该用户的全部 individual transactions（时间倒序）。最多一次性返回所有记录，如数据量过大建议后续加分页。
          </div>
        )}
      </div>
    </section>
  );
}
