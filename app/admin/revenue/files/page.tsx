import Link from 'next/link';
import { redirect } from 'next/navigation';
import { canViewRevenue } from '@/lib/admin';
import { listStoredMonthlyReportFiles } from '@/lib/admin/monthly-financial-reports';
import { getCentralEuropeanMonthParts } from '@/lib/centralEuropeanDateRange';
import { prisma } from '@/lib/prisma';
import { getServerSession } from '@/lib/session';

export const metadata = {
  title: '收益文件',
};

export const dynamic = 'force-dynamic';

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const monthLabel = (month: number) => `${month} 月`;

const isMonthKey = (value: string) => /^\d{4}-(0[1-9]|1[0-2])$/.test(value);

export default async function AdminRevenueFilesPage({ searchParams }: PageProps) {
  const session = await getServerSession();
  if (!session?.discordId || !canViewRevenue(session.discordId)) {
    redirect('/');
  }

  const params = (await searchParams) ?? {};
  const requestedYearRaw = Array.isArray(params.year) ? params.year[0] : params.year;
  const requestedYear = requestedYearRaw && /^\d{4}$/.test(requestedYearRaw) ? Number(requestedYearRaw) : null;
  const generatedMonth = Array.isArray(params.generated) ? params.generated[0] : params.generated;
  const now = getCentralEuropeanMonthParts(new Date());
  const [files, manualExpenseMonths] = await Promise.all([
    listStoredMonthlyReportFiles(),
    prisma.monthlyManualExpense.groupBy({
      by: ['monthKey'],
      _count: { id: true },
    }),
  ]);
  const storedFileCountByMonth = new Map<string, number>();
  for (const file of files) {
    if (isMonthKey(file.monthKey)) {
      storedFileCountByMonth.set(file.monthKey, (storedFileCountByMonth.get(file.monthKey) ?? 0) + 1);
    }
  }
  const manualCountByMonth = new Map(manualExpenseMonths.map((row) => [row.monthKey, row._count.id]));
  const years = Array.from(
    new Set([
      now.year,
      ...Array.from(storedFileCountByMonth.keys()).map((monthKey) => Number(monthKey.slice(0, 4))),
      ...manualExpenseMonths.filter((row) => isMonthKey(row.monthKey)).map((row) => Number(row.monthKey.slice(0, 4))),
    ]),
  ).sort((left, right) => right - left);
  const selectedYear = requestedYear && years.includes(requestedYear) ? requestedYear : years[0] ?? now.year;

  return (
    <div className="space-y-8 text-white">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.6em] text-white/60">ADMIN</p>
          <h2 className="text-2xl font-semibold">收益文件</h2>
          <p className="mt-2 text-sm text-white/60">按年度选择月份，查看该月的利润表、资产负债表和人工支出明细。</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/admin/revenue"
            className="inline-flex items-center justify-center rounded-full border border-white/20 px-5 py-2 text-sm text-white hover:bg-white/10"
          >
            返回查看收益
          </Link>
          <Link
            href="/admin"
            className="inline-flex items-center justify-center rounded-full border border-white/20 px-5 py-2 text-sm text-white hover:bg-white/10"
          >
            返回管理首页
          </Link>
        </div>
      </div>

      {generatedMonth ? (
        <p className="rounded-2xl border border-emerald-300/30 bg-emerald-300/10 px-4 py-3 text-sm text-emerald-100">
          {isMonthKey(generatedMonth) ? `${generatedMonth} 的报表已重新生成。` : '上一个月的报表已生成。'}
        </p>
      ) : null}

      <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
        <h3 className="text-lg font-semibold">选择年度</h3>
        <div className="mt-4 flex flex-wrap gap-2">
          {years.map((year) => (
            <Link
              key={year}
              href={`/admin/revenue/files?year=${year}`}
              className={`rounded-full border px-5 py-2 text-sm transition ${
                year === selectedYear
                  ? 'border-white bg-white text-black'
                  : 'border-white/20 text-white hover:bg-white/10'
              }`}
            >
              {year} 年
            </Link>
          ))}
        </div>
      </div>

      <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold">{selectedYear} 年月份</h3>
            <p className="mt-1 text-sm text-white/60">点击月份进入报表；每次导出的 Excel 都会按当前数据生成。</p>
          </div>
          <form action="/api/admin/revenue/files/generate" method="post" className="flex flex-wrap items-center gap-2">
            <input
              type="month"
              name="month"
              defaultValue={`${selectedYear}-${String(Math.min(now.month, 12)).padStart(2, '0')}`}
              className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
            />
            <input type="hidden" name="force" value="1" />
            <button
              type="submit"
              className="rounded-full border border-white/20 px-4 py-2 text-sm text-white hover:bg-white/10"
            >
              重新生成文件
            </button>
          </form>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {Array.from({ length: 12 }, (_, index) => {
            const month = index + 1;
            const monthKey = `${selectedYear}-${String(month).padStart(2, '0')}`;
            const isFuture = selectedYear > now.year || (selectedYear === now.year && month > now.month);
            const fileCount = storedFileCountByMonth.get(monthKey) ?? 0;
            const manualCount = manualCountByMonth.get(monthKey) ?? 0;
            if (isFuture) {
              return (
                <div key={monthKey} className="rounded-2xl border border-white/5 px-4 py-4 text-center text-sm text-white/25">
                  {monthLabel(month)}
                </div>
              );
            }
            return (
              <Link
                key={monthKey}
                href={`/admin/revenue/files/${monthKey}`}
                className="rounded-2xl border border-white/15 bg-black/10 px-4 py-4 text-center transition hover:border-white/40 hover:bg-white/10"
              >
                <span className="block font-medium text-white">{monthLabel(month)}</span>
                <span className="mt-1 block text-xs text-white/55">
                  {fileCount ? `${fileCount} 个文件` : '实时生成'}
                </span>
                {manualCount ? <span className="mt-1 block text-xs text-amber-200">{manualCount} 笔人工支出</span> : null}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
