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

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export const metadata = {
  title: '可撤回订单',
};

type OrderAuditRow = {
  id: string;
  orderId: string;
  paymentTransactionId: string;
  transactionOrderId: number;
  hostId: string;
  workerId: string;
  peiwanId: number;
  gross: unknown;
  pointsEarned: unknown;
  feeAmount: unknown;
  netAmount: unknown;
  commissionRate: unknown;
  hostFromIncome: unknown;
  hostFromRecharge: unknown;
  spendBonusExtra: unknown;
  spendRemainingBefore: unknown;
  bossReferralInviterId: string | null;
  bossReferralAmount: unknown | null;
  workerReferralInviterId: string | null;
  workerReferralAmount: unknown | null;
  createdAt: Date;
};

export default async function RefundableOrdersPage(props: PageProps) {
  const session = await getServerSession();
  if (!session?.discordId || !canViewRefundableGifts(session.discordId)) {
    redirect('/');
  }

  const searchParams = (await props.searchParams) ?? {};
  const hostParam = searchParams.hostId;
  const workerParam = searchParams.workerId;
  const hostId =
    typeof hostParam === 'string'
      ? hostParam.trim()
      : Array.isArray(hostParam)
        ? hostParam[0]?.trim()
        : '';
  const workerId =
    typeof workerParam === 'string'
      ? workerParam.trim()
      : Array.isArray(workerParam)
        ? workerParam[0]?.trim()
        : '';
  const pageParam = searchParams.page;
  const rawPage = Array.isArray(pageParam) ? pageParam[0] : pageParam;
  const parsedPage = rawPage ? Number.parseInt(rawPage, 10) : 1;
  const currentPage = Number.isNaN(parsedPage) || parsedPage < 1 ? 1 : parsedPage;
  const skip = (currentPage - 1) * PAGE_SIZE;

  let whereClause = Prisma.empty;
  if (hostId && workerId) {
    whereClause = Prisma.sql`WHERE oa."hostId" = ${hostId} AND oa."workerId" = ${workerId}`;
  } else if (hostId) {
    whereClause = Prisma.sql`WHERE oa."hostId" = ${hostId}`;
  } else if (workerId) {
    whereClause = Prisma.sql`WHERE oa."workerId" = ${workerId}`;
  }

  const [totalCount, records] = await Promise.all([
    prisma
      .$queryRaw<Array<{ count: bigint | number }>>(
        Prisma.sql`
          SELECT COUNT(*)::bigint AS count
          FROM "order_audit" oa
          ${whereClause}
        `,
      )
      .then((rows) => Number(rows[0]?.count ?? 0)),
    prisma.$queryRaw<OrderAuditRow[]>(
      Prisma.sql`
        SELECT
          oa."id",
          oa."orderId",
          oa."paymentTransactionId",
          oa."transactionOrderId",
          oa."hostId",
          oa."workerId",
          oa."peiwanId",
          oa."gross",
          oa."pointsEarned",
          oa."feeAmount",
          oa."netAmount",
          oa."commissionRate",
          oa."hostFromIncome",
          oa."hostFromRecharge",
          oa."spendBonusExtra",
          oa."spendRemainingBefore",
          oa."bossReferralInviterId",
          oa."bossReferralAmount",
          oa."workerReferralInviterId",
          oa."workerReferralAmount",
          oa."createdAt"
        FROM "order_audit" oa
        ${whereClause}
        ORDER BY oa."createdAt" DESC, oa."id" DESC
        LIMIT ${PAGE_SIZE}
        OFFSET ${skip}
      `,
    ),
  ]);

  const relatedDiscordIds = Array.from(
    new Set(
      records
        .flatMap((record) => [record.hostId, record.workerId])
        .map((id) => id.trim())
        .filter((id) => /^\d+$/.test(id)),
    ),
  );
  const relatedMembers = relatedDiscordIds.length
    ? await prisma.member.findMany({
        where: { discordUserId: { in: relatedDiscordIds } },
        select: { discordUserId: true, serverDisplayName: true },
      })
    : [];
  const displayNameMap = new Map(
    relatedMembers.map((row) => [row.discordUserId, row.serverDisplayName?.trim() ?? '']),
  );
  const resolveDisplayName = (discordUserId: string) => {
    const mapped = displayNameMap.get(discordUserId)?.trim();
    if (mapped) return mapped;
    return '未知用户';
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const hasPrev = currentPage > 1;
  const hasNext = currentPage < totalPages;
  const prevPage = Math.max(1, currentPage - 1);
  const nextPage = Math.min(totalPages, currentPage + 1);

  return (
    <section className="min-h-screen bg-[#020204] text-white px-6 py-12">
      <div className="mx-auto flex max-w-[1400px] flex-col gap-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.6em] text-white/60">ADMIN</p>
            <h1 className="text-3xl font-semibold">可撤回订单</h1>
            <p className="text-sm text-white/60">仅展示 order_audit 数据，不提供网页撤回按钮。</p>
          </div>
          <Link
            href="/admin"
            className="inline-flex items-center justify-center rounded-full border border-white/20 px-4 py-2 text-sm text-white hover:bg-white/10"
          >
            返回后台
          </Link>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-8 space-y-5">
          <p className="text-xs text-white/50">
            第 {currentPage} / {totalPages} 页 · 共 {totalCount} 条
          </p>

          <form
            className="grid gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 sm:grid-cols-2"
            action="/admin/refundable-orders"
            method="get"
          >
            <div className="space-y-1">
              <label className="text-xs uppercase tracking-[0.4em] text-white/60">老板 Discord ID</label>
              <input
                type="text"
                name="hostId"
                defaultValue={hostId}
                className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#5c43a3]"
                placeholder="输入老板 ID"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs uppercase tracking-[0.4em] text-white/60">陪玩 Discord ID</label>
              <input
                type="text"
                name="workerId"
                defaultValue={workerId}
                className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#5c43a3]"
                placeholder="输入陪玩 ID"
              />
            </div>
            <div className="sm:col-span-2 flex gap-3">
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
                {records.map((record) => (
                  <tr key={record.id} className="align-top">
                    <td className="px-3 py-3 font-mono text-[11px] text-white/80 whitespace-normal break-words">
                      <div>orderId: {record.orderId}</div>
                      <div>txnNo: {record.transactionOrderId}</div>
                      <div>auditId: {record.id}</div>
                    </td>
                    <td className="px-3 py-3 text-white/70 whitespace-normal break-words">
                      <div>{formatDate(record.createdAt)}</div>
                      <div className="text-[11px] text-white/50">{record.paymentTransactionId}</div>
                    </td>
                    <td className="px-3 py-3 whitespace-normal break-words">
                      <div className="space-y-1">
                        <div className="text-white/90">{resolveDisplayName(record.hostId)}</div>
                        <div className="font-mono text-[11px] text-white/80">{record.hostId}</div>
                      </div>
                    </td>
                    <td className="px-3 py-3 whitespace-normal break-words">
                      <div className="space-y-1">
                        <div className="text-white/90">{resolveDisplayName(record.workerId)}</div>
                        <div className="font-mono text-[11px] text-white/80">{record.workerId}</div>
                      </div>
                    </td>
                    <td className="px-3 py-3">{formatNumber(record.gross)}</td>
                    <td className="px-3 py-3">{formatNumber(record.netAmount)}</td>
                    <td className="px-3 py-3">{formatNumber(record.commissionRate)}</td>
                    <td className="px-3 py-3">{formatNumber(record.hostFromIncome)}</td>
                    <td className="px-3 py-3">{formatNumber(record.hostFromRecharge)}</td>
                    <td className="px-3 py-3">{formatNumber(record.spendBonusExtra)}</td>
                    <td className="px-3 py-3 whitespace-normal break-words">
                      <div>老板：{formatNumber(record.bossReferralAmount ?? 0)}</div>
                      <div>陪玩：{formatNumber(record.workerReferralAmount ?? 0)}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-white/60">
              第 {currentPage} / {totalPages} 页 · 共 {totalCount} 条
            </p>
            <div className="flex gap-2">
              <Link
                href={`/admin/refundable-orders?hostId=${encodeURIComponent(hostId)}&workerId=${encodeURIComponent(workerId)}&page=${prevPage}`}
                className={`rounded-full border px-4 py-2 text-xs uppercase tracking-[0.4em] ${
                  hasPrev ? 'border-white/20 text-white hover:bg-white/10' : 'border-white/10 text-white/40 pointer-events-none'
                }`}
                aria-disabled={!hasPrev}
              >
                上一页
              </Link>
              <Link
                href={`/admin/refundable-orders?hostId=${encodeURIComponent(hostId)}&workerId=${encodeURIComponent(workerId)}&page=${nextPage}`}
                className={`rounded-full border px-4 py-2 text-xs uppercase tracking-[0.4em] ${
                  hasNext ? 'border-white/20 text-white hover:bg-white/10' : 'border-white/10 text-white/40 pointer-events-none'
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
