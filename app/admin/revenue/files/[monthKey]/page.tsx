import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Prisma } from '@prisma/client';
import { canViewRevenue } from '@/lib/admin';
import { getDividendLedgerState, getMonthlyFinancialReportPreview, parseMonthlyReportMonthKey } from '@/lib/admin/monthly-financial-reports';
import { formatCentralEuropeanMonthKey, getCentralEuropeanMonthParts } from '@/lib/centralEuropeanDateRange';
import { getServerSession } from '@/lib/session';
import { isNewEntityReportMonth } from '@/lib/operating-entity-cutover';
import MonthlyExpenseManager from './MonthlyExpenseManager';
import ConfirmMonthlyReportButton from './ConfirmMonthlyReportButton';
import MonthlyDividendManager from './MonthlyDividendManager';

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
  if (!parseMonthlyReportMonthKey(monthKey) || !isNewEntityReportMonth(monthKey)) notFound();
  const [preview, dividendLedger] = await Promise.all([
    getMonthlyFinancialReportPreview(monthKey), getDividendLedgerState(monthKey),
  ]);
  const currentParts = getCentralEuropeanMonthParts(new Date());
  const isCurrentMonth = monthKey === formatCentralEuropeanMonthKey(currentParts.year, currentParts.month);
  const monthTitle = `${preview.year} 年 ${preview.month} 月`;
  const legacyBalanceSheet = !('reconciliationDifference' in preview);
  const balanceDifference = new Prisma.Decimal(preview.assetTotal).sub(preview.liabilityAndEquityTotal).toString();

  return (
    <div className="space-y-8 text-white">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.6em] text-white/60">MONTHLY FINANCIAL REPORT</p>
          <h2 className="text-2xl font-semibold">{monthTitle}</h2>
          <p className="mt-2 text-sm text-white/60">
            {preview.confirmedAt
              ? `已于 ${new Date(preview.confirmedAt).toLocaleString('zh-CN', { timeZone: 'Europe/Rome' })} 确认；财报数字与 Excel 已固定。`
              : '以下为未确认的实时利润表与资产负债表；手工支出保存后会立即纳入计算。'}
          </p>
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

      {!preview.confirmedAt && parseMonthlyReportMonthKey(preview.monthKey)!.end <= new Date() ? (
        <ConfirmMonthlyReportButton monthKey={preview.monthKey} />
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-5"><p className="text-sm text-white/60">收入合计</p><p className="mt-2 text-2xl font-semibold">{formatMoney(preview.incomeTotal)}</p></div>
        <div className="rounded-3xl border border-amber-200/20 bg-amber-100/5 p-5"><p className="text-sm text-white/60">支出合计</p><p className="mt-2 text-2xl font-semibold">{formatMoney(preview.expenseTotal)}</p></div>
        <div className="rounded-3xl border border-emerald-200/20 bg-emerald-100/5 p-5"><p className="text-sm text-white/60">净利润</p><p className="mt-2 text-2xl font-semibold">{formatMoney(preview.netProfit)}</p></div>
      </div>

      <section className="space-y-3 rounded-3xl border border-sky-200/20 bg-sky-100/5 p-5">
        <h3 className="text-lg font-semibold">现金收支核对（不等于业务利润）</h3>
        <div className="grid gap-3 text-sm md:grid-cols-4">
          <p>期初银行余额：<span className="font-mono">{formatMoney(preview.cashFlow.openingBankBalance)}</span></p>
          <p>充值现金流入：<span className="font-mono">{formatMoney(preview.cashFlow.rechargeInflow)}</span></p>
          <p>提现现金流出：<span className="font-mono">{formatMoney(preview.cashFlow.withdrawalOutflow)}</span></p>
          <p>人工记录现金支出：<span className="font-mono">{formatMoney(preview.cashFlow.manualExpenseOutflow)}</span></p>
          <p>已支付股东分红：<span className="font-mono">{formatMoney(preview.cashFlow.dividendPaymentOutflow ?? '0')}</span></p>
          <p>本期已记录现金净流入：<span className="font-mono">{formatMoney(preview.cashFlow.netRecordedCashMovement)}</span></p>
          <p>期末账面银行余额（待核对）：<span className="font-mono">{formatMoney(preview.cashFlow.estimatedClosingBankBalance)}</span></p>
          <p>前期支出调整（非本月现金）：<span className="font-mono">{formatMoney(preview.cashFlow.priorPeriodExpenseAdjustment)}</span></p>
          <p>负数充值待核对：<span className="font-mono">{formatMoney(preview.cashFlow.negativeRechargePendingReview)}</span></p>
        </div>
        <p className="text-xs text-white/50">新主体 2026 年 9 月 25 日银行期初为 ¥0；以后月份从已记录收支逐月结转。预存余额购买抽奖或服务不产生新的银行入账；负数充值需确认是实际退款还是钱包扣款。补记旧月的支出不自动视作本月银行付款；Stripe 手续费由人工支出记录。账面结余并非银行对账单余额。</p>
      </section>

      {preview.walletReconciliation ? (
        <section className="space-y-3 rounded-3xl border border-emerald-200/20 bg-emerald-100/5 p-5">
          <h3 className="text-lg font-semibold">已确认钱包余额核对</h3>
          <div className="grid gap-3 text-sm md:grid-cols-3">
            <p>期初用户余额：<span className="font-mono">{formatMoney(preview.walletReconciliation.openingBalance)}</span></p>
            <p>期末用户余额：<span className="font-mono">{formatMoney(preview.walletReconciliation.closingBalance)}</span></p>
            <p>本期净变动：<span className="font-mono">{formatMoney(preview.walletReconciliation.netMovement)}</span></p>
          </div>
          <p className="text-xs text-white/50">净变动包括充值、提现、消费、奖励、返利和冲回等钱包流水；确认前已校验流水连续性。</p>
          <div className="grid gap-x-6 gap-y-1 text-xs text-white/60 md:grid-cols-3">
            {preview.walletReconciliation.movements.map((row) => (
              <p key={row.type}>{row.type}（{row.count} 笔）：<span className="font-mono">{formatMoney(row.amount)}</span></p>
            ))}
          </div>
        </section>
      ) : null}

      <section className="space-y-5 rounded-3xl border border-white/10 bg-white/5 p-5">
        <h3 className="text-lg font-semibold">利润表</h3>
        <div><p className="mb-3 text-sm text-white/60">收入</p><StatementTable rows={preview.incomeRows} totalLabel="收入合计" total={preview.incomeTotal} /></div>
        <div><p className="mb-3 text-sm text-white/60">支出</p><StatementTable rows={preview.expenseRows} totalLabel="支出合计" total={preview.expenseTotal} /></div>
        <div className="flex justify-end rounded-2xl bg-white/10 px-4 py-3 text-sm"><span className="text-white/70">当月盈亏</span><span className="ml-6 font-mono font-semibold">{formatMoney(preview.netProfit)}</span></div>
      </section>

      <section className="space-y-5 rounded-3xl border border-white/10 bg-white/5 p-5">
        <h3 className="text-lg font-semibold">资产负债表（待核对）</h3>
        <p className="text-sm text-amber-200/80">{legacyBalanceSheet
          ? '这是已确认的旧版报表，仍采用旧的资产及分红推算口径；代码更新不会改写已确认文件。'
          : '当月盈亏列入所有者权益，不自动视为分红。资产中的银行余额仅按已记录现金收支推算，须与实际银行流水及用户余额承担范围核对；差额不会自动配平。'}</p>
        <div><p className="mb-3 text-sm text-white/60">资产</p><StatementTable rows={preview.assetRows} totalLabel={legacyBalanceSheet ? '资产合计（旧模型推算）' : '资产合计（待核对）'} total={preview.assetTotal} /></div>
        <div><p className="mb-3 text-sm text-white/60">负债</p><StatementTable rows={preview.liabilityRows} totalLabel="负债合计" total={preview.liabilityTotal} /></div>
        <div><p className="mb-3 text-sm text-white/60">所有者权益</p><StatementTable rows={preview.equityRows} totalLabel="所有者权益合计" total={preview.equityTotal} /></div>
        <div className="flex justify-end rounded-2xl bg-white/10 px-4 py-3 text-sm"><span className="text-white/70">负债和所有者权益总计</span><span className="ml-6 font-mono font-semibold">{formatMoney(preview.liabilityAndEquityTotal)}</span></div>
        {!legacyBalanceSheet ? <div className="flex justify-end rounded-2xl border border-amber-300/30 bg-amber-300/5 px-4 py-3 text-sm"><span className="text-amber-100">资产减负债和所有者权益（待核对）</span><span className="ml-6 font-mono font-semibold text-amber-100">{formatMoney(balanceDifference)}</span></div> : null}
      </section>

      <MonthlyDividendManager
        monthKey={monthKey}
        confirmed={Boolean(preview.confirmedAt)}
        isCurrentMonth={isCurrentMonth}
        decisions={dividendLedger.decisions.map((row) => ({ id: row.id, amount: row.amount.toString(), note: row.note, operatorId: row.operatorId, at: row.createdAt.toISOString(), sourceMonthKey: row.sourceMonthKey }))}
        payments={dividendLedger.payments.map((row) => ({ id: row.id, amount: row.amount.toString(), note: row.note, operatorId: row.operatorId, at: row.paidAt.toISOString() }))}
        payable={dividendLedger.payableAtMonthEnd.toString()}
      />

      <MonthlyExpenseManager monthKey={preview.monthKey} records={preview.manualExpenses} confirmed={Boolean(preview.confirmedAt)} />
    </div>
  );
}
