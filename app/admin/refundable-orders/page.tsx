import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Prisma } from '@prisma/client';
import { formatAmountDown2 } from '@/lib/numberFormat';
import { prisma } from '@/lib/prisma';
import { getServerSession } from '@/lib/session';
import { canViewRefundableGifts } from '@/lib/admin';

const ROME_TIMEZONE = 'Europe/Rome';
const PAGE_SIZE = 50;

const formatDate = (value?: Date | string | null) => {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('zh-CN', { timeZone: ROME_TIMEZONE });
};

const formatNumber = (value: unknown) => formatAmountDown2(value);

const normalizeParam = (value: string | string[] | undefined) => {
  if (typeof value === 'string') return value.trim();
  if (Array.isArray(value)) return value[0]?.trim() ?? '';
  return '';
};

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export const metadata = {
  title: '可撤回订单',
};

export default async function RefundableOrdersPage(props: PageProps) {
  const session = await getServerSession();
  if (!session?.discordId || !canViewRefundableGifts(session.discordId)) {
    redirect('/');
  }

  const searchParams = (await props.searchParams) ?? {};
  const hostId = normalizeParam(searchParams.hostId);
  const workerId = normalizeParam(searchParams.workerId);
  const rawPage = normalizeParam(searchParams.page) || '1';
  const parsedPage = Number.parseInt(rawPage, 10);
  const currentPage = Number.isNaN(parsedPage) || parsedPage < 1 ? 1 : parsedPage;
  const skip = (currentPage - 1) * PAGE_SIZE;

  const filters: Prisma.OrderAuditWhereInput[] = [];
  if (hostId) {
    filters.push({
      OR: [{ hostId }, { hostJinleeId: hostId }],
    });
  }
  if (workerId) {
    filters.push({
      OR: [{ workerId }, { workerJinleeId: workerId }],
    });
  }
  const whereClause: Prisma.OrderAuditWhereInput = filters.length ? { AND: filters } : {};

  const [totalCount, records] = await Promise.all([
    prisma.orderAudit.count({ where: whereClause }),
    prisma.orderAudit.findMany({
      where: whereClause,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip,
      take: PAGE_SIZE,
      select: {
        id: true,
        orderId: true,
        paymentTransactionId: true,
        hostId: true,
        hostJinleeId: true,
        hostWechatOpenId: true,
        workerId: true,
        workerJinleeId: true,
        peiwanId: true,
        gross: true,
        pointsEarned: true,
        feeAmount: true,
        netAmount: true,
        commissionRate: true,
        hostFromIncome: true,
        hostFromRecharge: true,
        spendBonusExtra: true,
        spendRemainingBefore: true,
        bossReferralInviterId: true,
        bossReferralAmount: true,
        workerReferralInviterId: true,
        workerReferralAmount: true,
        createdAt: true,
      },
    }),
  ]);

  const relatedDiscordIds = Array.from(
    new Set(
      records
        .flatMap((record) => [record.hostId, record.workerId])
        .filter((value): value is string => Boolean(value?.trim()))
        .map((value) => value.trim()),
    ),
  );
  const relatedJinleeIds = Array.from(
    new Set(
      records
        .flatMap((record) => [record.hostJinleeId, record.workerJinleeId])
        .filter((value): value is string => Boolean(value?.trim()))
        .map((value) => value.trim()),
    ),
  );

  const [relatedMembers, relatedJinleeUsers] = await Promise.all([
    relatedDiscordIds.length
      ? prisma.member.findMany({
          where: { discordUserId: { in: relatedDiscordIds } },
          select: { discordUserId: true, serverDisplayName: true },
        })
      : Promise.resolve([]),
    relatedJinleeIds.length
      ? prisma.jinleeUser.findMany({
          where: { jinleeId: { in: relatedJinleeIds } },
          select: {
            jinleeId: true,
            discordUserId: true,
            discordDisplayName: true,
            wechatDisplayName: true,
          },
        })
      : Promise.resolve([]),
  ]);

  const discordDisplayNameMap = new Map(
    relatedMembers.map((row) => [row.discordUserId, row.serverDisplayName?.trim() ?? '']),
  );
  const jinleeUserMap = new Map(
    relatedJinleeUsers.map((row) => [row.jinleeId, row]),
  );

  const resolveDisplayName = (params: { discordUserId?: string | null; jinleeId?: string | null }) => {
    const discordUserId = params.discordUserId?.trim() ?? '';
    if (discordUserId) {
      const discordDisplayName = discordDisplayNameMap.get(discordUserId)?.trim();
      if (discordDisplayName) return discordDisplayName;
    }

    const jinleeId = params.jinleeId?.trim() ?? '';
    if (jinleeId) {
      const jinleeUser = jinleeUserMap.get(jinleeId);
      const jinleeDisplayName =
        jinleeUser?.discordDisplayName?.trim() ||
        jinleeUser?.wechatDisplayName?.trim() ||
        '';
      if (jinleeDisplayName) return jinleeDisplayName;
    }

    if (discordUserId) return discordUserId;
    return '未知用户';
  };

  const buildPageHref = (page: number) => {
    const params = new URLSearchParams();
    if (hostId) params.set('hostId', hostId);
    if (workerId) params.set('workerId', workerId);
    params.set('page', String(page));
    return `/admin/refundable-orders?${params.toString()}`;
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const hasPrev = currentPage > 1;
  const hasNext = currentPage < totalPages;
  const prevPage = Math.max(1, currentPage - 1);
  const nextPage = Math.min(totalPages, currentPage + 1);

  return (
    <section className="min-h-screen bg-[#020204] px-6 py-12 text-white">
      <div className="mx-auto flex max-w-[1400px] flex-col gap-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.6em] text-white/60">ADMIN</p>
            <h1 className="text-3xl font-semibold">可撤回订单</h1>
            <p className="text-sm text-white/60">按 `jinleeId` 优先检索，Discord 仅保留为审计快照。</p>
          </div>
          <Link
            href="/admin"
            className="inline-flex items-center justify-center rounded-full border border-white/20 px-4 py-2 text-sm text-white hover:bg-white/10"
          >
            返回后台
          </Link>
        </div>

        <div className="space-y-5 rounded-3xl border border-white/10 bg-white/5 p-8">
          <p className="text-xs text-white/50">
            第 {currentPage} / {totalPages} 页 · 共 {totalCount} 条
          </p>

          <form
            className="grid gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 sm:grid-cols-2"
            action="/admin/refundable-orders"
            method="get"
          >
            <div className="space-y-1">
              <label className="text-xs uppercase tracking-[0.4em] text-white/60">老板 ID</label>
              <input
                type="text"
                name="hostId"
                defaultValue={hostId}
                className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#5c43a3]"
                placeholder="jinleeId 或 discord id"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs uppercase tracking-[0.4em] text-white/60">陪玩 ID</label>
              <input
                type="text"
                name="workerId"
                defaultValue={workerId}
                className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#5c43a3]"
                placeholder="jinleeId 或 discord id"
              />
            </div>
            <div className="flex gap-3 sm:col-span-2">
              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-full bg-[#5c43a3] px-5 py-2 text-sm font-medium text-white hover:bg-[#4a3388]"
              >
                筛选
              </button>
              <Link
                href="/admin/refundable-orders"
                className="inline-flex items-center justify-center rounded-full border border-white/20 px-4 py-2 text-sm text-white hover:bg-white/10"
              >
                清除筛选
              </Link>
            </div>
          </form>

          <div className="rounded-2xl border border-white/10">
            <table className="w-full table-auto text-sm text-white">
              <thead className="bg-white/5 text-[11px] uppercase tracking-[0.35em] text-white/50">
                <tr>
                  <th className="px-3 py-3 text-left">Audit</th>
                  <th className="px-3 py-3 text-left">时间</th>
                  <th className="px-3 py-3 text-left">老板</th>
                  <th className="px-3 py-3 text-left">陪玩</th>
                  <th className="px-3 py-3 text-left">订单总额</th>
                  <th className="px-3 py-3 text-left">陪玩到手</th>
                  <th className="px-3 py-3 text-left">抽成比例</th>
                  <th className="px-3 py-3 text-left">老板收入扣款</th>
                  <th className="px-3 py-3 text-left">老板充值扣款</th>
                  <th className="px-3 py-3 text-left">消费Buff额外</th>
                  <th className="px-3 py-3 text-left">订单返利</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {records.length === 0 && (
                  <tr>
                    <td className="px-4 py-6 text-white/60" colSpan={11}>
                      暂无记录。
                    </td>
                  </tr>
                )}
                {records.map((record) => {
                  const hostDisplayName = resolveDisplayName({
                    discordUserId: record.hostId,
                    jinleeId: record.hostJinleeId,
                  });
                  const workerDisplayName = resolveDisplayName({
                    discordUserId: record.workerId,
                    jinleeId: record.workerJinleeId,
                  });

                  return (
                    <tr key={record.id} className="align-top">
                      <td className="whitespace-normal break-words px-3 py-3 font-mono text-[11px] text-white/80">
                        <div>orderId: {record.orderId}</div>
                        <div className="text-white/50">auditId: {record.id}</div>
                      </td>
                      <td className="whitespace-normal break-words px-3 py-3 text-white/70">
                        <div>{formatDate(record.createdAt)}</div>
                        <div className="text-[11px] text-white/50">{record.paymentTransactionId}</div>
                      </td>
                      <td className="whitespace-normal break-words px-3 py-3">
                        <div className="space-y-1">
                          <div className="text-white/90">{hostDisplayName}</div>
                          {record.hostId ? (
                            <div className="font-mono text-[11px] text-white/80">Discord: {record.hostId}</div>
                          ) : null}
                          {record.hostJinleeId ? (
                            <div className="font-mono text-[11px] text-white/50">Jinlee: {record.hostJinleeId}</div>
                          ) : null}
                          {!record.hostId && record.hostWechatOpenId ? (
                            <div className="text-[11px] text-white/50">微信用户</div>
                          ) : null}
                        </div>
                      </td>
                      <td className="whitespace-normal break-words px-3 py-3">
                        <div className="space-y-1">
                          <div className="text-white/90">{workerDisplayName}</div>
                          <div className="font-mono text-[11px] text-white/80">Discord: {record.workerId}</div>
                          <div className="font-mono text-[11px] text-white/50">Jinlee: {record.workerJinleeId}</div>
                        </div>
                      </td>
                      <td className="px-3 py-3">{formatNumber(record.gross)}</td>
                      <td className="px-3 py-3">{formatNumber(record.netAmount)}</td>
                      <td className="px-3 py-3">{formatNumber(record.commissionRate)}</td>
                      <td className="px-3 py-3">{formatNumber(record.hostFromIncome)}</td>
                      <td className="px-3 py-3">{formatNumber(record.hostFromRecharge)}</td>
                      <td className="px-3 py-3">{formatNumber(record.spendBonusExtra)}</td>
                      <td className="whitespace-normal break-words px-3 py-3">
                        <div>老板：{formatNumber(record.bossReferralAmount ?? 0)}</div>
                        <div>陪玩：{formatNumber(record.workerReferralAmount ?? 0)}</div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-white/60">
              第 {currentPage} / {totalPages} 页 · 共 {totalCount} 条
            </p>
            <div className="flex gap-2">
              <Link
                href={buildPageHref(prevPage)}
                className={`rounded-full border px-4 py-2 text-xs uppercase tracking-[0.4em] ${
                  hasPrev
                    ? 'border-white/20 text-white hover:bg-white/10'
                    : 'pointer-events-none border-white/10 text-white/40'
                }`}
                aria-disabled={!hasPrev}
              >
                上一页
              </Link>
              <Link
                href={buildPageHref(nextPage)}
                className={`rounded-full border px-4 py-2 text-xs uppercase tracking-[0.4em] ${
                  hasNext
                    ? 'border-white/20 text-white hover:bg-white/10'
                    : 'pointer-events-none border-white/10 text-white/40'
                }`}
                aria-disabled={!hasNext}
              >
                下一页
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
