'use client';

import { convertCentralEuropeanInputToUtcInput } from '@/lib/centralEuropeanDateRange';

type RevenueTimeRangeActionsProps = {
  fallbackStartUtcValue: string;
  fallbackEndUtcValue: string;
};

const readInputValue = (id: string) => {
  if (typeof document === 'undefined') return '';
  const element = document.getElementById(id);
  return element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement ? element.value.trim() : '';
};

const buildTargetHref = (
  pathname: string,
  fallbackStartUtcValue: string,
  fallbackEndUtcValue: string
) => {
  const params = new URLSearchParams();
  const startUtcValue =
    convertCentralEuropeanInputToUtcInput(readInputValue('admin-revenue-startDate')) ?? fallbackStartUtcValue;
  const endUtcValue =
    convertCentralEuropeanInputToUtcInput(readInputValue('admin-revenue-endDate')) ?? fallbackEndUtcValue;
  const excludeRecharge = readInputValue('admin-revenue-excludeRecharge');
  const excludeMember = readInputValue('admin-revenue-excludeMember');

  if (startUtcValue) params.set('startDate', startUtcValue);
  if (endUtcValue) params.set('endDate', endUtcValue);
  if (excludeRecharge) params.set('excludeRecharge', excludeRecharge);
  if (excludeMember) params.set('excludeMember', excludeMember);

  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
};

export function RevenueTimeRangeActions({
  fallbackStartUtcValue,
  fallbackEndUtcValue,
}: RevenueTimeRangeActionsProps) {
  const openTarget = (pathname: string) => {
    window.location.assign(buildTargetHref(pathname, fallbackStartUtcValue, fallbackEndUtcValue));
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={() => openTarget('/api/admin/revenue/export')}
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
        onClick={() => openTarget('/admin/revenue/charts')}
        className="inline-flex items-center justify-center rounded-full border border-white/20 px-6 py-2 text-sm text-white hover:bg-white/10"
      >
        查看表格
      </button>
    </div>
  );
}
