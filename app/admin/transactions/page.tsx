import Link from 'next/link';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getServerSession } from '@/lib/session';
import { isAdminDiscordId } from '@/lib/admin';

const ROME_TIMEZONE = 'Europe/Rome';

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
  return date.toLocaleString('zh-CN', { timeZone: ROME_TIMEZONE });
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

const PAGE_SIZE = 20;

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
  const startParam = Array.isArray(searchParams.startDate) ? searchParams.startDate[0] : searchParams.startDate;
  const endParam = Array.isArray(searchParams.endDate) ? searchParams.endDate[0] : searchParams.endDate;
  const parsedStart = startParam ? new Date(startParam) : null;
  const parsedEnd = endParam ? new Date(endParam) : null;
  const startDate = parsedStart && !Number.isNaN(parsedStart.getTime()) ? parsedStart : null;
  const endDate = parsedEnd && !Number.isNaN(parsedEnd.getTime()) ? parsedEnd : null;
  const pageParam = searchParams.page;
  const rawPage = Array.isArray(pageParam) ? pageParam[0] : pageParam;
  const parsedPage = rawPage ? Number.parseInt(rawPage, 10) : 1;
  const currentPage = Number.isNaN(parsedPage) || parsedPage < 1 ? 1 : parsedPage;
  const skip = (currentPage - 1) * PAGE_SIZE;
  const whereClause = discordId
    ? {
        discordId,
        ...(startDate || endDate
          ? {
              timeCreatedAt: {
                gte: startDate ?? undefined,
                lte: endDate ?? undefined,
              },
            }
          : {}),
      }
    : undefined;

  const member = discordId
    ? await prisma.member.findUnique({
        where: { discordUserId: discordId },
        select: { discordUserId: true, serverDisplayName: true },
      })
    : null;

  const [totalCount, transactions] = discordId
    ? await Promise.all([
        prisma.individualTransaction.count({ where: whereClause }),
        prisma.individualTransaction.findMany({
          where: whereClause,
          orderBy: { timeCreatedAt: 'desc' },
          skip,
          take: PAGE_SIZE,
        }),
      ])
    : [0, []];
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const hasPrev = currentPage > 1;
  const hasNext = currentPage < totalPages;
  const prevPage = Math.max(1, currentPage - 1);
  const nextPage = Math.min(totalPages, currentPage + 1);

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
            <div className="flex flex-col gap-3">
              <input
                type="text"
                name="discordId"
                defaultValue={discordId}
                placeholder="请输入 Discord ID"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-[#5c43a3]"
              />
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-xs text-white/60">开始日期</label>
                  <input
                    type="date"
                    name="startDate"
                    defaultValue={startParam ?? ''}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-[#5c43a3]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-white/60">结束日期</label>
                  <input
                    type="date"
                    name="endDate"
                    defaultValue={endParam ?? ''}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-[#5c43a3]"
                  />
                </div>
              </div>
              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-full bg-[#5c43a3] px-6 py-3 text-sm tracking-[0.2em] text-white hover:bg-[#4a3388]"
              >
                查询
              </button>
            </div>
            <p className="text-xs text-white/60">查询结果按时间倒序显示，可按日期区间筛选。</p>
          </form>
        </div>

        {discordId ? (
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold">查询结果</h2>
                <p className="text-sm text-white/60">
                  用户：{member?.serverDisplayName ?? '—'}（{discordId}）
                  {startDate || endDate ? (
                    <>
                      {' '}
                      · 时间范围：
                      {startDate ? startDate.toLocaleDateString('zh-CN', { timeZone: ROME_TIMEZONE }) : '—'} ~{' '}
                      {endDate ? endDate.toLocaleDateString('zh-CN', { timeZone: ROME_TIMEZONE }) : '—'}
                    </>
                  ) : null}
                </p>
              </div>
              <span className="text-xs uppercase tracking-[0.4em] text-white/50">
                共 {totalCount} 条 · 第 {Math.min(currentPage, totalPages)} / {totalPages} 页
              </span>
            </div>

            {transactions.length > 0 ? (
              <div className="overflow-x-auto space-y-3">
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
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-sm text-white/60">
                  <p>
                    第 {Math.min(currentPage, totalPages)} / {totalPages} 页 · 共 {totalCount} 条
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Link
                      prefetch={false}
                      href={`/admin/transactions?discordId=${encodeURIComponent(discordId)}&page=${prevPage}${
                        startParam ? `&startDate=${encodeURIComponent(startParam)}` : ''
                      }${endParam ? `&endDate=${encodeURIComponent(endParam)}` : ''}`}
                      className={`px-4 py-2 rounded-full border text-xs uppercase tracking-[0.3em] ${
                        hasPrev ? 'border-white/30 hover:bg-white/10' : 'border-white/10 text-white/40 pointer-events-none'
                      }`}
                      aria-disabled={!hasPrev}
                    >
                      上一页
                    </Link>
                    <form
                      method="get"
                      action="/admin/transactions"
                      className="flex items-center gap-2 text-xs uppercase tracking-[0.3em]"
                    >
                      <input type="hidden" name="discordId" value={discordId} />
                      {startParam ? <input type="hidden" name="startDate" value={startParam} /> : null}
                      {endParam ? <input type="hidden" name="endDate" value={endParam} /> : null}
                      <label className="text-white/60">跳转页</label>
                      <input
                        type="number"
                        name="page"
                        min={1}
                        max={totalPages}
                        defaultValue={currentPage}
                        className="w-20 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-[#5c43a3]"
                      />
                      <button
                        type="submit"
                        className="rounded-full border border-white/30 px-3 py-2 text-white hover:bg-white/10"
                      >
                        跳转
                      </button>
                    </form>
                    <Link
                      prefetch={false}
                      href={`/admin/transactions?discordId=${encodeURIComponent(discordId)}&page=${nextPage}${
                        startParam ? `&startDate=${encodeURIComponent(startParam)}` : ''
                      }${endParam ? `&endDate=${encodeURIComponent(endParam)}` : ''}`}
                      className={`px-4 py-2 rounded-full border text-xs uppercase tracking-[0.3em] ${
                        hasNext ? 'border-white/30 hover:bg-white/10' : 'border-white/10 text-white/40 pointer-events-none'
                      }`}
                      aria-disabled={!hasNext}
                    >
                      下一页
                    </Link>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-white/60">暂无流水记录或未找到该用户。</p>
            )}
          </div>
        ) : (
          <div className="rounded-3xl border border-dashed border-white/10 bg-white/5 p-6 text-sm text-white/60">
            输入 Discord ID 后点击查询，将显示该用户的全部 individual transactions（时间倒序）。可选填日期范围并分页查看。
          </div>
        )}

      </div>
    </section>
  );
}
