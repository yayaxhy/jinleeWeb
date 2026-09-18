import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { canViewRevenue } from '@/lib/admin';
import { getMonthlyFinancialReportPreview, parseMonthlyReportMonthKey } from '@/lib/admin/monthly-financial-reports';
import { getServerSession } from '@/lib/session';
import MonthlyExpenseManager from './MonthlyExpenseManager';

export const dynamic = 'force-dynamic';

type PageProps = {
  params: Promise<{ monthKey: string }>;
};

type ReportRow = {
  item: string;
  amount: string;
  category?: string;
  date?: string;
  note?: string;
  count?: number;
};

const formatMoney = (value: string) =>
  new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY', minimumFractionDigits: 2 }).format(Number(value));

function StatementTable({ rows, totalLabel, total }: { rows: ReportRow[]; totalLabel: string; total: string }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-white/10 text-left text-white/60">
            <th className="py-3 pr-4">项目</th>
            <th className="py-3 pr-4">分类 / 时间</th>
            <th className="py-3 pr-4">备注</th>
            <th className="py-3 text-right">金额</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={`${row.item}-${index}`} className="border-b border-white/10 last:border-0">
              <td className="py-3 pr-4 text-white">{row.item}</td>
              <td className="py-3 pr-4 text-white/60">{row.category || row.date || '—'}</td>
              <td className="py-3 pr-4 text-white/60">{row.note || '—'}{row.count && row.count > 1 ? ` · ${row.count} 笔` : ''}</td>
              <td className="py-3 text-right font-mono text-white">{formatMoney(row.amount)}</td>
            </tr>
          ))}
          <tr className="bg-white/10 font-semibold text-white">
            <td className="px-3 py-3" colSpan={3}>{totalLabel}</td>
            <td className="px-3 py-3 text-right font-mono">{formatMoney(total)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export default async function MonthlyRevenueFilePage({ params }: PageProps) {
  const session = await getServerSession();
  if (!session?.discordId || !canViewRevenue(session.discordId)) redirect('/');

  const { monthKey } = await params;
  if (!parseMonthlyReportMonthKey(monthKey)) notFound();
  const preview = await getMonthlyFinancialReportPreview(monthKey);
  const monthTitle = `${preview.year} 年 ${preview.month} 月`;

  return (
    <div className="space-y-8 text-white">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.6em] text-white/60">MONTHLY FINANCIAL REPORT</p>
          <h2 className="text-2xl font-semibold">{monthTitle}</h2>
          <p className="mt-2 text-sm text-white/60">以下为实时利润表与资产负债表；手工支出保存后会立即纳入计算。</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href={`/api/admin/revenue/files/export?month=${encodeURIComponent(preview.monthKey)}`}
            className="inline-flex items-center justify-center rounded-full bg-white px-5 py-2 text-sm text-black hover:bg-white/85"
          >
            下载 Excel
          </a>
          <Link
            href={`/admin/revenue/files?year=${preview.year}`}
            className="inline-flex items-center justify-center rounded-full border border-white/20 px-5 py-2 text-sm text-white hover:bg-white/10"
          >
            返回月份
          </Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-5"><p className="text-sm text-white/60">收入合计</p><p className="mt-2 text-2xl font-semibold">{formatMoney(preview.incomeTotal)}</p></div>
        <div className="rounded-3xl border border-amber-200/20 bg-amber-100/5 p-5"><p className="text-sm text-white/60">支出合计</p><p className="mt-2 text-2xl font-semibold">{formatMoney(preview.expenseTotal)}</p></div>
        <div className="rounded-3xl border border-emerald-200/20 bg-emerald-100/5 p-5"><p className="text-sm text-white/60">净利润</p><p className="mt-2 text-2xl font-semibold">{formatMoney(preview.netProfit)}</p></div>
      </div>

      <section className="space-y-5 rounded-3xl border border-white/10 bg-white/5 p-5">
        <h3 className="text-lg font-semibold">利润表</h3>
        <div><p className="mb-3 text-sm text-white/60">收入</p><StatementTable rows={preview.incomeRows} totalLabel="收入合计" total={preview.incomeTotal} /></div>
        <div><p className="mb-3 text-sm text-white/60">支出</p><StatementTable rows={preview.expenseRows} totalLabel="支出合计" total={preview.expenseTotal} /></div>
        <div className="flex justify-end rounded-2xl bg-white/10 px-4 py-3 text-sm"><span className="text-white/70">净利润</span><span className="ml-6 font-mono font-semibold">{formatMoney(preview.netProfit)}</span></div>
      </section>

      <section className="space-y-5 rounded-3xl border border-white/10 bg-white/5 p-5">
        <h3 className="text-lg font-semibold">资产负债表</h3>
        <div><p className="mb-3 text-sm text-white/60">资产</p><StatementTable rows={preview.assetRows} totalLabel="资产总计（总现金）" total={preview.assetTotal} /></div>
        <div><p className="mb-3 text-sm text-white/60">负债</p><StatementTable rows={preview.liabilityRows} totalLabel="负债合计" total={preview.liabilityTotal} /></div>
        <div><p className="mb-3 text-sm text-white/60">所有者权益</p><StatementTable rows={preview.equityRows} totalLabel="所有者权益合计" total={preview.equityTotal} /></div>
        <div className="flex justify-end rounded-2xl bg-white/10 px-4 py-3 text-sm"><span className="text-white/70">负债和所有者权益总计</span><span className="ml-6 font-mono font-semibold">{formatMoney(preview.liabilityAndEquityTotal)}</span></div>
      </section>

      <MonthlyExpenseManager monthKey={preview.monthKey} records={preview.manualExpenses} />
    </div>
  );
}
