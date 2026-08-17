import Link from 'next/link';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { getServerSession } from '@/lib/session';
import { canViewKefuTransactions, isAdminDiscordId } from '@/lib/admin';
import { formatAmountDown2 } from '@/lib/numberFormat';
import { formatTransactionType } from '@/lib/transaction-display';

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
  return formatAmountDown2(value);
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

const paymentSource = (transactionType: string) => {
  if (transactionType === '网站充值') return 'ZPay';
  if (transactionType === '微信Native充值') return '微信原生';
  if (transactionType === '信用卡/银行卡充值') return 'Stripe';
  return '—';
};

export const metadata = {
  title: '查询流水',
};

const PAGE_SIZE = 20;

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminTransactionsPage(props: PageProps) {
  const session = await getServerSession();
  if (!session?.discordId || !canViewKefuTransactions(session.discordId)) {
    redirect('/');
  }

  const searchParams = (await props.searchParams) ?? {};
  const fromIdParam = searchParams.fromId;
  const toIdParam = searchParams.toId;
  const userIdParam = searchParams.userId;
  const discordIdParam = searchParams.discordId;
  const fromId =
    typeof fromIdParam === 'string'
      ? fromIdParam.trim()
      : Array.isArray(fromIdParam)
        ? fromIdParam[0]?.trim() ?? ''
        : typeof userIdParam === 'string'
          ? userIdParam.trim()
          : Array.isArray(userIdParam)
            ? userIdParam[0]?.trim() ?? ''
            : typeof discordIdParam === 'string'
              ? discordIdParam.trim()
              : Array.isArray(discordIdParam)
                ? discordIdParam[0]?.trim() ?? ''
                : '';
  const toId =
    typeof toIdParam === 'string'
      ? toIdParam.trim()
      : Array.isArray(toIdParam)
        ? toIdParam[0]?.trim() ?? ''
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
  const whereClause: Prisma.IndividualTransactionWhereInput = {};
  if (fromId) {
    whereClause.OR = [{ discordId: fromId }, { jinleeId: fromId }];
  }
  if (toId) {
    whereClause.thirdPartydiscordId = toId;
  }
  if (startDate || endDate) {
    whereClause.timeCreatedAt = {
      gte: startDate ?? undefined,
      lte: endDate ?? undefined,
    };
  }
  const hasFilters = Object.keys(whereClause).length > 0;

  const userSummary = fromId
    ? await prisma.jinleeUser.findFirst({
        where: {
          OR: [{ jinleeId: fromId }, { discordUserId: fromId }],
        },
        select: {
          jinleeId: true,
          discordUserId: true,
          discordDisplayName: true,
          wechatDisplayName: true,
        },
      })
    : null;

  const [totalCount, transactions] = await Promise.all([
    prisma.individualTransaction.count({ where: hasFilters ? whereClause : undefined }),
    prisma.individualTransaction.findMany({
      where: hasFilters ? whereClause : undefined,
      orderBy: { timeCreatedAt: 'desc' },
      skip,
      take: PAGE_SIZE,
    }),
  ]);
  const stripePaymentIntentIds = Array.from(
    new Set(
      transactions
        .filter((tx) => tx.typeOfTransaction === '信用卡/银行卡充值')
        .map((tx) => tx.thirdPartydiscordId.trim())
        .filter(Boolean),
    ),
  );
  const stripePayments = stripePaymentIntentIds.length
    ? await prisma.stripePayment.findMany({
        where: { paymentIntentId: { in: stripePaymentIntentIds } },
        select: { outTradeNo: true, paymentIntentId: true },
      })
    : [];
  const stripeOrderByPaymentIntentId = new Map(
    stripePayments
      .filter((payment): payment is { outTradeNo: string; paymentIntentId: string } => Boolean(payment.paymentIntentId))
      .map((payment) => [payment.paymentIntentId, payment.outTradeNo]),
  );
  const canDownloadStripeEvidence = isAdminDiscordId(session.discordId);

  const relatedDiscordIds = Array.from(
    new Set(
      transactions
        .flatMap((tx) => [tx.discordId, tx.thirdPartydiscordId ?? ''])
        .map((id) => id?.trim())
        .filter((id): id is string => Boolean(id))
        .filter((id) => /^\d+$/.test(id))
    )
  );
  const relatedJinleeIds = Array.from(
    new Set(
      transactions
        .map((tx) => tx.jinleeId?.trim())
        .filter((id): id is string => Boolean(id))
    )
  );
  const relatedMembers = relatedDiscordIds.length
    ? await prisma.member.findMany({
        where: { discordUserId: { in: relatedDiscordIds } },
        select: { discordUserId: true, serverDisplayName: true },
      })
    : [];
  const relatedJinleeUsers = relatedJinleeIds.length
    ? await prisma.jinleeUser.findMany({
        where: { jinleeId: { in: relatedJinleeIds } },
        select: {
          jinleeId: true,
          discordDisplayName: true,
          wechatDisplayName: true,
        },
      })
    : [];
  const displayNameMap = new Map(
    relatedMembers.map((row) => [row.discordUserId, row.serverDisplayName?.trim() ?? ''])
  );
  const jinleeNameMap = new Map(
    relatedJinleeUsers.map((row) => [
      row.jinleeId,
      row.discordDisplayName?.trim() || row.wechatDisplayName?.trim() || '',
    ])
  );
  const resolveDisplayName = (params: { discordUserId?: string | null; jinleeId?: string | null }) => {
    const jinleeMapped = params.jinleeId ? jinleeNameMap.get(params.jinleeId)?.trim() : '';
    if (jinleeMapped) return jinleeMapped;
    const discordUserId = params.discordUserId;
    if (!discordUserId) return '—';
    const mapped = displayNameMap.get(discordUserId)?.trim();
    if (mapped) return mapped;
    if (discordUserId === 'SYSTEM') return '系统';
    return '未知用户';
  };
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const hasPrev = currentPage > 1;
  const hasNext = currentPage < totalPages;
  const prevPage = Math.max(1, currentPage - 1);
  const nextPage = Math.min(totalPages, currentPage + 1);
  const persistentQueryParams = {
    ...(fromId ? { fromId } : {}),
    ...(toId ? { toId } : {}),
    ...(startParam ? { startDate: startParam } : {}),
    ...(endParam ? { endDate: endParam } : {}),
  };
  const exportParams = new URLSearchParams(persistentQueryParams);
  const exportQuery = exportParams.toString();
  const exportUrl = exportQuery ? `/api/admin/transactions/export?${exportQuery}` : '/api/admin/transactions/export';

  return (
    <section className="min-h-screen bg-[#020204] text-white px-6 py-12">
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.6em] text-white/60">ADMIN</p>
            <h1 className="text-3xl font-semibold">查询流水</h1>
            <p className="text-sm text-white/60">默认展示全部流水，可按主用户ID、第三方关联ID与日期区间筛选。</p>
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
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-sm text-white/80">主用户ID</label>
                  <input
                    type="text"
                    name="fromId"
                    defaultValue={fromId}
                    placeholder="请输入 Jinlee ID 或 Discord ID"
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-[#5c43a3]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm text-white/80">第三方关联ID（陪玩ID）</label>
                  <input
                    type="text"
                    name="toId"
                    defaultValue={toId}
                    placeholder="请输入第三方关联 Discord ID"
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-[#5c43a3]"
                  />
                </div>
              </div>
              <div className="space-y-1 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-white/65">
                <p>*查特定用户的所有流水：填写主用户ID即可</p>
                <p>*查特定用户对特定用户的所有流水：填写主用户ID（老板ID）和第三方关联ID（陪玩ID）</p>
              </div>
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
            <p className="text-xs text-white/60">查询结果按时间倒序显示。</p>
          </form>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold">查询结果</h2>
              <p className="text-sm text-white/60">
                {fromId
                  ? `主用户ID：${
                      userSummary?.discordDisplayName ??
                      userSummary?.wechatDisplayName ??
                      userSummary?.discordUserId ??
                      userSummary?.jinleeId ??
                      '—'
                    }（${userSummary?.jinleeId ?? fromId}）`
                  : '全部流水'}
                {toId ? ` · 第三方关联ID：${toId}` : null}
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
            <div className="flex flex-wrap items-center gap-3 text-xs uppercase tracking-[0.4em] text-white/50">
              <a
                href={exportUrl}
                className="inline-flex items-center justify-center rounded-full border border-white/30 px-4 py-2 text-xs uppercase tracking-[0.3em] text-white hover:bg-white/10"
              >
                下载 XLSX
              </a>
              <span>
                共 {totalCount} 条 · 第 {Math.min(currentPage, totalPages)} / {totalPages} 页
              </span>
            </div>
          </div>

          {transactions.length > 0 ? (
            <div className="overflow-x-auto space-y-3">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-white/60 uppercase tracking-[0.3em] border-b border-white/10">
                    <th className="py-3 pr-4">时间</th>
                    <th className="py-3 pr-4">用户</th>
                    <th className="py-3 pr-4">类型</th>
                    <th className="py-3 pr-4">充值来源</th>
                    <th className="py-3 pr-4">变动前余额</th>
                    <th className="py-3 pr-4">金额变动</th>
                    <th className="py-3 pr-4">变动后余额</th>
                    <th className="py-3 pr-4">关联对象</th>
                    <th className="py-3 pr-4">争议证据</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((tx) => {
                    const change = resolveAmountChange(tx.amountChange, tx.balanceBefore, tx.balanceAfter);
                    const meta = changeMeta(change);
                    return (
                      <tr key={tx.transactionId} className="border-b border-white/10 last:border-0">
                        <td className="py-3 pr-4 font-mono text-white/90">{formatDate(tx.timeCreatedAt)}</td>
                        <td className="py-3 pr-4">
                          <div className="space-y-1">
                            <div className="text-white/90">
                              {resolveDisplayName({ discordUserId: tx.discordId, jinleeId: tx.jinleeId })}
                            </div>
                            <div className="text-xs text-white/50 font-mono">{tx.jinleeId ?? tx.discordId ?? '—'}</div>
                            {tx.discordId && tx.jinleeId ? (
                              <div className="text-xs text-white/40 font-mono">Discord: {tx.discordId}</div>
                            ) : null}
                          </div>
                        </td>
                        <td className="py-3 pr-4 text-white/90">{formatTransactionType(tx.typeOfTransaction)}</td>
                        <td className="py-3 pr-4 text-white/80">{paymentSource(tx.typeOfTransaction)}</td>
                        <td className="py-3 pr-4 font-mono text-white/80">{formatNumber(tx.balanceBefore)}</td>
                        <td className={`py-3 pr-4 font-mono ${meta.className}`}>{meta.label}</td>
                        <td className="py-3 pr-4 font-mono text-white/80">{formatNumber(tx.balanceAfter)}</td>
                        <td className="py-3 pr-4">
                          {tx.thirdPartydiscordId ? (
                            <div className="space-y-1">
                              <div className="text-white/70">
                                {resolveDisplayName({ discordUserId: tx.thirdPartydiscordId })}
                              </div>
                              <div className="text-xs text-white/50 font-mono">{tx.thirdPartydiscordId}</div>
                            </div>
                          ) : (
                            <span className="text-white/60">—</span>
                          )}
                        </td>
                        <td className="py-3 pr-4">
                          {canDownloadStripeEvidence && tx.typeOfTransaction === '信用卡/银行卡充值' ? (
                            (() => {
                              const outTradeNo = stripeOrderByPaymentIntentId.get(tx.thirdPartydiscordId);
                              return outTradeNo ? (
                                <a
                                  href={`/api/admin/stripe-payments/${encodeURIComponent(outTradeNo)}/evidence`}
                                  className="text-xs text-violet-300 underline underline-offset-4 hover:text-violet-100"
                                >
                                  下载
                                </a>
                              ) : (
                                <span className="text-white/40">—</span>
                              );
                            })()
                          ) : (
                            <span className="text-white/40">—</span>
                          )}
                        </td>
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
                    href={`/admin/transactions?${new URLSearchParams({
                      ...persistentQueryParams,
                      page: String(prevPage),
                    }).toString()}`}
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
                    {fromId ? <input type="hidden" name="fromId" value={fromId} /> : null}
                    {toId ? <input type="hidden" name="toId" value={toId} /> : null}
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
                    href={`/admin/transactions?${new URLSearchParams({
                      ...persistentQueryParams,
                      page: String(nextPage),
                    }).toString()}`}
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
            <p className="text-sm text-white/60">暂无流水记录。</p>
          )}
        </div>

      </div>
    </section>
  );
}
