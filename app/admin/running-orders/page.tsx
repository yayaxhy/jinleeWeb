import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getServerSession } from '@/lib/session';
import {
  canViewOrderRequests,
  isAdminDiscordId,
  isKefuDiscordId,
  isHowardDiscordId,
  isIriaDiscordId,
  isPeiwanInfoAdminDiscordId,
} from '@/lib/admin';
import { formatAmountDown2 } from '@/lib/numberFormat';

const ROME_TIMEZONE = 'Europe/Rome';
const PAGE_SIZE = 20;

const formatDate = (value?: Date | string | null) => {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('zh-CN', { timeZone: ROME_TIMEZONE });
};

const formatNumber = (value: unknown, maximumFractionDigits = 2) => {
  void maximumFractionDigits;
  return formatAmountDown2(value);
};

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const resolveBackHref = (discordId?: string | null) => {
  if (!discordId) return '/';
  if (isKefuDiscordId(discordId)) return '/kefu';
  if (isHowardDiscordId(discordId)) return '/howard';
  if (isIriaDiscordId(discordId)) return '/iria';
  if (isPeiwanInfoAdminDiscordId(discordId)) return '/admin';
  if (isAdminDiscordId(discordId)) return '/admin';
  return '/';
};

export const metadata = {
  title: '正在进行的订单',
};

export default async function RunningOrdersPage(props: PageProps) {
  const session = await getServerSession();
  if (!session?.discordId || !canViewOrderRequests(session.discordId)) {
    redirect('/');
  }

  const searchParams = (await props.searchParams) ?? {};
  const orderIdParam = searchParams.orderId;
  const hostIdParam = searchParams.hostId;
  const workerIdParam = searchParams.workerId;
  const peiwanIdParam = searchParams.peiwanId;
  const orderId =
    typeof orderIdParam === 'string'
      ? orderIdParam.trim()
      : Array.isArray(orderIdParam)
        ? orderIdParam[0]?.trim()
        : '';
  const hostId =
    typeof hostIdParam === 'string'
      ? hostIdParam.trim()
      : Array.isArray(hostIdParam)
        ? hostIdParam[0]?.trim()
        : '';
  const workerId =
    typeof workerIdParam === 'string'
      ? workerIdParam.trim()
      : Array.isArray(workerIdParam)
        ? workerIdParam[0]?.trim()
        : '';
  const peiwanIdRaw =
    typeof peiwanIdParam === 'string'
      ? peiwanIdParam.trim()
      : Array.isArray(peiwanIdParam)
        ? peiwanIdParam[0]?.trim()
        : '';

  const filters: Prisma.OrderWhereInput[] = [{ status: 'RUNNING' }];

  if (orderId) {
    const numeric = Number(orderId);
    if (Number.isInteger(numeric) && numeric > 0) {
      filters.push({ OR: [{ displayNo: numeric }, { id: orderId }] });
    } else {
      filters.push({ id: orderId });
    }
  }
  if (hostId) {
    filters.push({
      OR: [{ hostId }, { hostJinleeId: hostId }],
    });
  }
  if (workerId) filters.push({ workerId });
  if (peiwanIdRaw) {
    const numericPeiwan = Number(peiwanIdRaw);
    if (Number.isInteger(numericPeiwan) && numericPeiwan > 0) {
      filters.push({ peiwanId: numericPeiwan });
    }
  }
  const whereClause: Prisma.OrderWhereInput = { AND: filters };

  const pageParam = searchParams.page;
  const rawPage = Array.isArray(pageParam) ? pageParam[0] : pageParam;
  const parsedPage = rawPage ? Number.parseInt(rawPage, 10) : 1;
  const currentPage = Number.isNaN(parsedPage) || parsedPage < 1 ? 1 : parsedPage;
  const skip = (currentPage - 1) * PAGE_SIZE;

  const [totalCount, orders] = await Promise.all([
    prisma.order.count({ where: whereClause }),
    prisma.order.findMany({
      where: whereClause,
      orderBy: [{ acceptedAt: 'desc' }, { createdAt: 'desc' }],
      skip,
      take: PAGE_SIZE,
      select: {
        id: true,
        displayNo: true,
        hostId: true,
        hostJinleeId: true,
        workerId: true,
        peiwanId: true,
        unitPrice: true,
        chargedMinutes: true,
        chargedGross: true,
        createdAt: true,
        acceptedAt: true,
        stopwatchStartAt: true,
        cutoffAt: true,
        hostJinleeUser: { select: { jinleeId: true, discordDisplayName: true, wechatDisplayName: true } },
        host: { select: { discordUserId: true, serverDisplayName: true } },
        worker: { select: { discordUserId: true, serverDisplayName: true } },
      },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const hasPrev = currentPage > 1;
  const hasNext = currentPage < totalPages;
  const prevPage = Math.max(1, currentPage - 1);
  const nextPage = Math.min(totalPages, currentPage + 1);
  const backHref = resolveBackHref(session.discordId);
  const exportParams = new URLSearchParams({
    ...(orderId ? { orderId } : {}),
    ...(hostId ? { hostId } : {}),
    ...(workerId ? { workerId } : {}),
    ...(peiwanIdRaw ? { peiwanId: peiwanIdRaw } : {}),
  });
  const exportUrl = exportParams.toString()
    ? `/api/admin/running-orders/export?${exportParams.toString()}`
    : '/api/admin/running-orders/export';

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold text-white">正在进行的订单</h2>
        <p className="text-sm text-white/60">展示所有 RUNNING 状态订单</p>
      </div>

      <form className="grid gap-3 rounded-2xl border border-white/10 bg-white/5 p-5 md:grid-cols-4" action="/admin/running-orders" method="get">
        <div className="space-y-1">
          <label className="text-xs uppercase tracking-[0.4em] text-white/50">订单 ID / 编号</label>
          <input
            name="orderId"
            defaultValue={orderId}
            className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
            placeholder="订单 id 或 displayNo"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs uppercase tracking-[0.4em] text-white/50">老板 ID</label>
          <input
            name="hostId"
            defaultValue={hostId}
            className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
            placeholder="jinleeId 或 discord id"
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
        <div className="space-y-1">
          <label className="text-xs uppercase tracking-[0.4em] text-white/50">陪玩编号</label>
          <input
            name="peiwanId"
            defaultValue={peiwanIdRaw}
            className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
            placeholder="PEIWANID"
          />
        </div>
        <div className="md:col-span-4">
          <button
            type="submit"
            className="inline-flex w-full items-center justify-center rounded-xl bg-[#5c43a3] px-4 py-2 text-sm font-medium text-white hover:bg-[#4a3388]"
          >
            查询
          </button>
        </div>
      </form>

      <div className="overflow-x-auto rounded-2xl border border-white/10">
        <div className="flex items-center justify-end border-b border-white/10 bg-white/5 px-4 py-3">
          <a
            href={exportUrl}
            className="inline-flex items-center justify-center rounded-full border border-white/30 px-4 py-2 text-xs uppercase tracking-[0.3em] text-white hover:bg-white/10"
          >
            下载 XLSX
          </a>
        </div>
        <table className="min-w-full text-sm text-white">
          <thead className="bg-white/5 text-xs uppercase tracking-[0.4em] text-white/50">
            <tr>
              <th className="px-4 py-3 text-left">接单时间</th>
              <th className="px-4 py-3 text-left">订单编号</th>
              <th className="px-4 py-3 text-left">老板</th>
              <th className="px-4 py-3 text-left">陪玩</th>
              <th className="px-4 py-3 text-left">单价</th>
              <th className="px-4 py-3 text-left">已计费分钟</th>
              <th className="px-4 py-3 text-left">已计费金额</th>
              <th className="px-4 py-3 text-left">计费开始</th>
              <th className="px-4 py-3 text-left">自动截止</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {orders.length === 0 && (
              <tr>
                <td className="px-4 py-6 text-white/60" colSpan={9}>
                  暂无进行中的订单。
                </td>
              </tr>
            )}
            {orders.map((order) => {
              const hostName =
                order.host?.serverDisplayName ??
                order.hostJinleeUser?.discordDisplayName ??
                order.hostJinleeUser?.wechatDisplayName ??
                order.host?.discordUserId ??
                order.hostId ??
                order.hostJinleeId ??
                '未知用户';
              const workerName = order.worker?.serverDisplayName ?? order.worker?.discordUserId ?? order.workerId;
              return (
                <tr key={order.id} className="align-top">
                  <td className="px-4 py-4 text-white/70 whitespace-nowrap">{formatDate(order.acceptedAt ?? order.createdAt)}</td>
                  <td className="px-4 py-4">
                    <div className="space-y-1">
                      <div className="font-mono text-white/90">{order.displayNo}</div>
                      <div className="text-xs text-white/50 font-mono">{order.id}</div>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="space-y-1">
                      <div className="text-white/90">{hostName}</div>
                      <div className="text-xs text-white/50 font-mono">{order.hostJinleeId ?? order.hostId ?? '—'}</div>
                      {order.hostId && order.hostJinleeId ? (
                        <div className="text-xs text-white/40 font-mono">Discord: {order.hostId}</div>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="space-y-1">
                      <div className="text-white/90">{workerName}</div>
                      <div className="text-xs text-white/50 font-mono">{order.workerId}</div>
                      <div className="text-xs text-white/60">陪玩ID: {order.peiwanId}</div>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-white/80">¥{formatNumber(order.unitPrice)}</td>
                  <td className="px-4 py-4 text-white/80">{formatNumber(order.chargedMinutes, 0)}</td>
                  <td className="px-4 py-4 text-white/80">¥{formatNumber(order.chargedGross)}</td>
                  <td className="px-4 py-4 text-white/70 whitespace-nowrap">{formatDate(order.stopwatchStartAt)}</td>
                  <td className="px-4 py-4 text-white/70 whitespace-nowrap">{formatDate(order.cutoffAt)}</td>
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
            href={`/admin/running-orders?orderId=${encodeURIComponent(orderId)}&hostId=${encodeURIComponent(hostId)}&workerId=${encodeURIComponent(workerId)}&peiwanId=${encodeURIComponent(peiwanIdRaw)}&page=${prevPage}`}
            className={`rounded-full border px-4 py-2 text-xs uppercase tracking-[0.4em] ${
              hasPrev ? 'border-white/20 text-white hover:bg-white/10' : 'border-white/10 text-white/40 pointer-events-none'
            }`}
            aria-disabled={!hasPrev}
          >
            上一页
          </Link>
          <Link
            href={`/admin/running-orders?orderId=${encodeURIComponent(orderId)}&hostId=${encodeURIComponent(hostId)}&workerId=${encodeURIComponent(workerId)}&peiwanId=${encodeURIComponent(peiwanIdRaw)}&page=${nextPage}`}
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
        href={backHref}
        className="inline-flex items-center justify-center rounded-full border border-white/20 px-6 py-2 text-sm tracking-[0.2em] text-white hover:bg-white/10"
      >
        返回上一级
      </Link>
    </div>
  );
}
