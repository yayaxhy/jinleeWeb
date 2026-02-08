import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getServerSession } from '@/lib/session';
import { canViewOrderRequests } from '@/lib/admin';

const ROME_TIMEZONE = 'Europe/Rome';
const PAGE_SIZE = 20;

const formatDate = (value?: Date | string | null) => {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('zh-CN', { timeZone: ROME_TIMEZONE });
};

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>> | Record<string, string | string[] | undefined>;
};

export default async function AdminOrderRequestsPage(props: PageProps = {}) {
  const session = await getServerSession();
  if (!session?.discordId || !canViewOrderRequests(session.discordId)) {
    redirect('/');
  }

  const rawParams = await Promise.resolve(props.searchParams);
  const searchParams = rawParams ?? {};
  const orderIdParam = searchParams.orderId;
  const ownerIdParam = searchParams.ownerId;
  const workerIdParam = searchParams.workerId;
  const orderId =
    typeof orderIdParam === 'string'
      ? orderIdParam.trim()
      : Array.isArray(orderIdParam)
        ? orderIdParam[0]?.trim()
        : '';
  const ownerId =
    typeof ownerIdParam === 'string'
      ? ownerIdParam.trim()
      : Array.isArray(ownerIdParam)
        ? ownerIdParam[0]?.trim()
        : '';
  const workerId =
    typeof workerIdParam === 'string'
      ? workerIdParam.trim()
      : Array.isArray(workerIdParam)
        ? workerIdParam[0]?.trim()
        : '';

  const pageParam = searchParams.page;
  const rawPage = Array.isArray(pageParam) ? pageParam[0] : pageParam;
  const parsedPage = rawPage ? Number.parseInt(rawPage, 10) : 1;
  const currentPage = Number.isNaN(parsedPage) || parsedPage < 1 ? 1 : parsedPage;
  const skip = (currentPage - 1) * PAGE_SIZE;

  const where: Prisma.OrderRequestLogWhereInput = {};
  if (orderId) where.orderId = orderId;
  if (ownerId) where.ownerId = ownerId;
  if (workerId) where.clicks = { some: { workerId } };

  const [totalCount, rows] = await Promise.all([
    prisma.orderRequestLog.count({ where }),
    prisma.orderRequestLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: PAGE_SIZE,
      include: {
        owner: { select: { discordUserId: true, serverDisplayName: true } },
        clicks: {
          orderBy: { clickedAt: 'asc' },
          include: { worker: { select: { discordUserId: true, serverDisplayName: true } } },
        },
      },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const hasPrev = currentPage > 1;
  const hasNext = currentPage < totalPages;
  const prevPage = Math.max(1, currentPage - 1);
  const nextPage = Math.min(totalPages, currentPage + 1);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold">抢单记录</h2>
        <p className="text-sm text-white/60">查看派单内容与陪玩抢单名单</p>
      </div>

      <form className="grid gap-3 rounded-2xl border border-white/10 bg-white/5 p-5 md:grid-cols-4" action="/admin/order-requests" method="get">
        <div className="space-y-1">
          <label className="text-xs uppercase tracking-[0.4em] text-white/50">订单 ID</label>
          <input
            name="orderId"
            defaultValue={orderId}
            className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
            placeholder="message / interaction id"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs uppercase tracking-[0.4em] text-white/50">老板 ID</label>
          <input
            name="ownerId"
            defaultValue={ownerId}
            className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
            placeholder="discord id"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs uppercase tracking-[0.4em] text-white/50">陪玩 ID</label>
          <input
            name="workerId"
            defaultValue={workerId}
            className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
            placeholder="discord id"
          />
        </div>
        <div className="flex items-end">
          <button
            type="submit"
            className="inline-flex w-full items-center justify-center rounded-xl bg-[#5c43a3] px-4 py-2 text-sm font-medium text-white hover:bg-[#4a3388]"
          >
            查询
          </button>
        </div>
      </form>

      <div className="overflow-x-auto rounded-2xl border border-white/10">
        <table className="min-w-full text-sm text-white">
          <thead className="bg-white/5 text-xs uppercase tracking-[0.4em] text-white/50">
            <tr>
              <th className="px-4 py-3 text-left">时间</th>
              <th className="px-4 py-3 text-left">订单 ID</th>
              <th className="px-4 py-3 text-left">老板</th>
              <th className="px-4 py-3 text-left">派单内容</th>
              <th className="px-4 py-3 text-left">抢单陪玩</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {rows.length === 0 && (
              <tr>
                <td className="px-4 py-6 text-white/60" colSpan={5}>
                  暂无记录。
                </td>
              </tr>
            )}
            {rows.map((row) => {
              const ownerName =
                row.ownerDisplayName
                ?? row.owner?.serverDisplayName
                ?? row.owner?.discordUserId
                ?? row.ownerId;
              const clickers = row.clicks.map((click) => ({
                name:
                  click.workerDisplayName
                  ?? click.worker?.serverDisplayName
                  ?? click.worker?.discordUserId
                  ?? click.workerId,
                id: click.workerId,
              }));
              return (
                <tr key={row.orderId} className="align-top">
                  <td className="px-4 py-4 text-white/70 whitespace-nowrap">{formatDate(row.createdAt)}</td>
                  <td className="px-4 py-4 font-mono text-white/80">{row.orderId}</td>
                  <td className="px-4 py-4">
                    <div className="space-y-1">
                      <div className="text-white/90">{ownerName}</div>
                      <div className="text-xs text-white/50 font-mono">{row.ownerId}</div>
                    </div>
                  </td>
                  <td className="px-4 py-4 max-w-[360px] whitespace-pre-wrap break-words text-white/80">
                    {row.content}
                  </td>
                  <td className="px-4 py-4 text-white/80">
                    <div className="space-y-1">
                      <div>共 {row.clicks.length} 人</div>
                      {clickers.length ? (
                        <div className="space-y-1">
                          {clickers.map((clicker, index) => (
                            <div key={`${row.orderId}-${clicker.id}-${index}`} className="text-xs text-white/70">
                              <div>{clicker.name}</div>
                              <div className="font-mono text-white/50">{clicker.id}</div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-xs text-white/60">—</div>
                      )}
                    </div>
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
            href={`/admin/order-requests?orderId=${encodeURIComponent(orderId)}&ownerId=${encodeURIComponent(ownerId)}&workerId=${encodeURIComponent(workerId)}&page=${prevPage}`}
            className={`rounded-full border px-4 py-2 text-xs uppercase tracking-[0.4em] ${
              hasPrev ? 'border-white/20 text-white hover:bg-white/10' : 'border-white/10 text-white/40 pointer-events-none'
            }`}
            aria-disabled={!hasPrev}
          >
            上一页
          </Link>
          <Link
            href={`/admin/order-requests?orderId=${encodeURIComponent(orderId)}&ownerId=${encodeURIComponent(ownerId)}&workerId=${encodeURIComponent(workerId)}&page=${nextPage}`}
            className={`rounded-full border px-4 py-2 text-xs uppercase tracking-[0.4em] ${
              hasNext ? 'border-white/20 text-white hover:bg-white/10' : 'border-white/10 text-white/40 pointer-events-none'
            }`}
            aria-disabled={!hasNext}
          >
            下一页
          </Link>
        </div>
      </div>

      <Link
        href="/admin"
        className="inline-flex items-center justify-center rounded-full border border-white/20 px-6 py-2 text-sm tracking-[0.2em] text-white hover:bg-white/10"
      >
        返回后台首页
      </Link>
    </div>
  );
}
