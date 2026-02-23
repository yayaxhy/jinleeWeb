import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getServerSession } from '@/lib/session';
import { canViewTransactions, isHowardReadOnlyDiscordId } from '@/lib/admin';
import { formatAmountDown2 } from '@/lib/numberFormat';

const ROME_TIMEZONE = 'Europe/Rome';
const PAGE_SIZE = 50;

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
  return formatAmountDown2(value);
};

const formatDate = (value?: Date | string | null) => {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('zh-CN', { timeZone: ROME_TIMEZONE });
};

export const metadata = {
  title: '支出记录',
};

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminExpensesPage(props: PageProps) {
  const session = await getServerSession();
  if (!session?.discordId || !canViewTransactions(session.discordId)) {
    redirect('/');
  }
  const readOnly = isHowardReadOnlyDiscordId(session.discordId);

  const searchParams = (await props.searchParams) ?? {};
  const operatorIdParam = searchParams.operatorId;
  const targetIdParam = searchParams.targetId;
  const reasonParam = searchParams.reason;
  const startParam = Array.isArray(searchParams.startDate) ? searchParams.startDate[0] : searchParams.startDate;
  const endParam = Array.isArray(searchParams.endDate) ? searchParams.endDate[0] : searchParams.endDate;
  const operatorId =
    typeof operatorIdParam === 'string'
      ? operatorIdParam.trim()
      : Array.isArray(operatorIdParam)
        ? operatorIdParam[0]?.trim() ?? ''
        : '';
  const targetId =
    typeof targetIdParam === 'string'
      ? targetIdParam.trim()
      : Array.isArray(targetIdParam)
        ? targetIdParam[0]?.trim() ?? ''
        : '';
  const reasonKeyword =
    typeof reasonParam === 'string'
      ? reasonParam.trim()
      : Array.isArray(reasonParam)
        ? reasonParam[0]?.trim() ?? ''
        : '';

  const parsedStart = startParam ? new Date(startParam) : null;
  const parsedEnd = endParam ? new Date(endParam) : null;
  const startDate = parsedStart && !Number.isNaN(parsedStart.getTime()) ? parsedStart : null;
  const endDate = parsedEnd && !Number.isNaN(parsedEnd.getTime()) ? parsedEnd : null;

  const pageParam = searchParams.page;
  const rawPage = Array.isArray(pageParam) ? pageParam[0] : pageParam;
  const parsedPage = rawPage ? Number.parseInt(rawPage, 10) : 1;
  const currentPage = Number.isNaN(parsedPage) || parsedPage < 1 ? 1 : parsedPage;
  const skip = (currentPage - 1) * PAGE_SIZE;

  const whereClause: Prisma.ExpenseWhereInput = {};
  if (operatorId) whereClause.operatorId = operatorId;
  if (targetId) whereClause.targetId = targetId;
  if (reasonKeyword) {
    whereClause.reason = { contains: reasonKeyword, mode: 'insensitive' };
  }
  if (startDate || endDate) {
    whereClause.createdAt = {
      gte: startDate ?? undefined,
      lte: endDate ?? undefined,
    };
  }
  const hasFilters = Object.keys(whereClause).length > 0;

  const [totalCount, sumAgg, expenses] = await Promise.all([
    prisma.expense.count({ where: hasFilters ? whereClause : undefined }),
    prisma.expense.aggregate({
      _sum: { amount: true },
      where: hasFilters ? whereClause : undefined,
    }),
    prisma.expense.findMany({
      where: hasFilters ? whereClause : undefined,
      orderBy: { createdAt: 'desc' },
      skip,
      take: PAGE_SIZE,
      select: {
        id: true,
        operatorId: true,
        targetId: true,
        amount: true,
        reason: true,
        createdAt: true,
      },
    }),
  ]);

  const relatedDiscordIds = Array.from(
    new Set(
      expenses
        .flatMap((row) => [row.operatorId, row.targetId ?? ''])
        .map((id) => id.trim())
        .filter((id) => /^\d+$/.test(id))
    )
  );
  const relatedMembers = relatedDiscordIds.length
    ? await prisma.member.findMany({
        where: { discordUserId: { in: relatedDiscordIds } },
        select: { discordUserId: true, serverDisplayName: true },
      })
    : [];
  const displayNameMap = new Map(
    relatedMembers.map((row) => [row.discordUserId, row.serverDisplayName?.trim() ?? ''])
  );
  const resolveDisplayName = (discordUserId?: string | null) => {
    if (!discordUserId) return '—';
    const mapped = displayNameMap.get(discordUserId)?.trim();
    if (mapped) return mapped;
    return '未知用户';
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const hasPrev = currentPage > 1;
  const hasNext = currentPage < totalPages;
  const prevPage = Math.max(1, currentPage - 1);
  const nextPage = Math.min(totalPages, currentPage + 1);

  const queryBase = new URLSearchParams({
    ...(operatorId ? { operatorId } : {}),
    ...(targetId ? { targetId } : {}),
    ...(reasonKeyword ? { reason: reasonKeyword } : {}),
    ...(startParam ? { startDate: startParam } : {}),
    ...(endParam ? { endDate: endParam } : {}),
  });
  const currentQuery = new URLSearchParams(queryBase);
  currentQuery.set('page', String(Math.min(currentPage, totalPages)));
  const redirectToCurrent = `/admin/expenses?${currentQuery.toString()}`;
  const exportUrl = queryBase.toString() ? `/api/admin/expenses/export?${queryBase.toString()}` : '/api/admin/expenses/export';

  return (
    <section className="min-h-screen bg-[#020204] px-6 py-12 text-white">
      <div className="mx-auto flex max-w-7xl flex-col gap-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.6em] text-white/60">ADMIN</p>
            <h1 className="text-3xl font-semibold">支出记录（Expense）</h1>
            <p className="text-sm text-white/60">支持筛选、分页和 Excel 下载。</p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/admin/revenue"
              className="inline-flex items-center justify-center rounded-full border border-white/20 px-4 py-2 text-sm text-white hover:bg-white/10"
            >
              返回查看收益
            </Link>
            <Link
              href="/admin"
              className="inline-flex items-center justify-center rounded-full border border-white/20 px-4 py-2 text-sm text-white hover:bg-white/10"
            >
              返回后台
            </Link>
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <form className="grid gap-3 md:grid-cols-2 lg:grid-cols-3" action="/admin/expenses" method="get">
            <input
              type="text"
              name="operatorId"
              defaultValue={operatorId}
              placeholder="操作人 Discord ID"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-[#5c43a3]"
            />
            <input
              type="text"
              name="targetId"
              defaultValue={targetId}
              placeholder="目标用户 Discord ID"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-[#5c43a3]"
            />
            <input
              type="text"
              name="reason"
              defaultValue={reasonKeyword}
              placeholder="原因关键词"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-[#5c43a3]"
            />
            <input
              type="date"
              name="startDate"
              defaultValue={startParam ?? ''}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-[#5c43a3]"
            />
            <input
              type="date"
              name="endDate"
              defaultValue={endParam ?? ''}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-[#5c43a3]"
            />
            <div className="flex gap-2">
              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-full bg-[#5c43a3] px-6 py-3 text-sm tracking-[0.2em] text-white hover:bg-[#4a3388]"
              >
                筛选
              </button>
              <Link
                href="/admin/expenses"
                className="inline-flex items-center justify-center rounded-full border border-white/20 px-4 py-3 text-sm text-white hover:bg-white/10"
              >
                重置
              </Link>
            </div>
          </form>
          {readOnly ? (
            <p className="mt-3 text-xs text-amber-300/90">当前账号为只读模式，可查询和下载，但不能修改原因。</p>
          ) : null}
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <h2 className="text-xl font-semibold">Expense Transactions</h2>
              <p className="text-sm text-white/60">
                共 {totalCount} 条 · 当前页 {Math.min(currentPage, totalPages)} / {totalPages} · 总额 ¥
                {formatNumber(sumAgg._sum.amount)}
              </p>
            </div>
            <a
              href={exportUrl}
              className="inline-flex items-center justify-center rounded-full border border-white/30 px-4 py-2 text-xs uppercase tracking-[0.3em] text-white hover:bg-white/10"
            >
              下载 XLSX
            </a>
          </div>

          {expenses.length ? (
            <div className="overflow-x-auto space-y-3">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-left uppercase tracking-[0.3em] text-white/60">
                    <th className="py-3 pr-4">时间</th>
                    <th className="py-3 pr-4">操作人</th>
                    <th className="py-3 pr-4">目标用户</th>
                    <th className="py-3 pr-4">金额</th>
                    <th className="py-3 pr-4">原因</th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.map((row) => (
                    <tr key={row.id} className="border-b border-white/10 last:border-0">
                      <td className="py-3 pr-4 font-mono text-white/90">{formatDate(row.createdAt)}</td>
                      <td className="py-3 pr-4">
                        <div className="space-y-1">
                          <div className="text-white/90">{resolveDisplayName(row.operatorId)}</div>
                          <div className="font-mono text-xs text-white/50">{row.operatorId}</div>
                        </div>
                      </td>
                      <td className="py-3 pr-4">
                        {row.targetId ? (
                          <div className="space-y-1">
                            <div className="text-white/80">{resolveDisplayName(row.targetId)}</div>
                            <div className="font-mono text-xs text-white/50">{row.targetId}</div>
                          </div>
                        ) : (
                          <span className="text-white/50">—</span>
                        )}
                      </td>
                      <td className="py-3 pr-4 font-mono text-white/90">¥{formatNumber(row.amount)}</td>
                      <td className="py-3 pr-4 text-white/80">
                        <form
                          action="/api/admin/expenses/update-reason"
                          method="post"
                          className="flex min-w-[280px] items-center gap-2"
                        >
                          <input type="hidden" name="id" value={row.id} />
                          <input type="hidden" name="redirectTo" value={redirectToCurrent} />
                          <input
                            type="text"
                            name="reason"
                            defaultValue={row.reason}
                            disabled={readOnly}
                            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#5c43a3] disabled:cursor-not-allowed disabled:opacity-50"
                          />
                          <button
                            type="submit"
                            disabled={readOnly}
                            className="inline-flex items-center justify-center rounded-full border border-white/30 px-3 py-1 text-xs text-white hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            保存
                          </button>
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-white/60">
                <p>
                  第 {Math.min(currentPage, totalPages)} / {totalPages} 页
                </p>
                <div className="flex flex-wrap gap-2">
                  <Link
                    prefetch={false}
                    href={`/admin/expenses?${new URLSearchParams({ ...Object.fromEntries(queryBase.entries()), page: String(prevPage) }).toString()}`}
                    className={`rounded-full border px-4 py-2 text-xs uppercase tracking-[0.3em] ${
                      hasPrev ? 'border-white/30 hover:bg-white/10' : 'pointer-events-none border-white/10 text-white/40'
                    }`}
                    aria-disabled={!hasPrev}
                  >
                    上一页
                  </Link>
                  <Link
                    prefetch={false}
                    href={`/admin/expenses?${new URLSearchParams({ ...Object.fromEntries(queryBase.entries()), page: String(nextPage) }).toString()}`}
                    className={`rounded-full border px-4 py-2 text-xs uppercase tracking-[0.3em] ${
                      hasNext ? 'border-white/30 hover:bg-white/10' : 'pointer-events-none border-white/10 text-white/40'
                    }`}
                    aria-disabled={!hasNext}
                  >
                    下一页
                  </Link>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-white/60">暂无支出记录。</p>
          )}
        </div>
      </div>
    </section>
  );
}
