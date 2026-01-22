import Link from 'next/link';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getServerSession } from '@/lib/session';
import { isAdminDiscordId } from '@/lib/admin';

const ROME_TIMEZONE = 'Europe/Rome';
const PAGE_SIZE = 50;

const stringifyUnknown = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'bigint') return value.toString();
  if (typeof value === 'object' && value !== null && 'toString' in value) {
    const toStringFn = (value as { toString?: () => string }).toString;
    if (typeof toStringFn === 'function') {
      return toStringFn.call(value);
    }
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

const parseNumber = (value: unknown): number | null => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') {
    return Number.isNaN(value) ? null : value;
  }
  if (typeof value === 'bigint') {
    return Number(value);
  }
  const numeric = Number(stringifyUnknown(value));
  return Number.isNaN(numeric) ? null : numeric;
};

const formatNumber = (value: unknown, maximumFractionDigits = 2) => {
  const numeric = parseNumber(value);
  if (numeric === null) return '—';
  return numeric.toLocaleString('zh-CN', { minimumFractionDigits: 0, maximumFractionDigits });
};

const formatDate = (value?: Date | string | null) => {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('zh-CN', { timeZone: ROME_TIMEZONE });
};

const formatVoucher = (value: unknown) => {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'string') return value || '—';
  try {
    return JSON.stringify(value);
  } catch {
    const fallback = stringifyUnknown(value);
    return fallback || '—';
  }
};

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>> | Record<string, string | string[] | undefined>;
};

export const metadata = {
  title: '可退回打赏',
};

export default async function RefundableGiftsPage(props: PageProps = {}) {
  const session = await getServerSession();
  if (!session?.discordId || !isAdminDiscordId(session.discordId)) {
    redirect('/');
  }

  const rawParams = await Promise.resolve(props.searchParams);
  const searchParams = rawParams ?? {};
  const pageParam = searchParams.page;
  const rawPage = Array.isArray(pageParam) ? pageParam[0] : pageParam;
  const parsedPage = rawPage ? Number.parseInt(rawPage, 10) : 1;
  const currentPage = Number.isNaN(parsedPage) || parsedPage < 1 ? 1 : parsedPage;
  const skip = (currentPage - 1) * PAGE_SIZE;

  const [totalCount, records] = await Promise.all([
    prisma.giftAudit.count(),
    prisma.giftAudit.findMany({
      orderBy: { createdAt: 'desc' },
      skip,
      take: PAGE_SIZE,
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const hasPrev = currentPage > 1;
  const hasNext = currentPage < totalPages;
  const prevPage = Math.max(1, currentPage - 1);
  const nextPage = Math.min(totalPages, currentPage + 1);

  return (
    <section className="min-h-screen bg-[#020204] text-white px-6 py-12">
      <div className="mx-auto flex max-w-7xl flex-col gap-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.6em] text-white/60">ADMIN</p>
            <h1 className="text-3xl font-semibold">可退回打赏</h1>
            <p className="text-sm text-white/60">
              按时间倒序
            </p>
          </div>
          <Link
            href="/admin"
            className="inline-flex items-center justify-center rounded-full border border-white/20 px-4 py-2 text-sm text-white hover:bg-white/10"
          >
            返回后台
          </Link>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            
            <p className="text-xs text-white/50">
              第 {currentPage} / {totalPages} 页 · 共 {totalCount} 条
            </p>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-white/10">
            <table className="min-w-full text-sm text-white">
              <thead className="bg-white/5 text-xs uppercase tracking-[0.4em] text-white/50">
                <tr>
                  <th className="px-4 py-3 text-left whitespace-nowrap">Individual</th>
                  <th className="px-4 py-3 text-left whitespace-nowrap">时间</th>
                  <th className="px-4 py-3 text-left whitespace-nowrap">订单 ID</th>
                  <th className="px-4 py-3 text-left whitespace-nowrap">礼物</th>
                  <th className="px-4 py-3 text-left whitespace-nowrap">数量</th>
                  <th className="px-4 py-3 text-left whitespace-nowrap">单价</th>
                  <th className="px-4 py-3 text-left whitespace-nowrap">总额</th>
                  <th className="px-4 py-3 text-left whitespace-nowrap">应付</th>
                  <th className="px-4 py-3 text-left whitespace-nowrap">手续费</th>
                  <th className="px-4 py-3 text-left whitespace-nowrap">净额</th>
                  <th className="px-4 py-3 text-left whitespace-nowrap">分成比例</th>
                  <th className="px-4 py-3 text-left whitespace-nowrap">心动值</th>
                  <th className="px-4 py-3 text-left whitespace-nowrap">赠送人</th>
                  <th className="px-4 py-3 text-left whitespace-nowrap">收礼人</th>
                  <th className="px-4 py-3 text-left whitespace-nowrap">券 IDs</th>
                  
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {records.length === 0 && (
                  <tr>
                    <td className="px-4 py-6 text-white/60" colSpan={15}>
                      暂无记录。
                    </td>
                  </tr>
                )}
                {records.map((record) => (
                  <tr key={record.individualTransactionId} className="align-top">
                    <td className="px-4 py-3 font-mono text-xs text-white/80 whitespace-pre-wrap break-all">
                      {record.individualTransactionId}
                    </td>
                    <td className="px-4 py-3 text-white/70 whitespace-nowrap">{formatDate(record.createdAt)}</td>
                    <td className="px-4 py-3 font-mono text-xs text-white/80 whitespace-pre-wrap break-all">
                      {record.orderId}
                    </td>
                    <td className="px-4 py-3 text-white/90">{record.giftName}</td>
                    <td className="px-4 py-3">{formatNumber(record.quantity, 4)}</td>
                    <td className="px-4 py-3">{formatNumber(record.unitPrice, 4)}</td>
                    <td className="px-4 py-3">{formatNumber(record.gross, 4)}</td>
                    <td className="px-4 py-3">{formatNumber(record.payable, 4)}</td>
                    <td className="px-4 py-3">{formatNumber(record.feeAmount, 4)}</td>
                    <td className="px-4 py-3">{formatNumber(record.netAmount, 4)}</td>
                    <td className="px-4 py-3">{formatNumber(record.receiverRate, 4)}</td>
                    <td className="px-4 py-3">{formatNumber(record.heartGain, 0)}</td>
                    <td className="px-4 py-3 font-mono text-xs text-white/80 whitespace-pre-wrap break-all">
                      {record.giverId}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-white/80 whitespace-pre-wrap break-all">
                      {record.receiverId}
                    </td>
                    <td className="px-4 py-3 text-white/80 whitespace-pre-wrap break-all">
                      {formatVoucher(record.voucherIds)}
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
                href={`/admin/refundable-gifts?page=${prevPage}`}
                className={`rounded-full border px-4 py-2 text-xs uppercase tracking-[0.4em] ${
                  hasPrev ? 'border-white/20 text-white hover:bg-white/10' : 'border-white/10 text-white/40 pointer-events-none'
                }`}
                aria-disabled={!hasPrev}
              >
                上一页
              </Link>
              <Link
                href={`/admin/refundable-gifts?page=${nextPage}`}
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
