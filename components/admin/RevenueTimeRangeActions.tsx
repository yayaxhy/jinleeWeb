'use client';

type RevenueTimeRangeActionsProps = {
  fallbackStartValue: string;
  fallbackEndValue: string;
};

const readInputValue = (id: string) => {
  if (typeof document === 'undefined') return '';
  const element = document.getElementById(id);
  return element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement ? element.value.trim() : '';
};

const buildTargetHref = (pathname: string, fallbackStartValue: string, fallbackEndValue: string) => {
  const params = new URLSearchParams();
  const startValue = readInputValue('admin-revenue-startDate') || fallbackStartValue;
  const endValue = readInputValue('admin-revenue-endDate') || fallbackEndValue;
  const excludeRecharge = readInputValue('admin-revenue-excludeRecharge');
  const excludeMember = readInputValue('admin-revenue-excludeMember');

  if (startValue) params.set('startDate', startValue);
  if (endValue) params.set('endDate', endValue);
  if (excludeRecharge) params.set('excludeRecharge', excludeRecharge);
  if (excludeMember) params.set('excludeMember', excludeMember);

  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
};

export function RevenueTimeRangeActions({
  fallbackStartValue,
  fallbackEndValue,
}: RevenueTimeRangeActionsProps) {
  const openExport = () => {
    window.location.assign(buildTargetHref('/api/admin/revenue/export', fallbackStartValue, fallbackEndValue));
  };
  const openCharts = () => {
    window.location.assign(buildTargetHref('/admin/revenue/charts', fallbackStartValue, fallbackEndValue));
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={openExport}
        className="inline-flex items-center justify-center rounded-full border border-white/20 px-6 py-2 text-sm text-white hover:bg-white/10"
      >
        下载 Excel（全部收益数据）
      </button>
      <button
        type="submit"
        className="inline-flex items-center justify-center rounded-full bg-white/15 px-6 py-2 text-sm text-white hover:bg-white/25"
      >
        刷新数据
      </button>
      <button
        type="button"
        onClick={openCharts}
        className="inline-flex items-center justify-center rounded-full border border-white/20 px-6 py-2 text-sm text-white hover:bg-white/10"
      >
        查看表格
      </button>
    </div>
  );
}
